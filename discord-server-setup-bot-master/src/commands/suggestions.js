'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require('discord.js');
const mongoose = require('mongoose');

// ─── Schemas ────────────────────────────────────────────────────────────────

const suggestionConfigSchema = new mongoose.Schema({
  guildId:         { type: String, required: true, unique: true },
  channelId:       { type: String, default: null },
  staffChannelId:  { type: String, default: null },
  enabled:         { type: Boolean, default: true },
  anonymousMode:   { type: Boolean, default: false },
  enableThreads:   { type: Boolean, default: false },
  cooldownMinutes: { type: Number, default: 0 },
  dmUpdates:       { type: Boolean, default: true },
  minLength:       { type: Number, default: 10 },
  maxPerUser:      { type: Number, default: 25 },
});

const suggestionEntrySchema = new mongoose.Schema({
  guildId:          { type: String, required: true },
  suggestionNumber: { type: Number, required: true },
  channelId:        { type: String, default: null },
  messageId:        { type: String, default: null },
  threadId:         { type: String, default: null },
  authorId:         { type: String, required: true },
  content:          { type: String, required: true },
  status:           { type: String, enum: ['pending', 'approved', 'denied', 'implemented'], default: 'pending' },
  upvotes:          { type: [String], default: [] },
  downvotes:        { type: [String], default: [] },
  staffNote:        { type: String, default: null },
  staffId:          { type: String, default: null },
  createdAt:        { type: Date, default: Date.now },
  updatedAt:        { type: Date, default: Date.now },
});

suggestionEntrySchema.index({ guildId: 1, suggestionNumber: 1 }, { unique: true });

const SuggestionConfig = mongoose.models.SuggestionConfig
  || mongoose.model('SuggestionConfig', suggestionConfigSchema);

const SuggestionEntry = mongoose.models.SuggestionEntry
  || mongoose.model('SuggestionEntry', suggestionEntrySchema);

// In-memory wizard sessions: `${userId}_${guildId}` → { step, channelId, staffChannelId }
const setupWizard = new Map();

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_META = {
  pending:     { color: '#5865F2', emoji: '⏳', label: 'Pending' },
  approved:    { color: '#57F287', emoji: '✅', label: 'Approved' },
  denied:      { color: '#ED4245', emoji: '❌', label: 'Denied' },
  implemented: { color: '#9B59B6', emoji: '🔨', label: 'Implemented' },
};

