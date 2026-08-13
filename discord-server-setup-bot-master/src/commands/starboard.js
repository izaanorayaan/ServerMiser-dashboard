'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelType,
} = require('discord.js');
const mongoose = require('mongoose');

// ─── Schemas ────────────────────────────────────────────────────────────────

const starboardConfigSchema = new mongoose.Schema({
  guildId:         { type: String, required: true, unique: true },
  channelId:       { type: String, default: null },
  emoji:           { type: String, default: '⭐' },
  threshold:       { type: Number, default: 3 },
  selfStar:        { type: Boolean, default: false },
  botStars:        { type: Boolean, default: false },
  ignoredChannels: { type: [String], default: [] },
  color:           { type: String, default: '#FFD700' },
  enabled:         { type: Boolean, default: true },
  maxAgeDays:      { type: Number, default: 0 },
});

const starboardEntrySchema = new mongoose.Schema({
  guildId:           { type: String, required: true },
  originalMsgId:     { type: String, required: true, unique: true },
  originalChannelId: { type: String, required: true },
  starboardMsgId:    { type: String, default: null },
  authorId:          { type: String, required: true },
  count:             { type: Number, default: 0 },
  starredAt:         { type: Date, default: Date.now },
});

const StarboardConfig = mongoose.models.StarboardConfig
  || mongoose.model('StarboardConfig', starboardConfigSchema);

const StarboardEntry = mongoose.models.StarboardEntry
  || mongoose.model('StarboardEntry', starboardEntrySchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildStarboardEmbed(message, count, config) {
  const author = message.author;
  const channel = message.channel;
  const content = message.content ? message.content.slice(0, 1024) : null;
  const imageAttachment = message.attachments.find(
    a => a.contentType && a.contentType.startsWith('image/')
  );

  const embed = new EmbedBuilder()
    .setColor(config.color || '#FFD700')
    .setAuthor({
      name: author.tag,
      iconURL: author.displayAvatarURL({ dynamic: true }),
    })
    .setFooter({
      text: `${config.emoji} ${count} · #${channel.name} · ${message.id}`,
    })
    .setTimestamp(message.createdAt);

  if (content) embed.setDescription(content);
  if (imageAttachment) embed.setImage(imageAttachment.url);

  return embed;
}

function buildJumpRow(message) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Jump to Message')
      .setStyle(ButtonStyle.Link)
      .setURL(message.url)
  );
}

async function getOrCreateConfig(guildId) {
  let config = await StarboardConfig.findOne({ guildId });
  if (!config) {
    config = await StarboardConfig.create({ guildId });
  }
  return config;
}

function isEmojiMatch(reaction, configEmoji) {
  const name = reaction.emoji.name;
  const id = reaction.emoji.id;
  if (id) return `<:${name}:${id}>` === configEmoji || id === configEmoji;
  return name === configEmoji;
}

// In-memory wizard sessions: `${userId}_${guildId}` → { channelId, emoji, threshold }
const wizardSessions = new Map();

// ─── Subcommand Handlers ─────────────────────────────────────────────────────

async function handleSetup(interaction) {
  // Allow direct set via prefix or slash with an argument
  const direct = interaction.options?.getChannel?.('channel');
  if (direct) {
    const config = await getOrCreateConfig(interaction.guildId);
    config.channelId = direct.id;
    config.enabled = true;
    await config.save();
    return interaction.reply({ content: `✅ Starboard channel set to ${direct}.`, ephemeral: true });
  }

  // Wizard — step 1: pick channel
  const channels = interaction.guild.channels.cache
    .filter(c => c.type === ChannelType.GuildText)
    .first(24);

  if (!channels.length) {
    return interaction.reply({ content: '❌ No text channels found.', ephemeral: true });
  }

  wizardSessions.set(`${interaction.user.id}_${interaction.guildId}`, {});

  const embed = new EmbedBuilder()
    .setTitle('⭐ Starboard Setup — Step 1 / 4')
    .setColor('#FFD700')
    .setDescription('Select the **channel** where starred messages will be posted.\n\nTip: you can also run `/starboard setup #channel` to skip the wizard.');

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('starboard_wizard_ch')
      .setPlaceholder('Choose a text channel...')
      .addOptions(
        channels.map(c => ({
          label: `#${c.name}`.slice(0, 90),
          value: c.id,
          description: (c.topic || 'Text channel').slice(0, 90),
        }))
      )
  );

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleConfig(interaction) {
  const setting = interaction.options.getString('setting');
  const value   = interaction.options.getString('value');
  const config  = await getOrCreateConfig(interaction.guildId);

  switch (setting) {
    case 'emoji':
      config.emoji = value;
      break;

    case 'threshold': {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        return interaction.reply({ content: '❌ Threshold must be a positive integer.', ephemeral: true });
      }
      config.threshold = num;
      break;
    }

    case 'color':
      if (!/^#[0-9A-Fa-f]{6}$/.test(value)) {
        return interaction.reply({ content: '❌ Color must be a valid hex code (e.g. `#FFD700`).', ephemeral: true });
      }
      config.color = value;
      break;

    case 'self-star':
      config.selfStar = value.toLowerCase() === 'true' || value === '1';
      break;

    case 'bot-stars':
      config.botStars = value.toLowerCase() === 'true' || value === '1';
      break;

    case 'max-age': {
      const days = parseInt(value, 10);
      if (isNaN(days) || days < 0) {
        return interaction.reply({ content: '❌ Max-age must be 0 (disabled) or a positive number of days.', ephemeral: true });
      }
      config.maxAgeDays = days;
      break;
    }

    default:
      return interaction.reply({ content: '❌ Unknown setting.', ephemeral: true });
  }

  await config.save();
  return interaction.reply({
    content: `✅ **${setting}** has been updated to \`${value}\`.`,
    ephemeral: true,
  });
}

