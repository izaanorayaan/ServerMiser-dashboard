const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database'); 
const formatter = require('../utils/textFormatter.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fun-menu')
    .setDescription('Explore what the Fun Module offers in a clean single-column directory.'),
  name: 'fun-menu',

  async execute(interaction) {
    const guildId = interaction.guildId || interaction.guild?.id;
    if (!guildId) return;

    // 1. Framework switch verification gate checks
    const mainSettings = db.readData('settings.json') || {};
    const currentGuildSettings = mainSettings[guildId] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      const errorPayload = { 
        content: '🔒 The **Fun Module** features have been globally disabled by an administrator.', 
        flags: [MessageFlags.Ephemeral] 
      };
      // Strips bitwise flags safely if accessed via prefix emulator bypass arrays
      if (interaction.flagsToStrip) delete errorPayload.flags;
      return interaction.reply(errorPayload).catch(() => null);
    }

    // 2. Dynamic Layout Extraction
    let cuteStyle = 'off';
    try {
      const cuteData = db.readData('cute.json') || {};
      cuteStyle = cuteData[guildId] || 'off';
    } catch (e) {
      console.error("Error reading cute data in fun-menu:", e);
    }

    const titleText = formatter.formatCute('Fun Module Menu', cuteStyle, '✨');
    const embedColor = cuteStyle !== 'off' ? '#FF69B4' : '#00FF00';

    // 3. Construct clean single-column directory menu embed layout
    const embed = new EmbedBuilder()
      .setColor(embedColor)
      .setTitle(titleText)
      .setDescription(
        'Welcome to the **Fun & Entertainment Hub**!\n' +
        'All tools support both modern Slash Commands (`/`) and classic Prefix Commands (`|`).\n\n' +
        '📌 **Available Commands Directory**\n' +
        '• 🎲 `dice-duel` ➡️ Challenge members to a live button duel.\n' +
        '• 📝 `trivia` ➡️ Test your wits with general knowledge tasks.\n' +
        '• 🗺️ `capital-quiz` ➡️ Show off your geography memory skills.\n' +
        '• 🤔 `wouldyourather` ➡️ Choose between tough scenario pairs.\n' +
        '• 🎭 `joke` ➡️ Grab a quick developer-focused chuckle.\n' +
        '• 👨 `dadjoke` ➡️ Get a classic, groans-guaranteed dad joke.\n' +
        '• 🔮 `fortune` ➡️ Peer into the crystal ball at your future.\n' +
        '• 🌌 `spacefact` ➡️ Learn an amazing cosmic trivia truth.\n' +
        '• 🐱 `cat` ➡️ Spits out a random cat picture and feline fact.\n' +
        '• 🐶 `dog` ➡️ Spits out a random dog picture and canine fact.\n' +
        '• 🍦 `flavor` ➡️ Discover your current ice cream flavor personality.\n' +
        '• 💖 `predict-love` ➡️ Calculate compatibility metrics with users.\n' +
        '• 💥 `slap` / `hug` ➡️ Targeted interaction handler macros.'
      )
      .setFooter({ text: `Style Profile: ${cuteStyle.toUpperCase()}` });

    await interaction.reply({ embeds: [embed] }).catch(() => null);
  },

  async executePrefix(message, args, client) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[message.guild?.id] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
    }

    // Pass downstream structural keys accurately to prevent profile drops
    const mockInteraction = {
      guild: message.guild,
      guildId: message.guild.id,
      flagsToStrip: true, // Tells response layer to prevent bitwise flag object validation crashes
      reply: async (options) => message.reply(options)
    };
    
    await this.execute(mockInteraction).catch(err => console.error('Error handling inline fun-menu prefix logic:', err));
  }
};
