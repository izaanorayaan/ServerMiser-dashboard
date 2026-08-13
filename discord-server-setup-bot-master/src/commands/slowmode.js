const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder,
    ChannelType
  } = require('discord.js');
  const { Schema, model, models } = require('mongoose');
  
  // ─────────────────────────────────────────────────────────────
  // Config & Schema Definitions
  // ─────────────────────────────────────────────────────────────
  
  const MAX_SLOWMODE_SECONDS = 21600; // 6 Hours Discord Hard Cap
  const ACCENT_COLOR = 0x5865f2;
  
  const SlowmodeSettingsSchema = new Schema({
    channelId: { type: String, required: true, unique: true },
    guildId: { type: String, required: true },
    slowmodeDuration: { type: Number, required: true }, 
    enforcedBy: { type: String, required: true },       
    createdAt: { type: Date, default: Date.now }
  });
  
  const SlowmodeSettings = models.SlowmodeSettings || model('SlowmodeSettings', SlowmodeSettingsSchema);
  
  // ─────────────────────────────────────────────────────────────
  // Slash Command Definition
  // ─────────────────────────────────────────────────────────────
  
  const data = new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Manage channel slowmode intervals')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages | PermissionFlagsBits.ManageChannels | PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Establish a slowmode restriction on a channel')
        .addIntegerOption((opt) =>
          opt
            .setName('seconds')
            .setDescription('Cooldown duration in seconds')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_SLOWMODE_SECONDS)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel to restrict (defaults to current)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Modify an existing channel slowmode interval')
        .addIntegerOption((opt) =>
          opt
            .setName('seconds')
            .setDescription('New cooldown duration in seconds')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_SLOWMODE_SECONDS)
        )
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel to edit (defaults to current)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Completely remove slowmode restrictions from a channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel to clear (defaults to current)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('exempt')
        .setDescription('Audit who bypasses the slowmode rule inside a channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel to evaluate (defaults to current)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    );
  
  // ─────────────────────────────────────────────────────────────
  // Compatibility Parsing Helpers
  // ─────────────────────────────────────────────────────────────
  
  function isPrefixMode(interaction) {
    return typeof interaction.isChatInputCommand === 'function' && interaction.isChatInputCommand() === false;
  }
  
  function parsePrefixArgs(interaction) {
    const raw = String(interaction.content || '');
    const tokens = raw.trim().split(/\s+/);
    
    const sub = tokens[1] ? tokens[1].toLowerCase() : null;
    
    let seconds = null;
    let targetChannel = interaction.channel;
  
    for (let i = 2; i < tokens.length; i++) {
      const val = parseInt(tokens[i], 10);
      if (!isNaN(val)) {
        seconds = val;
        break;
      }
    }
  
    if (interaction.mentions?.channels?.size > 0) {
      targetChannel = interaction.mentions.channels.first();
    }
  
    return { sub, seconds, targetChannel };
  }
  
  async function verifyPermissions(interaction) {
    const member = interaction.member;
    if (!member) return false;
  
    return (
      member.permissions.has(PermissionFlagsBits.ManageMessages) ||
      member.permissions.has(PermissionFlagsBits.ManageChannels) ||
      member.permissions.has(PermissionFlagsBits.Administrator)
    );
  }
// ─────────────────────────────────────────────────────────────
// Subcommand Handlers
// ─────────────────────────────────────────────────────────────

async function handleCreate(interaction, prefixData = null) {
    const targetChannel = prefixData ? prefixData.targetChannel : (interaction.options.getChannel('channel') || interaction.channel);
    const seconds = prefixData ? prefixData.seconds : interaction.options.getInteger('seconds');
  
    if (!targetChannel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: `❌ I lack the **Manage Channels** permission to apply changes to ${targetChannel}.`,
        flags: [MessageFlags.Ephemeral]
      });
    }
  
    if (!seconds || isNaN(seconds) || seconds < 1 || seconds > MAX_SLOWMODE_SECONDS) {
      return interaction.reply({
        content: `❌ Please provide a valid number of seconds between 1 and ${MAX_SLOWMODE_SECONDS}.\n**Example:** \`|slowmode create 10\``
      });
    }
  
    if (targetChannel.rateLimitPerUser > 0) {
      return interaction.reply({
        content: `⚠️ Slowmode is already active in ${targetChannel}. Use \`edit\` to alter it or \`remove\` to wipe it.`,
        flags: [MessageFlags.Ephemeral]
      });
    }
  
    await targetChannel.setRateLimitPerUser(seconds);
  
    await SlowmodeSettings.findOneAndUpdate(
      { channelId: targetChannel.id },
      {
        channelId: targetChannel.id,
        guildId: interaction.guild.id,
        slowmodeDuration: seconds,
        enforcedBy: interaction.user.id,
        createdAt: new Date()
      },
      { upsert: true }
    );
  
    const embed = new EmbedBuilder()
      .setTitle('⏳ Slowmode Created')
      .setDescription(`A slowmode limitation has been locked into ${targetChannel}.`)
      .addFields(
        { name: 'Cooldown Interval', value: `\`${seconds} second${seconds === 1 ? '' : 's'}\``, inline: true },
        { name: 'Enforced By', value: `${interaction.user}`, inline: true }
      )
      .setColor(ACCENT_COLOR)
      .setTimestamp();
  
    return interaction.reply({ embeds: [embed] });
  }
  
  async function handleEdit(interaction, prefixData = null) {
    const targetChannel = prefixData ? prefixData.targetChannel : (interaction.options.getChannel('channel') || interaction.channel);
    const seconds = prefixData ? prefixData.seconds : interaction.options.getInteger('seconds');
  
    if (!targetChannel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: `❌ I lack the **Manage Channels** permission to apply modifications to ${targetChannel}.`,
        flags: [MessageFlags.Ephemeral]
      });
    }
  
    if (!seconds || isNaN(seconds) || seconds < 1 || seconds > MAX_SLOWMODE_SECONDS) {
      return interaction.reply({
        content: `❌ Please provide a valid number of seconds between 1 and ${MAX_SLOWMODE_SECONDS}.\n**Example:** \`|slowmode edit 30\``
      });
    }
  
    await targetChannel.setRateLimitPerUser(seconds);
  
    await SlowmodeSettings.findOneAndUpdate(
      { channelId: targetChannel.id },
      {
        channelId: targetChannel.id,
        guildId: interaction.guild.id,
        slowmodeDuration: seconds,
        enforcedBy: interaction.user.id,
        createdAt: new Date()
      },
      { upsert: true }
    );
  
    const embed = new EmbedBuilder()
      .setTitle('🔄 Slowmode Updated')
      .setDescription(`Successfully adjusted processing intervals for ${targetChannel}.`)
      .addFields(
        { name: 'Adjusted Cooldown', value: `\`${seconds} second${seconds === 1 ? '' : 's'}\``, inline: true },
        { name: 'Modified By', value: `${interaction.user}`, inline: true }
      )
      .setColor(ACCENT_COLOR)
      .setTimestamp();
  
    return interaction.reply({ embeds: [embed] });
  }
  
  async function handleRemove(interaction, prefixData = null) {
    const targetChannel = prefixData ? prefixData.targetChannel : (interaction.options.getChannel('channel') || interaction.channel);
  
    if (!targetChannel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: `❌ I lack the **Manage Channels** permission to drop limits from ${targetChannel}.`,
        flags: [MessageFlags.Ephemeral]
      });
    }
  
    if (targetChannel.rateLimitPerUser === 0) {
      return interaction.reply({
        content: `❌ ${targetChannel} does not have an active slowmode profile to remove.`,
        flags: [MessageFlags.Ephemeral]
      });
    }
  
    await targetChannel.setRateLimitPerUser(0);
    await SlowmodeSettings.deleteOne({ channelId: targetChannel.id });
  
    return interaction.reply({
      content: `✅ Slowmode parameters successfully removed from ${targetChannel}. Restrictions dropped.`
    });
  }
  
  async function handleExempt(interaction, prefixData = null) {
    const targetChannel = prefixData ? prefixData.targetChannel : (interaction.options.getChannel('channel') || interaction.channel);
    
    if (isPrefixMode(interaction)) {
      const cachedRoles = await interaction.guild.roles.fetch();
      const exemptRoles = [];
      cachedRoles.forEach((role) => {
        if (role.managed) return; 
        if (role.permissions.has(PermissionFlagsBits.Administrator) || role.permissions.has(PermissionFlagsBits.ManageChannels) || role.permissions.has(PermissionFlagsBits.ManageMessages)) {
          exemptRoles.push(role);
        }
      });
      const descriptionText = exemptRoles.length > 0 ? exemptRoles.map(r => `• ${r}`).join('\n') : '_No explicit role structures override this channel configuration._';
      const embed = new EmbedBuilder()
        .setTitle(`🛡️ Slowmode Bypass Audit: #${targetChannel.name}`)
        .setDescription(`Members holding the following role configurations naturally bypass user cooldown configurations inside this system location:\n\n${descriptionText}`)
        .setFooter({ text: 'Note: Channel creators & Server Owners are always immune.' })
        .setColor(ACCENT_COLOR);
      return interaction.reply({ embeds: [embed] });
    }
  
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  
    const cachedRoles = await interaction.guild.roles.fetch();
    const exemptRoles = [];
  
    cachedRoles.forEach((role) => {
      if (role.managed) return; 
      const perms = role.permissions;
      if (
        perms.has(PermissionFlagsBits.Administrator) ||
        perms.has(PermissionFlagsBits.ManageChannels) ||
        perms.has(PermissionFlagsBits.ManageMessages)
      ) {
        exemptRoles.push(role);
      }
    });
  
    const descriptionText = exemptRoles.length > 0 
      ? exemptRoles.map(r => `• ${r}`).join('\n')
      : '_No explicit role structures override this channel configuration._';
  
    const embed = new EmbedBuilder()
      .setTitle(`🛡️ Slowmode Bypass Audit: #${targetChannel.name}`)
      .setDescription(`Members holding the following role configurations naturally bypass user cooldown configurations inside this system location:\n\n${descriptionText}`)
      .setFooter({ text: 'Note: Channel creators & Server Owners are always immune.' })
      .setColor(ACCENT_COLOR);
  
    return interaction.editReply({ embeds: [embed] });
  }
  
  // ─────────────────────────────────────────────────────────────
  // Exports
  // ─────────────────────────────────────────────────────────────
  
  module.exports = {
    data,
    async execute(interaction) {
      if (isPrefixMode(interaction)) {
        const isAllowed = await verifyPermissions(interaction);
        if (!isAllowed) {
          return interaction.reply({
            content: '❌ You need **Manage Messages**, **Manage Channels**, or **Administrator** permissions to use this command.'
          });
        }
  
        const parsed = parsePrefixArgs(interaction);
        if (parsed.sub === 'create') return handleCreate(interaction, parsed);
        if (parsed.sub === 'edit') return handleEdit(interaction, parsed);
        if (parsed.sub === 'remove') return handleRemove(interaction, parsed);
        if (parsed.sub === 'exempt') return handleExempt(interaction, parsed);
  
        return interaction.reply({
          content: '❌ Invalid usage. Available subcommands: `create`, `edit`, `remove`, `exempt`.\n**Example:** `|slowmode create 10 #channel`'
        });
      }
  
      const sub = interaction.options.getSubcommand();
      if (sub === 'create') return handleCreate(interaction);
      if (sub === 'edit') return handleEdit(interaction);
      if (sub === 'remove') return handleRemove(interaction);
      if (sub === 'exempt') return handleExempt(interaction);
    }
  };
    