const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const database = require('../utils/database'); // Points to your MongoDB client model

module.exports = {
  name: 'mod-logs-toggle',
  description: 'Log all moderator actions into one channel.',
  data: new SlashCommandBuilder()
    .setName('mod-logs-toggle')
    .setDescription('Log all moderator actions into one channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(opt => 
      opt.setName('status')
        .setDescription('Toggle logging status')
        .setRequired(true)
        .addChoices(
          { name: 'On', value: 'on' },
          { name: 'Off', value: 'off' }
        )
    )
    .addChannelOption(opt => 
      opt.setName('channel')
        .setDescription('The targeted channel where logs are sent')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const guild = interaction.guild;
    if (!guild) return;
    const guildId = guild.id;
    const memberExecutor = interaction.member;

    if (memberExecutor && !memberExecutor.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ **Permissions Required!** You need `Manage Server` to run this configuration.', ephemeral: true }).catch(() => null);
    }

    if (typeof interaction.deferReply === 'function') {
      await interaction.deferReply({ ephemeral: true }).catch(() => null);
    }

    // 📡 DYNAMIC ADAPTER PARAMETER RESOLUTION
    let status = null;
    let channel = null;

    if (interaction.options && typeof interaction.options.getChannel === 'function') {
      // PROCESSED VIA NATIVE APPLICATION SLASH OPTIONS
      status = interaction.options.getString('status');
      channel = interaction.options.getChannel('channel');
    } else {
      // PROCESSED VIA PREFIX MOCK EMULATOR ADAPTER FLOWS
      const rawTextArgs = interaction.options?.getString('status') || '';
      const parsedArray = rawTextArgs.split(/ +/);
      status = parsedArray[0] ? parsedArray[0].toLowerCase() : null;
      channel = guild.channels.cache.get(parsedArray[1]?.replace(/[^0-9]/g, '')) || interaction.channel || null;
    }

    if (status !== 'on' && status !== 'off') {
      const usageNotice = '❌ **Invalid syntax:** Use `|mod-logs-toggle <on|off> [#channel]`';
      return interaction.deferred || interaction.replied ? interaction.editReply({ content: usageNotice }) : interaction.reply({ content: usageNotice, ephemeral: true });
    }

    const guildConfig = await database.findOne({ guildId: guildId }).catch(() => null) || {};
    const modLogsEnabled = (status === 'on');
    let unifiedLogChannelId = guildConfig.unifiedLogChannelId || null;

    if (channel) {
      unifiedLogChannelId = channel.id;
    } else if (status === 'on' && !unifiedLogChannelId) {
      const firstTimeError = '❌ Please specify or mention a text channel when turning logging options ON for the first time.';
      return interaction.deferred || interaction.replied ? interaction.editReply({ content: firstTimeError }) : interaction.reply({ content: firstTimeError, ephemeral: true });
    }

    await database.findOneAndUpdate(
      { guildId: guildId },
      { $set: { modLogsEnabled: modLogsEnabled, unifiedLogChannelId: unifiedLogChannelId } },
      { upsert: true }
    ).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Unified Mod Logging Configuration')
      .setColor(status === 'on' ? '#00FF00' : '#FF0000')
      .setDescription(`Unified moderator action logging has been set to: **${status.toUpperCase()}**\nTarget Logs Channel: ${unifiedLogChannelId ? `<#${unifiedLogChannelId}>` : '`None` Layout'}`);

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ content: null, embeds: [embed] });
    }
    return interaction.reply({ embeds: [embed] });
  }
};
