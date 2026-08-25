const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
  } = require('discord.js');
  const mongoose = require('mongoose');
  const { parseVariables, VARIABLE_CATALOG } = require('../utils/autoResponderVars.js');
  
  // ============================================================================
  // MONGOOSE MODEL
  // ============================================================================
  const responderSchema = new mongoose.Schema({
    id: String,
    name: String,
    trigger: { type: String, default: '' },
    matchType: { type: String, default: 'contains' }, // exact|contains|startswith|endswith|wildcard|regex
    caseSensitive: { type: Boolean, default: false },
    responses: { type: [String], default: [] },
    replyMode: { type: String, default: 'reply' }, // reply|channel|dm
    responseType: { type: String, default: 'text' }, // text|embed|reaction
    useEmbed: { type: Boolean, default: false },
    embedColor: { type: String, default: '#5865F2' },
    embedTitle: { type: String, default: '' },
    reactions: { type: [String], default: [] },
    deleteTrigger: { type: Boolean, default: false },
    cooldown: { type: Number, default: 0 }, // seconds, per-user
    chance: { type: Number, default: 100 }, // 1-100
    allowedChannels: { type: [String], default: [] },
    ignoredChannels: { type: [String], default: [] },
    requiredRole: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    uses: { type: Number, default: 0 },
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
  }, { _id: false });
  
  const autoResponderSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    maxPerGuild: { type: Number, default: 50 },
    responders: { type: [responderSchema], default: [] },
  });
  
  const AutoResponder = mongoose.models.AutoResponder || mongoose.model('AutoResponder', autoResponderSchema);
  
  // ============================================================================
  // IN-MEMORY WIZARD SESSIONS
  // ============================================================================
  const sessions = new Map(); // key `${guildId}-${userId}` -> { draft, editingId, createdAt }
  const SESSION_TTL = 15 * 60 * 1000;
  
  setInterval(() => {
    const now = Date.now();
    for (const [key, s] of sessions.entries()) {
      if (now - s.createdAt > SESSION_TTL) sessions.delete(key);
    }
  }, 60 * 1000).unref?.();
  
  // ============================================================================
  // HELPERS
  // ============================================================================
  const COLOR = '#5865F2';
  const OK = '#57F287';
  const ERR = '#ED4245';
  
  function isStaff(member) {
    if (!member) return false;
    return member.permissions.has(PermissionFlagsBits.ManageGuild) ||
           member.permissions.has(PermissionFlagsBits.Administrator);
  }
  
  function genId() {
    return (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)).toUpperCase();
  }
  
  async function getConfig(guildId) {
    let doc = await AutoResponder.findOne({ guildId });
    if (!doc) doc = await AutoResponder.create({ guildId, responders: [] });
    return doc;
  }
  
  function blankDraft() {
    return {
      id: genId(),
      name: '',
      trigger: '',
      matchType: 'contains',
      caseSensitive: false,
      responses: [],
      replyMode: 'reply',
      responseType: 'text',
      useEmbed: false,
      embedColor: COLOR,
      embedTitle: '',
      reactions: [],
      deleteTrigger: false,
      cooldown: 0,
      chance: 100,
      allowedChannels: [],
      ignoredChannels: [],
      requiredRole: '',
      enabled: true,
      uses: 0,
    };
  }
  
  const MATCH_LABELS = {
    exact: 'Exact match (whole message equals trigger)',
    contains: 'Contains (trigger appears anywhere)',
    startswith: 'Starts with the trigger',
    endswith: 'Ends with the trigger',
    wildcard: 'Wildcard (use * as any text)',
    regex: 'Regex (advanced pattern)',
  };
  
  // ---- Wizard UI builders ----
  function draftEmbed(draft, editing) {
    const responses = draft.responses.length
      ? draft.responses.map((r, i) => `\`${i + 1}.\` ${r.length > 80 ? r.slice(0, 80) + '…' : r}`).join('\n')
      : '*Not set yet — click **Set Response***';
  
    return new EmbedBuilder()
      .setColor(draft.embedColor || COLOR)
      .setTitle(editing ? '✏️ Editing Auto Responder' : '🪄 Auto Responder Wizard')
      .setDescription('Configure each part below. Your changes preview live. Click **Save** when ready.')
      .addFields(
        { name: '🎯 Trigger', value: draft.trigger ? `\`${draft.trigger}\`` : '*Not set*', inline: true },
        { name: '🔍 Match Type', value: `\`${draft.matchType}\``, inline: true },
        { name: '🔠 Case Sensitive', value: draft.caseSensitive ? 'Yes' : 'No', inline: true },
        { name: '💬 Responses', value: responses, inline: false },
        { name: '🧩 Response Type', value: `\`${draft.responseType || 'text'}\``, inline: true },
        { name: '📤 Delivery', value: `\`${draft.replyMode}\`${draft.useEmbed ? ' • embed' : ''}`, inline: true },
        { name: '🎲 Chance', value: `${draft.chance}%`, inline: true },
        { name: '⏱️ Cooldown', value: `${draft.cooldown}s`, inline: true },
        { name: '🗑️ Delete Trigger', value: draft.deleteTrigger ? 'Yes' : 'No', inline: true },
        { name: '🔒 Required Role', value: draft.requiredRole ? `<@&${draft.requiredRole}>` : 'Anyone', inline: true },
        { name: '😀 Reactions', value: draft.reactions.length ? draft.reactions.join(' ') : 'None', inline: true },
        { name: '📌 Allowed Channels', value: draft.allowedChannels.length ? draft.allowedChannels.map(id => `<#${id}>`).join(', ') : 'All channels', inline: true },
        { name: '🚫 Ignored Channels', value: draft.ignoredChannels.length ? draft.ignoredChannels.map(id => `<#${id}>`).join(', ') : 'None', inline: true },
      )
      .setFooter({ text: `ID: ${draft.id} • Use /autoresponder variables to see all placeholders` });
  }
  
  function wizardRows(draft) {
    const row1 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('autoresponder_wiz_trigger').setLabel('Set Trigger').setStyle(ButtonStyle.Primary).setEmoji('🎯'),
      new ButtonBuilder().setCustomId('autoresponder_wiz_response').setLabel('Set Response').setStyle(ButtonStyle.Primary).setEmoji('💬'),
      new ButtonBuilder().setCustomId('autoresponder_wiz_advanced').setLabel('Advanced').setStyle(ButtonStyle.Secondary).setEmoji('⚙️'),
      new ButtonBuilder().setCustomId('autoresponder_wiz_reactions').setLabel('Reactions').setStyle(ButtonStyle.Secondary).setEmoji('😀'),
    );
    const row2 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('autoresponder_select_delivery')
        .setPlaceholder('Delivery mode & format')
        .addOptions(
          { label: 'Reply to the message', value: 'reply', default: draft.replyMode === 'reply', emoji: '↩️' },
          { label: 'Send in channel', value: 'channel', default: draft.replyMode === 'channel', emoji: '📨' },
          { label: 'Direct message the user', value: 'dm', default: draft.replyMode === 'dm', emoji: '✉️' },
          { label: draft.useEmbed ? 'Format: Embed (on)' : 'Format: Plain text', value: 'toggle_embed', emoji: '🎨' },
          { label: draft.caseSensitive ? 'Case sensitive (on)' : 'Case sensitive (off)', value: 'toggle_case', emoji: '🔠' },
        ),
    );
    const row3 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('autoresponder_select_response_type')
        .setPlaceholder('Response style')
        .addOptions(
          { label: 'Plain text', value: 'text', default: (draft.responseType || 'text') === 'text', emoji: '💬' },
          { label: 'Embedded response', value: 'embed', default: (draft.responseType || 'text') === 'embed', emoji: '🧩' },
          { label: 'Reaction response', value: 'reaction', default: (draft.responseType || 'text') === 'reaction', emoji: '😀' },
        )
    );
    const row4 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('autoresponder_select_match')
        .setPlaceholder(`Match type: ${draft.matchType}`)
        .addOptions(Object.entries(MATCH_LABELS).map(([value, label]) => ({
          label: value, description: label.slice(0, 100), value, default: draft.matchType === value,
        }))),
    );
    const row5 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('autoresponder_wiz_save').setLabel('Save').setStyle(ButtonStyle.Success).setEmoji('💾'),
      new ButtonBuilder().setCustomId('autoresponder_wiz_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('✖️'),
    );
    return [row1, row2, row3, row4, row5];
  }
  
  async function renderWizard(interaction, key, editing = false) {
    const s = sessions.get(key);
    if (!s) return;
    const payload = { embeds: [draftEmbed(s.draft, editing)], components: wizardRows(s.draft) };
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(payload).catch(() => null);
    }
    return interaction.update(payload).catch(() => null);
  }
  
  // ============================================================================
  // COMMAND
  // ============================================================================
  module.exports = {
    data: new SlashCommandBuilder()
      .setName('autoresponder')
      .setDescription('Create automatic replies to custom text triggers.')
      .addSubcommand(s => s.setName('setup').setDescription('Open the step-by-step wizard to build a responder'))
      .addSubcommand(s => s.setName('add').setDescription('Quickly add a responder')
        .addStringOption(o => o.setName('trigger').setDescription('The phrase to listen for').setRequired(true))
        .addStringOption(o => o.setName('response').setDescription('The reply to send (use variables!)').setRequired(true)))
      .addSubcommand(s => s.setName('list').setDescription('List all auto responders'))
      .addSubcommand(s => s.setName('info').setDescription('View one responder in detail')
        .addStringOption(o => o.setName('id').setDescription('Responder ID or trigger').setRequired(true)))
      .addSubcommand(s => s.setName('edit').setDescription('Edit an existing responder in the wizard')
        .addStringOption(o => o.setName('id').setDescription('Responder ID or trigger').setRequired(true)))
      .addSubcommand(s => s.setName('remove').setDescription('Delete a responder')
        .addStringOption(o => o.setName('id').setDescription('Responder ID or trigger').setRequired(true)))
      .addSubcommand(s => s.setName('toggle').setDescription('Enable/disable a single responder')
        .addStringOption(o => o.setName('id').setDescription('Responder ID or trigger').setRequired(true)))
      .addSubcommand(s => s.setName('test').setDescription('Preview how a responder renders')
        .addStringOption(o => o.setName('id').setDescription('Responder ID or trigger').setRequired(true)))
      .addSubcommand(s => s.setName('variables').setDescription('See every placeholder variable you can use'))
      .addSubcommand(s => s.setName('config').setDescription('View the module overview'))
      .addSubcommand(s => s.setName('enable').setDescription('Enable the auto responder module (Manage Server)'))
      .addSubcommand(s => s.setName('disable').setDescription('Disable the auto responder module (Manage Server)')),
    name: 'autoresponder',
  
    async execute(interaction, client) {
      const isInteraction = typeof interaction.isChatInputCommand === 'function' ? interaction.isChatInputCommand() : false;
      const guild = interaction.guild;
      if (!guild) {
        return interaction.reply({ content: '❌ This command can only be used in a server.' }).catch(() => null);
      }
  
      const member = interaction.member || await guild.members.fetch(interaction.user.id).catch(() => null);
  
      // Resolve subcommand for slash commands.
      let sub;
      let args = [];
      if (isInteraction) {
        sub = interaction.options.getSubcommand(false) || 'config';
      } else {
        // Prefix: raw string lives in getString(); first word is the subcommand.
        const raw = (interaction.options.getString('subcommand') || '').trim();
        args = raw.split(/ +/).filter(Boolean);
        sub = (args.shift() || 'config').toLowerCase();
      }
  
      const reply = (opts) => {
        const payload = typeof opts === 'string' ? { content: opts } : opts;
        if (isInteraction && !interaction.replied && !interaction.deferred) {
          return interaction.reply({ ...payload, ephemeral: payload.ephemeral ?? false }).catch(() => null);
        }
        return interaction.reply(payload).catch(() => null);
      };
  
      // ---------- variables (open to everyone) ----------
      if (sub === 'variables' || sub === 'vars') {
        const embed = new EmbedBuilder()
          .setColor(COLOR)
          .setTitle('🔤 Auto Responder Variables')
          .setDescription('Drop any of these into a response and they are replaced live when the responder fires.');
        for (const [group, items] of Object.entries(VARIABLE_CATALOG)) {
          embed.addFields({ name: group, value: items.map(([v, d]) => `\`${v}\` — ${d}`).join('\n') });
        }
        embed.setFooter({ text: 'Tip: {random:hi|hey|yo} picks a random option each time.' });
        return reply({ embeds: [embed] });
      }
  
      const config = await getConfig(guild.id);
  
      // ---------- list ----------
      if (sub === 'list') {
        if (!config.responders.length) {
          return reply({ embeds: [new EmbedBuilder().setColor(COLOR).setTitle('📭 No Auto Responders')
            .setDescription(`Create one with \`/autoresponder setup\` or \`/autoresponder add\`.`)] });
        }
        const lines = config.responders.map(r =>
          `${r.enabled ? '🟢' : '⚪'} \`${r.id}\` • **${r.trigger}** \`(${r.matchType})\` — ${r.responses.length} response(s) • ${r.uses} uses`);
        const embed = new EmbedBuilder()
          .setColor(COLOR)
          .setTitle(`📋 Auto Responders (${config.responders.length})`)
          .setDescription(lines.join('\n').slice(0, 4000))
          .setFooter({ text: `Module is ${config.enabled ? 'ENABLED' : 'DISABLED'} • /autoresponder info <id> for details` });
        return reply({ embeds: [embed] });
      }
  
      // ---------- config overview ----------
      if (sub === 'config') {
        const embed = new EmbedBuilder()
          .setColor(config.enabled ? OK : ERR)
          .setTitle('⚙️ Auto Responder Module')
          .setDescription(config.enabled
            ? '🟢 The module is **enabled** — responders are active.'
            : '🔴 The module is **disabled** — no responders will fire until an admin enables it.')
          .addFields(
            { name: 'Total responders', value: String(config.responders.length), inline: true },
            { name: 'Active', value: String(config.responders.filter(r => r.enabled).length), inline: true },
            { name: 'Total fires', value: String(config.responders.reduce((a, r) => a + (r.uses || 0), 0)), inline: true },
          )
          .setFooter({ text: 'Staff: /autoresponder setup • enable • disable' });
        return reply({ embeds: [embed] });
      }
  
      // ---------- info ----------
      if (sub === 'info') {
        const query = (isInteraction ? interaction.options.getString('id') : args.join(' ')).trim();
        const r = config.responders.find(x => x.id === query.toUpperCase() || x.trigger.toLowerCase() === query.toLowerCase());
        if (!r) return reply(`❌ No responder found matching \`${query}\`.`);
        const embed = new EmbedBuilder()
          .setColor(r.enabled ? OK : ERR)
          .setTitle(`🔎 Responder \`${r.id}\``)
          .addFields(
            { name: 'Trigger', value: `\`${r.trigger}\``, inline: true },
            { name: 'Match', value: `\`${r.matchType}\``, inline: true },
            { name: 'Enabled', value: r.enabled ? 'Yes' : 'No', inline: true },
            { name: 'Delivery', value: `${r.replyMode}${r.useEmbed ? ' • embed' : ''}`, inline: true },
            { name: 'Chance', value: `${r.chance}%`, inline: true },
            { name: 'Cooldown', value: `${r.cooldown}s`, inline: true },
            { name: 'Delete trigger', value: r.deleteTrigger ? 'Yes' : 'No', inline: true },
            { name: 'Required role', value: r.requiredRole ? `<@&${r.requiredRole}>` : 'Anyone', inline: true },
            { name: 'Uses', value: String(r.uses || 0), inline: true },
            { name: 'Responses', value: r.responses.map((x, i) => `\`${i + 1}.\` ${x}`).join('\n').slice(0, 1024) || 'None' },
          );
        return reply({ embeds: [embed] });
      }
  
      // ---------- test ----------
      if (sub === 'test') {
        const query = (isInteraction ? interaction.options.getString('id') : args.join(' ')).trim();
        const r = config.responders.find(x => x.id === query.toUpperCase() || x.trigger.toLowerCase() === query.toLowerCase());
        if (!r) return reply(`❌ No responder found matching \`${query}\`.`);
        const fakeMsg = { guild, author: interaction.user, member, channel: interaction.channel, client, content: r.trigger, id: interaction.id };
        const rendered = parseVariables(r.responses[Math.floor(Math.random() * r.responses.length)] || '', fakeMsg, { trigger: r.trigger });
        if (r.useEmbed) {
          return reply({ content: '🧪 **Preview:**', embeds: [new EmbedBuilder().setColor(r.embedColor || COLOR).setTitle(r.embedTitle || null).setDescription(rendered || '*empty*')] });
        }
        return reply(`🧪 **Preview:**\n${rendered || '*empty*'}`);
      }
  
      // ===== Everything below requires staff =====
      if (!isStaff(member)) {
        return reply({ embeds: [new EmbedBuilder().setColor(ERR).setTitle('🚫 Missing Permissions')
          .setDescription('You need the **Manage Server** or **Administrator** permission to configure auto responders.')] });
      }
  
      // ---------- enable / disable module ----------
      if (sub === 'enable' || sub === 'disable') {
        config.enabled = sub === 'enable';
        await config.save();
        return reply({ embeds: [new EmbedBuilder().setColor(config.enabled ? OK : ERR)
          .setTitle(config.enabled ? '🟢 Auto Responder Enabled' : '🔴 Auto Responder Disabled')
          .setDescription(config.enabled
            ? 'Responders will now fire for matching messages.'
            : 'All responders are paused until re-enabled.')] });
      }
  
      // ---------- quick add ----------
      if (sub === 'add') {
        const trigger = (isInteraction ? interaction.options.getString('trigger') : args.shift() || '').trim();
        const response = (isInteraction ? interaction.options.getString('response') : args.join(' ')).trim();
        if (!trigger || !response) return reply('❌ Usage: `/autoresponder add <trigger> <response>`');
        if (config.responders.length >= config.maxPerGuild) return reply(`❌ Limit reached (${config.maxPerGuild}).`);
        const draft = blankDraft();
        draft.trigger = trigger;
        draft.responses = [response];
        draft.createdBy = interaction.user.id;
        config.responders.push(draft);
        await config.save();
        return reply({ embeds: [new EmbedBuilder().setColor(OK).setTitle('✅ Auto Responder Created')
          .setDescription(`Trigger \`${trigger}\` added with ID \`${draft.id}\`.${config.enabled ? '' : '\n\n⚠️ The module is currently **disabled** — enable it with `/autoresponder enable`.'}`)] });
      }
  
      // ---------- remove ----------
      if (sub === 'remove' || sub === 'delete') {
        const query = (isInteraction ? interaction.options.getString('id') : args.join(' ')).trim();
        const idx = config.responders.findIndex(x => x.id === query.toUpperCase() || x.trigger.toLowerCase() === query.toLowerCase());
        if (idx === -1) return reply(`❌ No responder found matching \`${query}\`.`);
        const [removed] = config.responders.splice(idx, 1);
        await config.save();
        return reply(`🗑️ Removed responder \`${removed.id}\` (trigger: **${removed.trigger}**).`);
      }
  
      // ---------- toggle single ----------
      if (sub === 'toggle') {
        const query = (isInteraction ? interaction.options.getString('id') : args.join(' ')).trim();
        const r = config.responders.find(x => x.id === query.toUpperCase() || x.trigger.toLowerCase() === query.toLowerCase());
        if (!r) return reply(`❌ No responder found matching \`${query}\`.`);
        r.enabled = !r.enabled;
        await config.save();
        return reply(`${r.enabled ? '🟢 Enabled' : '⚪ Disabled'} responder \`${r.id}\` (**${r.trigger}**).`);
      }
  
      // ---------- setup / edit (wizard) ----------
      if (sub === 'setup' || sub === 'edit' || sub === 'create') {
        const key = `${guild.id}-${interaction.user.id}`;
        let editingId = null;
        if (sub === 'edit') {
          const query = (isInteraction ? interaction.options.getString('id') : args.join(' ')).trim();
          const r = config.responders.find(x => x.id === query.toUpperCase() || x.trigger.toLowerCase() === query.toLowerCase());
          if (!r) return reply(`❌ No responder found matching \`${query}\`.`);
          editingId = r.id;
          sessions.set(key, { draft: JSON.parse(JSON.stringify(r)), editingId, createdAt: Date.now() });
        } else {
          if (config.responders.length >= config.maxPerGuild) return reply(`❌ Limit reached (${config.maxPerGuild}).`);
          sessions.set(key, { draft: blankDraft(), editingId: null, createdAt: Date.now() });
        }
        const s = sessions.get(key);
        return reply({ embeds: [draftEmbed(s.draft, !!editingId)], components: wizardRows(s.draft) });
      }
  
      return reply('❓ Unknown subcommand. Try `/autoresponder config`.');
    },
  
    // ==========================================================================
    // COMPONENT / MODAL ROUTER (customId starts with "autoresponder_")
    // ==========================================================================
    async handleInteraction(interaction, client) {
      try {
        const key = `${interaction.guildId}-${interaction.user.id}`;
        const id = interaction.customId;
  
        // Modal submissions
        if (typeof interaction.isModalSubmit === 'function' && interaction.isModalSubmit()) {
          const s = sessions.get(key);
          if (!s) return interaction.reply({ content: '⌛ This wizard session expired. Run `/autoresponder setup` again.', ephemeral: true }).catch(() => null);
  
          if (id === 'autoresponder_modal_trigger') {
            s.draft.trigger = interaction.fields.getTextInputValue('trigger').trim();
            const mt = interaction.fields.getTextInputValue('matchtype').trim().toLowerCase();
            if (MATCH_LABELS[mt]) s.draft.matchType = mt;
          } else if (id === 'autoresponder_modal_response') {
            const raw = interaction.fields.getTextInputValue('responses');
            s.draft.responses = raw.split('\n---\n').map(x => x.trim()).filter(Boolean);
            const title = interaction.fields.getTextInputValue('embedtitle');
            if (title != null) s.draft.embedTitle = title.trim();
          } else if (id === 'autoresponder_modal_advanced') {
            const cd = parseInt(interaction.fields.getTextInputValue('cooldown'), 10);
            const ch = parseInt(interaction.fields.getTextInputValue('chance'), 10);
            s.draft.cooldown = isNaN(cd) ? 0 : Math.max(0, cd);
            s.draft.chance = isNaN(ch) ? 100 : Math.min(100, Math.max(1, ch));
            s.draft.deleteTrigger = /^(y|yes|true|on)$/i.test(interaction.fields.getTextInputValue('delete').trim());
            const role = interaction.fields.getTextInputValue('role').replace(/[^0-9]/g, '');
            s.draft.requiredRole = role || '';
            const allowed = interaction.fields.getTextInputValue('allowed_channels').split(',').map(v => v.trim()).filter(Boolean).map(v => v.replace(/[^0-9]/g, '')).filter(Boolean);
            const ignored = interaction.fields.getTextInputValue('ignored_channels').split(',').map(v => v.trim()).filter(Boolean).map(v => v.replace(/[^0-9]/g, '')).filter(Boolean);
            s.draft.allowedChannels = allowed;
            s.draft.ignoredChannels = ignored;
          } else if (id === 'autoresponder_modal_reactions') {
            const raw = interaction.fields.getTextInputValue('reactions');
            s.draft.reactions = raw.split(/[\s,]+/).map(x => x.trim()).filter(Boolean).slice(0, 5);
          }
          s.createdAt = Date.now();
          await interaction.deferUpdate().catch(() => null);
          return renderWizard(interaction, key, !!s.editingId);
        }
  
        const s = sessions.get(key);
        if (!s && id !== 'autoresponder_wiz_cancel') {
          return interaction.reply({ content: '⌛ This wizard session expired. Run `/autoresponder setup` again.', ephemeral: true }).catch(() => null);
        }
  
        // Select menus
        if (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu()) {
          const val = interaction.values[0];
          if (id === 'autoresponder_select_delivery') {
            if (val === 'toggle_embed') s.draft.useEmbed = !s.draft.useEmbed;
            else if (val === 'toggle_case') s.draft.caseSensitive = !s.draft.caseSensitive;
            else s.draft.replyMode = val;
          } else if (id === 'autoresponder_select_match') {
            s.draft.matchType = val;
          } else if (id === 'autoresponder_select_response_type') {
            s.draft.responseType = val;
            s.draft.useEmbed = val === 'embed';
          }
          s.createdAt = Date.now();
          return renderWizard(interaction, key, !!s.editingId);
        }
  
        // Buttons
        if (id === 'autoresponder_wiz_trigger') {
          const modal = new ModalBuilder().setCustomId('autoresponder_modal_trigger').setTitle('Set Trigger');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('trigger').setLabel('Trigger phrase').setStyle(TextInputStyle.Short).setRequired(true).setValue(s.draft.trigger || '')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('matchtype').setLabel('Match: exact/contains/startswith/endswith').setStyle(TextInputStyle.Short).setRequired(false).setValue(s.draft.matchType).setPlaceholder('contains')),
          );
          return interaction.showModal(modal).catch(() => null);
        }
        if (id === 'autoresponder_wiz_response') {
          const modal = new ModalBuilder().setCustomId('autoresponder_modal_response').setTitle('Set Response(s)');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('responses').setLabel('Response(s) — separate alts with ---').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(3800).setValue(s.draft.responses.join('\n---\n')).setPlaceholder('Hi {user}! Welcome to {server}.\n---\nHey {user.name}!')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embedtitle').setLabel('Embed title (optional, embed mode only)').setStyle(TextInputStyle.Short).setRequired(false).setValue(s.draft.embedTitle || '')),
          );
          return interaction.showModal(modal).catch(() => null);
        }
        if (id === 'autoresponder_wiz_advanced') {
          const modal = new ModalBuilder().setCustomId('autoresponder_modal_advanced').setTitle('Advanced Options');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('cooldown').setLabel('Per-user cooldown (seconds)').setStyle(TextInputStyle.Short).setRequired(false).setValue(String(s.draft.cooldown))),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('chance').setLabel('Trigger chance (1-100)').setStyle(TextInputStyle.Short).setRequired(false).setValue(String(s.draft.chance))),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('delete').setLabel('Delete the trigger message? (yes/no)').setStyle(TextInputStyle.Short).setRequired(false).setValue(s.draft.deleteTrigger ? 'yes' : 'no')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role').setLabel('Required role ID (blank = anyone)').setStyle(TextInputStyle.Short).setRequired(false).setValue(s.draft.requiredRole || '')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('allowed_channels').setLabel('Allowed channel IDs (comma separated)').setStyle(TextInputStyle.Short).setRequired(false).setValue((s.draft.allowedChannels || []).join(', '))),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('ignored_channels').setLabel('Ignored channel IDs (comma separated)').setStyle(TextInputStyle.Short).setRequired(false).setValue((s.draft.ignoredChannels || []).join(', '))),
          );
          return interaction.showModal(modal).catch(() => null);
        }
        if (id === 'autoresponder_wiz_reactions') {
          const modal = new ModalBuilder().setCustomId('autoresponder_modal_reactions').setTitle('Auto Reactions');
          modal.addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reactions').setLabel('Emojis to react with (space separated)').setStyle(TextInputStyle.Short).setRequired(false).setValue(s.draft.reactions.join(' ')).setPlaceholder('👍 🎉 ❤️')),
          );
          return interaction.showModal(modal).catch(() => null);
        }
        if (id === 'autoresponder_wiz_cancel') {
          sessions.delete(key);
          return interaction.update({ embeds: [new EmbedBuilder().setColor(ERR).setTitle('✖️ Wizard Cancelled').setDescription('No changes were saved.')], components: [] }).catch(() => null);
        }
        if (id === 'autoresponder_wiz_save') {
          if (!s.draft.trigger || !s.draft.responses.length) {
            return interaction.reply({ content: '❌ You must set both a **trigger** and at least one **response** before saving.', ephemeral: true }).catch(() => null);
          }
          if ((s.draft.responseType || 'text') === 'reaction' && (!s.draft.reactions || s.draft.reactions.length === 0)) {
            return interaction.reply({ content: '❌ Reaction responders need at least one emoji selected before saving.', ephemeral: true }).catch(() => null);
          }
          const config = await getConfig(interaction.guildId);
          s.draft.createdBy = s.draft.createdBy || interaction.user.id;
          if (s.editingId) {
            const idx = config.responders.findIndex(x => x.id === s.editingId);
            if (idx !== -1) {
              const uses = config.responders[idx].uses || 0;
              config.responders[idx] = { ...s.draft, uses };
            } else {
              config.responders.push(s.draft);
            }
          } else {
            config.responders.push(s.draft);
          }
          config.markModified('responders');
          await config.save();
          sessions.delete(key);
          return interaction.update({
            embeds: [new EmbedBuilder().setColor(OK).setTitle('💾 Saved!')
              .setDescription(`Responder \`${s.draft.id}\` for trigger **${s.draft.trigger}** is live.${config.enabled ? '' : '\n\n⚠️ Module is **disabled** — run `/autoresponder enable`.'}`)],
            components: [],
          }).catch(() => null);
        }
      } catch (err) {
        console.error('[AutoResponder handleInteraction error]:', err.message);
        if (!interaction.replied && !interaction.deferred) {
          interaction.reply({ content: '❌ Something went wrong handling that action.', ephemeral: true }).catch(() => null);
        }
      }
    },
  
    // Expose the model for the event handler
    AutoResponder,
  };
  