async function handleIgnore(interaction) {
  const channel = interaction.options.getChannel('channel');
  const config  = await getOrCreateConfig(interaction.guildId);

  if (config.ignoredChannels.includes(channel.id)) {
    return interaction.reply({ content: `⚠️ ${channel} is already ignored.`, ephemeral: true });
  }

  config.ignoredChannels.push(channel.id);
  await config.save();

  return interaction.reply({ content: `✅ ${channel} added to the ignore list.`, ephemeral: true });
}

async function handleUnignore(interaction) {
  const channel = interaction.options.getChannel('channel');
  const config  = await getOrCreateConfig(interaction.guildId);

  const idx = config.ignoredChannels.indexOf(channel.id);
  if (idx === -1) {
    return interaction.reply({ content: `⚠️ ${channel} is not in the ignore list.`, ephemeral: true });
  }

  config.ignoredChannels.splice(idx, 1);
  await config.save();

  return interaction.reply({ content: `✅ ${channel} removed from the ignore list.`, ephemeral: true });
}

async function handleToggle(interaction) {
  const config = await getOrCreateConfig(interaction.guildId);
  config.enabled = !config.enabled;
  await config.save();

  return interaction.reply({
    content: `✅ Starboard is now **${config.enabled ? 'enabled' : 'disabled'}**.`,
    ephemeral: true,
  });
}

async function handleForce(interaction, client) {
  const messageId = interaction.options.getString('message_id');
  await interaction.deferReply({ ephemeral: true });

  const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    return interaction.editReply({ content: '❌ Could not find that message in this channel.' });
  }

  const config = await StarboardConfig.findOne({ guildId: interaction.guildId });
  if (!config || !config.channelId) {
    return interaction.editReply({ content: '❌ Starboard channel is not configured.' });
  }

  const starboardChannel = await client.channels.fetch(config.channelId).catch(() => null);
  if (!starboardChannel) {
    return interaction.editReply({ content: '❌ Could not access the starboard channel.' });
  }

  let entry = await StarboardEntry.findOne({ originalMsgId: message.id });

  if (entry && entry.starboardMsgId) {
    const existing = await starboardChannel.messages.fetch(entry.starboardMsgId).catch(() => null);
    if (existing) {
      entry.count += 1;
      await entry.save();
      const embed = buildStarboardEmbed(message, entry.count, config);
      await existing.edit({ embeds: [embed], components: [buildJumpRow(message)] }).catch(() => null);
      return interaction.editReply({ content: `✅ Updated existing starboard entry (count: **${entry.count}**).` });
    }
  }

  const embed = buildStarboardEmbed(message, entry ? entry.count : 1, config);
  const sent  = await starboardChannel.send({
    embeds: [embed],
    components: [buildJumpRow(message)],
  }).catch(() => null);

  if (!sent) {
    return interaction.editReply({ content: '❌ Failed to send message to the starboard channel.' });
  }

  if (entry) {
    entry.starboardMsgId = sent.id;
    await entry.save();
  } else {
    await StarboardEntry.create({
      guildId:           interaction.guildId,
      originalMsgId:     message.id,
      originalChannelId: message.channelId,
      starboardMsgId:    sent.id,
      authorId:          message.author.id,
      count:             1,
    });
  }

  return interaction.editReply({ content: `✅ Message force-starred to ${starboardChannel}.` });
}

