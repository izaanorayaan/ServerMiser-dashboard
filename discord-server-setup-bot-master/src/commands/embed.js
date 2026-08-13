const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags
} = require('discord.js');
const mongoose = require('mongoose');

// ─── Database Schema Definition ─────────────────────────────────────────────

const embedTemplateSchema = new mongoose.Schema({
  guildId:   { type: String, required: true },
  name:      { type: String, required: true },
  createdBy: { type: String, required: true },
  data:      { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

embedTemplateSchema.index({ guildId: 1, name: 1 }, { unique: true });

const EmbedTemplate =
  mongoose.models.EmbedTemplate ||
  mongoose.model('EmbedTemplate', embedTemplateSchema);

// ─── In-Memory Session Cache Matrix ─────────────────────────────────────────

const sessions = new Map();

function sessionKey(userId, guildId) {
  return `${userId}_${guildId}`;
}

function getSession(userId, guildId) {
  const key = sessionKey(userId, guildId);
  if (!sessions.has(key)) {
    sessions.set(key, { createdAt: Date.now() });
  }
  const session = sessions.get(key);
  session._lastActive = Date.now();
  return session;
}

function clearSession(userId, guildId) {
  sessions.delete(sessionKey(userId, guildId));
}

setInterval(() => {
  const now = Date.now();
  const ttl = 30 * 60 * 1000;
  for (const [key, session] of sessions.entries()) {
    const lastActive = session._lastActive ?? session.createdAt ?? 0;
    if (now - lastActive > ttl) sessions.delete(key);
  }
}, 5 * 60 * 1000);

// ─── Visual Component Framework UI Modals ───────────────────────────────────

function previewActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('embed_preview_field').setLabel('📝 Edit Fields').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('embed_preview_send').setLabel('📤 Send').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('embed_preview_clear').setLabel('🗑️ Clear').setStyle(ButtonStyle.Danger),
  );
}

function buildCreateModal() {
  return new ModalBuilder()
    .setCustomId('embed_modal_create')
    .setTitle('Create Embed')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_title').setLabel('Title').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setRequired(false).setMaxLength(4000)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_color').setLabel('Color (hex)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('#5865F2').setMaxLength(7)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_footer').setLabel('Footer Text').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(2048)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('embed_author').setLabel('Author Name').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(256))
    );
}

function buildFieldAddModal() {
  return new ModalBuilder()
    .setCustomId('embed_modal_field_add')
    .setTitle('Add Field')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('field_name').setLabel('Field Name').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(256)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('field_value').setLabel('Field Value').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1024)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('field_inline').setLabel('Inline?').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('yes/no'))
    );
}

function buildSendConfirmModal() {
  return new ModalBuilder()
    .setCustomId('embed_modal_send_confirm')
    .setTitle('Send Embed')
    .addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('send_channel').setLabel('Channel ID or mention').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('#general or 123456789012345678'))
    );
}

// ─── Core Slash Command Definition Payload Registry ────────────────────────

