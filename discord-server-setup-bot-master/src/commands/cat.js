const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

const CAT_FACTS = [
  "Meow! Did you know cats sleep for roughly 70% of their entire lives?",
  "Purr... Domestic cats actually have 32 distinct muscles in each ear to control them independently.",
  "A group of adult cats hanging out together is officially called a clowder!",
  "Cats are highly vocal animals and can make over 100 completely distinct vocal sounds.",
  "Cats use their highly sensitive whiskers to judge if a tight space is too narrow to squeeze through.",
  "A cat's unique nose print pattern is completely individual, much like a human fingerprint!",
  "A cat can sprint at top speeds reaching up to 30 miles per hour over short backyard distances.",
  "Every domestic cat alive today can trace its evolutionary genetic lineage directly back to ancient African wildcats.",
  "A healthy cat can jump up to an incredible six times its total height in a single bound!",
  "Cats rub their faces against humans to mark them with hidden scent glands located near their cheeks."
];

// Permanent, high-quality Tenor cat animations optimized for text layout embedding
const CAT_GIFS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTQ4a2RwMjA2NThwZnJmZGlzNXIycWg2eXZwcngyZ2ZkanZ5cXo4aSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/3oriO0OEd9QIDdllqo/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTQ4a2RwMjA2NThwZnJmZGlzNXIycWg2eXZwcngyZ2ZkanZ5cXo4aSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/uyfgCPQeCjYMVxt2m3/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTQ4a2RwMjA2NThwZnJmZGlzNXIycWg2eXZwcngyZ2ZkanZ5cXo4aSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/yedDQGWwq0heU/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTQ4a2RwMjA2NThwZnJmZGlzNXIycWg2eXZwcngyZ2ZkanZ5cXo4aSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/oz0iZ8vYdgeTVMtFAe/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTQ4a2RwMjA2NThwZnJmZGlzNXIycWg2eXZwcngyZ2ZkanZ5cXo4aSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/dRcMsUUrnR8He/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTQ4a2RwMjA2NThwZnJmZGlzNXIycWg2eXZwcngyZ2ZkanZ5cXo4aSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/haCYYKWRVeilcEL65X/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTQ4a2RwMjA2NThwZnJmZGlzNXIycWg2eXZwcngyZ2ZkanZ5cXo4aSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/bdIHP4CqxvdUe2MJH8/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTQ4a2RwMjA2NThwZnJmZGlzNXIycWg2eXZwcngyZ2ZkanZ5cXo4aSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/1YLltfFKpiti8ePRT4/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3OWQzZXk1cGQzemt0enRzeGt3c2Y4dzE3Ymk5NjduN3MxZWZ5c3QwaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/PfPgPP9VX3m5O05sba/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3OWQzZXk1cGQzemt0enRzeGt3c2Y4dzE3Ymk5NjduN3MxZWZ5c3QwaiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/0oIkdy76oYE8uPsPjy/giphy.gif"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cat')
    .setDescription('Spits out a fully animated cat GIF and a random feline fact.'),
  name: 'cat',

  async execute(interaction) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[interaction.guildId] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return interaction.reply({ 
        content: '❌ The Fun Module is currently disabled on this server!', 
        flags: [MessageFlags.Ephemeral] 
      }).catch(() => null);
    }
    
    const randomFact = CAT_FACTS[Math.floor(Math.random() * CAT_FACTS.length)];
    const randomGif = CAT_GIFS[Math.floor(Math.random() * CAT_GIFS.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#E67E22')
      .setTitle(isCuteActive ? '✨ 🐱 ANIMATED CAT VALUE ✨' : '🐱 Random Cat Fact')
      .setDescription(`💡 **Did you know?** ${randomFact}`)
      .setImage(randomGif); // 🌟 Lock the GIF inside the card layout!
      
    // Removed direct text content string parameter from response payload layout
    await interaction.reply({ 
      embeds: [embed] 
    }).catch(() => null);
  },

  async executePrefix(message, args, client) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[message.guild?.id] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
    }

    const randomFact = CAT_FACTS[Math.floor(Math.random() * CAT_FACTS.length)];
    const randomGif = CAT_GIFS[Math.floor(Math.random() * CAT_GIFS.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[message.guild?.id] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#E67E22')
      .setTitle(isCuteActive ? '✨ 🐱 ANIMATED CAT VALUE ✨' : '🐱 Random Cat Fact')
      .setDescription(`💡 **Did you know?** ${randomFact}`)
      .setImage(randomGif); // 🌟 Lock the GIF inside the card here too!
      
    // Removed direct text content string parameter from prefix response layout
    return message.reply({ 
      embeds: [embed] 
    }).catch(() => null);
  }
};