async function handleStats(interaction) {
  await interaction.deferReply();

  const guildId = interaction.guildId;
  const now     = new Date();
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [total, todayCount, weekCount, topEntry] = await Promise.all([
    StarboardEntry.countDocuments({ guildId }),
    StarboardEntry.countDocuments({ guildId, starredAt: { $gte: today } }),
    StarboardEntry.countDocuments({ guildId, starredAt: { $gte: weekAgo } }),
    StarboardEntry.findOne({ guildId }).sort({ count: -1 }),
  ]);

  const config = await StarboardConfig.findOne({ guildId });

  const embed = new EmbedBuilder()
    .setTitle('⭐ Starboard Statistics')
    .setColor(config?.color || '#FFD700')
    .addFields(
      { name: 'Total Starred Messages', value: `${total}`, inline: true },
      { name: "Today's Stars",          value: `${todayCount}`, inline: true },
      { name: "This Week's Stars",      value: `${weekCount}`, inline: true },
    )
    .setTimestamp();

  if (topEntry) {
    const jumpUrl = `https://discord.com/channels/${guildId}/${topEntry.originalChannelId}/${topEntry.originalMsgId}`;
    embed.addFields({
      name:  'Most Starred Message',
      value: `[Jump to message](${jumpUrl}) — **${topEntry.count}** ⭐`,
    });
  }

  return interaction.editReply({ embeds: [embed] });
}