// ─── SlashCommandBuilder ─────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('suggestions')
  .setDescription('Suggestion system management')

  .addSubcommand(sub => sub
    .setName('setup')
    .setDescription('Launch the guided setup wizard (or provide a channel directly)')
    .addChannelOption(opt => opt
      .setName('channel')
      .setDescription('Directly set the suggestion channel (skips wizard)')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false))
    .addChannelOption(opt => opt
      .setName('staff-channel')
      .setDescription('Staff review channel (only used when channel is also provided)')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)))

  .addSubcommand(sub => sub
    .setName('config')
    .setDescription('Configure suggestion settings')
    .addStringOption(opt => opt
      .setName('setting')
      .setDescription('Which setting to change')
      .setRequired(true)
      .addChoices(
        { name: 'anonymous',    value: 'anonymous' },
        { name: 'threads',      value: 'threads' },
        { name: 'cooldown',     value: 'cooldown' },
        { name: 'dm-updates',   value: 'dm-updates' },
        { name: 'min-length',   value: 'min-length' },
        { name: 'max-per-user', value: 'max-per-user' },
      ))
    .addStringOption(opt => opt
      .setName('value')
      .setDescription('New value (true/false or a number)')
      .setRequired(true)))

  .addSubcommand(sub => sub
    .setName('toggle')
    .setDescription('Enable or disable the suggestions module'))

  .addSubcommand(sub => sub
    .setName('submit')
    .setDescription('Submit a suggestion')
    .addStringOption(opt => opt
      .setName('content')
      .setDescription('Your suggestion (10–1000 characters)')
      .setRequired(true)
      .setMinLength(10)
      .setMaxLength(1000)))

  .addSubcommand(sub => sub
    .setName('approve')
    .setDescription('Approve a suggestion')
    .addIntegerOption(opt => opt
      .setName('id')
      .setDescription('Suggestion number')
      .setRequired(true)
      .setMinValue(1))
    .addStringOption(opt => opt
      .setName('note')
      .setDescription('Optional staff note')
      .setRequired(false)
      .setMaxLength(500)))

  .addSubcommand(sub => sub
    .setName('deny')
    .setDescription('Deny a suggestion')
    .addIntegerOption(opt => opt
      .setName('id')
      .setDescription('Suggestion number')
      .setRequired(true)
      .setMinValue(1))
    .addStringOption(opt => opt
      .setName('note')
      .setDescription('Optional staff note')
      .setRequired(false)
      .setMaxLength(500)))

  .addSubcommand(sub => sub
    .setName('implement')
    .setDescription('Mark a suggestion as implemented')
    .addIntegerOption(opt => opt
      .setName('id')
      .setDescription('Suggestion number')
      .setRequired(true)
      .setMinValue(1))
    .addStringOption(opt => opt
      .setName('note')
      .setDescription('Optional staff note')
      .setRequired(false)
      .setMaxLength(500)))

  .addSubcommand(sub => sub
    .setName('delete')
    .setDescription('Delete a suggestion entirely')
    .addIntegerOption(opt => opt
      .setName('id')
      .setDescription('Suggestion number')
      .setRequired(true)
      .setMinValue(1)))

  .addSubcommand(sub => sub
    .setName('list')
    .setDescription('List suggestions')
    .addStringOption(opt => opt
      .setName('status')
      .setDescription('Filter by status')
      .setRequired(false)
      .addChoices(
        { name: 'pending',     value: 'pending' },
        { name: 'approved',    value: 'approved' },
        { name: 'denied',      value: 'denied' },
        { name: 'implemented', value: 'implemented' },
        { name: 'all',         value: 'all' },
      )))

  .addSubcommand(sub => sub
    .setName('my')
    .setDescription('View your own suggestions'));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function requiresManageGuild(sub) {
  return ['setup', 'config', 'toggle', 'approve', 'deny', 'implement', 'delete'].includes(sub);
}

async function getOrCreateConfig(guildId) {
  let cfg = await SuggestionConfig.findOne({ guildId });
  if (!cfg) cfg = await SuggestionConfig.create({ guildId });
  return cfg;
}

async function nextSuggestionNumber(guildId) {
  const last = await SuggestionEntry
    .findOne({ guildId })
    .sort({ suggestionNumber: -1 })
    .select('suggestionNumber')
    .lean();
  return (last?.suggestionNumber ?? 0) + 1;
}

function buildSuggestionEmbed(entry, cfg, user) {
  const meta = STATUS_META[entry.status] ?? STATUS_META.pending;
  const anon = cfg.anonymousMode;

  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(`💡 Suggestion #${entry.suggestionNumber}`)
    .setDescription(entry.content)
    .addFields(
      { name: 'Status', value: `${meta.emoji} ${meta.label}`, inline: true },
      {
        name: 'Votes',
        value: `👍 ${entry.upvotes.length} · 👎 ${entry.downvotes.length}`,
        inline: true,
      },
    )
    .setFooter({
      text: `Suggestion ID: ${entry.suggestionNumber} · Use /suggestions submit to add yours`,
    })
    .setTimestamp(entry.createdAt);

  if (anon || !user) {
    embed.setAuthor({ name: 'Anonymous' });
  } else {
    embed.setAuthor({
      name: user.tag,
      iconURL: user.displayAvatarURL({ dynamic: true }),
    });
  }

  if (entry.staffNote) {
    const staffMeta = STATUS_META[entry.status] ?? STATUS_META.pending;
    embed.addFields({
      name: `${staffMeta.emoji} Staff Note`,
      value: entry.staffNote,
    });
  }

  return embed;
}

