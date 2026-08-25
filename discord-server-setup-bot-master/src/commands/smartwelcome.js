'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, StringSelectMenuBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: true },
  channelId: { type: String, required: true },
  prompt: { type: String, default: 'Choose an interest so we can personalize your welcome.' },
  roles: [{ id: String, label: String }],
});
const SmartWelcome = mongoose.models.SmartWelcome || mongoose.model('SmartWelcome', schema);

function canManage(interaction) {
  return interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild)
    || interaction.member?.permissions.has(PermissionFlagsBits.Administrator);
}

module.exports = {
  name: 'smartwelcome',
  data: new SlashCommandBuilder()
    .setName('smartwelcome')
    .setDescription('Configure personalized welcomes and interest roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Configure smart welcome profiles')
      .addChannelOption(opt => opt.setName('channel').setDescription('Welcome channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addRoleOption(opt => opt.setName('interest-one').setDescription('First interest role').setRequired(true))
      .addRoleOption(opt => opt.setName('interest-two').setDescription('Second interest role').setRequired(false))
      .addRoleOption(opt => opt.setName('interest-three').setDescription('Third interest role').setRequired(false))
      .addStringOption(opt => opt.setName('prompt').setDescription('Question shown to new members').setMaxLength(200).setRequired(false)))
    .addSubcommand(sub => sub.setName('disable').setDescription('Disable smart welcome profiles')),

  async execute(interaction) {
    if (!canManage(interaction)) return interaction.reply({ content: 'You need Manage Server or Administrator permission.', ephemeral: true });
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'disable') {
      await SmartWelcome.findOneAndUpdate({ guildId: interaction.guildId }, { enabled: false });
      return interaction.reply({ content: 'Smart welcome profiles disabled.', ephemeral: true });
    }
    const roles = ['interest-one', 'interest-two', 'interest-three']
      .map(name => interaction.options.getRole(name))
      .filter(Boolean)
      .map(role => ({ id: role.id, label: role.name.slice(0, 100) }));
    await SmartWelcome.findOneAndUpdate(
      { guildId: interaction.guildId },
      { enabled: true, channelId: interaction.options.getChannel('channel').id, prompt: interaction.options.getString('prompt') || undefined, roles },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return interaction.reply({ content: `Smart welcomes enabled with ${roles.length} interest role${roles.length === 1 ? '' : 's'}.`, ephemeral: true });
  },

  async handleInteraction(interaction) {
    if (!interaction.isStringSelectMenu() || interaction.customId !== 'smartwelcome_interest') return;
    const [guildId, roleId] = interaction.values[0].split(':');
    const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return interaction.reply({ content: 'This welcome selector is no longer valid.', ephemeral: true });
    const config = await SmartWelcome.findOne({ guildId, enabled: true });
    const role = guild.roles.cache.get(roleId) || await guild.roles.fetch(roleId).catch(() => null);
    if (!config || !role) return interaction.reply({ content: 'This welcome profile is no longer available.', ephemeral: true });
    const member = await guild.members.fetch(interaction.user.id).catch(() => null);
    if (member?.manageable) await member.roles.add(role, 'Smart welcome interest selection').catch(() => null);
    return interaction.update({ content: `Welcome to **${guild.name}**. You selected **${role.name}**.`, embeds: [], components: [] });
  },

  async handleMemberJoin(member) {
    const config = await SmartWelcome.findOne({ guildId: member.guild.id, enabled: true });
    if (!config) return;
    const options = config.roles.map(role => ({ label: role.label, value: `${member.guild.id}:${role.id}` }));
    if (options.length) {
      await member.send({
        embeds: [new EmbedBuilder().setTitle(`Welcome to ${member.guild.name}`).setDescription(config.prompt).setColor('#57F287')],
        components: [new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('smartwelcome_interest').setPlaceholder('Choose an interest').addOptions(options))],
      }).catch(() => null);
    }
    const channel = member.guild.channels.cache.get(config.channelId);
    if (channel) await channel.send(`Welcome ${member}! Tell us what you are interested in by checking your welcome message.`).catch(() => null);
  },
};
