const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roll')
    .setDescription('Roll a random number or a multi-sided die.')
    .addIntegerOption(option => 
      option.setName('sides')
        .setDescription('Number of sides on the die (Default: 6)')
        .setRequired(false)
    ),
  name: 'roll',

  async execute(interaction) {
    // 1. Unified database architecture lookup
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[interaction.guildId] || {};

    // Standard structural safety framework filter matching boolean configurations
    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return interaction.reply({ 
        content: '❌ The Fun Module is currently disabled on this server!', 
        flags: [MessageFlags.Ephemeral] 
      }).catch(() => null);
    }

    const sides = interaction.options.getInteger('sides') || 6;

    if (sides < 2) {
      return interaction.reply({ 
        content: '❌ A die must have at least 2 sides!', 
        flags: [MessageFlags.Ephemeral] 
      }).catch(() => null);
    }

    // 2. Perform randomization calculation
    const result = Math.floor(Math.random() * sides) + 1;

    // 3. Dynamic Font Style Layout Extraction
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    // 4. Construct high-quality embed response
    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#9B59B6')
      .setTitle(isCuteActive ? '✨ 🎲 DICE ROLL STATE ✨' : '🎲 Dice Roll')
      .setDescription(`You rolled a **${sides}-sided** die and got a **${result}**!`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] }).catch(() => null);
  },

  async executePrefix(message, argsArray, client) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[message.guild?.id] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
    }

    // Parse the sides integer from prefix argument arrays safely
    let parsedSides = 6;
    if (argsArray && argsArray[0]) {
      const parsedInt = parseInt(argsArray[0]);
      if (!isNaN(parsedInt)) {
        parsedSides = parsedInt;
      }
    }

    if (parsedSides < 2) {
      return message.reply('❌ A die must have at least 2 sides!').catch(() => null);
    }

    // Pass downstream structural keys accurately to prevent profile drops
    const mockContextInteraction = {
      guild: message.guild,
      guildId: message.guild.id,
      user: message.author,
      member: message.member,
      options: {
        getInteger: (name) => parsedSides
      },
      reply: async (options) => message.reply(options)
    };

    const targetCommand = client.commands.get('roll');
    if (targetCommand) {
      await targetCommand.execute(mockContextInteraction).catch(err => console.error('Error in roll prefix route execution:', err));
    }
  }
};
