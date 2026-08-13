const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

// Brand new pool of 20 hilarious everyday normal jokes
const JOKES = [
  "My wife told me to stop impersonating a flamingo. I had to put my foot down.",
  "I told my doctor that I broke my arm in two places. He told me to stop going to those places.",
  "I used to think I was indecisive, but now I'm not so sure.",
  "Parallel lines have so much in common. It’s a shame they’ll never meet.",
  "I told my suitcase there will be no vacation this year. Now I'm dealing with emotional baggage.",
  "What do you call a fake noodle? An impasta.",
  "Why don't skeletons fight each other? They don't have the guts.",
  "I'm reading a book on anti-gravity. I just can't put it down!",
  "What do you call a can opener that doesn't work? A can't opener.",
  "Why did the bicycle fall over? Because it was two-tired.",
  "I asked my dog what's on top of the house. He said, 'Roof!'",
  "Why do we tell actors to 'break a leg'? Because every play has a cast.",
  "What do you call a sleeping dinosaur? A dino-snore!",
  "My boss told me to have a good day... so I went home.",
  "What do you call an alligator in a vest? An investigator.",
  "I wanted to buy some camouflage pants, but I couldn't find any.",
  "Why did the stadium get hot after the game? All of the fans left.",
  "What kind of shoes do ninjas wear? Sneakers.",
  "I told my wife she was drawing her eyebrows too high. She looked surprised.",
  "Why can't a nose be 12 inches long? Because then it would be a foot."
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('joke')
    .setDescription('Get a hilariously relatable, funny everyday joke.'),
  name: 'joke',

  async execute(interaction) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[interaction.guildId] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return interaction.reply({ 
        content: '❌ The Fun Module is currently disabled on this server!', 
        flags: [MessageFlags.Ephemeral] 
      }).catch(() => null);
    }
    
    const randomJoke = JOKES[Math.floor(Math.random() * JOKES.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#1ABC9C')
      .setTitle(isCuteActive ? '✨ 🎭 DAILY LAUGH STATE ✨' : '🎭 Super Funny Joke')
      .setDescription(`😂 **"${randomJoke}"**`)
      .setFooter({ text: 'Laughter is the best medicine!' });
      
    await interaction.reply({ embeds: [embed] }).catch(() => null);
  },

  async executePrefix(message, args, client) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[message.guild?.id] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
    }

    const randomJoke = JOKES[Math.floor(Math.random() * JOKES.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[message.guild?.id] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#1ABC9C')
      .setTitle(isCuteActive ? '✨ 🎭 DAILY LAUGH STATE ✨' : '🎭 Super Funny Joke')
      .setDescription(`😂 **"${randomJoke}"**`)
      .setFooter({ text: 'Laughter is the best medicine!' });
      
    await message.reply({ embeds: [embed] }).catch(() => null);
  }
};
