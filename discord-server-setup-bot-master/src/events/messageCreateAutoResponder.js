const { Events, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const { parseVariables } = require('../utils/autoResponderVars.js');

// Per-user, per-responder cooldown store: key `${responderId}-${userId}` -> timestamp
const cooldowns = new Map();

/**
 * Escape a string for safe use inside a RegExp.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Decide whether a message matches a responder's trigger.
 */
function matches(responder, content) {
  const trigger = responder.caseSensitive ? responder.trigger : responder.trigger.toLowerCase();
  const text = responder.caseSensitive ? content : content.toLowerCase();
  if (!trigger) return false;

  switch (responder.matchType) {
    case 'exact':
      return text.trim() === trigger.trim();
    case 'startswith':
      return text.startsWith(trigger);
    case 'endswith':
      return text.endsWith(trigger);
    case 'wildcard': {
      // Convert * to .* and match the whole string
      const pattern = '^' + trigger.split('*').map(escapeRegex).join('.*') + '$';
      try { return new RegExp(pattern, responder.caseSensitive ? '' : 'i').test(text); }
      catch { return false; }
    }
    case 'regex':
      try { return new RegExp(responder.trigger, responder.caseSensitive ? '' : 'i').test(content); }
      catch { return false; }
    case 'contains':
    default:
      return text.includes(trigger);
  }
}

module.exports = {
  name: Events.MessageCreate,
  once: false,
  async execute(message, client) {
    try {
      if (!message || !message.author || message.author.bot || message.webhookId || !message.guild) return;
      if (!message.content) return;

      // Never let the bot's prefix commands double as responder triggers.
      const prefix = (client && client.prefix) || message.client?.prefix || '|';
      if (message.content.startsWith(prefix)) return;

      const AutoResponder = mongoose.models.AutoResponder;
      if (!AutoResponder) return; // command file not loaded / model not registered yet

      const config = await AutoResponder.findOne({ guildId: message.guild.id });
      if (!config || !config.enabled || !config.responders?.length) return;

      const content = message.content;

      for (const responder of config.responders) {
        if (!responder.enabled) continue;
        if (!matches(responder, content)) continue;

        // Channel allow / ignore lists
        if (responder.allowedChannels?.length && !responder.allowedChannels.includes(message.channel.id)) continue;
        if (responder.ignoredChannels?.length && responder.ignoredChannels.includes(message.channel.id)) continue;

        // Required role gate
        if (responder.requiredRole && !message.member?.roles.cache.has(responder.requiredRole)) continue;

        // Chance roll
        if (responder.chance < 100 && Math.random() * 100 > responder.chance) continue;

        // Per-user cooldown
        if (responder.cooldown > 0) {
          const ckey = `${responder.id}-${message.author.id}`;
          const last = cooldowns.get(ckey) || 0;
          if (Date.now() - last < responder.cooldown * 1000) continue;
          cooldowns.set(ckey, Date.now());
        }

        // Build response text
        const template = responder.responses[Math.floor(Math.random() * responder.responses.length)] || '';
        const rendered = parseVariables(template, message, { trigger: responder.trigger });

        // Optionally delete the trigger message
        if (responder.deleteTrigger) {
          await message.delete().catch(() => null);
        }

        // Auto reactions
        if (responder.reactions?.length) {
          for (const emoji of responder.reactions) {
            await message.react(emoji).catch(() => null);
          }
        }

        // Deliver
        if (rendered) {
          const payload = responder.useEmbed
            ? { embeds: [new EmbedBuilder().setColor(responder.embedColor || '#5865F2').setTitle(responder.embedTitle || null).setDescription(rendered)] }
            : { content: rendered };

          if (responder.replyMode === 'dm') {
            await message.author.send(payload).catch(() => null);
          } else if (responder.replyMode === 'channel' || responder.deleteTrigger) {
            await message.channel.send(payload).catch(() => null);
          } else {
            await message.reply(payload).catch(() => message.channel.send(payload).catch(() => null));
          }
        }

        // Track usage (fire-and-forget; avoids blocking the loop)
        responder.uses = (responder.uses || 0) + 1;
        config.markModified('responders');
        config.save().catch(() => null);

        // Only fire the first matching responder per message to avoid spam.
        break;
      }
    } catch (err) {
      console.error('[AutoResponder event error]:', err.message);
    }
  },
};
