const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle 
  } = require('discord.js');
  const mongoose = require('mongoose');
  const database = require('../utils/database'); // Connected to your live Mongo cluster
  
  // ========================================================
  // 1. STABLE MONGOOSE AUTOMOD CONFIGURATION SCHEMA
  // ========================================================
  const AutoModSchema = new mongoose.Schema({
      guildId: { type: String, required: true },
      ruleId: { type: String, required: true, unique: true }, // Internal unique rule fingerprint
      ruleName: { type: String, default: 'Custom Rule' },
      filterType: { type: String, required: true }, // all_caps, bad_words, links, mass_mentions, phishing_links, etc.
      enabled: { type: Boolean, default: true },
      actions: { type: [String], default: ['block_message'] }, // block_message, timeout_user, kick_user, log_to_channel
      
      // PERSISTENT FLOW TRACKING MATRIX (Render/Container reboot safe)
      wizardActive: { type: Boolean, default: false },
      wizardStep: { type: Number, default: 0 },
      wizardUserId: { type: String, default: null },
      wizardMode: { type: String, default: 'setup' }, // setup, edit
      tempType: { type: String, default: null },
      tempActions: { type: [String], default: [] }
  });
  const AutoModModel = mongoose.models.AutoModRule || mongoose.model('AutoModRule', AutoModSchema);
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('automodrule')
      .setDescription('🛡️ Configure and manage multi-layered server background message filtering grids.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand(sub => sub.setName('setup').setDescription('Launch the interactive configuration setup wizard node'))
      .addSubcommand(sub => sub.setName('edit').setDescription('✏️ Modify your existing background filter parameter fields'))
      .addSubcommand(sub => sub.setName('delete').setDescription('🗑️ Wipe current filter metrics cleanly out of memory rows')),
    name: 'automodrule',
  
    async execute(interaction, client) {
       const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : false;
      const guild = interaction.guild;
      if (!guild) return;
      const guildId = guild.id;
      const userId = interaction.user.id;
  
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) && 
          !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        const lockMsg = '❌ **Access Denied:** You need `Manage Server` or `Administrator` privileges.';
        return isInteraction ? interaction.reply({ content: lockMsg, ephemeral: true }) : interaction.reply(lockMsg);
      }
  
      if (isInteraction) await interaction.deferReply({ ephemeral: true }).catch(() => null);
      const commandName = isInteraction ? interaction.options.getSubcommand() : interaction.content?.split(/ +/)?.[1]?.toLowerCase();
  
      // ==========================================
      // MODULE FLOW A: SETUP WIZARD IGNITION
      // ==========================================
      if (commandName === 'setup' || !commandName) {
        // Allocate a fresh persistent tracking entry document inside MongoDB
        const ruleUniqueId = `am_${guildId}_${Date.now()}`;
        const doc = new AutoModModel({
          guildId,
          ruleId: ruleUniqueId,
          filterType: 'pending',
          wizardActive: true,
          wizardStep: 1,
          wizardUserId: userId,
          wizardMode: 'setup'
        });
        await doc.save();
  
        const step1Embed = new EmbedBuilder()
          .setTitle('🛡️ AutoMod Rule: Configuration Setup Wizard')
          .setDescription(
            `Welcome to the guided message security framework builder.\n\n` +
            `Let's configure a new real-time background protection filter node step by step.\n\n` +
            `**Step 1:** Select the type of content data filter threshold you want this rule to monitor.`
          )
          .setColor('#5865F2');
  
        const selectRow = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('automod_wizard_step1')
            .setPlaceholder('Choose a content filter signature type...')
            .addOptions([
              { label: 'All-Caps Spam Shouting', value: 'all_caps', description: 'Blocks excessive message usage containing only uppercase text blocks.', emoji: '📢' },
              { label: 'Prohibited Bad Words List', value: 'bad_words', description: 'Filters out explicit system backdoors, exploit requests, and malicious scripts.', emoji: '🤬' },
              { label: 'Unverified Invite Links', value: 'invite_links', description: 'Intercepts discord.gg server advertisement linkages.', emoji: '🔗' },
              { label: 'Global Server Hyperlinks', value: 'links', description: 'Monitors all external link pointers communication pathways.', emoji: '🌐' },
              { label: 'Mass Member Mentions Spam', value: 'mass_mentions', description: 'Triggers when a message pings more than 4 server roles/members.', emoji: '👥' },
              { label: 'Known Phishing URL Registry', value: 'phishing_links', description: 'Atomic block rules against standard fake Discord Nitro link networks.', emoji: '🚨' },
              { label: 'Zalgo Character Glitch Spam', value: 'zalgo_text', description: 'Identifies and filters corrupted font layout text stacks.', emoji: '👾' }
            ])
        );
  
        return isInteraction 
          ? interaction.editReply({ embeds: [step1Embed], components: [selectRow] }) 
          : interaction.reply({ embeds: [step1Embed], components: [selectRow] });
      }
    // ==========================================
    // MODULE FLOW B: EDIT SKIPPABLE WIZARD
    // ==========================================
    if (commandName === 'edit') {
        const activeRules = await AutoModModel.find({ guildId, wizardActive: false }).catch(() => null);
        if (!activeRules || activeRules.length === 0) {
          const noRuleErr = '❌ **Configuration Error:** No active AutoMod rules discovered inside this server context.';
          return isInteraction ? interaction.editReply(noRuleErr) : interaction.reply(noRuleErr);
        }
  
        const editSelectionEmbed = new EmbedBuilder()
          .setTitle('✏️ Edit AutoMod Configuration Grid')
          .setDescription('Select the existing live background protection rule node you want to modify from the dropdown menu underneath:')
          .setColor('#E67E22');
  
        const targetOptions = activeRules.map(rule => ({
            label: `${rule.filterType.toUpperCase()} Filter`.slice(0, 24),
            description: `Fingerprint Snowflake reference ID: ${rule.ruleId.slice(-8)}`,
            value: rule.ruleId
        }));
  
        const selectMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('automod_edit_select_target')
            .setPlaceholder('Choose an existing rules framework node...')
            .addOptions(targetOptions)
        );
  
        return isInteraction 
          ? interaction.editReply({ embeds: [editSelectionEmbed], components: [selectMenu] }) 
          : interaction.reply({ embeds: [editSelectionEmbed], components: [selectMenu] });
      }
  
      // ==========================================
      // MODULE FLOW C: SAFE DOUBLE-CHECK DELETION
      // ==========================================
      if (commandName === 'delete') {
        const activeRules = await AutoModModel.find({ guildId, wizardActive: false }).catch(() => null);
        if (!activeRules || activeRules.length === 0) {
          const noRuleErr = '❌ **Configuration Error:** No active AutoMod rules exist to purge.';
          return isInteraction ? interaction.editReply(noRuleErr) : interaction.reply(noRuleErr);
        }
  
        const deleteEmbed = new EmbedBuilder()
          .setTitle('🗑️ Delete AutoMod Security Rule')
          .setDescription('Select the target filter framework block you want to wipe permanently out of your database records:')
          .setColor('#ED4245');
  
        const targetOptions = activeRules.map(rule => ({
            label: `Wipe: ${rule.filterType.toUpperCase()} Grid`.slice(0, 24),
            value: rule.ruleId
        }));
  
        const selectMenu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('automod_delete_select_target')
            .setPlaceholder('Choose a rule to completely delete...')
            .addOptions(targetOptions)
        );
  
        return isInteraction 
          ? interaction.editReply({ embeds: [deleteEmbed], components: [selectMenu] }) 
          : interaction.reply({ embeds: [deleteEmbed], components: [selectMenu] });
      }
    },
  // ========================================================
  // 🔘 WIZARD INTERACTIVE SELECTION MENU HANDLING CONTROLLER
  // ========================================================
  async handleInteraction(interaction) {
    const guild = interaction.guild;
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    // --- DELETION SELECTION CONFIRMATION PIPELINES ---
    if (interaction.customId === 'automod_delete_select_target' && interaction.isStringSelectMenu()) {
      await interaction.deferUpdate().catch(() => null);
      const ruleTargetId = String(interaction.values[0]);

      const confirmEmbed = new EmbedBuilder()
        .setTitle('⚠️ Absolute Safety Confirmation Check')
        .setDescription(`Are you completely sure you want to delete this rule configuration reference? Background parsing filters tracking this data will drop instantly.`)
        .setColor('#ED4245');

      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`automod_purge_confirm_${ruleTargetId}`).setLabel('Yes, Wipe Rule').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('automod_purge_cancel').setLabel('Abort Action').setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ embeds: [confirmEmbed], components: [buttonsRow] });
    }

    if (interaction.customId.startsWith('automod_purge_confirm_')) {
       await interaction.deferUpdate().catch(() => null);
       const targetId = interaction.customId.split('_')[3];
       await AutoModModel.deleteOne({ ruleId: targetId }).catch(() => null);
       return interaction.editReply({ content: '🗑️ **Purge Successful:** Security filter node wiped cleanly out of the database.', embeds: [], components: [] });
    }
    if (interaction.customId === 'automod_purge_cancel') {
       await interaction.deferUpdate().catch(() => null);
       return interaction.editReply({ content: '✅ Deletion aborted safely. Rule configurations remain secure.', embeds: [], components: [] });
    }

    // --- SKIPPABLE WIZARD TRACKING AND STATE CONTROL CIRCUITS ---
    if (interaction.customId === 'automod_edit_select_target' && interaction.isStringSelectMenu()) {
       await interaction.deferUpdate().catch(() => null);
       const targetId = String(interaction.values[0]);
       
       const ruleDoc = await AutoModModel.findOne({ ruleId: targetId });
       if (!ruleDoc) return;

       ruleDoc.wizardActive = true;
       ruleDoc.wizardStep = 2; // Jump directly to action modifier screens
       ruleDoc.wizardUserId = userId;
       ruleDoc.wizardMode = 'edit';
       await ruleDoc.save();

       const editStep2Embed = new EmbedBuilder()
         .setTitle('✏️ Edit AutoMod: Step 2 (Enforcement Actions)')
         .setDescription(`Current Filter Style: \`${ruleDoc.filterType.toUpperCase()}\`\n\nChoose a new mitigation style behavior pattern, or click **Skip This Step** to keep it as it is.`)
         .setColor('#E67E22');

       const selectMenu = new ActionRowBuilder().addComponents(
         new StringSelectMenuBuilder()
           .setCustomId('automod_wizard_step2')
           .setPlaceholder('Choose enforcement actions mitigation patterns...')
           .addOptions([
             { label: 'Low: Block Message & Warn User', value: 'act_block', emoji: '⚠️' },
             { label: 'Medium: Log Infraction & Timeout User', value: 'act_timeout', emoji: '⏳' },
             { label: 'High: Automated System Account Kick', value: 'act_kick', emoji: '🥾' }
           ])
       );

       const skipRow = new ActionRowBuilder().addComponents(
         new ButtonBuilder().setCustomId('automod_wizard_skip_step2').setLabel('Skip This Step & Finalize').setStyle(ButtonStyle.Secondary)
       );

       return interaction.editReply({ embeds: [editStep2Embed], components: [selectMenu, skipRow] });
    }

    // Lookup any active setup/edit wizard trackers running under the user's ID
    const doc = await AutoModModel.findOne({ guildId, wizardActive: true, wizardUserId: userId }).catch(() => null);
    if (!doc) return; // Discard stale button tracking triggers securely

    // STEP 1 RESOLUTION: EXTRACT MATRICES SIGNATURES
    if (interaction.customId === 'automod_wizard_step1' && interaction.isStringSelectMenu()) {
       await interaction.deferUpdate().catch(() => null);
       doc.tempType = String(interaction.values[0]);
       doc.wizardStep = 2;
       await doc.save();

       const step2Embed = new EmbedBuilder()
         .setTitle('🛡️ Step 2: Choose Enforcement Mitigation Style')
         .setDescription(
           `**Selected Data Filter:** \`${doc.tempType.toUpperCase()}\`\n\n` +
           `Now, select the automated defense action your bot will execute the moment this rule's signature threshold is breached.`
         )
         .setColor('#E67E22');

       const selectMenu = new ActionRowBuilder().addComponents(
         new StringSelectMenuBuilder()
           .setCustomId('automod_wizard_step2')
           .setPlaceholder('Select remediation action behaviors...')
           .addOptions([
             { label: 'Low Mitigation: Block Message & Warn User', value: 'act_block', description: 'Deletes text instantly and sends an ephemeral chat challenge alert.', emoji: '⚠️' },
             { label: 'Medium Mitigation: Log Infraction & Timeout Profile', value: 'act_timeout', description: 'Blocks message, records parameters, and sets a 5-minute timeout.', emoji: '⏳' },
             { label: 'High Mitigation: Automated System Guild Kick Execution', value: 'act_kick', description: 'Completely drops connection strings and kicks the offending account.', emoji: '🥾' }
           ])
       );

       return interaction.editReply({ embeds: [step2Embed], components: [selectMenu] });
    }

    // STEP 2 RESOLUTION: SAVE ACTIONS MODIFIERS OR TRIGGER SKIP FINALIZE
    if ((interaction.customId === 'automod_wizard_step2' && interaction.isStringSelectMenu()) || interaction.customId === 'automod_wizard_skip_step2') {
        await interaction.deferUpdate().catch(() => null);
        
        if (interaction.isStringSelectMenu()) {
           const modeInput = String(interaction.values[0]);
           if (modeInput === 'act_block') {
              doc.tempActions = ['block_message', 'log_to_channel'];
           } else if (modeInput === 'act_timeout') {
              doc.tempActions = ['block_message', 'timeout_user', 'log_to_channel'];
           } else if (modeInput === 'act_kick') {
              doc.tempActions = ['block_message', 'kick_user', 'log_to_channel'];
           }
        } else {
           // Skip option tripped: If in setup default to base block, if in edit preserve old parameters arrays
           if (doc.wizardMode === 'setup') doc.tempActions = ['block_message', 'log_to_channel'];
        }
 
        // Commit parameters straight into the live tracking slots
        doc.enabled = true;
        doc.wizardActive = false; // Close active wizard status indicators
        if (doc.wizardMode === 'setup') {
           doc.filterType = doc.tempType;
           doc.ruleName = `${doc.tempType.toUpperCase()} Automated Defense Gate`;
        }
        if (doc.tempActions.length > 0) {
           doc.actions = doc.tempActions;
        }
        await doc.save();
 
        const finalizeEmbed = new EmbedBuilder()
          .setTitle('✅ AutoMod Security Profile Saved!')
          .setDescription(
            `Successfully compiled your protection framework rules straight into permanent storage disks.\n\n` +
            `• **Rule Handle Moniker:** \`${doc.ruleName}\`\n` +
            `• **Monitored Signature Type:** \`${doc.filterType.toUpperCase()}\`\n` +
            `• **Assigned Defense Mitigation:** \`[${doc.actions.join(', ').toUpperCase()}]\` loops.`
          )
          .setColor('#2ECC71')
          .setTimestamp();
 
        return interaction.editReply({ embeds: [finalizeEmbed], components: [] });
     }
   }
 };
     