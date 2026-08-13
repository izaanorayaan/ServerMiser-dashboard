const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

// Expanded pool featuring 30 unique fortune predictions
const FORTUNES = [
  "An exciting adventure awaits you right around the corner.",
  "Your hard work will pay off sooner than you expect.",
  "A brilliant idea will clear your path forward very soon.",
  "Do not mistake temptation for opportunity.",
  "Someone close to you is holding a wonderful surprise.",
  "Your courage will lead you to great places this week.",
  "A golden opportunity will present itself when you least expect it.",
  "Be on the lookout for a message that will change your mood entirely.",
  "Trust your instincts; they are leading you in the right direction.",
  "You will soon conquer a minor obstacle that has been bothering you.",
  "A pleasant surprise is in store for you tonight.",
  "Your creative talents will bring you recognition very shortly.",
  "A long-awaited conversation will bring you unexpected closure.",
  "An old friendship will reignite with newfound positive energy.",
  "Focus on your passion projects today; inspiration is at an all-time high.",
  "Your financial outlook is about to take a sharp turn for the better.",
  "Someone is looking up to you right now, even if you don't realize it.",
  "An unexpected gift will find its way to you in the coming days.",
  "Rest up; you will need your energy for an incredible opportunity soon.",
  "The answers you are looking for will arrive from an unlikely source.",
  "A small risk you take this week will result in a massive long-term reward.",
  "Your kindness toward a stranger today will return to you tenfold.",
  "An obstacle you currently face is actually a blessing in disguise.",
  "Clear out old clutter; you need space for the new blessings arriving soon.",
  "Your path is unique; stop comparing your timeline to those around you.",
  "An analytical approach to your current problem will reveal a simple fix.",
  "Do not let temporary clouds hide the permanent sunshine in your life.",
  "A journey of a thousand miles begins with a single confident step today.",
  "The perfect moment to start doesn't exist. Take action right now.",
  "A smile from you will be the absolute highlight of someone's day tomorrow."
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fortune')
    .setDescription('Reveals a prediction about your future.'),
  name: 'fortune',

  async execute(interaction) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[interaction.guildId] || {};

    // Standard structural safety framework filter matching boolean conversions
    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return interaction.reply({ 
        content: '❌ The Fun Module is currently disabled on this server!', 
        flags: [MessageFlags.Ephemeral] 
      }).catch(() => null);
    }
    
    const prediction = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#A020F0')
      .setTitle(isCuteActive ? '✨ 🔮 YOUR FORTUNE ✨' : '🔮 Your Fortune')
      .setDescription(`💬 *"${prediction}"*`)
      .setFooter({ text: 'The crystal ball has spoken.' });
      
    await interaction.reply({ embeds: [embed] }).catch(() => null);
  },

  async executePrefix(message, args, client) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[message.guild?.id] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
    }

    const prediction = FORTUNES[Math.floor(Math.random() * FORTUNES.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[message.guild?.id] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#A020F0')
      .setTitle(isCuteActive ? '✨ 🔮 YOUR FORTUNE ✨' : '🔮 Your Fortune')
      .setDescription(`💬 *"${prediction}"*`)
      .setFooter({ text: 'The crystal ball has spoken.' });
      
    await message.reply({ embeds: [embed] }).catch(() => null);
  }
};