const data = new SlashCommandBuilder()
  .setName('embed')
  .setDescription('Build and manage rich embeds')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
  .setDMPermission(false)
  .addSubcommand(sub => sub.setName('create').setDescription('Open a modal to build a new embed'))
  .addSubcommand(sub => sub.setName('edit').setDescription('Load an existing bot embed into your session for editing').addStringOption(opt => opt.setName('message_id').setDescription('ID of the bot message to edit').setRequired(true)))
  .addSubcommand(sub => sub.setName('send').setDescription('Send your in-progress embed to a channel').addChannelOption(opt => opt.setName('channel').setDescription('Target channel').setRequired(true)))
  .addSubcommandGroup(group =>
    group.setName('field').setDescription('Manage embed fields')
      .addSubcommand(sub => sub.setName('add').setDescription('Open a modal to add a field to your embed'))
      .addSubcommand(sub => sub.setName('remove').setDescription('Remove a field from your embed by index').addIntegerOption(opt => opt.setName('index').setDescription('Field index (1–25)').setRequired(true).setMinValue(1).setMaxValue(25)))
  )
  .addSubcommand(sub => sub.setName('image').setDescription('Set the large image URL on your embed').addStringOption(opt => opt.setName('url').setDescription('Image URL').setRequired(true)))
  .addSubcommand(sub => sub.setName('thumbnail').setDescription('Set the thumbnail URL on your embed').addStringOption(opt => opt.setName('url').setDescription('Thumbnail URL').setRequired(true)))
  .addSubcommand(sub => sub.setName('color').setDescription('Set the embed color').addStringOption(opt => opt.setName('hex').setDescription('Hex color e.g. #FF0000').setRequired(true)))
  .addSubcommand(sub => sub.setName('footer').setDescription('Set the embed footer').addStringOption(opt => opt.setName('text').setDescription('Footer text').setRequired(true).setMaxLength(2048)).addStringOption(opt => opt.setName('icon_url').setDescription('Footer icon URL').setRequired(false)))
  .addSubcommand(sub => sub.setName('author').setDescription('Set the embed author').addStringOption(opt => opt.setName('name').setDescription('Author name').setRequired(true).setMaxLength(256)).addStringOption(opt => opt.setName('icon_url').setDescription('Author icon URL').setRequired(false)).addStringOption(opt => opt.setName('url').setDescription('Author URL').setRequired(false)))
  .addSubcommand(sub => sub.setName('preview').setDescription('Preview your current in-progress embed'))
  .addSubcommand(sub => sub.setName('clear').setDescription('Clear your in-progress embed session'))
  .addSubcommandGroup(group =>
    group.setName('template').setDescription('Manage embed templates')
      .addSubcommand(sub => sub.setName('save').setDescription('Save current embed as a named template').addStringOption(opt => opt.setName('name').setDescription('Template name').setRequired(true)))
      .addSubcommand(sub => sub.setName('load').setDescription('Load a saved template into your session').addStringOption(opt => opt.setName('name').setDescription('Template name').setRequired(true)))
      .addSubcommand(sub => sub.setName('list').setDescription('List all saved templates for this server'))
      .addSubcommand(sub => sub.setName('delete').setDescription('Delete a saved template').addStringOption(opt => opt.setName('name').setDescription('Template name').setRequired(true)))
  );
// ─── Helpers & Utilities ────────────────────────────────────────────────────

function getField(interaction, id) {
  try {
    return interaction.fields.getTextInputValue(id) || null;
  } catch {
    return null;
  }
}

function parseHex(raw) {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  return parseInt(cleaned, 16);
}

function buildEmbedFromSession(session) {
  const embed = new EmbedBuilder();

  if (session.title)       embed.setTitle(session.title);
  if (session.description) embed.setDescription(session.description);
  if (session.color != null) embed.setColor(session.color);
  if (session.imageUrl)    embed.setImage(session.imageUrl);
  if (session.thumbnailUrl) embed.setThumbnail(session.thumbnailUrl);

  if (session.footer?.text) {
    embed.setFooter({
      text:    session.footer.text,
      iconURL: session.footer.iconUrl || undefined,
    });
  }

  if (session.author?.name) {
    embed.setAuthor({
      name:    session.author.name,
      iconURL: session.author.iconUrl || undefined,
      url:     session.author.url || undefined,
    });
  }

  if (Array.isArray(session.fields) && session.fields.length > 0) {
    embed.addFields(
      session.fields.map(f => ({
        name:   f.name,
        value:  f.value,
        inline: !!f.inline,
      }))
    );
  }

  return embed;
}

function hasSessionContent(session) {
  return !!(
    session.title || session.description || session.imageUrl ||
    session.thumbnailUrl || session.footer?.text || session.author?.name ||
    (Array.isArray(session.fields) && session.fields.length > 0)
  );
}

function sessionToData(session) {
  return {
    title:        session.title        || null,
    description:  session.description  || null,
    color:        session.color        ?? null,
    imageUrl:     session.imageUrl     || null,
    thumbnailUrl: session.thumbnailUrl || null,
    footer:       session.footer       || null,
    author:       session.author       || null,
    fields:       session.fields       || [],
  };
}

function loadDataIntoSession(session, data) {
  session.title        = data.title        || null;
  session.description  = data.description  || null;
  session.color        = data.color        ?? null;
  session.imageUrl     = data.imageUrl     || null;
  session.thumbnailUrl = data.thumbnailUrl || null;
  session.footer       = data.footer       || null;
  session.author       = data.author       || null;
  session.fields       = data.fields       || [];
}

async function requireManageMessages(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    await interaction.reply({
      content: '❌ You need the **Manage Messages** permission to use this command.',
      flags: [MessageFlags.Ephemeral],
    }).catch(() => null);
    return false;
  }
  return true;
}

