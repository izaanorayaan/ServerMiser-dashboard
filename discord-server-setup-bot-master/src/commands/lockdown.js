const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder,
    ChannelType
  } = require('discord.js');
  
  // ─────────────────────────────────────────────────────────────
  // Config Constants
  // ─────────────────────────────────────────────────────────────
  
  const ACCENT_COLOR_LOCK = 0xed4245;  // Red for Locked
  const ACCENT_COLOR_UNLOCK = 0x57f287; // Green for Unlocked
  
  // ─────────────────────────────────────────────────────────────
  // Slash Command Definition (Restricted to Administrators)
  // ─────────────────────────────────────────────────────────────
  
  const data = new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Freeze or thaw text channels during emergencies')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('on')
        .setDescription('Lock down a channel to prevent standard users from messaging')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel to lock (defaults to current)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('off')
        .setDescription('Lift a lockdown and allow standard text activity again')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('The channel to unlock (defaults to current)')
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
    // Examples: "|lockdown on", "|lockdown off #general"
    const raw = String(interaction.content || '');
    const tokens = raw.trim().split(/\s+/);
    
    const sub = tokens[1] ? tokens[1].toLowerCase() : null;
    let targetChannel = interaction.channel;
  
    if (interaction.mentions?.channels?.size > 0) {
      targetChannel = interaction.mentions.channels.first();
    }
  
    return { sub, targetChannel };
  }
  
  async function verifyAdminPermissions(interaction) {
    return interaction.member?.permissions?.has(PermissionFlagsBits.Administrator) || false;
  }
  // ─────────────────────────────────────────────────────────────
// Core Lockdown Execution Engine
// ─────────────────────────────────────────────────────────────

async function executeLockdown(interaction, actionType, targetChannel) {
    // Guard against structural channel types that do not support permission overrides
    if (targetChannel.type !== ChannelType.GuildText && targetChannel.type !== ChannelType.GuildAnnouncement) {
      return interaction.reply({
        content: '❌ Lockdown modifications can only be performed on standard text channels.',
        flags: [MessageFlags.Ephemeral]
      });
    }
  
    // Double check Bot Client internal permissions inside the specific channel context
    if (!targetChannel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: `❌ I lack the **Manage Roles / Permissions** channel permission to modify ${targetChannel}.`,
        flags: [MessageFlags.Ephemeral]
      });
    }
  
    const prefixMode = isPrefixMode(interaction);
  
    try {
      const everyoneRole = interaction.guild.roles.everyone;
  
      if (actionType === 'on') {
        // Edit the channel overwrites to explicitly deny SendMessages for @everyone
        await targetChannel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: false
        }, { reason: `Emergency lockdown initiated by Admin: ${interaction.user.tag}` });
  
        const embed = new EmbedBuilder()
          .setTitle('🔒 Channel Locked Down')
          .setDescription(`This channel has been placed under administrative quarantine. Standard members cannot send messages until further notice.`)
          .addFields(
            { name: 'Target Channel', value: `${targetChannel}`, inline: true },
            { name: 'Enforced By', value: `${interaction.user}`, inline: true }
          )
          .setColor(ACCENT_COLOR_LOCK)
          .setTimestamp();
  
        return interaction.reply({ embeds: [embed] });
  
      } else if (actionType === 'off') {
        // Restore default behavior by nullifying the explicit denial flag for @everyone
        await targetChannel.permissionOverwrites.edit(everyoneRole, {
          SendMessages: null
        }, { reason: `Lockdown lifted by Admin: ${interaction.user.tag}` });
  
        const embed = new EmbedBuilder()
          .setTitle('🔓 Lockdown Lifted')
          .setDescription(`The administrative lockdown profile has been removed. Text channels are open for global public communication loops again.`)
          .addFields(
            { name: 'Target Channel', value: `${targetChannel}`, inline: true },
            { name: 'Authorized By', value: `${interaction.user}`, inline: true }
          )
          .setColor(ACCENT_COLOR_UNLOCK)
          .setTimestamp();
  
        return interaction.reply({ embeds: [embed] });
      }
  
    } catch (err) {
      console.error('Lockdown overwrite processing hit an internal error:', err);
      const errorContent = '❌ An operational error occurred while shifting permission overwrites down the gateway pipeline.';
      return interaction.reply({ content: errorContent, flags: [MessageFlags.Ephemeral] });
    }
  }
  
  // ─────────────────────────────────────────────────────────────
  // Exports & Runtime Router
  // ─────────────────────────────────────────────────────────────
  
  module.exports = {
    data,
    async execute(interaction) {
      // 1. Guard Entry: Enforce Admin authorization restriction globally across formats
      const isAdmin = await verifyAdminPermissions(interaction);
      if (!isAdmin) {
        const rejectText = '❌ Access Denied: This utility requires **Administrator** security clearance.';
        return isPrefixMode(interaction) 
          ? interaction.reply({ content: rejectText }) 
          : interaction.reply({ content: rejectText, flags: [MessageFlags.Ephemeral] });
      }
  
      // 2. Format Invocations: Map input parameters out of text structures or interaction maps
      if (isPrefixMode(interaction)) {
        const parsed = parsePrefixArgs(interaction);
  
        if (parsed.sub === 'on') return executeLockdown(interaction, 'on', parsed.targetChannel);
        if (parsed.sub === 'off') return executeLockdown(interaction, 'off', parsed.targetChannel);
  
        return interaction.reply({
          content: '❌ Invalid state option specified. Available subcommands: `on`, `off`.\n**Usage:** `|lockdown [on|off] [#channel]`'
        });
      }
  
      // 3. Slash Command Parsing Routing Table
      const sub = interaction.options.getSubcommand();
      const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
  
      if (sub === 'on') return executeLockdown(interaction, 'on', targetChannel);
      if (sub === 'off') return executeLockdown(interaction, 'off', targetChannel);
    }
  };
  