const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

const MEMES = [
  { title: "When you check your phone at 2 AM and the screen brightness completely melts your eyes", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYTJkMThwcjI3eWt0M3NkNXo3cXF3NjVub3NxeTQwdzZjbzI5b2twYyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/9hXT5I4TekIeCzp4b8/giphy.gif" },
  { title: "me when i pull up in front of a bunch of 5 year olds", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeWI1anlzenlwMzI5NXY5Zm5rbjE3ZndqYXpnYXN4MmxtN25zdHgwYSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/oBPEvqqYECSkLoLkud/giphy.gif" },
  { title: "When you walk into a room with maximum confidence but completely forget why you went in there", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeWI1anlzenlwMzI5NXY5Zm5rbjE3ZndqYXpnYXN4MmxtN25zdHgwYSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/BlEdmJfXRIM9lEL1kI/giphy.gif" },
  { title: "Us 😘❤️", url: "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ZTkzeW9ydXJsY2RqN20wMG9mMnJncnNlOXViYWZlaWVxN21qY3d6cSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/rXxh0fRy6jJNcceKR8/giphy.gif" },
  { title: "Ai literally", url: "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3eDh3cmd3NXd1MWk4YWY3eXV4ZTJ5Z29jbnZlYWlxeDVlbnpxeTNjZCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/DDRxf80ksbaHsyfw2L/giphy.gif" },
  { title: "When the teacher gives the worst kid in the class an A+", url: "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3c2QzcnJqeHh1dWQ0dTN3NG8wemw4NDBsbjJlbjFocjB5Zzk4NnFqOSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/hgE6Gq6TSA3pEm9PgW/giphy.gif" },
  { title: "When you wave back at someone in public only to realize they were waving at the person behind you", url: "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ejJ6OWE4Yjl0Y2pza2xobWdla2R0amNjcDBwOXppM2Y0MHJkejEwMSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/8XZV0MwrVVw2L4jpeK/giphy.gif" },
  { title: "Watching your food rotate in the microwave like it is a top-tier cinematic feature film", url: "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3NWlpbTcyNWtlaDV3M3JhdTYzZTYzbjVveHMwZ3FkNzE1MTF1amF0ZiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/YMdwcGZzmVPd92pfYO/giphy.gif" },
  { title: "When you accidentally push a commercial door that explicitly has a giant 'PULL' sign on it", url: "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ZmduN2c1cm1taHV1amhsZTNycGgya2hienJ0N3NoZ2N5azRmM2d2YiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/jVUMbDbUtS2eKPJtlU/giphy.gif" },
  { title: "The absolute heart-stopping panic when you reach into your pocket and don't feel your phone", url: "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3Y2tuY3I1eXpwaWZqYnN6dTQ2bXlwN3g4cDUyenR6aXhvdTEwMG1sMyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/wpvDtQOHSvHCDpCa03/giphy.gif" },
  { title: "Me looking at my total bank account balance after saying 'treat yourself' just one minor time", url: "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MzVudnU3ZzJyejZ4ZHF0aTJ1NHA0NGNqNHlzMWFnbTdnbWthNjJiZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/heTOo1Etgs2SohZrBg/giphy.gif" },
  { title: "The exact facial expression you make when the waiter is bringing your food over to the table", url: "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3MzVudnU3ZzJyejZ4ZHF0aTJ1NHA0NGNqNHlzMWFnbTdnbWthNjJiZyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/5quG1HRA7wjpPByjyq/giphy.gif" },
  { title: "When you hear your own voice on an audio recording and wonder how anyone stands talking to you", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExMzFtN25hMjYyZHVteW8yczN2dGVrdjk5emIyYW84czM4ZHd0aGQ1cSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/aM4FFzsndEiXpgiFKD/giphy.gif" },
  { title: "Me laughing at a random joke three hours later when I finally understand what it meant", url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExZGlmZnRoZm5ldGk3YW9tcWh2bXIxNXU3cnR1bGc0dTllZW1lNmNhMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/k7Ip1BaxWwmLQZJ7Gk/giphy.gif" },
  { title: "When you finish an exam and have absolutely zero idea if you got a 100% score or a 0% score", url: "https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExaGE3MGJ0bjQ1cG53dWFoMGVnenc1Mzh6MWVlNWIzcnFnbnhtc3ZtcSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/cWuCpYskQfi34aGiJQ/giphy.gif" }
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Spits out a random funny, relatable lifestyle meme.'),
  name: 'meme',

  async execute(interaction) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[interaction.guildId] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return interaction.reply({ 
        content: '❌ The Fun Module is currently disabled on this server!', 
        flags: [MessageFlags.Ephemeral] 
      }).catch(() => null);
    }
    
    const selected = MEMES[Math.floor(Math.random() * MEMES.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#95A5A6')
      .setTitle(isCuteActive ? `✨ 😂 ${selected.title.toUpperCase()} ✨` : `😂 ${selected.title}`)
      .setImage(selected.url) // Added back to lock image natively inside card
      .setFooter({ text: 'Everyday Life Relatable Content' });
      
    // Removed direct text content string parameter from reply payload layout
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

    const selected = MEMES[Math.floor(Math.random() * MEMES.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[message.guild?.id] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#95A5A6')
      .setTitle(isCuteActive ? `✨ 😂 ${selected.title.toUpperCase()} ✨` : `😂 ${selected.title}`)
      .setImage(selected.url) // Added back here as well
      .setFooter({ text: 'Everyday Life Relatable Content' });
      
    // Removed direct text content string parameter from prefix response layout
    return message.reply({ 
      embeds: [embed] 
    }).catch(() => null);
  }
};