async function requireManageGuild(interaction) {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: '❌ You need the **Manage Guild** permission to use this command.',
      flags: [MessageFlags.Ephemeral],
    }).catch(() => null);
    return false;
  }
  return true;
}

function isPrefixMode(interaction) {
  return typeof interaction.isChatInputCommand === 'function' && interaction.isChatInputCommand() === false;
}

function parsePrefixArgs(interaction) {
  const raw = String(interaction.content || '');
  const tokens = raw.trim().split(/\s+/);
  const sub = tokens[1] ? tokens[1].toLowerCase() : null;
  const rawArgs = tokens.slice(2).join(' ').trim();

  let targetChannel = interaction.channel;
  if (interaction.mentions?.channels?.size > 0) {
    targetChannel = interaction.mentions.channels.first();
  }

  return { sub, rawArgs, targetChannel };
}
// ─── Subcommand Handlers ─────────────────────────────────────────────────────

async function handleCreate(interaction) {
  if (!await requireManageMessages(interaction)) return;
  if (isPrefixMode(interaction)) {
    return interaction.reply({
      content: '⚠️ Visual UI Modals cannot be loaded via text prefix commands. Please run this command as a native Slash Command (`/embed create`) to open the canvas designer.',
    }).catch(() => null);
  }
  await interaction.showModal(buildCreateModal()).catch(() => null);
}

