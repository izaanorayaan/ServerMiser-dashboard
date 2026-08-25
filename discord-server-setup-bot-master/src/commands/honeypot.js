'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const mongoose = require('mongoose');

const honeypotSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  action: { type: String, enum: ['ban', 'kick', 'softban', 'mute', 'delete_message'], default: 'ban' },
  deleteMessages: { type: Boolean, default: true },
  messageType: { type: String, enum: ['plain', 'embed'], default: 'plain' },
  message: { type: String, required: true, minlength: 15, maxlength: 2000 },
  embedTitle: { type: String, default: null, maxlength: 256 },
  embedColor: { type: String, default: '#ED4245' },
  embedFooter: { type: String, default: null, maxlength: 2048 },
  setupUserId: { type: String, required: true },
}, { timestamps: true });

const Honeypot = mongoose.models.Honeypot || mongoose.model('Honeypot', honeypotSchema);
const setupSessions = new Map();

function sessionKey(interaction) {
  return `${interaction.guildId}:${interaction.user.id}`;
}

function canManage(interaction) {
  return interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild)
    || interaction.member?.permissions.has(PermissionFlagsBits.Administrator);
}

function buildMessageTypeRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('honeypot_message_type')
      .setPlaceholder('Choose the warning format...')
      .addOptions([
        { label: 'Plain text', value: 'plain', description: 'Send a normal text warning before the ban.' },
        { label: 'Embed wizard', value: 'embed', description: 'Configure title, color, footer, and body.' },
      ])
  );
}

function buildActionRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('honeypot_action')
      .setPlaceholder('Choose the action...')
      .addOptions([
        { label: 'Ban', value: 'ban', description: 'Ban the member from the server.' },
        { label: 'Kick', value: 'kick', description: 'Kick the member from the server.' },
        { label: 'Softban', value: 'softban', description: 'Ban, delete recent messages, then unban.' },
        { label: 'Mute', value: 'mute', description: 'Timeout the member for 28 days.' },
        { label: 'Delete message', value: 'delete_message', description: 'Delete the triggering message without member action.' },
      ])
  );
}

function buildDeleteMessagesRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('honeypot_delete_messages')
      .setPlaceholder('Delete the member\'s recent messages?')
      .addOptions([
        { label: 'Yes, delete recent messages', value: 'true', description: 'Delete up to seven days of messages when banning.' },
        { label: 'No, keep recent messages', value: 'false', description: 'Do not request message deletion during the ban.' },
      ])
  );
}