function buildVoteRow(number) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggestions_vote_up_${number}`)
      .setLabel('Upvote')
      .setEmoji('👍')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`suggestions_vote_down_${number}`)
      .setLabel('Downvote')
      .setEmoji('👎')
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildStaffRow(number) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`suggestions_approve_${number}`)
      .setLabel('Approve')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`suggestions_deny_${number}`)
      .setLabel('Deny')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`suggestions_implement_${number}`)
      .setLabel('Implement')
      .setEmoji('🔨')
      .setStyle(ButtonStyle.Secondary),
  );
}

async function applyStatusChange(interaction, entry, cfg, newStatus, staffNote) {
  entry.status    = newStatus;
  entry.staffNote = staffNote || null;
  entry.staffId   = interaction.user.id;
  entry.updatedAt = new Date();
  await entry.save();

  const meta = STATUS_META[newStatus];

  // Edit original message embed
  if (entry.channelId && entry.messageId) {
    const ch = await interaction.client.channels.fetch(entry.channelId).catch(() => null);
    if (ch) {
      const msg = await ch.messages.fetch(entry.messageId).catch(() => null);
      if (msg) {
        const author = cfg.anonymousMode
          ? null
          : await interaction.client.users.fetch(entry.authorId).catch(() => null);

        const embed = buildSuggestionEmbed(entry, cfg, author);
        await msg.edit({ embeds: [embed], components: [buildVoteRow(entry.suggestionNumber), buildStaffRow(entry.suggestionNumber)] })
          .catch(() => null);
      }
    }
  }

  // DM the author
  if (cfg.dmUpdates && !cfg.anonymousMode) {
    const author = await interaction.client.users.fetch(entry.authorId).catch(() => null);
    if (author) {
      const dmEmbed = new EmbedBuilder()
        .setColor(meta.color)
        .setTitle(`${meta.emoji} Suggestion #${entry.suggestionNumber} ${meta.label}`)
        .setDescription(entry.content)
        .setTimestamp();
      if (staffNote) dmEmbed.addFields({ name: 'Staff Note', value: staffNote });
      await author.send({ embeds: [dmEmbed] }).catch(() => null);
    }
  }

  // Staff channel notification
  if (cfg.staffChannelId) {
    const staffCh = await interaction.client.channels.fetch(cfg.staffChannelId).catch(() => null);
    if (staffCh) {
      const notifEmbed = new EmbedBuilder()
        .setColor(meta.color)
        .setTitle(`${meta.emoji} Suggestion #${entry.suggestionNumber} marked ${meta.label}`)
        .setDescription(entry.content)
        .addFields({ name: 'Staff', value: `<@${interaction.user.id}>`, inline: true })
        .setTimestamp();
      if (staffNote) notifEmbed.addFields({ name: 'Note', value: staffNote });
      await staffCh.send({ embeds: [notifEmbed] }).catch(() => null);
    }
  }
}

// ─── Subcommand Handlers ─────────────────────────────────────────────────────

