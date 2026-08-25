const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    ChannelType, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
  } = require('discord.js');
  const mongoose = require('mongoose');
  const database = require('../utils/database'); // Linked to your live Mongo connection
  
  // ==========================================
  // 1. EMBEDDED MONGOOSE ANALYTICS SCHEMA
  // ==========================================
  const AnalyticsSchema = new mongoose.Schema({
      guildId: { type: String, required: true, unique: true },
      enabled: { type: Boolean, default: false },
      categoryId: { type: String, default: null },
      totalChannelId: { type: String, default: null },
      humansChannelId: { type: String, default: null },
      botsChannelId: { type: String, default: null },
      wizardActive: { type: Boolean, default: false },
      wizardStep: { type: Number, default: 0 },
      wizardUserId: { type: String, default: null },
      labelStyle: { type: String, enum: ['clean', 'tech', 'secure'], default: 'clean' }
  });
  const AnalyticsModel = mongoose.models.AnalyticsRule || mongoose.model('AnalyticsRule', AnalyticsSchema);

  // guild.members.cache is only ever as complete as whatever the client has
  // seen over the gateway — right after startup (or in large servers) it can
  // be a small fraction of the real member list, which is why the bot count
  // was showing way under the real number. guild.memberCount is always
  // accurate, so we fetch the full member list first and derive bots/humans
  // from memberCount so the two numbers always add up correctly.
  async function getMemberCounts(guild) {
    const totalMembers = guild.memberCount;
    let totalBots;
    try {
      const members = await guild.members.fetch();
      totalBots = members.filter(m => m.user.bot).size;
    } catch (err) {
      console.error(`[Analytics] members.fetch() failed for ${guild.id}, falling back to cache:`, err.message);
      totalBots = guild.members.cache.filter(m => m.user.bot).size || 0;
    }
    const totalHumans = totalMembers - totalBots;
    return { totalMembers, totalBots, totalHumans };
  }

  // Auto-refresh interval — how often the background loop re-checks every
  // enabled guild's counters and renames channels if the numbers drifted.
  const AUTO_REFRESH_MS = 60 * 1000; // 1 minute

  // Single source of truth for what each label style renders as, shared by
  // /analytics setup, /analytics update, the edit-wizard finalizer, and the
  // background auto-refresh loop — so a chosen style (tech/secure) is never
  // silently reset back to the default "clean" labels by any of them.
  function buildLabels(style, totalMembers, totalHumans, totalBots) {
    if (style === 'tech') {
      return {
        categoryName: '⚙️ DATA CORE ──',
        totalLabel: `├ 🛰️ ALL FIELDS: ${totalMembers}`,
        humansLabel: `├ 👥 POPULATION: ${totalHumans}`,
        botsLabel: `└ 🤖 CONNECTORS: ${totalBots}`,
      };
    }
    if (style === 'secure') {
      return {
        categoryName: '🔒 PROTECTION METRICS',
        totalLabel: `🔒 Verified Node: ${totalMembers}`,
        humansLabel: `🔒 Human Access: ${totalHumans}`,
        botsLabel: `🔒 Core Apps: ${totalBots}`,
      };
    }
    return {
      categoryName: '📊 SERVER STATS',
      totalLabel: `👥 Total Members: ${totalMembers}`,
      humansLabel: `🙋 Humans: ${totalHumans}`,
      botsLabel: `🤖 Bots: ${totalBots}`,
    };
  }

  // Walks every guild with analytics enabled and renames any channel whose
  // label is stale. Only calls setName() when the text actually changed, to
  // stay well clear of Discord's 2-renames-per-10-minutes-per-channel cap.
  async function refreshAllAnalyticsGuilds(client) {
    const docs = await AnalyticsModel.find({ enabled: true }).catch(() => []);
    for (const doc of docs) {
      const guild = client.guilds.cache.get(doc.guildId);
      if (!guild) continue;
      try {
        const { totalMembers, totalBots, totalHumans } = await getMemberCounts(guild);
        const { categoryName, totalLabel, humansLabel, botsLabel } = buildLabels(doc.labelStyle, totalMembers, totalHumans, totalBots);

        const cat = guild.channels.cache.get(doc.categoryId);
        if (cat && cat.name !== categoryName) await cat.setName(categoryName).catch(() => null);
        const tc = guild.channels.cache.get(doc.totalChannelId);
        if (tc && tc.name !== totalLabel) await tc.setName(totalLabel).catch(() => null);
        const hc = guild.channels.cache.get(doc.humansChannelId);
        if (hc && hc.name !== humansLabel) await hc.setName(humansLabel).catch(() => null);
        const bc = guild.channels.cache.get(doc.botsChannelId);
        if (bc && bc.name !== botsLabel) await bc.setName(botsLabel).catch(() => null);
      } catch (err) {
        console.error(`[Analytics] Auto-refresh failed for guild ${doc.guildId}:`, err.message);
      }
    }
  }

  function startAnalyticsRefresher(client) {
    refreshAllAnalyticsGuilds(client).catch(() => null);
    setInterval(() => refreshAllAnalyticsGuilds(client).catch(() => null), AUTO_REFRESH_MS);
    console.log(`[Analytics] Auto-refresh loop started (every ${AUTO_REFRESH_MS / 1000}s).`);
  }

  module.exports = {
    data: new SlashCommandBuilder()
      .setName('analytics')
      .setDescription('📊 Live stat counter channels at the top of your list. Auto-refreshes every 1 min.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand(sub => sub.setName('setup').setDescription('Deploy statistics channel grids (auto-refreshes every 1 min)'))
      .addSubcommand(sub => sub.setName('edit').setDescription('✏️ Modify your existing statistics channel layout settings'))
      .addSubcommand(sub => sub.setName('delete').setDescription('🗑️ Wipe current statistic channels and clear database traces'))
      .addSubcommand(sub => sub.setName('update').setDescription('🔄 Force an instant refresh (counters already auto-refresh every 1 min)')),
    name: 'analytics',
    startAnalyticsRefresher,
  
    async execute(interaction, client) {
      const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : false;
      const guild = interaction.guild;
      if (!guild) return;
      const guildId = guild.id;
      const memberExecutor = interaction.member;
  
      if (!memberExecutor.permissions.has(PermissionFlagsBits.ManageGuild) && 
          !memberExecutor.permissions.has(PermissionFlagsBits.Administrator)) {
        const lockMsg = '❌ **Access Denied:** You need `Manage Server` or `Administrator` privileges.';
        return isInteraction ? interaction.reply({ content: lockMsg, ephemeral: true }) : interaction.reply(lockMsg);
      }
  
      if (isInteraction) await interaction.deferReply({ ephemeral: true }).catch(() => null);
      const doc = await AnalyticsModel.findOne({ guildId }).catch(() => null) || new AnalyticsModel({ guildId });
      const commandName = isInteraction ? interaction.options.getSubcommand() : interaction.content?.split(/ +/)[1]?.toLowerCase();
  
      // ==========================================
      // MODULE FLOW A: SETUP COUNTER SYSTEM
      // ==========================================
      if (commandName === 'setup') {
        // Safe destruction layer: Wipe old active entries before deploying fresh nodes
        if (doc.categoryId) { const c = guild.channels.cache.get(doc.categoryId); if (c) await c.delete().catch(() => null); }
        if (doc.totalChannelId) { const c = guild.channels.cache.get(doc.totalChannelId); if (c) await c.delete().catch(() => null); }
        if (doc.humansChannelId) { const c = guild.channels.cache.get(doc.humansChannelId); if (c) await c.delete().catch(() => null); }
        if (doc.botsChannelId) { const c = guild.channels.cache.get(doc.botsChannelId); if (c) await c.delete().catch(() => null); }
  
        const { totalMembers, totalBots, totalHumans } = await getMemberCounts(guild);
        const { totalLabel, humansLabel, botsLabel } = buildLabels('clean', totalMembers, totalHumans, totalBots);

        // Spawns structural stats framework category pinned to position 0
        const statsCategory = await guild.channels.create({
          name: '📊 SERVER STATS',
          type: ChannelType.GuildCategory,
          position: 0
        });

        const totalChan = await guild.channels.create({ name: totalLabel, type: ChannelType.GuildVoice, parent: statsCategory.id, permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect], allow: [PermissionFlagsBits.ViewChannel] }] });
        const humansChan = await guild.channels.create({ name: humansLabel, type: ChannelType.GuildVoice, parent: statsCategory.id, permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect], allow: [PermissionFlagsBits.ViewChannel] }] });
        const botsChan = await guild.channels.create({ name: botsLabel, type: ChannelType.GuildVoice, parent: statsCategory.id, permissionOverwrites: [{ id: guild.roles.everyone.id, deny: [PermissionFlagsBits.Connect], allow: [PermissionFlagsBits.ViewChannel] }] });

        doc.enabled = true;
        doc.categoryId = statsCategory.id;
        doc.totalChannelId = totalChan.id;
        doc.humansChannelId = humansChan.id;
        doc.botsChannelId = botsChan.id;
        doc.wizardActive = false;
        doc.labelStyle = 'clean';
        await doc.save();

        const successEmbed = new EmbedBuilder()
          .setTitle('✅ Counter Channels Deployed')
          .setDescription(`Successfully created your stats tracking layout pinned cleanly at position \`0\` of your server list.\n\n🔄 **Auto-Refresh:** These counters update automatically every **1 minute** — you don't need to run \`/analytics update\` yourself. That command is still there if you ever want to force an immediate refresh.`)
          .setColor('#2ECC71');
  
        return isInteraction ? interaction.editReply({ embeds: [successEmbed] }) : interaction.reply({ embeds: [successEmbed] });
      }
    // ==========================================
    // MODULE FLOW B: EDIT COUNTER CONFIGURATIONS
    // ==========================================
    if (commandName === 'edit') {
        if (!doc.enabled || !doc.categoryId) {
          const err = '❌ **Error:** No analytics setup was found to edit. Run `/analytics setup` first.';
          return isInteraction ? interaction.editReply(err) : interaction.reply(err);
        }
  
        doc.wizardActive = true;
        doc.wizardStep = 1;
        doc.wizardUserId = interaction.user.id;
        await doc.save();
  
        const editEmbed = new EmbedBuilder()
          .setTitle('✏️ Edit Stats Channels: Step 1')
          .setDescription(`Would you like to change the category wrapper name? Current name is **📊 SERVER STATS**.\n\nClick **Change Name** to input modifications, or click the **Skip This Step** button to preserve it.`)
          .setColor('#E67E22');
  
        const buttonsRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`analytics_edit_action_modify_${interaction.user.id}`).setLabel('Change Name Layout').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`analytics_edit_action_skip_${interaction.user.id}`).setLabel('Skip This Step').setStyle(ButtonStyle.Secondary)
        );
  
        return isInteraction 
          ? interaction.editReply({ embeds: [editEmbed], components: [buttonsRow] }) 
          : interaction.reply({ embeds: [editEmbed], components: [buttonsRow] });
      }
  
      // ==========================================
      // MODULE FLOW C: PURGE COUNTERS FROM SERVER
      // ==========================================
      if (commandName === 'delete') {
        const confirmEmbed = new EmbedBuilder()
          .setTitle('⚠️ Absolute Safety Confirmation Check')
          .setDescription(
            `### Are you absolutely sure?\n` +
            `Proceeding will completely delete your stats tracking category, remove all voice counter nodes from your channel list, and drop all configuration files out of your database.\n\n` +
            `🚨 *Note: This operation cannot be reversed.*`
          )
          .setColor('#ED4245');
  
        const buttonsRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`analytics_delete_confirm_${interaction.user.id}`).setLabel('Yes, Delete Everything').setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId('analytics_delete_cancel').setLabel('Cancel Operation').setStyle(ButtonStyle.Secondary)
        );
  
        return isInteraction 
          ? interaction.editReply({ embeds: [confirmEmbed], components: [buttonsRow] }) 
          : interaction.reply({ embeds: [confirmEmbed], components: [buttonsRow] });
      }
  
      // ==========================================
      // MODULE FLOW D: FORCE UPDATE REFRESH LOOP
      // ==========================================
      if (commandName === 'update') {
        if (!doc.enabled || !doc.categoryId) {
          const err = '❌ **Error:** No active layouts configured. Run `/analytics setup` first.';
          return isInteraction ? interaction.editReply(err) : interaction.reply(err);
        }
  
        const { totalMembers, totalBots, totalHumans } = await getMemberCounts(guild);
        const { totalLabel, humansLabel, botsLabel } = buildLabels(doc.labelStyle, totalMembers, totalHumans, totalBots);

        const tc = guild.channels.cache.get(doc.totalChannelId); if (tc) await tc.setName(totalLabel).catch(() => null);
        const hc = guild.channels.cache.get(doc.humansChannelId); if (hc) await hc.setName(humansLabel).catch(() => null);
        const bc = guild.channels.cache.get(doc.botsChannelId); if (bc) await bc.setName(botsLabel).catch(() => null);

        const updateMsg = '🔄 **Counters Refreshed:** Live analytics tracking nodes updated successfully. (These also auto-refresh every 1 minute on their own.)';
        return isInteraction ? interaction.editReply({ content: updateMsg }) : interaction.reply(updateMsg);
      }
    },
  // ========================================================
  // 🔘 WIZARD INTERACTIVE SELECTION MENU HANDLING CONTROLLER
  // ========================================================
  async handleInteraction(interaction) {
    if (!interaction.isButton()) return;
    await interaction.deferUpdate().catch(() => null);

    const guild = interaction.guild;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const parts = interaction.customId.split('_');

    // --- DELETION SELECTION FLOW ENGINE CIRCUITS ---
    if (interaction.customId.startsWith('analytics_delete_confirm_')) {
      const doc = await AnalyticsModel.findOne({ guildId }).catch(() => null);
      if (doc) {
        if (doc.categoryId) { const c = guild.channels.cache.get(doc.categoryId); if (c) await c.delete().catch(() => null); }
        if (doc.totalChannelId) { const c = guild.channels.cache.get(doc.totalChannelId); if (c) await c.delete().catch(() => null); }
        if (doc.humansChannelId) { const c = guild.channels.cache.get(doc.humansChannelId); if (c) await c.delete().catch(() => null); }
        if (doc.botsChannelId) { const c = guild.channels.cache.get(doc.botsChannelId); if (c) await c.delete().catch(() => null); }
        await AnalyticsModel.deleteOne({ guildId });
      }
      return interaction.editReply({ content: '🗑️ **Purge Successful:** Stats layout dropped and wiped cleanly out of database tracks.', embeds: [], components: [] });
    }
    if (interaction.customId === 'analytics_delete_cancel') {
      return interaction.editReply({ content: '✅ Deletion cancelled. Active tracking nodes remain safe.', embeds: [], components: [] });
    }

    // --- PERSISTENT SKIPPABLE WIZARD SYSTEM RUNTIME MAPS ---
    const doc = await AnalyticsModel.findOne({ guildId }).catch(() => null);
    if (!doc || !doc.wizardActive || doc.wizardUserId !== userId) return;

    if (interaction.customId.startsWith('analytics_edit_action_skip_')) {
      doc.wizardActive = false;
      await doc.save();

      const skipFinalEmbed = new EmbedBuilder()
        .setTitle('✅ Configuration Maintained')
        .setDescription('No modifications were requested. Your existing statistics category tracker rules remain running intact.')
        .setColor('#3498DB');

      return interaction.editReply({ embeds: [skipFinalEmbed], components: [] });
    }

    if (interaction.customId.startsWith('analytics_edit_action_modify_')) {
      doc.wizardStep = 2;
      await doc.save();

      const step2Embed = new EmbedBuilder()
        .setTitle('✏️ Step 2: Choose Display Font Layout Type')
        .setDescription('Select the accent framework style you want to apply across all child voice counter channels node files below:')
        .setColor('#E67E22');

      const selectButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`analytics_style_choice_clean_${userId}`).setLabel('Classic Clean Layout').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`analytics_style_choice_tech_${userId}`).setLabel('Industrial Tracker Line').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`analytics_style_choice_secure_${userId}`).setLabel('Locked Protection Accent').setStyle(ButtonStyle.Danger)
      );

      return interaction.editReply({ embeds: [step2Embed], components: [selectButtons] });
    }
    if (interaction.customId.startsWith('analytics_style_choice_')) {
        const choiceType = parts[3]; // 'clean', 'tech', or 'secure'
        doc.wizardActive = false;
        doc.labelStyle = choiceType;
        await doc.save();

        const { totalMembers, totalBots, totalHumans } = await getMemberCounts(guild);
        const { categoryName, totalLabel, humansLabel, botsLabel } = buildLabels(choiceType, totalMembers, totalHumans, totalBots);

        // Re-format running voice channel parameters natively inside the live guild matrix
        const cat = guild.channels.cache.get(doc.categoryId); if (cat) await cat.setName(categoryName).catch(() => null);
        const tc = guild.channels.cache.get(doc.totalChannelId); if (tc) await tc.setName(totalLabel).catch(() => null);
        const hc = guild.channels.cache.get(doc.humansChannelId); if (hc) await hc.setName(humansLabel).catch(() => null);
        const bc = guild.channels.cache.get(doc.botsChannelId); if (bc) await bc.setName(botsLabel).catch(() => null);
  
        const finalizedEmbed = new EmbedBuilder()
          .setTitle('✅ Statistics System Re-Formatted!')
          .setDescription(`Successfully applied your font layout preferences. Your tracking channels have been modified to map the chosen configuration fields.\n\n🔄 This style is now saved and will be kept every time the counters auto-refresh (every **1 minute**).`)
          .setColor('#2ECC71')
          .setTimestamp();
  
        return interaction.editReply({ embeds: [finalizedEmbed], components: [] });
      }
    }
  };
      