async function handleEdit(interaction) {
  if (!await requireManageMessages(interaction)) return;

  const messageId = isPrefixMode(interaction) 
    ? parsePrefixArgs(interaction).rawArgs.trim() 
    : interaction.options.getString('message_id');

  if (!messageId) {
    return interaction.reply({ content: '❌ Please provide a valid target message ID.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    return interaction.reply({ content: '❌ Message not found in this channel.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  if (message.author.id !== interaction.client.user.id) {
    return interaction.reply({ content: '❌ That message was not sent by this bot.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const existing = message.embeds[0];
  if (!existing) {
    return interaction.reply({ content: '❌ That message has no embed to edit.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const session = getSession(interaction.user.id, interaction.guildId);
  session.title        = existing.title       || null;
  session.description  = existing.description || null;
  session.color        = existing.color       ?? null;
  session.imageUrl     = existing.image?.url  || null;
  session.thumbnailUrl = existing.thumbnail?.url || null;
  session.footer       = existing.footer ? { text: existing.footer.text, iconUrl: existing.footer.iconURL || null } : null;
  session.author       = existing.author ? { name: existing.author.name, iconUrl: existing.author.iconURL || null, url: existing.author.url || null } : null;
  session.fields       = (existing.fields || []).map(f => ({ name: f.name, value: f.value, inline: f.inline }));
  session.editMessageId  = messageId;
  session.editChannelId  = interaction.channel.id;
  session._lastActive    = Date.now();

  await interaction.reply({ content: '✅ Embed loaded into your session. Use `/embed send` to update it.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
}

async function handleSend(interaction) {
  if (!await requireManageMessages(interaction)) return;

  const targetChannel = isPrefixMode(interaction) ? parsePrefixArgs(interaction).targetChannel : interaction.options.getChannel('channel');
  const session = getSession(interaction.user.id, interaction.guildId);

  if (!hasSessionContent(session)) {
    return interaction.reply({ content: '❌ Your session is empty. Use `/embed create` first.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const embed = buildEmbedFromSession(session);

  if (session.editMessageId && session.editChannelId) {
    const editChannel = await interaction.client.channels.fetch(session.editChannelId).catch(() => null);
    const editMessage = await editChannel?.messages.fetch(session.editMessageId).catch(() => null);

    if (editMessage) {
      await editMessage.edit({ embeds: [embed] }).catch(() => null);
      delete session.editMessageId;
      delete session.editChannelId;
      return interaction.reply({ content: `✅ Embed updated in <#${editChannel.id}>.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }
  }

  await targetChannel.send({ embeds: [embed] }).catch(() => null);
  await interaction.reply({ content: `✅ Embed sent to <#${targetChannel.id}>.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
}

async function handleFieldAdd(interaction) {
  if (!await requireManageMessages(interaction)) return;
  if (isPrefixMode(interaction)) {
    return interaction.reply({ content: '❌ Visual UI Modals cannot be loaded via text prefix commands. Please run `/embed field add`.' }).catch(() => null);
  }
  await interaction.showModal(buildFieldAddModal()).catch(() => null);
}

async function handleFieldRemove(interaction) {
  if (!await requireManageMessages(interaction)) return;

  const index = isPrefixMode(interaction) ? parseInt(parsePrefixArgs(interaction).rawArgs, 10) : interaction.options.getInteger('index');
  const session = getSession(interaction.user.id, interaction.guildId);

  if (!Array.isArray(session.fields) || session.fields.length === 0) {
    return interaction.reply({ content: '❌ Your embed has no fields.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  if (isNaN(index) || index < 1 || index > session.fields.length) {
    return interaction.reply({ content: `❌ Invalid index. Your embed has ${session.fields.length} field(s).`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  session.fields.splice(index - 1, 1);
  await interaction.reply({ content: `✅ Field #${index} removed. Your embed now has ${session.fields.length} field(s).`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
}

async function handleImage(interaction) {
  if (!await requireManageMessages(interaction)) return;
  const url = isPrefixMode(interaction) ? parsePrefixArgs(interaction).rawArgs.trim() : interaction.options.getString('url');
  const session = getSession(interaction.user.id, interaction.guildId);
  session.imageUrl = url;
  await interaction.reply({ content: `✅ Image URL set.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
}

async function handleThumbnail(interaction) {
  if (!await requireManageMessages(interaction)) return;
  const url = isPrefixMode(interaction) ? parsePrefixArgs(interaction).rawArgs.trim() : interaction.options.getString('url');
  const session = getSession(interaction.user.id, interaction.guildId);
  session.thumbnailUrl = url;
  await interaction.reply({ content: `✅ Thumbnail URL set.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
}
async function handleColor(interaction) {
  if (!await requireManageMessages(interaction)) return;
  const raw = isPrefixMode(interaction) ? parsePrefixArgs(interaction).rawArgs.trim() : interaction.options.getString('hex');
  const color = parseHex(raw);
  if (color === null) {
    return interaction.reply({ content: '❌ Invalid hex color. Use format `#FF0000`.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }
  const session = getSession(interaction.user.id, interaction.guildId);
  session.color = color;
  await interaction.reply({ content: `✅ Color set to \`${raw}\`.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
}

async function handleFooter(interaction) {
  if (!await requireManageMessages(interaction)) return;
  
  let text, iconUrl = null;
  if (isPrefixMode(interaction)) {
    text = parsePrefixArgs(interaction).rawArgs.trim();
  } else {
    text = interaction.options.getString('text');
    iconUrl = interaction.options.getString('icon_url') || null;
  }
  
  if (!text) {
    return interaction.reply({ content: '❌ Footer text string is required.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const session = getSession(interaction.user.id, interaction.guildId);
  session.footer = { text, iconUrl };
  await interaction.reply({ content: `✅ Footer set.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
}

async function handleAuthor(interaction) {
  if (!await requireManageMessages(interaction)) return;
  
  let name, iconUrl = null, url = null;
  if (isPrefixMode(interaction)) {
    name = parsePrefixArgs(interaction).rawArgs.trim();
  } else {
    name = interaction.options.getString('name');
    iconUrl = interaction.options.getString('icon_url') || null;
    url = interaction.options.getString('url') || null;
  }

  if (!name) {
    return interaction.reply({ content: '❌ Author name string is required.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const session = getSession(interaction.user.id, interaction.guildId);
  session.author = { name, iconUrl, url };
  await interaction.reply({ content: `✅ Author set.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
}

async function handlePreview(interaction) {
  if (!await requireManageMessages(interaction)) return;
  const session = getSession(interaction.user.id, interaction.guildId);

  if (!hasSessionContent(session)) {
    return interaction.reply({ content: '❌ Your session is empty. Use `/embed create` first.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const embed = buildEmbedFromSession(session);
  await interaction.reply({
    content: '**Preview:**',
    embeds: [embed],
    components: [previewActionRow()],
    flags: [MessageFlags.Ephemeral],
  }).catch(() => null);
}

async function handleClear(interaction) {
  if (!await requireManageMessages(interaction)) return;
  clearSession(interaction.user.id, interaction.guildId);
  await interaction.reply({ content: '✅ Session cleared.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
}

async function handleTemplateSave(interaction) {
  if (!await requireManageGuild(interaction)) return;
  
  const name = isPrefixMode(interaction) ? parsePrefixArgs(interaction).rawArgs.trim() : interaction.options.getString('name');

  if (!name) {
    return interaction.reply({ content: '❌ Please specify a unique identifier name for this template preset.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const session = getSession(interaction.user.id, interaction.guildId);
  if (!hasSessionContent(session)) {
    return interaction.reply({ content: '❌ Your session is empty. Nothing to save.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const data = sessionToData(session);

  await EmbedTemplate.findOneAndUpdate(
    { guildId: interaction.guildId, name },
    {
      guildId:   interaction.guildId,
      name,
      createdBy: interaction.user.id,
      data,
      updatedAt: new Date(),
    },
    { upsert: true, new: true },
  ).catch(() => null);

  await interaction.reply({ content: `✅ Template **${name}** saved!`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
}

async function handleTemplateLoad(interaction) {
  if (!await requireManageGuild(interaction)) return;
  
  const name = isPrefixMode(interaction) ? parsePrefixArgs(interaction).rawArgs.trim() : interaction.options.getString('name');

  if (!name) {
    return interaction.reply({ content: '❌ Please specify a template name to recall from storage.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const template = await EmbedTemplate.findOne({ guildId: interaction.guildId, name }).catch(() => null);
  if (!template) {
    return interaction.reply({ content: `❌ No template named **${name}** found.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const session = getSession(interaction.user.id, interaction.guildId);
  loadDataIntoSession(session, template.data);

  await interaction.reply({
    content: `✅ Template **${name}** loaded! Use \`/embed preview\` to check it.`,
    flags: [MessageFlags.Ephemeral],
  }).catch(() => null);
}

async function handleTemplateList(interaction) {
  if (!await requireManageMessages(interaction)) return;

  const templates = await EmbedTemplate.find({ guildId: interaction.guildId }).sort({ name: 1 }).catch(() => null);
  if (!templates?.length) {
    return interaction.reply({ content: '❌ No templates saved for this server.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const lines = templates.map((t, i) => {
    const date = t.updatedAt ?? t.createdAt;
    const dateStr = date ? `<t:${Math.floor(date.getTime() / 1000)}:D>` : 'Unknown';
    return `**${i + 1}.** \`${t.name}\` — by <@${t.createdBy}> on ${dateStr}`;
  });

  const embed = new EmbedBuilder()
    .setTitle('📋 Saved Embed Templates')
    .setDescription(lines.join('\n'))
    .setColor(0x5865f2);

  await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] }).catch(() => null);
}

async function handleTemplateDelete(interaction) {
  if (!await requireManageGuild(interaction)) return;
  
  const name = isPrefixMode(interaction) ? parsePrefixArgs(interaction).rawArgs.trim() : interaction.options.getString('name');

  if (!name) {
    return interaction.reply({ content: '❌ Please provide a template name to permanently wipe.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  const result = await EmbedTemplate.findOneAndDelete({ guildId: interaction.guildId, name }).catch(() => null);
  if (!result) {
    return interaction.reply({ content: `❌ No template named **${name}** found.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
  }

  await interaction.reply({ content: `✅ Template **${name}** has been deleted from your database.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
}
// ─── Interaction Handler ──────────────────────────────────────────────────────

async function handleInteraction(interaction) {
  const { customId, user, guildId } = interaction;

  if (customId === 'embed_modal_create') {
    const title       = getField(interaction, 'embed_title');
    const description = getField(interaction, 'embed_description');
    const colorRaw    = getField(interaction, 'embed_color');
    const footerText  = getField(interaction, 'embed_footer');
    const authorName  = getField(interaction, 'embed_author');

    const session = getSession(user.id, guildId);
    if (title)       session.title       = title;
    if (description) session.description = description;
    if (colorRaw) {
      const parsed = parseHex(colorRaw);
      if (parsed !== null) session.color = parsed;
    }
    if (footerText)  session.footer  = { ...(session.footer || {}), text: footerText };
    if (authorName)  session.author  = { ...(session.author || {}), name: authorName };
    session._lastActive = Date.now();

    if (!hasSessionContent(session)) {
      return interaction.reply({
        content: '❌ Your embed is empty — fill in at least a title, description, or another field before previewing.',
        flags: [MessageFlags.Ephemeral],
      }).catch(() => null);
    }

    const embed = buildEmbedFromSession(session);
    await interaction.reply({ content: '**Preview:**', embeds: [embed], components: [previewActionRow()], flags: [MessageFlags.Ephemeral] }).catch(() => null);
    return;
  }

  if (customId === 'embed_modal_field_add') {
    const name    = getField(interaction, 'field_name');
    const value   = getField(interaction, 'field_value');
    const inlineRaw = getField(interaction, 'field_inline') || '';
    const inline  = inlineRaw.trim().toLowerCase() === 'yes';

    if (!name || !value) {
      return interaction.reply({ content: '❌ Field name and value are required.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    const session = getSession(user.id, guildId);
    if (!Array.isArray(session.fields)) session.fields = [];

    if (session.fields.length >= 25) {
      return interaction.reply({ content: '❌ Embeds can have at most 25 fields.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    session.fields.push({ name, value, inline });
    session._lastActive = Date.now();

    await interaction.reply({ content: `✅ Field added! Your embed now has **${session.fields.length}** field(s).`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
    return;
  }

  if (customId === 'embed_preview_send') {
    await interaction.showModal(buildSendConfirmModal()).catch(() => null);
    return;
  }

  if (customId === 'embed_modal_send_confirm') {
    const raw = getField(interaction, 'send_channel');
    if (!raw) return interaction.reply({ content: '❌ Channel is required.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    
    const channelId = raw.trim().replace(/[<#>]/g, '');
    const targetChannel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!targetChannel?.isTextBased()) {
      return interaction.reply({ content: '❌ Could not find that channel.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    const session = getSession(user.id, guildId);
    if (!hasSessionContent(session)) {
      return interaction.reply({ content: '❌ Your session is empty.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    const embed = buildEmbedFromSession(session);

    if (session.editMessageId && session.editChannelId) {
      const editChannel = await interaction.client.channels.fetch(session.editChannelId).catch(() => null);
      const editMessage = await editChannel?.messages.fetch(session.editMessageId).catch(() => null);

      if (editMessage) {
        await editMessage.edit({ embeds: [embed] }).catch(() => null);
        delete session.editMessageId;
        delete session.editChannelId;
        await interaction.reply({ content: `✅ Embed layout updated in <#${editChannel.id}>.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
        return;
      }
    }

    await targetChannel.send({ embeds: [embed] }).catch(() => null);
    await interaction.reply({ content: `✅ Embed successfully sent to <#${targetChannel.id}>.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
    return;
  }

  if (customId === 'embed_preview_field') {
    await interaction.showModal(buildFieldAddModal()).catch(() => null);
    return;
  }

  if (customId === 'embed_preview_clear') {
    clearSession(user.id, guildId);
    await interaction.reply({ content: '✅ Session canvas wiped.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    return;
  }
}

// ─── Execute Router ───────────────────────────────────────────────────────────

async function execute(interaction) {
  let group, sub;
  
  if (isPrefixMode(interaction)) {
    const parsed = parsePrefixArgs(interaction);
    const tokens = String(interaction.content || '').trim().split(/\s+/);
    
    if (parsed.sub === 'field') {
      group = 'field';
      sub = tokens[2] ? tokens[2].toLowerCase() : null;
    } else if (parsed.sub === 'template') {
      group = 'template';
      sub = tokens[2] ? tokens[2].toLowerCase() : null;
    } else {
      sub = parsed.sub;
    }
  } else {
    group = interaction.options.getSubcommandGroup(false);
    sub   = interaction.options.getSubcommand();
  }

  if (group === 'field') {
    if (sub === 'add')    return handleFieldAdd(interaction);
    if (sub === 'remove') return handleFieldRemove(interaction);
  }

  if (group === 'template') {
    if (sub === 'save')   return handleTemplateSave(interaction);
    if (sub === 'load')   return handleTemplateLoad(interaction);
    if (sub === 'list')   return handleTemplateList(interaction);
    if (sub === 'delete') return handleTemplateDelete(interaction);
  }

  if (sub === 'create')    return handleCreate(interaction);
  if (sub === 'edit')      return handleEdit(interaction);
  if (sub === 'send')      return handleSend(interaction);
  if (sub === 'image')     return handleImage(interaction);
  if (sub === 'thumbnail') return handleThumbnail(interaction);
  if (sub === 'color')     return handleColor(interaction);
  if (sub === 'footer')    return handleFooter(interaction);
  if (sub === 'author')    return handleAuthor(interaction);
  if (sub === 'preview')   return handlePreview(interaction);
  if (sub === 'clear')     return handleClear(interaction);
}

module.exports = { data, name: 'embed', execute, handleInteraction };