async function handleSetup(interaction) {
  const direct = interaction.options?.getChannel?.('channel');
  if (direct) {
    const staffChannel = interaction.options?.getChannel?.('staff-channel');
    const cfg = await getOrCreateConfig(interaction.guildId);
    cfg.channelId      = direct.id;
    cfg.staffChannelId = staffChannel?.id ?? cfg.staffChannelId;
    cfg.enabled = true;
    await cfg.save();
    const lines = [`✅ Suggestions channel set to ${direct}.`];
    if (staffChannel) lines.push(`Staff review channel set to ${staffChannel}.`);
    return interaction.reply({ content: lines.join('\n'), ephemeral: true });
  }

  // Wizard — step 1: pick submission channel
  setupWizard.set(`${interaction.user.id}_${interaction.guildId}`, { step: 1 });

  const embed = new EmbedBuilder()
    .setTitle('💡 Suggestions Setup — Step 1 / 4')
    .setColor('#5865F2')
    .setDescription('Select the **channel** where members will submit suggestions.\n\nTip: run `/suggestions setup #channel` to skip this wizard.');

  const row = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('suggestions_wizard_ch')
      .setPlaceholder('Choose the suggestions channel...')
      .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
  );

  return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleConfig(interaction) {
  const setting = interaction.options.getString('setting');
  const raw     = interaction.options.getString('value');
  const cfg     = await getOrCreateConfig(interaction.guildId);

  const boolSettings = { anonymous: 'anonymousMode', threads: 'enableThreads', 'dm-updates': 'dmUpdates' };
  const numSettings  = { cooldown: { field: 'cooldownMinutes', min: 0, max: 1440 }, 'min-length': { field: 'minLength', min: 5, max: 500 }, 'max-per-user': { field: 'maxPerUser', min: 1, max: 50 } };

  if (boolSettings[setting]) {
    if (raw !== 'true' && raw !== 'false') {
      return interaction.reply({ content: '❌ Value must be `true` or `false`.', ephemeral: true });
    }
    cfg[boolSettings[setting]] = raw === 'true';
    await cfg.save();
    return interaction.reply({ content: `✅ \`${setting}\` set to \`${raw}\`.`, ephemeral: true });
  }

  if (numSettings[setting]) {
    const { field, min, max } = numSettings[setting];
    const num = parseInt(raw, 10);
    if (isNaN(num) || num < min || num > max) {
      return interaction.reply({ content: `❌ Value must be a number between ${min} and ${max}.`, ephemeral: true });
    }
    cfg[field] = num;
    await cfg.save();
    return interaction.reply({ content: `✅ \`${setting}\` set to \`${num}\`.`, ephemeral: true });
  }

  return interaction.reply({ content: '❌ Unknown setting.', ephemeral: true });
}

async function handleToggle(interaction) {
  const cfg = await getOrCreateConfig(interaction.guildId);
  cfg.enabled = !cfg.enabled;
  await cfg.save();
  const state = cfg.enabled ? '✅ enabled' : '🔴 disabled';
  return interaction.reply({ content: `Suggestions module is now **${state}**.`, ephemeral: true });
}

async function handleSubmit(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const cfg = await getOrCreateConfig(interaction.guildId);

  if (!cfg.enabled) {
    return interaction.editReply('❌ The suggestions module is currently disabled.');
  }
  if (!cfg.channelId) {
    return interaction.editReply('❌ No suggestions channel has been configured. Ask a staff member to run `/suggestions setup`.');
  }

  const content = interaction.options.getString('content');

  if (content.length < cfg.minLength) {
    return interaction.editReply(`❌ Your suggestion must be at least **${cfg.minLength}** characters long.`);
  }

  // Cooldown check
  if (cfg.cooldownMinutes > 0) {
    const since = new Date(Date.now() - cfg.cooldownMinutes * 60_000);
    const recent = await SuggestionEntry.findOne({
      guildId:  interaction.guildId,
      authorId: interaction.user.id,
      createdAt: { $gte: since },
    }).lean();
    if (recent) {
      const remaining = Math.ceil((recent.createdAt.getTime() + cfg.cooldownMinutes * 60_000 - Date.now()) / 60_000);
      return interaction.editReply(`❌ You're on cooldown. Please wait **${remaining}** more minute(s).`);
    }
  }

  // Max-per-user check
  const pendingCount = await SuggestionEntry.countDocuments({
    guildId:  interaction.guildId,
    authorId: interaction.user.id,
    status:   'pending',
  });
  if (pendingCount >= cfg.maxPerUser) {
    return interaction.editReply(`❌ You already have **${pendingCount}** pending suggestion(s). The limit is **${cfg.maxPerUser}**.`);
  }

  const number = await nextSuggestionNumber(interaction.guildId);

  const entry = new SuggestionEntry({
    guildId:          interaction.guildId,
    suggestionNumber: number,
    authorId:         interaction.user.id,
    content,
    status:           'pending',
  });

  const channel = await interaction.client.channels.fetch(cfg.channelId).catch(() => null);
  if (!channel) {
    return interaction.editReply('❌ Could not find the suggestions channel. Please ask staff to re-run `/suggestions setup`.');
  }

  const embed = buildSuggestionEmbed(entry, cfg, interaction.user);
  const components = [buildVoteRow(number), buildStaffRow(number)];

  const msg = await channel.send({ embeds: [embed], components }).catch(() => null);
  if (!msg) {
    return interaction.editReply('❌ Failed to post the suggestion. Check my permissions in the suggestions channel.');
  }

  entry.channelId = channel.id;
  entry.messageId = msg.id;

  if (cfg.enableThreads) {
    const thread = await msg.startThread({
      name: `Suggestion #${number} discussion`,
      autoArchiveDuration: 1440,
    }).catch(() => null);
    if (thread) entry.threadId = thread.id;
  }

  await entry.save();

  return interaction.editReply(`✅ Your suggestion has been submitted as **#${number}**.`);
}