module.exports = {
  name: 'honeypot',
  data: new SlashCommandBuilder()
    .setName('honeypot')
    .setDescription('Ban members who send messages in a trap channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub.setName('setup').setDescription('Configure the honeypot trap channel and warning message.'))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable the configured honeypot.'))
    .addSubcommand(sub => sub.setName('delete').setDescription('Delete the configured honeypot.')),

  async execute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    if (!canManage(interaction)) return interaction.reply({ content: 'You need Manage Server or Administrator permission.', ephemeral: true });

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'disable' || subcommand === 'delete') {
      const result = subcommand === 'disable'
        ? await Honeypot.findOneAndUpdate({ guildId: interaction.guildId }, { enabled: false })
        : await Honeypot.deleteOne({ guildId: interaction.guildId });
      if (!result || (subcommand === 'delete' && result.deletedCount === 0)) {
        return interaction.reply({ content: 'No honeypot is configured for this server.', ephemeral: true });
      }
      return interaction.reply({ content: `Honeypot ${subcommand === 'disable' ? 'disabled' : 'deleted'}.`, ephemeral: true });
    }

    const existing = await Honeypot.findOne({ guildId: interaction.guildId });
    setupSessions.set(sessionKey(interaction), { channelId: existing?.channelId || null });
    const channelRow = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('honeypot_channel')
        .setPlaceholder('Choose the honeypot channel...')
        .setChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1)
    );
    return interaction.reply({
      embeds: [new EmbedBuilder().setTitle('Honeypot Setup: Trap Channel').setColor('#F1C40F').setDescription('Choose a channel where any non-staff message will trigger an immediate ban.')],
      components: [channelRow],
      ephemeral: true,
    });
  },

  async handleInteraction(interaction) {
    if (!interaction.guild || !canManage(interaction)) return interaction.reply({ content: 'You do not have permission to configure the honeypot.', ephemeral: true }).catch(() => null);
    const key = sessionKey(interaction);
    const session = setupSessions.get(key);
    if (!session) return interaction.reply({ content: 'This honeypot setup expired. Run `/honeypot setup` again.', ephemeral: true }).catch(() => null);

    if (interaction.customId === 'honeypot_channel' && interaction.isChannelSelectMenu()) {
      session.channelId = interaction.values[0];
      setupSessions.set(key, session);
      return interaction.update({
        embeds: [new EmbedBuilder().setTitle('Honeypot Setup: Action').setColor('#F1C40F').setDescription(`Trap channel: <#${session.channelId}>\n\nChoose what happens when a non-staff member sends a message.`)],
        components: [buildActionRow()],
      });
    }

    if (interaction.customId === 'honeypot_action' && interaction.isStringSelectMenu()) {
      session.action = interaction.values[0];
      setupSessions.set(key, session);
      return interaction.update({
        embeds: [new EmbedBuilder().setTitle('Honeypot Setup: Delete Messages').setColor('#F1C40F').setDescription('For ban and softban, choose whether Discord should delete the member\'s recent messages. The triggering message is always deleted.')],
        components: [buildDeleteMessagesRow()],
      });
    }

    if (interaction.customId === 'honeypot_delete_messages' && interaction.isStringSelectMenu()) {
      session.deleteMessages = interaction.values[0] === 'true';
      setupSessions.set(key, session);
      return interaction.update({
        embeds: [new EmbedBuilder().setTitle('Honeypot Setup: Warning Message').setColor('#F1C40F').setDescription('Choose the warning format sent immediately before the action.')],
        components: [buildMessageTypeRow()],
      });
    }

    if (interaction.customId === 'honeypot_message_type' && interaction.isStringSelectMenu()) {
      const messageType = interaction.values[0];
      const modal = new ModalBuilder()
        .setCustomId(`honeypot_message_${messageType}`)
        .setTitle(messageType === 'embed' ? 'Configure Honeypot Embed' : 'Configure Honeypot Message');
      const body = new TextInputBuilder()
        .setCustomId('body')
        .setLabel('Body (required, minimum 15 characters)')
        .setStyle(TextInputStyle.Paragraph)
        .setMinLength(15)
        .setMaxLength(2000)
        .setRequired(true);
      const inputs = [new ActionRowBuilder().addComponents(body)];
      if (messageType === 'embed') {
        inputs.push(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('title').setLabel('Title (optional)').setStyle(TextInputStyle.Short).setMaxLength(256).setRequired(false)));
        inputs.push(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('color').setLabel('Color hex (optional)').setPlaceholder('#ED4245').setStyle(TextInputStyle.Short).setMaxLength(7).setRequired(false)));
        inputs.push(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('footer').setLabel('Footer (optional)').setStyle(TextInputStyle.Short).setMaxLength(2048).setRequired(false)));
      }
      return interaction.showModal(modal.addComponents(inputs));
    }

    if (interaction.isModalSubmit() && ['honeypot_message_plain', 'honeypot_message_embed'].includes(interaction.customId)) {
      const body = interaction.fields.getTextInputValue('body').trim();
      if (body.length < 15) return interaction.reply({ content: 'The message body must be at least 15 characters long.', ephemeral: true });
      if (!session.channelId) return interaction.reply({ content: 'Choose a honeypot channel first.', ephemeral: true });
      const messageType = interaction.customId.endsWith('_embed') ? 'embed' : 'plain';
      const color = interaction.fields.getTextInputValue('color')?.trim() || '#ED4245';
      const document = await Honeypot.findOneAndUpdate(
        { guildId: interaction.guildId },
        {
          channelId: session.channelId,
          enabled: true,
          action: session.action || 'ban',
          deleteMessages: session.deleteMessages !== false,
          messageType,
          message: body,
          embedTitle: messageType === 'embed' ? interaction.fields.getTextInputValue('title')?.trim() || null : null,
          embedColor: /^#[0-9a-f]{6}$/i.test(color) ? color : '#ED4245',
          embedFooter: messageType === 'embed' ? interaction.fields.getTextInputValue('footer')?.trim() || null : null,
          setupUserId: interaction.user.id,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      setupSessions.delete(key);
      return interaction.reply({ content: `Honeypot enabled in <#${document.channelId}>. Messages from non-staff members will be deleted and the author banned.`, ephemeral: true });
    }
  },
};
