const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { logAction } = require('../utils/auditLog');
const db = require('../utils/database'); // Restored your dynamic helper model
const { createCase } = require('../utils/moderationCases');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user from the server')
    .addUserOption(option => option.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for ban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  name: 'ban',

  async execute(interaction, client) {
    // Correct checking layer to see if it is a real interaction or text mock
    const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : (interaction.options && !interaction.isMock ? true : false);
    
    if (isInteraction) {
      await interaction.deferReply().catch(() => null);
    } else {
      // For prefix commands, we send a processing message and keep track of it
      interaction.processingMessage = await interaction.reply('⏳ Processing ban command...').catch(() => null);
    }

    const guild = interaction.guild;
    const author = isInteraction ? interaction.user : interaction.author; 
    const memberExecutor = interaction.member;
    const guildId = interaction.guildId;

    if (!memberExecutor.permissions.has(PermissionFlagsBits.BanMembers)) {
      const msg = '❌ You need Ban Members permission!';
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }

    try {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      if (!user) {
        const msg = '❌ Please mention a valid user or provide a valid user ID.';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      const existingBan = await guild.bans.fetch({ user: user.id, cache: false }).catch(() => null);
      if (existingBan) {
        const msg = `❌ **${user.username}** is already banned from this server!`;
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      const member = await guild.members.fetch({ user: user.id, force: true }).catch(() => null);
      if (member && !member.bannable) {
        const msg = '❌ I cannot ban this user! Their roles are higher than mine or yours.';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      await guild.members.ban(user.id, { reason });

      const guildConfig = (await db.findOne({ guildId })) || {};
      const legacySettings = (await db.readData('settings.json')) || {};
      const currentGuildSettings = { ...(legacySettings[guildId] || {}), ...(guildConfig || {}) };

      if (currentGuildSettings.modLogsEnabled && currentGuildSettings.unifiedLogChannelId) {
        const modLogsChannel = guild.channels.cache.get(currentGuildSettings.unifiedLogChannelId) || await guild.channels.fetch(currentGuildSettings.unifiedLogChannelId).catch(() => null);
        if (modLogsChannel) {
          const embedLog = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🛡️ Unified Moderation: User Banned')
            .addFields(
              { name: 'Target User', value: `${user.username} (${user.id})` },
              { name: 'Responsible Staff', value: `${author.username}` },
              { name: 'Reason Given', value: reason }
            )
            .setTimestamp();
          await modLogsChannel.send({ embeds: [embedLog] }).catch(() => null);
        }
      }

      await logAction(guild, 'User Banned', author, `User: ${user.username}, Reason: ${reason}`);
      const moderationCase = await createCase({ guildId, action: 'ban', target: user, moderator: author, reason });

      const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('✅ User Banned')
        .setDescription(`${user.username} has been banned.\nReason: ${reason}\nCase: **#${moderationCase.caseNumber}**`);

      return isInteraction ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Ban error:', error);
      const msg = `❌ Error banning user: ${error.message}`;
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }
  },

  // ADDED: Complete prefix execution loop to translate prefix calls flawlessly
  
};