async function handleStaffAction(interaction, action) {
  const id   = interaction.options.getInteger('id');
  const note = interaction.options.getString('note') ?? null;
  const cfg  = await getOrCreateConfig(interaction.guildId);

  const entry = await SuggestionEntry.findOne({ guildId: interaction.guildId, suggestionNumber: id });
  if (!entry) {
    return interaction.reply({ content: `❌ Suggestion #${id} not found.`, ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });
  await applyStatusChange(interaction, entry, cfg, action, note);

  const meta = STATUS_META[action];
  return interaction.editReply(`${meta.emoji} Suggestion #${id} has been marked as **${meta.label}**.`);
}

async function handleDelete(interaction) {
  const id    = interaction.options.getInteger('id');
  const entry = await SuggestionEntry.findOne({ guildId: interaction.guildId, suggestionNumber: id });

  if (!entry) {
    return interaction.reply({ content: `❌ Suggestion #${id} not found.`, ephemeral: true });
  }

  if (entry.channelId && entry.messageId) {
    const ch = await interaction.client.channels.fetch(entry.channelId).catch(() => null);
    if (ch) {
      const msg = await ch.messages.fetch(entry.messageId).catch(() => null);
      if (msg) await msg.delete().catch(() => null);
    }
  }

  if (entry.threadId) {
    const thread = await interaction.client.channels.fetch(entry.threadId).catch(() => null);
    if (thread) await thread.delete().catch(() => null);
  }

  await entry.deleteOne();
  return interaction.reply({ content: `🗑️ Suggestion #${id} has been deleted.`, ephemeral: true });
}

async function handleList(interaction) {
  const statusFilter = interaction.options.getString('status') ?? 'pending';

  const query = { guildId: interaction.guildId };
  if (statusFilter !== 'all') query.status = statusFilter;

  const entries = await SuggestionEntry
    .find(query)
    .sort({ suggestionNumber: -1 })
    .limit(20)
    .lean();

  if (!entries.length) {
    return interaction.reply({ content: `No suggestions found${statusFilter !== 'all' ? ` with status **${statusFilter}**` : ''}.`, ephemeral: true });
  }

  const cfg = await getOrCreateConfig(interaction.guildId);
  const label = statusFilter === 'all' ? 'All' : STATUS_META[statusFilter]?.label ?? statusFilter;

  const lines = entries.map(e => {
    const meta   = STATUS_META[e.status] ?? STATUS_META.pending;
    const author = cfg.anonymousMode ? 'Anonymous' : `<@${e.authorId}>`;
    const votes  = `👍 ${e.upvotes.length} 👎 ${e.downvotes.length}`;
    const snip   = e.content.length > 60 ? `${e.content.slice(0, 60)}…` : e.content;
    return `**#${e.suggestionNumber}** ${meta.emoji} ${author} — ${snip} *(${votes})*`;
  });

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`💡 ${label} Suggestions (top ${entries.length})`)
    .setDescription(lines.join('\n'))
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleMy(interaction) {
  const entries = await SuggestionEntry
    .find({ guildId: interaction.guildId, authorId: interaction.user.id })
    .sort({ suggestionNumber: -1 })
    .limit(20)
    .lean();

  if (!entries.length) {
    return interaction.reply({ content: "You haven't submitted any suggestions.", ephemeral: true });
  }

  const lines = entries.map(e => {
    const meta  = STATUS_META[e.status] ?? STATUS_META.pending;
    const votes = `👍 ${e.upvotes.length} 👎 ${e.downvotes.length}`;
    const snip  = e.content.length > 60 ? `${e.content.slice(0, 60)}…` : e.content;
    return `**#${e.suggestionNumber}** ${meta.emoji} ${meta.label} — ${snip} *(${votes})*`;
  });

  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('💡 Your Suggestions')
    .setDescription(lines.join('\n'))
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

// ─── execute ──────────────────────────────────────────────────────────────────

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (requiresManageGuild(sub) && !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: '❌ You need the **Manage Server** permission to use this command.', ephemeral: true });
  }

  switch (sub) {
    case 'setup':     return handleSetup(interaction);
    case 'config':    return handleConfig(interaction);
    case 'toggle':    return handleToggle(interaction);
    case 'submit':    return handleSubmit(interaction);
    case 'approve':   return handleStaffAction(interaction, 'approved');
    case 'deny':      return handleStaffAction(interaction, 'denied');
    case 'implement': return handleStaffAction(interaction, 'implemented');
    case 'delete':    return handleDelete(interaction);
    case 'list':      return handleList(interaction);
    case 'my':        return handleMy(interaction);
    default:
      return interaction.reply({ content: '❌ Unknown subcommand.', ephemeral: true });
  }
}

