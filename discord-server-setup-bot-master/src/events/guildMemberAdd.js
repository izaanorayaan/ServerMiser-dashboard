const { Events, EmbedBuilder } = require('discord.js');
const { readData } = require('../utils/database');
const mongoose = require('mongoose');

function resolveMessage(template, member, guild) {
  return template
    .replace(/{user}/g, `${member}`)
    .replace(/{server}/g, guild.name)
    .replace(/{memberCount}/g, guild.memberCount);
}

module.exports = {
  name: Events.GuildMemberAdd,
  once: false,
  async execute(member, client) {
    try {
      const guild = member.guild;

      // ── Automated Role Assignment ────────────────────────────────
      const AutoRole = mongoose.models.AutoRole;
      if (AutoRole) {
        const config = await AutoRole.findOne({ guildId: guild.id });
        if (config) {
          const rolesToAssign = [];
          if (config.allRole && guild.roles.cache.has(config.allRole))
            rolesToAssign.push(config.allRole);
          if (member.user.bot) {
            if (config.botRole && guild.roles.cache.has(config.botRole))
              rolesToAssign.push(config.botRole);
          } else {
            if (config.humanRole && guild.roles.cache.has(config.humanRole))
              rolesToAssign.push(config.humanRole);
          }
          if (rolesToAssign.length > 0) {
            await member.roles.add(rolesToAssign).catch(err =>
              console.error(`[AutoRole] Missing permissions in guild ${guild.id}:`, err.message)
            );
          }
        }
      }

      // ── Welcome Message ──────────────────────────────────────────
      const settings = (await readData('settings.json')) || {};
      const serverSettings = settings[guild.id] || {};
      if (serverSettings.welcomeEnabled !== false) {
        const channelId = serverSettings.welcomeChannelId;
        if (channelId) {
          // Cache first, fall back to a live fetch (cache can be empty
          // right after a Render restart / cold start).
          const targetChannel =
            guild.channels.cache.get(channelId) ||
            (await guild.channels.fetch(channelId).catch(() => null));
          if (targetChannel) {
            const template = serverSettings.joinMessage || '✨ Welcome to {server}, {user}! We are glad to have you here. ✨';
            const finalMessage = resolveMessage(template, member, guild);
            if (serverSettings.welcomeEmbed !== false) {
              const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setTitle('✨ Welcome! ✨')
                .setDescription(finalMessage)
                .setThumbnail(member.user.displayAvatarURL({ size: 128 }))
                .setFooter({ text: `Member Count: ${guild.memberCount}` })
                .setTimestamp();
              await targetChannel.send({ embeds: [embed] }).catch(() => null);
            } else {
              await targetChannel.send(finalMessage).catch(() => null);
            }
          } else {
            console.warn(`[GuildMemberAdd] Configured welcome channel ${channelId} not found in guild ${guild.id}`);
          }
        }
      }

      // ── Invite Tracking ──────────────────────────────────────────
      const invitesCmd = client?.commands?.get('invites');
      if (invitesCmd?.handleMemberJoin) {
        await invitesCmd.handleMemberJoin(member, client).catch(() => null);
      }

    } catch (error) {
      console.error('[GuildMemberAdd] Error:', error.message);
    }
  },
};