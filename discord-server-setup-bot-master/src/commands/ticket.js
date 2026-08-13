const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ChannelType, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { logAction } = require('../utils/auditLog');
const database = require('../utils/database'); 
const { formatCute } = require('../utils/textFormatter.js');
const { Schema, model, models } = require('mongoose');

// ============================================================================
// TICKET TRANSCRIPT SCHEMA
// ============================================================================
const TicketTranscriptSchema = new Schema({
  ticketId: { type: String, required: true, unique: true },
  ticketNumber: { type: Number, required: true },
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  channelName: { type: String, required: true },
  isThread: { type: Boolean, default: false },
  staffRoleId: { type: String, default: null },
  participants: [{
    userId: String,
    username: String,
    _id: false
  }],
  createdAt: { type: Date, default: Date.now, index: true },
  closedAt: { type: Date, default: null },
  duration: { type: Number, default: 0 }, // in seconds
  transcriptContent: { type: String, required: true },
  messageCount: { type: Number, default: 0 }
}, { timestamps: true });

const TicketTranscript = models.TicketTranscript || model('TicketTranscript', TicketTranscriptSchema);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('🎟️ Advanced support ticket configuration and management system')
    .addSubcommand(subcommand =>
      subcommand
        .setName('setup')
        .setDescription('Launch the interactive ticket panel deployment wizard')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('ongoing')
        .setDescription('📋 View all live, active support ticket sessions')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('history')
        .setDescription('📜 View all ticket history with pagination and transcript search')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('purge')
        .setDescription('⚠️ Instantly delete all active tickets from the datastore')
    ),
  name: 'ticket',

  async execute(interaction, client) {
    const guild = interaction.guild;
    const guildId = interaction.guildId;
    const memberExecutor = interaction.member;

    // Enforce admin-only access
    if (!memberExecutor.permissions.has(PermissionFlagsBits.Administrator) && 
        !memberExecutor.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ 
        content: '❌ **Permissions Required:** You need `Manage Server` or `Administrator` access.', 
        ephemeral: true 
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildConfig = await database.findOne({ guildId }).catch(() => null) || {};
    let cuteStyle = 'off';
    try { cuteStyle = guildConfig.cuteStyle || 'off'; } catch (_) {}

    // ==========================================
    // 🧙 SETUP WIZARD: Deploy ticket panel with configuration
    // ==========================================
    if (subcommand === 'setup') {
      await interaction.deferReply({ ephemeral: true });

      // Step 0: Show ticket mode selection
      const modeEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🧙 Ticket System Deployment Wizard')
        .setDescription('Let\'s set up your ticket support system step by step.\n\n**Step 1 of 4:** How should tickets be created?')
        .addFields(
          { name: '🔹 Channels', value: 'Each ticket gets a dedicated private channel', inline: true },
          { name: '🧵 Threads', value: 'Tickets are private threads in a single channel', inline: true }
        )
        .setTimestamp();

      const modeButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_wizard_mode_channel')
          .setLabel('Use Channels')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔹'),
        new ButtonBuilder()
          .setCustomId('ticket_wizard_mode_thread')
          .setLabel('Use Threads')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🧵')
      );

      await interaction.editReply({ embeds: [modeEmbed], components: [modeButtons] });
    }

    // ==========================================
    // 📋 ONGOING TICKETS
    // ==========================================
    if (subcommand === 'ongoing') {
      await interaction.deferReply({ ephemeral: true });

      const activeTickets = guildConfig.activeTickets || {};
      const activeKeys = Object.keys(activeTickets);

      if (activeKeys.length === 0) {
        return interaction.editReply({ content: '📭 No active support tickets found.' });
      }

      const listEmbed = new EmbedBuilder()
        .setTitle('📋 Live Ongoing Support Tickets')
        .setColor('#3498DB')
        .setTimestamp();

      let descriptions = '';
      for (const [channelId, userData] of Object.entries(activeTickets)) {
        const userId = typeof userData === 'string' ? userData : userData.userId;
        descriptions += `• <#${channelId}> — Opened by <@${userId}>\n`;
      }
      listEmbed.setDescription(descriptions || 'None');

      return interaction.editReply({ embeds: [listEmbed] });
    }

    // ==========================================
    // 📜 TICKET HISTORY (Paginated)
    // ==========================================
    if (subcommand === 'history') {
      await interaction.deferReply({ ephemeral: true });

      try {
        // Fetch all transcripts for this guild
        const allTranscripts = await TicketTranscript.find({ guildId }).sort({ createdAt: -1 }).lean();

        if (allTranscripts.length === 0) {
          return interaction.editReply({ content: '📭 No ticket history found.' });
        }

        // Paginate (10 tickets per page)
        const itemsPerPage = 10;
        const pages = [];
        for (let i = 0; i < allTranscripts.length; i += itemsPerPage) {
          pages.push(allTranscripts.slice(i, i + itemsPerPage));
        }

        // Create first page embed
        const pageIndex = 0;
        const pageTranscripts = pages[pageIndex];

        const pageEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('📜 Ticket History')
          .setDescription(`Showing page **${pageIndex + 1}** of **${pages.length}**\n\nSelect a ticket to view its transcript:`)
          .setTimestamp();

        for (let i = 0; i < pageTranscripts.length; i++) {
          const t = pageTranscripts[i];
          const duration = Math.floor(t.duration / 60);
          const createdDate = new Date(t.createdAt).toLocaleDateString();
          pageEmbed.addFields({
            name: `${i + 1}. Ticket #${t.ticketNumber}`,
            value: `**User:** @${t.username}\n**Created:** ${createdDate}\n**Duration:** ${duration} min\n**Messages:** ${t.messageCount}`,
            inline: false
          });
        }

        // Create pagination and selection buttons
        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_history_page_${pageIndex}`)
            .setLabel(`Page ${pageIndex + 1} of ${pages.length}`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📖')
            .setDisabled(true),
          pageIndex > 0 ? new ButtonBuilder()
            .setCustomId(`ticket_history_prev_${pageIndex}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️') : new ButtonBuilder()
            .setCustomId('ticket_history_disabled_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
            .setDisabled(true),
          pageIndex < pages.length - 1 ? new ButtonBuilder()
            .setCustomId(`ticket_history_next_${pageIndex}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('➡️') : new ButtonBuilder()
            .setCustomId('ticket_history_disabled_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('➡️')
            .setDisabled(true)
        );

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`ticket_history_select_${pageIndex}`)
            .setPlaceholder('Choose a ticket to view...')
            .addOptions(pageTranscripts.map((t, i) => ({
              label: `Ticket #${t.ticketNumber}`,
              description: `by @${t.username} • ${Math.floor(t.duration / 60)} min`,
              value: `${pageIndex}_${i}`,
              emoji: '🎟️'
            })))
        );

        await interaction.editReply({ embeds: [pageEmbed], components: [paginationRow, selectRow] });
      } catch (err) {
        console.error('History command error:', err);
        return interaction.editReply({ content: `❌ Error loading history: ${err.message}` });
      }
    }

    // ==========================================
    // ⚠️ PURGE ALL TICKETS
    // ==========================================
    if (subcommand === 'purge') {
      await interaction.deferReply({ ephemeral: true });

      await database.findOneAndUpdate({ guildId }, { $set: { activeTickets: {} } }, { upsert: true });

      return interaction.editReply({ 
        embeds: [
          new EmbedBuilder()
            .setTitle('⚠️ Tickets Purged')
            .setColor('#ED4245')
            .setDescription('All active ticket records have been cleared.')
            .setTimestamp()
        ] 
      });
    }
  },
  // ========================================================
  // 🔘 INTERACTIVE BUTTON CONTROLLER & WIZARD PIPELINE
  // ========================================================
  async handleInteraction(interaction) {
    if (!interaction.isButton() && !interaction.isStringSelectMenu() && !interaction.isChannelSelectMenu() && !interaction.isRoleSelectMenu()) return;
    
    const customId = interaction.customId;
    const guild = interaction.guild;
    const guildId = interaction.guildId;
    const user = interaction.user;

    const guildConfig = await database.findOne({ guildId }).catch(() => null) || {};
    let cuteStyle = 'off';
    try { cuteStyle = guildConfig.cuteStyle || 'off'; } catch (_) {}

    // ==========================================
    // WIZARD: Step 0 - Mode Selection
    // ==========================================
    if (customId === 'ticket_wizard_mode_channel' || customId === 'ticket_wizard_mode_thread') {
      await interaction.deferUpdate();

      const ticketMode = customId === 'ticket_wizard_mode_channel' ? 'channel' : 'thread';
      const modeEmoji = ticketMode === 'channel' ? '🔹' : '🧵';
      const modeName = ticketMode === 'channel' ? 'Channels' : 'Threads';

      // Fetch ALL text channels from guild with timeout
      await Promise.race([
        interaction.guild.channels.fetch(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
      ]).catch(() => null);
      
      const allChannels = interaction.guild.channels.cache
        .filter(channel => channel.type === ChannelType.GuildText)
        .sort((a, b) => a.position - b.position) // Simple position sort only
        .first(25); // Discord component limit is 25 options

      if (allChannels.size === 0) {
        return interaction.editReply({ 
          content: '❌ No text channels available in this server. Please create some text channels first.',
          components: []
        });
      }

      const wizardEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🧙 Ticket System Deployment Wizard')
        .setDescription(`**Step 2 of 4:** Select the channel where the ticket panel will be deployed.\n\n${modeEmoji} **Mode:** ${modeName}`)
        .setTimestamp();

      const channelOptions = allChannels.map(channel => ({
        label: channel.name,
        value: channel.id,
        description: `Channel · Position: ${channel.position}`
      }));

      const channelSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`ticket_wizard_panel_channel_${ticketMode}`)
          .setPlaceholder('Choose channel for ticket panel...')
          .addOptions(channelOptions)
      );

      await interaction.editReply({ embeds: [wizardEmbed], components: [channelSelect] });
    }

    // ==========================================
    // WIZARD: Step 2a - Panel Channel Selection (both modes)
    // ==========================================
    if ((customId.startsWith('ticket_wizard_panel_channel_') || customId === 'ticket_wizard_channel_select') && interaction.isStringSelectMenu()) {
      await interaction.deferUpdate();

      const selectedChannel = interaction.values[0];
      const isThreadMode = customId.includes('thread');
      const ticketMode = isThreadMode ? 'thread' : 'channel';
      const modeEmoji = isThreadMode ? '🧵' : '🔹';

      // Fetch all roles from guild with timeout (excluding @everyone)
      await Promise.race([
        interaction.guild.roles.fetch(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
      ]).catch(() => null);
      
      const allRoles = interaction.guild.roles.cache
        .filter(role => role.id !== interaction.guildId) // Exclude @everyone
        .sort((a, b) => b.position - a.position)
        .first(25); // Discord component limit is 25 options

      if (allRoles.size === 0) {
        return interaction.editReply({ 
          content: '❌ No roles available in this server. Please create some roles first.',
          components: []
        });
      }

      const wizardEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🧙 Ticket System Deployment Wizard')
        .setDescription(`**Step 3 of 4:** Select the staff role to ping when tickets are opened.\n\n${modeEmoji} Panel Channel: <#${selectedChannel}>`)
        .setTimestamp();

      const roleOptions = allRoles.map(role => ({
        label: role.name,
        value: role.id,
        description: `Position: ${role.position}`
      }));

      const roleSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`ticket_wizard_role_select_${selectedChannel}_${ticketMode}`)
          .setPlaceholder('Choose staff role to ping on ticket open...')
          .addOptions(roleOptions)
      );

      await interaction.editReply({ embeds: [wizardEmbed], components: [roleSelect] });
    }

    // ==========================================
    // WIZARD: Step 3 - Staff Role Selection
    // ==========================================
    if (customId.startsWith('ticket_wizard_role_select_') && interaction.isStringSelectMenu()) {
      await interaction.deferUpdate();

      const parts = customId.replace('ticket_wizard_role_select_', '').split('_');
      const selectedChannel = parts[0];
      const ticketMode = parts[1] || 'channel';
      const modeEmoji = ticketMode === 'thread' ? '🧵' : '🔹';
      const selectedRole = interaction.values[0];
      
      const wizardEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🧙 Ticket System Deployment Wizard')
        .setDescription(`**Step 4 of 4:** Select the log channel for ticket events.\n\n${modeEmoji} Panel Channel: <#${selectedChannel}>\n👮 Staff Role: <@&${selectedRole}>`)
        .setTimestamp();

      // Fetch ALL text channels from guild with timeout
      await Promise.race([
        interaction.guild.channels.fetch(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
      ]).catch(() => null);
      
      const allLogChannels = interaction.guild.channels.cache
        .filter(channel => channel.type === ChannelType.GuildText)
        .sort((a, b) => a.position - b.position) // Simple position sort only
        .first(25); // Discord component limit is 25 options

      if (allLogChannels.size === 0) {
        return interaction.editReply({ 
          content: '❌ No text channels available for logging. Please create some text channels first.',
          components: []
        });
      }

      const logChannelOptions = allLogChannels.map(channel => ({
        label: channel.name,
        value: channel.id,
        description: `Channel · Position: ${channel.position}`
      }));

      const logChannelSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`ticket_wizard_log_select_${selectedChannel}_${selectedRole}_${ticketMode}`)
          .setPlaceholder('Choose a channel for ticket logs...')
          .addOptions(logChannelOptions)
      );

      await interaction.editReply({ embeds: [wizardEmbed], components: [logChannelSelect] });
    }

    // ==========================================
    // WIZARD: Step 4 - Deploy Panel
    // ==========================================
    if (customId.startsWith('ticket_wizard_log_select_') && interaction.isStringSelectMenu()) {
      await interaction.deferUpdate();

      const parts = customId.replace('ticket_wizard_log_select_', '').split('_');
      const panelChannelId = parts[0];
      const staffRoleId = parts[1];
      const ticketMode = parts[2] || 'channel';
      const logChannelId = interaction.values[0];

      try {
        const panelChannel = await guild.channels.fetch(panelChannelId).catch(() => null);
        const logChannel = await guild.channels.fetch(logChannelId).catch(() => null);

        if (!panelChannel || !logChannel) {
          return interaction.editReply({ content: '❌ Could not fetch one of the selected channels.', embeds: [], components: [] });
        }

        // Save wizard configuration
        await database.findOneAndUpdate(
          { guildId },
          { 
            $set: { 
              ticketConfig: {
                panelChannelId,
                staffRoleId,
                logChannelId,
                ticketMode: ticketMode,
                ticketCounter: guildConfig.ticketConfig?.ticketCounter || 0,
                panelMessageId: null
              }
            } 
          },
          { upsert: true }
        );

        // Deploy the panel
        const panelTitle = cuteStyle !== 'off' ? formatCute('Support Desk', cuteStyle, '🎫') : '🎫 Support Desk';
        const modeEmoji = ticketMode === 'thread' ? '🧵' : '🔹';
        
        const panelEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(panelTitle)
          .setDescription(
            `Need help? Create a support ticket below!\n\n` +
            `Click **Create Ticket** to open a private support ${ticketMode === 'thread' ? 'thread' : 'channel'}.\n` +
            `Our support team will be notified and assist you shortly.\n\n` +
            `🔒 Your ticket is private and secure.\n${modeEmoji} Using ${ticketMode} mode`
          )
          .setFooter({ text: `${guild.name} Support System` })
          .setTimestamp();

        const panelRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_system_open')
            .setLabel('Create Ticket')
            .setEmoji('🎟️')
            .setStyle(ButtonStyle.Success)
        );

        const panelMsg = await panelChannel.send({ embeds: [panelEmbed], components: [panelRow] });

        const successEmbed = new EmbedBuilder()
          .setColor('#2ECC71')
          .setTitle('✅ Ticket System Deployed!')
          .setDescription(`Your ticket support system has been successfully configured.\n\n` +
            `${modeEmoji} **Mode:** ${ticketMode === 'channel' ? 'Channels' : 'Threads'}\n` +
            `📍 **Panel Channel:** <#${panelChannelId}>\n` +
            `👮 **Staff Role:** <@&${staffRoleId}>\n` +
            `📋 **Log Channel:** <#${logChannelId}>`)
          .setTimestamp();

        return interaction.editReply({ embeds: [successEmbed], components: [] });
      } catch (err) {
        console.error('Wizard panel deployment error:', err);
        return interaction.editReply({ content: `❌ Error deploying panel: ${err.message}`, embeds: [], components: [] });
      }
    }

    // ==========================================
    // WIZARD: Step 1 (legacy fallback)
    // ==========================================
    if (customId === 'ticket_wizard_step1') {
      await interaction.deferUpdate();

      // Fetch ALL text channels from guild with timeout
      await Promise.race([
        interaction.guild.channels.fetch(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
      ]).catch(() => null);
      
      const allLegacyChannels = interaction.guild.channels.cache
        .filter(channel => channel.type === ChannelType.GuildText)
        .sort((a, b) => a.position - b.position) // Simple position sort only
        .first(25); // Discord component limit is 25 options

      if (allLegacyChannels.size === 0) {
        return interaction.editReply({ 
          content: '❌ No text channels available. Please create some text channels first.',
          components: []
        });
      }

      const wizardEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🧙 Ticket System Deployment Wizard')
        .setDescription('**Step 1 of 3:** Select the channel where the ticket panel will be deployed.')
        .setTimestamp();

      const legacyChannelOptions = allLegacyChannels.map(channel => ({
        label: channel.name,
        value: channel.id,
        description: `Channel · Position: ${channel.position}`
      }));

      const channelSelect = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('ticket_wizard_channel_select')
          .setPlaceholder('Choose a channel for the ticket panel...')
          .addOptions(legacyChannelOptions)
      );

      await interaction.editReply({ embeds: [wizardEmbed], components: [channelSelect] });
    }

    // ==========================================
    // OPEN TICKET (Channel or Thread Mode)
    // ==========================================
    if (customId === 'ticket_system_open') {
      await interaction.deferReply({ ephemeral: true });

      try {
        const ticketConfig = guildConfig.ticketConfig;
        if (!ticketConfig || !ticketConfig.staffRoleId || !ticketConfig.logChannelId) {
          return interaction.editReply({ content: '❌ Ticket system is not properly configured. Please run the setup wizard.' });
        }

        const activeTickets = guildConfig.activeTickets || {};
        const userHasTicket = Object.values(activeTickets).some(t => 
          typeof t === 'string' ? t === user.id : t.userId === user.id
        );
        
        if (userHasTicket) {
          return interaction.editReply({ content: '❌ You already have an active ticket. Please close it first.' });
        }

        // Increment ticket counter
        const ticketNumber = (ticketConfig.ticketCounter || 0) + 1;
        const ticketId = `ticket_${Date.now()}_${user.id}`;
        const isThreadMode = ticketConfig.ticketMode === 'thread';

        if (isThreadMode) {
          // ===== THREAD MODE =====
          const panelChannel = await guild.channels.fetch(ticketConfig.panelChannelId).catch(() => null);
          if (!panelChannel) {
            return interaction.editReply({ content: '❌ Could not find the panel channel.' });
          }

          const threadName = `ticket-${ticketNumber}`;
          const ticketThread = await panelChannel.threads.create({
            name: threadName,
            autoArchiveDuration: 1440, // 24 hours
            type: 'PRIVATE_THREAD'
          }).catch(err => {
            console.error('Thread creation error:', err);
            return null;
          });

          if (!ticketThread) {
            return interaction.editReply({ content: '❌ Failed to create ticket thread.' });
          }

          // Add users to thread manually
          await ticketThread.members.add(user.id).catch(() => null);
          const staffRole = guild.roles.cache.get(ticketConfig.staffRoleId);
          if (staffRole && staffRole.members.size > 0) {
            for (const member of staffRole.members.values()) {
              await ticketThread.members.add(member.id).catch(() => null);
            }
          }

          // Update config with new ticket and counter
          await database.findOneAndUpdate(
            { guildId },
            { 
              $set: { 
                [`activeTickets.${ticketThread.id}`]: { userId: user.id, ticketNumber, ticketId, createdAt: Date.now(), isThread: true, parentChannelId: ticketConfig.panelChannelId },
                'ticketConfig.ticketCounter': ticketNumber
              }
            },
            { upsert: true }
          );

          // Send welcome message in thread
          const welcomeEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle(`🎫 Ticket #${ticketNumber}`)
            .setDescription(`Welcome ${user}!\n\nThis is your private support ticket. Describe your issue and our staff team will assist you shortly.\n\n**Staff:** <@&${ticketConfig.staffRoleId}>`)
            .setFooter({ text: 'Use the buttons below to manage your ticket' })
            .setTimestamp();

          const ticketControlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_user_close')
              .setLabel('Close Ticket')
              .setEmoji('🔒')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('ticket_staff_close')
              .setLabel('Close (Staff)')
              .setEmoji('👮')
              .setStyle(ButtonStyle.Danger)
          );

          await ticketThread.send({ content: `${user} <@&${ticketConfig.staffRoleId}>`, embeds: [welcomeEmbed], components: [ticketControlRow] });

          // Send log message
          const logChannel = await guild.channels.fetch(ticketConfig.logChannelId).catch(() => null);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setColor('#5865F2')
              .setTitle('📊 Ticket Opened (Thread)')
              .setDescription(`**Ticket:** #${ticketNumber}\n**User:** ${user} (${user.id})\n**Thread:** <#${ticketThread.id}> in <#${ticketConfig.panelChannelId}>`)
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
          }

          try { await logAction(guild, 'Ticket Opened', user, `Ticket #${ticketNumber} (Thread)`); } catch (e) {}

          return interaction.editReply({ content: `✅ Ticket created! Access it here: <#${ticketThread.id}>` });
        } else {
          // ===== CHANNEL MODE =====
          const channelName = `ticket-${ticketNumber}`;
          const ticketChannel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            topic: `Ticket #${ticketNumber} opened by ${user.tag}`,
            permissionOverwrites: [
              { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
              { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory] },
              { id: ticketConfig.staffRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] }
            ],
          });

          // Update config with new ticket and counter
          await database.findOneAndUpdate(
            { guildId },
            { 
              $set: { 
                [`activeTickets.${ticketChannel.id}`]: { userId: user.id, ticketNumber, ticketId, createdAt: Date.now(), isThread: false },
                'ticketConfig.ticketCounter': ticketNumber
              }
            },
            { upsert: true }
          );

          // Send welcome message
          const welcomeEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle(`🎫 Ticket #${ticketNumber}`)
            .setDescription(`Welcome ${user}!\n\nThis is your private support ticket. Describe your issue and our staff team will assist you shortly.\n\n**Staff:** <@&${ticketConfig.staffRoleId}>`)
            .setFooter({ text: 'Use the buttons below to manage your ticket' })
            .setTimestamp();

          const ticketControlRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('ticket_user_close')
              .setLabel('Close Ticket')
              .setEmoji('🔒')
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId('ticket_staff_close')
              .setLabel('Close (Staff)')
              .setEmoji('👮')
              .setStyle(ButtonStyle.Danger)
          );

          await ticketChannel.send({ content: `${user} <@&${ticketConfig.staffRoleId}>`, embeds: [welcomeEmbed], components: [ticketControlRow] });

          // Send log message
          const logChannel = await guild.channels.fetch(ticketConfig.logChannelId).catch(() => null);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setColor('#5865F2')
              .setTitle('📊 Ticket Opened')
              .setDescription(`**Ticket:** #${ticketNumber}\n**User:** ${user} (${user.id})\n**Channel:** ${ticketChannel}`)
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
          }

          try { await logAction(guild, 'Ticket Opened', user, `Ticket #${ticketNumber}`); } catch (e) {}

          return interaction.editReply({ content: `✅ Ticket created! Access it here: ${ticketChannel}` });
        }
      } catch (err) {
        console.error('Ticket creation error:', err);
        return interaction.editReply({ content: `❌ Error creating ticket: ${err.message}` });
      }
    }

    // ==========================================
    // USER CLOSE TICKET
    // ==========================================
    if (customId === 'ticket_user_close') {
      await interaction.deferReply({ ephemeral: true });

      const ticketConfig = guildConfig.ticketConfig;
      const ticketData = guildConfig.activeTickets?.[interaction.channelId];

      if (!ticketData || ticketData.userId !== user.id) {
        return interaction.editReply({ content: '❌ Only the ticket creator can close their ticket.' });
      }

      // Show transcript button
      const transcriptRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_get_transcript')
          .setLabel('Get Transcript')
          .setEmoji('📄')
          .setStyle(ButtonStyle.Primary)
      );

      const closeEmbed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('⏳ Closing Ticket...')
        .setDescription(ticketData.isThread ? 'This ticket will be closed. Staff can get the transcript and archive the thread.' : 'This ticket will be closed. Staff can get the transcript and delete the channel.')
        .setTimestamp();

      await interaction.editReply({ embeds: [closeEmbed], components: [transcriptRow] });

      // Mark ticket for closing
      await database.findOneAndUpdate(
        { guildId },
        { $set: { [`activeTickets.${interaction.channelId}.status`]: 'user_requested_close' } }
      );
    }

    // ==========================================
    // STAFF CLOSE TICKET
    // ==========================================
    if (customId === 'ticket_staff_close') {
      const memberExecutor = interaction.member;

      if (!memberExecutor.roles.cache.has(guildConfig.ticketConfig?.staffRoleId) &&
          !memberExecutor.permissions.has(PermissionFlagsBits.Administrator) &&
          !memberExecutor.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ Only staff can close tickets.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const ticketData = guildConfig.activeTickets?.[interaction.channelId];
      if (!ticketData) {
        return interaction.editReply({ content: '❌ Could not find ticket data.' });
      }

      // Show options
      const optionsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('ticket_get_transcript')
          .setLabel('Get Transcript First')
          .setEmoji('📄')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('ticket_confirm_delete')
          .setLabel(ticketData.isThread ? 'Archive & Close Thread' : 'Delete Channel')
          .setEmoji(ticketData.isThread ? '📌' : '🗑️')
          .setStyle(ButtonStyle.Danger)
      );

      const closeEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🔒 Closing Ticket...')
        .setDescription(ticketData.isThread ? 'Get a transcript before archiving the thread.' : 'Get a transcript before deleting the channel.')
        .setTimestamp();

      await interaction.editReply({ embeds: [closeEmbed], components: [optionsRow] });

      // Mark ticket as staff requested close
      await database.findOneAndUpdate(
        { guildId },
        { $set: { [`activeTickets.${interaction.channelId}.status`]: 'staff_requested_close' } }
      );
    }

    // ==========================================
    // GET TRANSCRIPT
    // ==========================================
    if (customId === 'ticket_get_transcript') {
      await interaction.deferReply({ ephemeral: true });

      const ticketData = guildConfig.activeTickets?.[interaction.channelId];
      if (!ticketData) {
        return interaction.editReply({ content: '❌ Could not find ticket data.' });
      }

      try {
        // Fetch all messages
        const messages = await interaction.channel.messages.fetch({ limit: 100 });
        const sortedMessages = Array.from(messages.values()).reverse();

        // Collect participants
        const participantMap = new Map();
        let userAuthor = null;
        
        for (const msg of sortedMessages) {
          if (!participantMap.has(msg.author.id)) {
            participantMap.set(msg.author.id, {
              userId: msg.author.id,
              username: msg.author.username,
              displayName: msg.author.displayName || msg.author.username
            });
          }
          if (msg.author.id === ticketData.userId) {
            userAuthor = {
              userId: msg.author.id,
              username: msg.author.username,
              displayName: msg.author.displayName || msg.author.username
            };
          }
        }

        // Calculate duration
        const closedTime = Date.now();
        const openedTime = ticketData.createdAt;
        const durationSeconds = Math.floor((closedTime - openedTime) / 1000);

        // Generate transcript with display names for UI
        let transcript = `╔════════════════════════════════════════╗\n`;
        transcript += `║         TICKET TRANSCRIPT              ║\n`;
        transcript += `╠════════════════════════════════════════╣\n`;
        transcript += `║ Ticket #${ticketData.ticketNumber || 'Unknown'}\n`;
        transcript += `║ User: ${userAuthor?.displayName || 'Unknown'} (@${userAuthor?.username || 'unknown'})\n`;
        transcript += `║ Created: ${new Date(openedTime).toLocaleString()}\n`;
        transcript += `║ Closed: ${new Date(closedTime).toLocaleString()}\n`;
        transcript += `║ Duration: ${Math.floor(durationSeconds / 60)} minutes\n`;
        transcript += `║ Messages: ${sortedMessages.length}\n`;
        transcript += `╚════════════════════════════════════════╝\n\n`;

        for (const msg of sortedMessages) {
          if (msg.author.bot && msg.author.id !== interaction.client.user.id) continue;
          
          const timestamp = msg.createdTimestamp ? new Date(msg.createdTimestamp).toLocaleString() : 'Unknown';
          const displayName = msg.author.displayName || msg.author.username;
          transcript += `[${timestamp}] ${displayName} (@${msg.author.username}):\n`;
          
          if (msg.content) {
            transcript += `${msg.content}\n`;
          }
          
          if (msg.embeds.length > 0) {
            transcript += `[Embed: ${msg.embeds[0].title || 'No title'}]\n`;
          }
          
          if (msg.attachments.size > 0) {
            transcript += `[Attachments: ${msg.attachments.map(a => a.name).join(', ')}]\n`;
          }
          
          transcript += `\n`;
        }

        transcript += `═══════════════════════════════════════════\n`;
        transcript += `End of Transcript\n`;

        // Save to database with all information
        const ticketTranscript = new TicketTranscript({
          ticketId: ticketData.ticketId,
          ticketNumber: ticketData.ticketNumber,
          guildId: guildId,
          userId: ticketData.userId,
          username: userAuthor?.username || 'unknown',
          channelName: interaction.channel.name,
          isThread: ticketData.isThread || false,
          staffRoleId: guildConfig.ticketConfig?.staffRoleId || null,
          participants: Array.from(participantMap.values()).map(p => ({
            userId: p.userId,
            username: p.username
          })),
          createdAt: new Date(openedTime),
          closedAt: new Date(closedTime),
          duration: durationSeconds,
          transcriptContent: transcript,
          messageCount: sortedMessages.length
        });
        await ticketTranscript.save();

        // Send via DM as file
        const transcriptFile = Buffer.from(transcript, 'utf-8');
        const ticketFileName = `ticket-${ticketData.ticketNumber || 'unknown'}-transcript.txt`;

        try {
          await user.send({
            content: `📄 **Ticket #${ticketData.ticketNumber} Transcript**\n\n` +
                     `Duration: ${Math.floor(durationSeconds / 60)} minutes\n` +
                     `Messages: ${sortedMessages.length}\n` +
                     `Saved to server database ✅`,
            files: [
              {
                attachment: transcriptFile,
                name: ticketFileName
              }
            ]
          });
          await interaction.editReply({ content: `✅ Transcript sent to your DMs and saved to database!` });
        } catch (dmErr) {
          console.error('DM send error:', dmErr);
          // Try to send as reply instead
          await interaction.editReply({ 
            content: `✅ Transcript generated and saved to database!`,
            files: [{ attachment: transcriptFile, name: ticketFileName }]
          });
        }
      } catch (err) {
        console.error('Transcript error:', err);
        return interaction.editReply({ content: `❌ Error generating transcript: ${err.message}` });
      }
    }

    // ==========================================
    // CONFIRM DELETE TICKET (Channel or Thread)
    // ==========================================
    if (customId === 'ticket_confirm_delete') {
      await interaction.deferReply({ ephemeral: true });

      const ticketData = guildConfig.activeTickets?.[interaction.channelId];
      const ticketConfig = guildConfig.ticketConfig;

      if (!ticketData) {
        return interaction.editReply({ content: '❌ Could not find ticket data.' });
      }

      const isThreadMode = ticketData.isThread;

      if (isThreadMode) {
        // ===== THREAD MODE CLOSE =====
        try {
          // Remove user from thread
          await interaction.channel.members.remove(ticketData.userId).catch(() => null);

          // Archive the thread
          await interaction.channel.setArchived(true).catch(() => null);

          // Send log message
          const logChannel = ticketConfig && ticketConfig.logChannelId ? 
            await guild.channels.fetch(ticketConfig.logChannelId).catch(() => null) : null;
          
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setColor('#ED4245')
              .setTitle('📊 Ticket Closed (Thread)')
              .setDescription(`**Ticket:** #${ticketData.ticketNumber || 'Unknown'}\n**User:** <@${ticketData.userId}>\n**Thread:** <#${interaction.channelId}>`)
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
          }

          try { await logAction(guild, 'Ticket Closed', guild.members.cache.get(ticketData.userId) || { user: { tag: ticketData.userId } }, `Ticket #${ticketData.ticketNumber} (Thread Archived)`); } catch (e) {}

          // Remove from active tickets
          await database.findOneAndUpdate(
            { guildId },
            { $unset: { [`activeTickets.${interaction.channelId}`]: "" } }
          );

          return interaction.editReply({ content: '📌 Thread archived and user removed!' });
        } catch (err) {
          console.error('Thread close error:', err);
          return interaction.editReply({ content: `❌ Error closing thread: ${err.message}` });
        }
      } else {
        // ===== CHANNEL MODE CLOSE =====
        try {
          // Remove user from channel
          const ticketUser = await guild.members.fetch(ticketData.userId).catch(() => null);
          if (ticketUser) {
            await interaction.channel.permissionOverwrites.edit(ticketUser, { ViewChannel: false });
          }

          // Send log message
          const logChannel = ticketConfig && ticketConfig.logChannelId ? 
            await guild.channels.fetch(ticketConfig.logChannelId).catch(() => null) : null;
          
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setColor('#ED4245')
              .setTitle('📊 Ticket Closed')
              .setDescription(`**Ticket:** #${ticketData.ticketNumber || 'Unknown'}\n**User:** <@${ticketData.userId}>\n**Channel:** ${interaction.channel.name}`)
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
          }

          try { await logAction(guild, 'Ticket Closed', guild.members.cache.get(ticketData.userId) || { user: { tag: ticketData.userId } }, `Ticket #${ticketData.ticketNumber}`); } catch (e) {}

          // Remove from active tickets and delete channel
          await database.findOneAndUpdate(
            { guildId },
            { $unset: { [`activeTickets.${interaction.channelId}`]: "" } }
          );

          await interaction.editReply({ content: '🗑️ Deleting channel in 5 seconds...' });

          setTimeout(async () => {
            try {
              await interaction.channel.delete();
            } catch (err) {
              console.error('Channel delete error:', err.message);
            }
          }, 5000);
        } catch (err) {
          console.error('Ticket close error:', err);
          return interaction.editReply({ content: `❌ Error closing ticket: ${err.message}` });
        }
      }
    }

    // ==========================================
    // TICKET HISTORY: Pagination
    // ==========================================
    if (customId.startsWith('ticket_history_next_') || customId.startsWith('ticket_history_prev_')) {
      await interaction.deferUpdate();

      try {
        const parts = customId.split('_');
        const currentPage = parseInt(parts[3]);
        const isNext = customId.startsWith('ticket_history_next_');

        // Fetch all transcripts
        const allTranscripts = await TicketTranscript.find({ guildId }).sort({ createdAt: -1 }).lean();
        const itemsPerPage = 10;
        const pages = [];
        for (let i = 0; i < allTranscripts.length; i += itemsPerPage) {
          pages.push(allTranscripts.slice(i, i + itemsPerPage));
        }

        const newPage = isNext ? currentPage + 1 : currentPage - 1;
        if (newPage < 0 || newPage >= pages.length) return;

        const pageTranscripts = pages[newPage];
        const pageEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle('📜 Ticket History')
          .setDescription(`Showing page **${newPage + 1}** of **${pages.length}**\n\nSelect a ticket to view its transcript:`)
          .setTimestamp();

        for (let i = 0; i < pageTranscripts.length; i++) {
          const t = pageTranscripts[i];
          const duration = Math.floor(t.duration / 60);
          const createdDate = new Date(t.createdAt).toLocaleDateString();
          pageEmbed.addFields({
            name: `${i + 1}. Ticket #${t.ticketNumber}`,
            value: `**User:** @${t.username}\n**Created:** ${createdDate}\n**Duration:** ${duration} min\n**Messages:** ${t.messageCount}`,
            inline: false
          });
        }

        const paginationRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_history_page_${newPage}`)
            .setLabel(`Page ${newPage + 1} of ${pages.length}`)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📖')
            .setDisabled(true),
          newPage > 0 ? new ButtonBuilder()
            .setCustomId(`ticket_history_prev_${newPage}`)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️') : new ButtonBuilder()
            .setCustomId('ticket_history_disabled_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
            .setDisabled(true),
          newPage < pages.length - 1 ? new ButtonBuilder()
            .setCustomId(`ticket_history_next_${newPage}`)
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('➡️') : new ButtonBuilder()
            .setCustomId('ticket_history_disabled_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('➡️')
            .setDisabled(true)
        );

        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId(`ticket_history_select_${newPage}`)
            .setPlaceholder('Choose a ticket to view...')
            .addOptions(pageTranscripts.map((t, i) => ({
              label: `Ticket #${t.ticketNumber}`,
              description: `by @${t.username} • ${Math.floor(t.duration / 60)} min`,
              value: `${newPage}_${i}`,
              emoji: '🎟️'
            })))
        );

        await interaction.editReply({ embeds: [pageEmbed], components: [paginationRow, selectRow] });
      } catch (err) {
        console.error('Pagination error:', err);
        await interaction.editReply({ content: `❌ Error: ${err.message}` });
      }
    }

    // ==========================================
    // TICKET HISTORY: Transcript Selection
    // ==========================================
    if (customId.startsWith('ticket_history_select_') && interaction.isStringSelectMenu()) {
      await interaction.deferReply({ ephemeral: true });

      try {
        const value = interaction.values[0];
        const [pageStr, indexStr] = value.split('_');
        const pageIndex = parseInt(pageStr);
        const ticketIndex = parseInt(indexStr);

        // Fetch all transcripts
        const allTranscripts = await TicketTranscript.find({ guildId }).sort({ createdAt: -1 }).lean();
        const itemsPerPage = 10;
        const pages = [];
        for (let i = 0; i < allTranscripts.length; i += itemsPerPage) {
          pages.push(allTranscripts.slice(i, i + itemsPerPage));
        }

        const selectedTranscript = pages[pageIndex][ticketIndex];
        if (!selectedTranscript) {
          return interaction.editReply({ content: '❌ Transcript not found.' });
        }

        // Build info embed
        const infoEmbed = new EmbedBuilder()
          .setColor('#5865F2')
          .setTitle(`📄 Ticket #${selectedTranscript.ticketNumber} Transcript`)
          .addFields(
            { name: '👤 User', value: `@${selectedTranscript.username} (\`${selectedTranscript.userId}\`)`, inline: true },
            { name: '⏱️ Duration', value: `${Math.floor(selectedTranscript.duration / 60)} minutes`, inline: true },
            { name: '💬 Messages', value: `${selectedTranscript.messageCount}`, inline: true },
            { name: '📅 Created', value: `<t:${Math.floor(selectedTranscript.createdAt.getTime() / 1000)}:f>`, inline: true },
            { name: '🔒 Closed', value: `<t:${Math.floor(selectedTranscript.closedAt.getTime() / 1000)}:f>`, inline: true },
            { name: '🧵 Type', value: selectedTranscript.isThread ? 'Thread' : 'Channel', inline: true },
            { name: '👥 Participants', value: selectedTranscript.participants.map(p => `@${p.username}`).join(', ') || 'Unknown', inline: false }
          )
          .setTimestamp();

        // Send transcript file via DM
        const transcriptFile = Buffer.from(selectedTranscript.transcriptContent, 'utf-8');
        const ticketFileName = `ticket-${selectedTranscript.ticketNumber}-transcript.txt`;

        try {
          await interaction.user.send({
            content: `📄 **Ticket #${selectedTranscript.ticketNumber} Transcript**\n\n` +
                     `**User:** @${selectedTranscript.username}\n` +
                     `**Duration:** ${Math.floor(selectedTranscript.duration / 60)} minutes\n` +
                     `**Messages:** ${selectedTranscript.messageCount}\n` +
                     `**Created:** <t:${Math.floor(selectedTranscript.createdAt.getTime() / 1000)}:f>\n` +
                     `**Closed:** <t:${Math.floor(selectedTranscript.closedAt.getTime() / 1000)}:f>`,
            files: [{ attachment: transcriptFile, name: ticketFileName }]
          });
          await interaction.editReply({ embeds: [infoEmbed], content: '✅ Transcript sent to your DMs!' });
        } catch (dmErr) {
          console.error('DM send error:', dmErr);
          await interaction.editReply({ 
            embeds: [infoEmbed],
            files: [{ attachment: transcriptFile, name: ticketFileName }],
            content: '✅ Transcript sent here!'
          });
        }
      } catch (err) {
        console.error('Transcript selection error:', err);
        await interaction.editReply({ content: `❌ Error: ${err.message}` });
      }
    }
  }
};