// ─── handleInteraction ───────────────────────────────────────────────────────

// ─── Wizard step 2 → 3 helper (shared by channel-select and skip button) ────

async function advanceToStep3(interaction, key, staffChannelId) {
  const session = setupWizard.get(key) || {};
  session.staffChannelId = staffChannelId;
  session.step = 3;
  setupWizard.set(key, session);

  const embed = new EmbedBuilder()
    .setTitle('💡 Suggestions Setup — Step 3 / 4')
    .setColor('#5865F2')
    .setDescription(`Submission: <#${session.channelId}>\n${session.staffChannelId ? `Staff: <#${session.staffChannelId}>` : 'Staff: None'}\n\nSet the **per-user cooldown** (how long between submissions).`);

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('suggestions_wizard_cooldown')
      .setPlaceholder('Choose a cooldown...')
      .addOptions([
        { label: 'No cooldown',   value: '0'    },
        { label: '5 minutes',     value: '5'    },
        { label: '15 minutes',    value: '15'   },
        { label: '30 minutes',    value: '30'   },
        { label: '1 hour',        value: '60'   },
        { label: '6 hours',       value: '360'  },
        { label: '24 hours',      value: '1440' },
      ])
  );
  return interaction.update({ embeds: [embed], components: [row] }).catch(() => null);
}

