const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

// Expanded pool featuring 10 unique, highly detailed compatibility tiers
const LOVE_COMMENTS = [
  "💔 Absolute Zero. A complete mismatch. Avoid at all costs!",
  "🥀 Oof. The spark went out before it even caught fire. Cold vibes.",
  "📉 Just friends territory. Keeping it platonic is definitely your best bet.",
  "😐 Mixed signals. There is a tiny spark here, but it needs a mountain of work.",
  "🎟️ Fairly decent potential. You two could get along if the weather is nice.",
  "✨ Promising vibes! The universe might definitely be cooking something up.",
  "🌟 High compatibility! Genuine chemistry detected. Go check them out!",
  "🔥 Scorching hot! The attraction levels here are absolutely off the charts.",
  "💖 A match made in heaven! Truly beautiful cosmic compatibility!",
  "👑 Absolute soulmates! The perfect union has been officially declared! 🎉"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('predict-love')
    .setDescription('Calculate the ultimate romantic compatibility percentage.')
    .addStringOption(opt => opt.setName('first').setDescription('First item/person').setRequired(true))
    .addStringOption(opt => opt.setName('second').setDescription('Second item/person').setRequired(true)),
  name: 'predict-love',

  async execute(interaction) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[interaction.guildId] || {};

    // Standard structural safety framework filter matching boolean configurations
    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return interaction.reply({ 
        content: '❌ The Fun Module is currently disabled on this server!', 
        flags: [MessageFlags.Ephemeral] 
      }).catch(() => null);
    }
    
    const a = interaction.options.getString('first');
    const b = interaction.options.getString('second');
    
    if (!a || !b) {
      return interaction.reply({ content: '❌ You must specify two items or users to match!', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    const percentage = Math.floor(Math.random() * 101);

    // Highly refined 10-tier selection mathematics index mapping
    let commentIndex = 0;
    if (percentage > 10) commentIndex = 1;
    if (percentage > 25) commentIndex = 2;
    if (percentage > 40) commentIndex = 3;
    if (percentage > 55) commentIndex = 4;
    if (percentage > 70) commentIndex = 5;
    if (percentage > 80) commentIndex = 6;
    if (percentage > 88) commentIndex = 7;
    if (percentage > 95) commentIndex = 8;
    if (percentage === 100) commentIndex = 9;
    
    const comment = LOVE_COMMENTS[commentIndex];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#E91E63')
      .setTitle(isCuteActive ? '✨ ❤️ LOVE MATCH CALCULATOR ✨' : '❤️ Love Match Predictor')
      .setDescription(`💘 Compatibility match rating between **${a}** and **${b}** is **${percentage}%**!\n\n${comment}`)
      .setFooter({ text: 'Results are final and written in the stars.' });
      
    await interaction.reply({ embeds: [embed] }).catch(() => null);
  },

  async executePrefix(message, argsArray, client) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[message.guild?.id] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
    }

    // Custom multi-argument string parser for prefix calls splitting at a clear separator or comma
    // Example: |predict-love PersonA, PersonB or |predict-love PersonA PersonB
    const fullInput = argsArray ? argsArray.join(' ') : '';
    let itemA = '';
    let itemB = '';

    if (fullInput.includes(',')) {
      const parts = fullInput.split(',');
      itemA = parts[0].trim();
      itemB = parts.slice(1).join(',').trim();
    } else {
      const parts = fullInput.split(/ +/);
      itemA = parts[0] || '';
      itemB = parts.slice(1).join(' ').trim();
    }

    if (!itemA || !itemB) {
      return message.reply('❌ Usage: `|predict-love <FirstItem>, <SecondItem>` or `|predict-love <FirstItem> <SecondItem>`').catch(() => null);
    }

    // Construct the context wrapper compatibility variables
    const mockContextInteraction = {
      guild: message.guild,
      guildId: message.guild.id,
      user: message.author,
      member: message.member,
      options: {
        getString: (name) => (name === 'first' ? itemA : itemB)
      },
      reply: async (options) => message.reply(options)
    };

    const targetCommand = client.commands.get('predict-love');
    if (targetCommand) {
      await targetCommand.execute(mockContextInteraction).catch(err => console.error('Error in predict-love prefix route execution:', err));
    }
  }
};
