'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { createCase } = require('../utils/moderationCases');

module.exports = {
  name: 'softban',
  data: new SlashCommandBuilder()
    .setName('softban')
    .setDescription('Ban a member, remove recent messages, then immediately unban them')
    .addUserOption(opt => opt.setName('user').setDescription('User to softban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the softban').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true }).catch(() => null);
    if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.editReply('You need Ban Members permission.');
    const user = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (member && !member.bannable) return interaction.editReply('I cannot softban this member because of role hierarchy.');

    try {
      await interaction.guild.members.ban(user.id, { deleteMessageSeconds: 604800, reason });
      await interaction.guild.bans.remove(user.id, 'Softban completed').catch(() => null);
      const record = await createCase({ guildId: interaction.guildId, action: 'softban', target: user, moderator: interaction.user, reason }).catch(() => null);
      const embed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('Softban completed')
        .setDescription(`${user.username} was softbanned and can rejoin.\nReason: ${reason}\nCase: **#${record?.caseNumber || 'untracked'}**`);
      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      return interaction.editReply(`Softban failed: ${error.message}`);
    }
  },
};