async function handleInteraction(interaction) {
  const id  = interaction.customId;
  const key = `${interaction.user.id}_${interaction.guildId}`;

  // ── Setup wizard ────────────────────────────────────────────────────────────
  if (id === 'suggestions_wizard_ch') {
    const channelId = interaction.values[0];
    const session   = setupWizard.get(key) || {};
    session.channelId = channelId;
    session.step      = 2;
    setupWizard.set(key, session);

    const embed = new EmbedBuilder()
      .setTitle('💡 Suggestions Setup — Step 2 / 4')
      .setColor('#5865F2')
      .setDescription(`Submission channel: <#${channelId}>\n\nSelect a **staff review channel** where approvals/denials are announced, or press **Skip**.`);

    const selectRow = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('suggestions_wizard_staff')
        .setPlaceholder('Choose a staff channel...')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );
    const skipRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('suggestions_wizard_staff_skip')
        .setLabel('⏩ Skip (no staff channel)')
        .setStyle(ButtonStyle.Secondary)
    );
    return interaction.update({ embeds: [embed], components: [selectRow, skipRow] }).catch(() => null);
  }

  if (id === 'suggestions_wizard_staff') {
    return advanceToStep3(interaction, key, interaction.values[0]);
  }

  if (id === 'suggestions_wizard_staff_skip') {
    return advanceToStep3(interaction, key, null);
  }

  if (id === 'suggestions_wizard_cooldown') {
    const session = setupWizard.get(key) || {};
    session.cooldownMinutes = parseInt(interaction.values[0], 10) || 0;
    session.step = 4;
    setupWizard.set(key, session);

    const embed = new EmbedBuilder()
      .setTitle('💡 Suggestions Setup — Step 4 / 4')
      .setColor('#5865F2')
      .setDescription('Configure additional **module options**.');

    const row1 = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('suggestions_wizard_anon')
        .setPlaceholder('Anonymous mode?')
        .addOptions([
          { label: '👤 Show author names (default)', value: 'false' },
          { label: '🥷 Anonymous mode',              value: 'true'  },
        ])
    );
    return interaction.update({ embeds: [embed], components: [row1] }).catch(() => null);
  }

  if (id === 'suggestions_wizard_anon') {
    const session = setupWizard.get(key) || {};
    session.anonymousMode = interaction.values[0] === 'true';
    setupWizard.delete(key);

    const cfg = await getOrCreateConfig(interaction.guildId);
    cfg.channelId       = session.channelId;
    cfg.staffChannelId  = session.staffChannelId ?? cfg.staffChannelId;
    cfg.cooldownMinutes = session.cooldownMinutes ?? 0;
    cfg.anonymousMode   = session.anonymousMode   ?? false;
    cfg.enabled         = true;
    await cfg.save();

    const embed = new EmbedBuilder()
      .setTitle('✅ Suggestions Module Active!')
      .setColor('#57F287')
      .setDescription('Setup complete. Members can now run `/suggestions submit` or `|suggestions submit`.')
      .addFields(
        { name: 'Submission Channel', value: `<#${session.channelId}>`,                              inline: true },
        { name: 'Staff Channel',      value: session.staffChannelId ? `<#${session.staffChannelId}>` : 'None', inline: true },
        { name: 'Cooldown',           value: session.cooldownMinutes ? `${session.cooldownMinutes}m` : 'None', inline: true },
        { name: 'Anonymous',          value: session.anonymousMode ? 'Yes' : 'No',                   inline: true },
        { name: 'Next Steps',         value: '• `/suggestions config` — fine-tune settings\n• `/suggestions toggle` — pause/resume\n• Vote buttons appear on every suggestion automatically' }
      );
    return interaction.update({ embeds: [embed], components: [] }).catch(() => null);
  }

  // ── Button interactions ──────────────────────────────────────────────────
  if (interaction.isButton()) {
    const id = interaction.customId;

    // Vote buttons
    const voteMatch = id.match(/^suggestions_vote_(up|down)_(\d+)$/);
    if (voteMatch) {
      const direction = voteMatch[1];
      const number    = parseInt(voteMatch[2], 10);
      return handleVoteButton(interaction, direction, number);
    }

    // Staff action buttons
    const staffMatch = id.match(/^suggestions_(approve|deny|implement)_(\d+)$/);
    if (staffMatch) {
      const action = staffMatch[1];
      const number = parseInt(staffMatch[2], 10);
      return handleStaffButton(interaction, action, number);
    }
  }

  // ── Modal submissions ────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    const id = interaction.customId;
    const modalMatch = id.match(/^suggestions_modal_(approve|deny|implement)_(\d+)$/);
    if (modalMatch) {
      const action = modalMatch[1];
      const number = parseInt(modalMatch[2], 10);
      return handleStaffModalSubmit(interaction, action, number);
    }
  }
}

