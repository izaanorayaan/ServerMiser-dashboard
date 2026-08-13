const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

// Expanded pool featuring 20 mind-blowing space facts
const FACTS = [
  "One day on Venus is longer than one entire year on Venus due to its extremely slow rotation.",
  "Neutron stars are so dense, a single teaspoon of their material would weigh roughly 6 billion tons.",
  "Space is completely silent because there is no atmosphere or medium for sound waves to travel through.",
  "Footprints left on the Moon by Apollo astronauts will stay there for at least 100 million years because there is no wind or water to erode them.",
  "The Sun is massive on an Earthly scale, but relatively small cosmically. Still, about 1.3 million Earths could fit inside it.",
  "There is a planet called 55 Cancri e, located 40 light-years away, whose mass is believed to be largely composed of diamonds.",
  "Because of lower surface gravity, a person who weighs 100 pounds on Earth would weigh only about 38 pounds on Mars.",
  "The famous Halley's Comet passes by Earth once every 75 to 76 years, with its next anticipated perihelion scheduled for July 2061.",
  "Our Milky Way galaxy is on a certain collision course with the neighboring Andromeda galaxy, though the event won't occur for another 4 billion years.",
  "Saturn's rings aren't solid loops; they are made of billions of individual chunks of ice, rocky debris, and cosmic dust.",
  "The footprints and tire tracks left by humans on the Moon will stay there forever because there is no atmosphere.",
  "There are more trees on Earth than stars in the Milky Way galaxy. Earth has roughly 3 trillion trees; the galaxy has 100-400 billion stars.",
  "Sunset on Mars appears blue to human eyes because fine dust particles let blue light penetrate the atmosphere more efficiently.",
  "Outer space is not completely empty; it contains a very low density of particles, mostly hydrogen plasma, called the interstellar medium.",
  "Olympus Mons on Mars is the largest known volcano in the solar system. It is three times taller than Mount Everest.",
  "Light from the Sun takes approximately 8 minutes and 20 seconds to travel the 93 million miles to Earth.",
  "Venus is the hottest planet in our solar system, with surface temperatures reaching 465°C (900°F), even though Mercury is closer to the Sun.",
  "The Voyager 1 spacecraft, launched in 1977, is the farthest human-made object from Earth and has successfully entered interstellar space.",
  "Jupiter is a gas giant that doesn't have a solid surface. If you fell into it, you would just sink into increasingly dense layers of gas.",
  "Uranus has an extreme axial tilt of 98 degrees, meaning it literally rolls on its side as it orbits the Sun."
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('spacefact')
    .setDescription('Get a mind-blowing cosmic space fact.'),
  name: 'spacefact',

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
    
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#111133')
      .setTitle(isCuteActive ? '✨ 🌌 COSMIC SPACE TRIVIA ✨' : '🌌 Cosmic Space Fact')
      .setDescription(`🚀 *"${fact}"*`)
      .setFooter({ text: 'The universe is vast and full of wonders.' });
      
    await interaction.reply({ embeds: [embed] }).catch(() => null);
  },

  async executePrefix(message, args, client) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[message.guild?.id] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
    }

    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[message.guild?.id] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#111133')
      .setTitle(isCuteActive ? '✨ 🌌 COSMIC SPACE TRIVIA ✨' : '🌌 Cosmic Space Fact')
      .setDescription(`🚀 *"${fact}"*`)
      .setFooter({ text: 'The universe is vast and full of wonders.' });
      
    await message.reply({ embeds: [embed] }).catch(() => null);
  }
};
