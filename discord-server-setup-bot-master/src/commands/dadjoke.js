const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

// Expanded pool featuring 30 classic dad jokes
const DAD_JOKES = [
  "I'm reading a book on anti-gravity. I just can't put it down!",
  "I told my doctor that I broke my arm in two places. He told me to stop going to those places.",
  "Why do fathers take an extra pair of pants when they go golfing? In case they get a hole in one!",
  "What do you call a factory that makes okay products? A satisfactory.",
  "Why did the scarecrow win an award? Because he was outstanding in his field!",
  "What do you call someone with no body and no nose? Nobody knows.",
  "Why don't scientists trust atoms? Because they make up everything!",
  "Did you hear about the guy who invented the knock-knock joke? He won the 'no-bell' prize.",
  "I used to play piano by ear, but now I use my hands.",
  "How do you make a tissue dance? You put a little boogie in it.",
  "What do you call a fake noodle? An impasta.",
  "Why did the bicycle fall over? Because it was two-tired.",
  "Want to hear a joke about construction? I'm still working on it.",
  "What do you call a sleeping dinosaur? A dino-snore!",
  "Why do skeletons go into mines? To find gold and diamonds!",
  "Why did the invisible man turn down the job offer? He just couldn't see himself doing it.",
  "I ordered a chicken and an egg from Amazon. I'll let you know.",
  "What do you call a belt made out of watches? A waist of time.",
  "What do you call a fly without wings? A walk.",
  "How does a penguin build its house? Igloos it together!",
  "What do you call an alligator in a vest? An investigator.",
  "Why did the stadium get hot after the game? All of the fans left.",
  "What kind of shoes do ninjas wear? Sneakers.",
  "I told my wife she was drawing her eyebrows too high. She looked surprised.",
  "Why can't a nose be 12 inches long? Because then it would be a foot.",
  "What do you call a can opener that doesn't work? A can't opener.",
  "How do celebrity surfers stay clean? They wash up on shore.",
  "Why did the cookie go to the hospital? Because it felt crummy.",
  "What do you call a cheese that isn't yours? Nacho cheese.",
  "Why don't math problems ever go to parties? Because they have too many variables."
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dadjoke')
    .setDescription('Get a classic, groans-guaranteed dad joke.'),
  name: 'dadjoke',

  async execute(interaction) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[interaction.guildId] || {};

    // Standard structural safety framework filter
    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return interaction.reply({ 
        content: '❌ The Fun Module is currently disabled on this server!', 
        flags: [MessageFlags.Ephemeral] 
      }).catch(() => null);
    }
    
    const randomDadJoke = DAD_JOKES[Math.floor(Math.random() * DAD_JOKES.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#F1C40F')
      .setTitle(isCuteActive ? '✨ 👨 DAD JOKE ✨' : '👨 Dad Joke')
      .setDescription(`*${randomDadJoke}*`)
      .setFooter({ text: 'Groans guaranteed.' });
      
    await interaction.reply({ embeds: [embed] }).catch(() => null);
  },

  async executePrefix(message, args, client) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[message.guild?.id] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
    }

    const randomDadJoke = DAD_JOKES[Math.floor(Math.random() * DAD_JOKES.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[message.guild?.id] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#F1C40F')
      .setTitle(isCuteActive ? '✨ 👨 DAD JOKE ✨' : '👨 Dad Joke')
      .setDescription(`*${randomDadJoke}*`)
      .setFooter({ text: 'Groans guaranteed.' });
      
    await message.reply({ embeds: [embed] }).catch(() => null);
  }
};