// ─── Vote Button Handler ──────────────────────────────────────────────────────

async function handleVoteButton(interaction, direction, number) {
  const entry = await SuggestionEntry.findOne({ guildId: interaction.guildId, suggestionNumber: number });
  if (!entry) {
    return interaction.reply({ content: '❌ Suggestion not found.', ephemeral: true });
  }

  const cfg = await getOrCreateConfig(interaction.guildId);
  const userId = interaction.user.id;

  // Block self-voting unless anonymous (can't reliably check)
  if (!cfg.anonymousMode && entry.authorId === userId) {
    return interaction.reply({ content: "❌ You can't vote on your own suggestion.", ephemeral: true });
  }

  const upSet   = new Set(entry.upvotes);
  const downSet = new Set(entry.downvotes);
  let replyText;

  if (direction === 'up') {
    if (upSet.has(userId)) {
      upSet.delete(userId);
      replyText = '↩️ Removed your upvote.';
    } else {
      upSet.add(userId);
      downSet.delete(userId);
      replyText = '👍 You upvoted this suggestion.';
    }
  } else {
    if (downSet.has(userId)) {
      downSet.delete(userId);
      replyText = '↩️ Removed your downvote.';
    } else {
      downSet.add(userId);
      upSet.delete(userId);
      replyText = '👎 You downvoted this suggestion.';
    }
  }

  entry.upvotes   = [...upSet];
  entry.downvotes = [...downSet];
  entry.updatedAt = new Date();
  await entry.save();

  // Update the embed votes field
  const author = cfg.anonymousMode
    ? null
    : await interaction.client.users.fetch(entry.authorId).catch(() => null);
  const embed = buildSuggestionEmbed(entry, cfg, author);

  await interaction.message.edit({
    embeds:     [embed],
    components: interaction.message.components,
  }).catch(() => null);

  return interaction.reply({ content: replyText, ephemeral: true });
}

// ─── Staff Button Handler ─────────────────────────────────────────────────────

async function handleStaffButton(interaction, action, number) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
    return interaction.reply({ content: '❌ You need the **Manage Server** permission to use this.', ephemeral: true });
  }

  const actionLabels = { approve: 'Approve', deny: 'Deny', implement: 'Implement' };

  const modal = new ModalBuilder()
    .setCustomId(`suggestions_modal_${action}_${number}`)
    .setTitle(`${actionLabels[action]} Suggestion #${number}`)
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('staff_note')
          .setLabel('Staff note (optional)')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500),
      ),
    );

  return interaction.showModal(modal);
}

// ─── Staff Modal Submit Handler ───────────────────────────────────────────────

async function handleStaffModalSubmit(interaction, action, number) {
  const note  = interaction.fields.getTextInputValue('staff_note')?.trim() || null;
  const cfg   = await getOrCreateConfig(interaction.guildId);
  const entry = await SuggestionEntry.findOne({ guildId: interaction.guildId, suggestionNumber: number });

  if (!entry) {
    return interaction.reply({ content: `❌ Suggestion #${number} not found.`, ephemeral: true });
  }

  const statusMap = { approve: 'approved', deny: 'denied', implement: 'implemented' };
  const newStatus = statusMap[action];

  await interaction.deferReply({ ephemeral: true });
  await applyStatusChange(interaction, entry, cfg, newStatus, note);

  const meta = STATUS_META[newStatus];
  return interaction.editReply(`${meta.emoji} Suggestion #${number} has been marked as **${meta.label}**.`);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  data,
  name: 'suggestions',
  execute,
  handleInteraction,
  SuggestionConfig,
  SuggestionEntry,
};