const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

// Expanded pool featuring 20 distinct general knowledge trivia questions
const TRIVIA_POOL = [
  { q: "What is the only continent that lies in all four hemispheres?", a: "Africa" },
  { q: "What is the chemical symbol for Gold?", a: "Au" },
  { q: "Which planet in our solar system has the most moons?", a: "Saturn" },
  { q: "What is the rarest naturally occurring blood type in humans?", a: "AB Negative" },
  { q: "How many bones are there in an adult human body?", a: "206" },
  { q: "Which country is home to the Kangaroo?", a: "Australia" },
  { q: "What is the capital city of Japan?", a: "Tokyo" },
  { q: "What is the hardest natural substance on Earth?", a: "Diamond" },
  { q: "Which ocean is the largest on Earth?", a: "Pacific Ocean" },
  { q: "Who painted the famous Mona Lisa?", a: "Leonardo da Vinci" },
  { q: "What is the smallest country in the world?", a: "Vatican City" },
  { q: "Which organ in the human body consumes the most energy?", a: "The Brain" },
  { q: "What is the national animal of Scotland?", a: "Unicorn" },
  { q: "How many elements are currently listed on the Periodic Table?", a: "118" },
  { q: "What gas do plants absorb from the atmosphere to perform photosynthesis?", a: "Carbon Dioxide" },
  { q: "Which country invented tea?", a: "China" },
  { q: "What is the largest land mammal currently alive on Earth?", a: "African Elephant" },
  { q: "In what year did the Titanic sink in the North Atlantic Ocean?", a: "1912" },
  { q: "What is the currency utilized across the United Kingdom?", a: "Pound Sterling" },
  { q: "Which specific planet is often nicknamed the Red Planet?", a: "Mars" }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Spits out a random brain-teaser trivia question.'),
  name: 'trivia',

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
    
    const target = TRIVIA_POOL[Math.floor(Math.random() * TRIVIA_POOL.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#FFA500')
      .setTitle(isCuteActive ? '✨ 🧠 TRIVIA TIME! ✨' : '🧠 Trivia Time!')
      .setDescription(`**Question:** ${target.q}\n\n*Click the spoiler text below for the answer!*\n||${target.a}||`)
      .setFooter({ text: 'Test your brainpower!' });
      
    await interaction.reply({ embeds: [embed] }).catch(() => null);
  },

  async executePrefix(message, args, client) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[message.guild?.id] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
    }

    const target = TRIVIA_POOL[Math.floor(Math.random() * TRIVIA_POOL.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[message.guild?.id] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#FFA500')
      .setTitle(isCuteActive ? '✨ 🧠 TRIVIA TIME! ✨' : '🧠 Trivia Time!')
      .setDescription(`**Question:** ${target.q}\n\n*Click the spoiler text below for the answer!*\n||${target.a}||`)
      .setFooter({ text: 'Test your brainpower!' });
      
    await message.reply({ embeds: [embed] }).catch(() => null);
  }
};
