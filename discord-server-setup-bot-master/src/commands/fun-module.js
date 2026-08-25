const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../utils/database'); // Restored your dynamic adapter tracking

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fun-module')
    .setDescription('Enable or disable the fun commands module.')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('Choose to enable or disable fun commands')
        .setRequired(true)
        .addChoices(
          { name: 'enable', value: 'on' },
          { name: 'disable', value: 'off' }
        ))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  name: 'fun-module',

  async execute(interaction) {
    const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : false;

    if (isInteraction) {
      await interaction.deferReply().catch(() => null);
    }

    const guild = interaction.guild;
    const guildId = interaction.guildId || guild?.id;
    if (!guildId) return;

    const member = interaction.member;
    if (!member.permissions.has(PermissionFlagsBits.Administrator) && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      const msg = '❌ You require Manager or Administrator permissions to toggle modules.';
      return isInteraction 
        ? interaction.editReply({ content: msg }) 
        : interaction.reply({ content: msg, flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    const rawChoice = typeof interaction.options.getString === 'function' 
      ? interaction.options.getString('status') 
      : interaction.options.getString;
      
    if (!rawChoice) return;

    const choice = (rawChoice === 'enable' || rawChoice === 'on') ? 'on' : 'off';
    const isEnabled = (choice === 'on');
    
    // Read and save settings using your specific custom dynamic JSON-to-Mongo map
    const settings = (await db.readData('settings.json')) || {};
    if (!settings[guildId]) settings[guildId] = {};
    
    settings[guildId].funModule = isEnabled ? 'on' : 'off'; 
    await db.writeData('settings.json', settings);

    const embed = new EmbedBuilder()
      .setColor(isEnabled ? '#00FF00' : '#FF0000')
      .setTitle('🎛️ Module Configuration Saved')
      .setDescription(`The **Fun Module** features have been flipped **${isEnabled ? 'ENABLED' : 'DISABLED'}** server-wide.`);

    return isInteraction ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] }).catch(() => null);
  },

  
};
