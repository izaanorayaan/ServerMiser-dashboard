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
  
  const MAX_PURGE_AMOUNT = 100;
  const ACCENT_COLOR = 0xed4245; 
  
  // ─────────────────────────────────────────────────────────────
  // Slash Command Definition (Restricted to Administrators)
  // ─────────────────────────────────────────────────────────────
  
  const data = new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk delete messages using advanced filtering')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('any')
        .setDescription('Delete any recent messages matching no specific filter')
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('Number of messages to clear (1 - 100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_PURGE_AMOUNT)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('user')
        .setDescription('Purge messages sent exclusively by a specific member')
        .addUserOption((opt) =>
          opt
            .setName('target')
            .setDescription('The member whose messages you want to scrub')
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('Number of past channel messages to analyze (1 - 100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_PURGE_AMOUNT)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('bot')
        .setDescription('Purge messages sent exclusively by automated bots')
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('Number of past channel messages to analyze (1 - 100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_PURGE_AMOUNT)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('links')
        .setDescription('Purge recent messages containing HTTP/HTTPS links')
        .addIntegerOption((opt) =>
          opt
            .setName('amount')
            .setDescription('Number of past channel messages to analyze (1 - 100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(MAX_PURGE_AMOUNT)
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
    let amount = null;
    let targetUser = null;
  
    if (interaction.mentions?.users?.size > 0) {
      targetUser = interaction.mentions.users.first();
    }
  
    for (let i = 2; i < tokens.length; i++) {
      const parsedInt = parseInt(tokens[i], 10);
      if (!isNaN(parsedInt)) {
        amount = parsedInt;
        break;
      }
    }
  
    return { sub, amount, targetUser };
  }
  
  async function verifyAdminPermissions(interaction) {
    return interaction.member?.permissions?.has(PermissionFlagsBits.Administrator) || false;
  }
  
  // ─────────────────────────────────────────────────────────────
  // Core Purge Execution Engine
  // ─────────────────────────────────────────────────────────────
  
  async function executePurge(interaction, filterType, amount, targetUser = null) {
    if (interaction.channel.type !== ChannelType.GuildText && interaction.channel.type !== ChannelType.GuildAnnouncement) {
      return interaction.reply({
        content: '❌ Bulk message deletions can only be performed in standard text channels.',
        flags: [MessageFlags.Ephemeral]
      });
    }
  
    if (!interaction.channel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({
        content: '❌ I lack the **Manage Messages** channel permission to clean up chat blocks.',
        flags: [MessageFlags.Ephemeral]
      });
    }
  
    const prefixMode = isPrefixMode(interaction);
    if (!prefixMode) {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    }
  
    try {
      const fetchedMessages = await interaction.channel.messages.fetch({ limit: amount });
      const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      
      let messagesToDelete = fetchedMessages.filter((msg) => {
        if (msg.createdTimestamp < fourteenDaysAgo) return false;
        if (msg.pinned) return false; 
  
        switch (filterType) {
          case 'user':
            return targetUser ? msg.author.id === targetUser.id : false;
          case 'bot':
            return msg.author.bot;
          case 'links':
            return /https?:\/\/[^\s]+/i.test(msg.content);
          case 'any':
          default:
            return true;
        }
      });
  
      if (prefixMode) {
        messagesToDelete = messagesToDelete.set(interaction.id, interaction);
      }
  
      if (messagesToDelete.size === 0) {
        const emptyContent = '❌ No recent messages (under 14 days old and unpinned) matched your filter.';
        return prefixMode 
          ? interaction.reply({ content: emptyContent }).then(m => setTimeout(() => m.delete().catch(() => {}), 5000))
          : interaction.editReply({ content: emptyContent });
      }
  
      const deletedCollection = await interaction.channel.bulkDelete(messagesToDelete, true);
      
      const embed = new EmbedBuilder()
        .setTitle('🧹 Channel Purge Complete')
        .setDescription('Successfully scrubbed localized message entries from this system node.')
        .addFields(
          { name: 'Filter Applied', value: `\`${filterType.toUpperCase()}\``, inline: true },
          { name: 'Messages Deleted', value: `\`${deletedCollection.size}\``, inline: true }
        )
        .setColor(ACCENT_COLOR)
        .setTimestamp();
  
      if (prefixMode) {
        const confirmMsg = await interaction.channel.send({ embeds: [embed] });
        setTimeout(() => confirmMsg.delete().catch(() => {}), 6000);
        return;
      }
  
      return interaction.editReply({ embeds: [embed] });
  
    } catch (err) {
      console.error('Purge transaction process hit a structural error:', err);
      const errorContent = '❌ An internal error occurred while executing the bulk deletion routine.';
      return prefixMode ? interaction.reply({ content: errorContent }) : interaction.editReply({ content: errorContent });
    }
  }
  
  // ─────────────────────────────────────────────────────────────
  // Exports & Runtime Router
  // ─────────────────────────────────────────────────────────────
  
  module.exports = {
    data,
    async execute(interaction) {
      const isAdmin = await verifyAdminPermissions(interaction);
      if (!isAdmin) {
        const rejectText = '❌ Access Denied: This utility requires **Administrator** security clearance.';
        return isPrefixMode(interaction) 
          ? interaction.reply({ content: rejectText }) 
          : interaction.reply({ content: rejectText, flags: [MessageFlags.Ephemeral] });
      }
  
      if (isPrefixMode(interaction)) {
        const parsed = parsePrefixArgs(interaction);
        
        if (!parsed.amount || isNaN(parsed.amount) || parsed.amount < 1 || parsed.amount > MAX_PURGE_AMOUNT) {
          return interaction.reply({
            content: `❌ Please provide a valid evaluation block count between 1 and ${MAX_PURGE_AMOUNT}.\n**Usage:** \`|purge [any|user|bot|links] [amount] [@user]\``
          });
        }
  
        if (parsed.sub === 'any') return executePurge(interaction, 'any', parsed.amount);
        if (parsed.sub === 'bot') return executePurge(interaction, 'bot', parsed.amount);
        if (parsed.sub === 'links') return executePurge(interaction, 'links', parsed.amount);
        if (parsed.sub === 'user') {
          if (!parsed.targetUser) {
            return interaction.reply({ content: '❌ You must mention a target user.\n**Example:** `|purge user 25 @username`' });
          }
          return executePurge(interaction, 'user', parsed.amount, parsed.targetUser);
        }
  
        return interaction.reply({
          content: '❌ Invalid filter specified. Available subcommands: `any`, `user`, `bot`, `links`.\n**Example:** `|purge links 50`'
        });
      }
  
      const sub = interaction.options.getSubcommand();
      const amount = interaction.options.getInteger('amount');
  
      if (sub === 'any') return executePurge(interaction, 'any', amount);
      if (sub === 'bot') return executePurge(interaction, 'bot', amount);
      if (sub === 'links') return executePurge(interaction, 'links', amount);
      if (sub === 'user') {
        const target = interaction.options.getUser('target');
        return executePurge(interaction, 'user', amount, target);
      }
    }
  };
  