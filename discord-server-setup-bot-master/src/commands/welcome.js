const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { readData, writeData } = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure or toggle the welcome/leave system')
    .addChannelOption(option => option.setName('channel').setDescription('The welcome/leave channel').setRequired(true))
    .addBooleanOption(option => option.setName('enabled').setDescription('Enable or disable welcome/leave messages').setRequired(true))
    .addStringOption(option => option.setName('join_message').setDescription('Custom join message. Variables: {user} {server} {memberCount}').setRequired(false))
    .addStringOption(option => option.setName('leave_message').setDescription('Custom leave message. Variables: {user} {server} {memberCount}').setRequired(false))
    .addBooleanOption(option => option.setName('embed').setDescription('Send messages as embeds? (default: true)').setRequired(false))
    .addBooleanOption(option => option.setName('image').setDescription('Send the custom chud welcome image instead of an embed').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  name: 'welcome',

  async execute(interaction, client) {
    const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : false;
    const guildId = interaction.guildId;
    const memberExecutor = interaction.member;

    if (!memberExecutor.permissions.has(PermissionFlagsBits.ManageGuild)) {
      const msg = '❌ You need Manage Server permissions!';
      return isInteraction ? interaction.reply({ content: msg, ephemeral: true }) : interaction.reply(msg);
    }

    try {
      const targetChannel = interaction.options.getChannel('channel');
      const isEnabled = interaction.options.getBoolean('enabled');
      const joinMessage = interaction.options.getString('join_message') || null;
      const leaveMessage = interaction.options.getString('leave_message') || null;
      let useEmbed = interaction.options.getBoolean('embed');
      if (useEmbed === null) useEmbed = true;
      const useImage = interaction.options.getBoolean('image') || false;

      if (!targetChannel || isEnabled === null) {
        const msg = '❌ Invalid Syntax! Use: `|welcome <#channel> <true/false> [join message] [leave message]`\n**Variables:** `{user}` `{server}` `{memberCount}`';
        return interaction.reply({ content: msg, ephemeral: true }).catch(() => null);
      }

      // ========================================================
      // Persist via the same settings.json-backed store that
      // guildMemberAdd.js / guildMemberRemove.js actually read from.
      // (database.js has no findOneAndUpdate — readData/writeData
      // is the real, working API.)
      // ========================================================
      const settings = (await readData('settings.json')) || {};
      const existing = settings[guildId] || {};

      const updated = {
        ...existing,
        welcomeChannelId: targetChannel.id,
        welcomeEnabled: isEnabled,
        welcomeEmbed: useEmbed,
        welcomeImage: useImage,
      };

      // Only overwrite messages when the user actually supplied one,
      // otherwise keep whatever custom message was set previously.
      if (joinMessage) updated.joinMessage = joinMessage;
      if (leaveMessage) updated.leaveMessage = leaveMessage;

      settings[guildId] = updated;
      await writeData('settings.json', settings);

      const savedJoin = updated.joinMessage || 'Default: ✨ Welcome to {server}, {user}! We are glad to have you here. ✨';
      const savedLeave = updated.leaveMessage || 'Default: 👋 Goodbye {user}... We will miss you!';

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ Welcome Config Updated')
        .setDescription(
          `**Channel:** ${targetChannel}\n` +
          `**System Enabled:** \`${isEnabled}\`\n` +
          `**Use Embed:** \`${useEmbed}\`\n` +
          `**Use Image:** \`${useImage}\`\n\n` +
          `**Join Message:**\n\`${savedJoin}\`\n\n` +
          `**Leave Message:**\n\`${savedLeave}\`\n\n` +
          `**Available Variables:**\n\`{user}\` — mentions the member\n\`{server}\` — server name\n\`{memberCount}\` — current member count`
        );

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      const msg = `❌ Error: ${error.message}`;
      return interaction.reply({ content: msg, ephemeral: true }).catch(() => null);
    }
  },

  
};