// ─── Slash Command Data ───────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('starboard')
  .setDescription('Starboard configuration and management')

  .addSubcommand(sub =>
    sub
      .setName('setup')
      .setDescription('Launch the setup wizard (or pass a channel to skip it)')
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('Directly set this channel and skip the wizard')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false)
      )
  )

  .addSubcommand(sub =>
    sub
      .setName('config')
      .setDescription('Configure a starboard setting')
      .addStringOption(opt =>
        opt
          .setName('setting')
          .setDescription('The setting to change')
          .setRequired(true)
          .addChoices(
            { name: 'emoji',     value: 'emoji' },
            { name: 'threshold', value: 'threshold' },
            { name: 'color',     value: 'color' },
            { name: 'self-star', value: 'self-star' },
            { name: 'bot-stars', value: 'bot-stars' },
            { name: 'max-age',   value: 'max-age' },
          )
      )
      .addStringOption(opt =>
        opt
          .setName('value')
          .setDescription('The new value for the setting')
          .setRequired(true)
      )
  )

  .addSubcommand(sub =>
    sub
      .setName('ignore')
      .setDescription('Add a channel to the ignore list')
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('The channel to ignore')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )

  .addSubcommand(sub =>
    sub
      .setName('unignore')
      .setDescription('Remove a channel from the ignore list')
      .addChannelOption(opt =>
        opt
          .setName('channel')
          .setDescription('The channel to unignore')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )

  .addSubcommand(sub =>
    sub
      .setName('toggle')
      .setDescription('Enable or disable the starboard module')
  )

  .addSubcommand(sub =>
    sub
      .setName('force')
      .setDescription('Force-star a message by its ID')
      .addStringOption(opt =>
        opt
          .setName('message_id')
          .setDescription('The ID of the message to star')
          .setRequired(true)
      )
  )

  .addSubcommand(sub =>
    sub
      .setName('stats')
      .setDescription('View starboard statistics for this server')
  );

// ─── execute ─────────────────────────────────────────────────────────────────

const ADMIN_SUBCOMMANDS = new Set(['setup', 'config', 'ignore', 'unignore', 'toggle']);

async function execute(interaction, client) {
  const sub = interaction.options.getSubcommand();

  const needsManageGuild  = ADMIN_SUBCOMMANDS.has(sub);
  const needsManageMsgs   = sub === 'force';

  if (needsManageGuild) {
    const member = interaction.member;
    const hasPerms =
      member.permissions.has(PermissionFlagsBits.ManageGuild) ||
      member.permissions.has(PermissionFlagsBits.Administrator);
    if (!hasPerms) {
      return interaction.reply({
        content: '❌ You need the **Manage Server** permission to use this command.',
        ephemeral: true,
      });
    }
  }

  if (needsManageMsgs) {
    const member = interaction.member;
    const hasPerms =
      member.permissions.has(PermissionFlagsBits.ManageMessages) ||
      member.permissions.has(PermissionFlagsBits.Administrator);
    if (!hasPerms) {
      return interaction.reply({
        content: '❌ You need the **Manage Messages** permission to force-star.',
        ephemeral: true,
      });
    }
  }

  try {
    switch (sub) {
      case 'setup':    return await handleSetup(interaction);
      case 'config':   return await handleConfig(interaction);
      case 'ignore':   return await handleIgnore(interaction);
      case 'unignore': return await handleUnignore(interaction);
      case 'toggle':   return await handleToggle(interaction);
      case 'force':    return await handleForce(interaction, client);
      case 'stats':    return await handleStats(interaction);
      default:
        return interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
    }
  } catch (err) {
    console.error('[Starboard] execute error:', err);
    const method = interaction.deferred ? 'editReply' : 'reply';
    return interaction[method]({
      content: '❌ An unexpected error occurred.',
      ephemeral: true,
    }).catch(() => null);
  }
}

// ─── handleReaction ──────────────────────────────────────────────────────────

async function handleReaction(reaction, user, added, client) {
  try {
    if (user.bot) return;
    if (!reaction.message.guild) return;

    const guildId = reaction.message.guild.id;
    const config  = await StarboardConfig.findOne({ guildId });

    if (!config || !config.enabled || !config.channelId) return;

    // Ignore bots as authors unless botStars is on
    if (!config.botStars && reaction.message.author?.bot) return;

    // Emoji check
    if (!isEmojiMatch(reaction, config.emoji)) return;

    // Partial message — fetch full message
    if (reaction.message.partial) {
      await reaction.message.fetch().catch(() => null);
    }

    const message = reaction.message;
    if (!message || !message.author) return;

    // Ignored channel check
    if (config.ignoredChannels.includes(message.channelId)) return;

    // Self-star check
    if (!config.selfStar && user.id === message.author.id) return;

    // Max-age check
    if (config.maxAgeDays > 0) {
      const ageMs  = Date.now() - message.createdTimestamp;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      if (ageDays > config.maxAgeDays) return;
    }

    // Fetch partial reaction to get accurate count
    if (reaction.partial) {
      await reaction.fetch().catch(() => null);
    }

    // Count only users who reacted with the configured emoji
    const reactionObj = message.reactions.cache.find(r => isEmojiMatch(r, config.emoji));
    let count = reactionObj ? reactionObj.count : 0;

    // If self-star is disabled, subtract the author's own reaction
    if (!config.selfStar) {
      const reactors = await reactionObj?.users.fetch().catch(() => null);
      if (reactors && reactors.has(message.author.id)) count -= 1;
    }

    const starboardChannel = await client.channels.fetch(config.channelId).catch(() => null);
    if (!starboardChannel) return;

    let entry = await StarboardEntry.findOne({ originalMsgId: message.id });

    if (entry && entry.starboardMsgId) {
      // Update existing starboard post
      entry.count = count;
      await entry.save();

      const existing = await starboardChannel.messages
        .fetch(entry.starboardMsgId)
        .catch(() => null);

      if (existing) {
        if (count < 1) {
          // Optionally delete if stars drop to zero
          await existing.delete().catch(() => null);
          entry.starboardMsgId = null;
          await entry.save();
        } else {
          const embed = buildStarboardEmbed(message, count, config);
          await existing
            .edit({ embeds: [embed], components: [buildJumpRow(message)] })
            .catch(() => null);
        }
      }
      return;
    }

    // Not yet in starboard — check threshold
    if (!added || count < config.threshold) return;

    const embed = buildStarboardEmbed(message, count, config);
    const sent  = await starboardChannel
      .send({ embeds: [embed], components: [buildJumpRow(message)] })
      .catch(() => null);

    if (!sent) return;

    if (entry) {
      entry.starboardMsgId = sent.id;
      entry.count          = count;
      await entry.save();
    } else {
      await StarboardEntry.create({
        guildId,
        originalMsgId:     message.id,
        originalChannelId: message.channelId,
        starboardMsgId:    sent.id,
        authorId:          message.author.id,
        count,
      });
    }
  } catch (err) {
    console.error('[Starboard] handleReaction error:', err);
  }
}

// ─── Wizard Interaction Handler ──────────────────────────────────────────────

async function handleInteraction(interaction, client) {
  const key = `${interaction.user.id}_${interaction.guildId}`;
  const id  = interaction.customId;

  if (id === 'starboard_wizard_ch') {
    const channelId = interaction.values[0];
    wizardSessions.set(key, { channelId });

    const embed = new EmbedBuilder()
      .setTitle('⭐ Starboard Setup — Step 2 / 4')
      .setColor('#FFD700')
      .setDescription(`Channel: <#${channelId}>\n\nChoose the **reaction emoji** that triggers the starboard.`);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('starboard_wizard_emoji')
        .setPlaceholder('Choose an emoji...')
        .addOptions([
          { label: '⭐ Star (default)', value: '⭐' },
          { label: '🌟 Glowing Star',  value: '🌟' },
          { label: '💫 Dizzy',          value: '💫' },
          { label: '✨ Sparkles',        value: '✨' },
          { label: '❤️ Heart',           value: '❤️' },
          { label: '🔥 Fire',            value: '🔥' },
          { label: '💎 Diamond',         value: '💎' },
          { label: '👑 Crown',           value: '👑' },
          { label: '🎯 Bullseye',        value: '🎯' },
          { label: '🚀 Rocket',          value: '🚀' },
        ])
    );
    return interaction.update({ embeds: [embed], components: [row] }).catch(() => null);
  }

  if (id === 'starboard_wizard_emoji') {
    const emoji   = interaction.values[0];
    const session = wizardSessions.get(key) || {};
    session.emoji = emoji;
    wizardSessions.set(key, session);

    const embed = new EmbedBuilder()
      .setTitle('⭐ Starboard Setup — Step 3 / 4')
      .setColor('#FFD700')
      .setDescription(`Channel: <#${session.channelId}> · Emoji: ${emoji}\n\nHow many reactions are needed to **star** a message?`);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('starboard_wizard_threshold')
        .setPlaceholder('Choose a reaction threshold...')
        .addOptions([
          { label: '2 reactions',             value: '2' },
          { label: '3 reactions (recommended)', value: '3' },
          { label: '5 reactions',             value: '5' },
          { label: '7 reactions',             value: '7' },
          { label: '10 reactions',            value: '10' },
          { label: '15 reactions',            value: '15' },
          { label: '20 reactions',            value: '20' },
        ])
    );
    return interaction.update({ embeds: [embed], components: [row] }).catch(() => null);
  }

  if (id === 'starboard_wizard_threshold') {
    const threshold   = parseInt(interaction.values[0], 10);
    const session     = wizardSessions.get(key) || {};
    session.threshold = threshold;
    wizardSessions.set(key, session);

    const embed = new EmbedBuilder()
      .setTitle('⭐ Starboard Setup — Step 4 / 4')
      .setColor('#FFD700')
      .setDescription(`Channel: <#${session.channelId}> · Emoji: ${session.emoji} · Threshold: ${threshold}\n\nChoose the **embed color** for starboard posts.`);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('starboard_wizard_color')
        .setPlaceholder('Choose a color...')
        .addOptions([
          { label: '⭐ Gold (default)', value: '#FFD700' },
          { label: '🔵 Blurple',        value: '#5865F2' },
          { label: '🟢 Green',          value: '#57F287' },
          { label: '🔴 Red',            value: '#ED4245' },
          { label: '🟣 Purple',         value: '#9B59B6' },
          { label: '🟠 Orange',         value: '#E67E22' },
          { label: '⚪ White',          value: '#FFFFFF' },
          { label: '🩵 Sky Blue',       value: '#3498DB' },
        ])
    );
    return interaction.update({ embeds: [embed], components: [row] }).catch(() => null);
  }

  if (id === 'starboard_wizard_color') {
    const color   = interaction.values[0];
    const session = wizardSessions.get(key) || {};
    wizardSessions.delete(key);

    if (!session.channelId) {
      return interaction.update({ content: '❌ Wizard session expired. Please run `/starboard setup` again.', embeds: [], components: [] }).catch(() => null);
    }

    const config      = await getOrCreateConfig(interaction.guildId);
    config.channelId  = session.channelId;
    config.emoji      = session.emoji || '⭐';
    config.threshold  = session.threshold || 3;
    config.color      = color;
    config.enabled    = true;
    await config.save();

    const embed = new EmbedBuilder()
      .setTitle('✅ Starboard Is Live!')
      .setColor(color)
      .setDescription('Your starboard is now **enabled** and ready to go.')
      .addFields(
        { name: 'Channel',   value: `<#${session.channelId}>`,           inline: true },
        { name: 'Emoji',     value: config.emoji,                          inline: true },
        { name: 'Threshold', value: `${config.threshold} reaction(s)`,    inline: true },
        { name: 'Color',     value: color,                                 inline: true },
        { name: 'Next Steps', value: '• `/starboard ignore #channel` — exclude channels\n• `/starboard config self-star true` — allow self-stars\n• `/starboard config bot-stars true` — include bot messages\n• `/starboard toggle` — pause/resume anytime' }
      );

    return interaction.update({ embeds: [embed], components: [] }).catch(() => null);
  }
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  StarboardConfig,
  StarboardEntry,
  data,
  name: 'starboard',
  execute,
  handleReaction,
  handleInteraction,
};
