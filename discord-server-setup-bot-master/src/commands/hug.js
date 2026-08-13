const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

const HUG_ACTIONS = [
  "wrapped their arms tightly around {target} for a massive, warm bear hug! 🧸",
  "gives {target} a comforting squeeze. Everything is going to be completely okay! 💕",
  "tackles {target} with an unexpected, joyful surprise virtual hug! ⚡",
  "gives {target} a polite but deeply genuine, heartwarming embrace. ✨",
  "runs over and engulfs {target} in a cozy, warm blanket-style hug! 🧣",
  "gives {target} a gentle, warm side-hug to brighten up their entire day! ☀️",
  "sneaks up quietly behind {target} and gives them a sudden, happy back-hug! 🤗",
  "gives {target} an absolute mega-hug that lifts them completely off the room floor! 🚀",
  "shares a quiet, comforting, long-lasting embrace with {target} to ease their mind. 💤",
  "flings their arms wide open and wraps {target} in a pure, wholesome cloud-like hug! ☁️",
  "gives {target} a quick, cheerful high-five that naturally rolls into a warm embrace! 👋",
  "spreads total positivity by throwing a friendly cushion-style hug right at {target}! 🛋️",
  "stops everything they are doing just to give {target} the most well-deserved hug ever! 🏆",
  "pats {target} on the back and wraps them in a highly supportive team hug! 👥",
  "sends a million digital micro-hugs flying straight into {target}'s active chat stream! 💻"
];

// Permanent Giphy direct links optimized for embeds
const HUG_GIFS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdTU5aWRlMXMyOTV5YzU3dnJqZjVld254ZGI0ZTB5Z2F0OWU4Zm1ncyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/gl8ymnpv4Sqha/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdTU5aWRlMXMyOTV5YzU3dnJqZjVld254ZGI0ZTB5Z2F0OWU4Zm1ncyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/5OqXb948EBkyUcnwHt/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3ZzdxYzgydGhtNm9maHU0d3RseGMzZG9nNmd2enhpdndyZ3JzajlncCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/lrr9rHuoJOE0w/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3cmRlYml1eDQ2bzduajJ5aTFxNTBuZTNycW85Z3ZpN3I1eW9lcjhlZSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/d9eL06htb5Vks/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPWVjZjA1ZTQ3N243aHdmeng5NDdvY2FvNGhmcDV5NnN2YzU4bnJncGtrOHduZjZoZSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/Gf54zTxt2QKru/giphy.gif"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hug')
    .setDescription('Give a member a warm, fuzzy virtual hug.')
    .addUserOption(option => option.setName('user').setDescription('The user to hug').setRequired(true)),
  name: 'hug',

  async execute(interaction) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[interaction.guildId] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return interaction.reply({ 
        content: '❌ The Fun Module is currently disabled on this server!', 
        flags: [MessageFlags.Ephemeral] 
      }).catch(() => null);
    }
    
    const target = interaction.options.getUser('user');
    if (!target) return interaction.reply({ content: '❌ User target not found.', flags: [MessageFlags.Ephemeral] }).catch(() => null);

    const caller = interaction.user;
    if (target.id === caller.id) {
      return interaction.reply({ content: '🤗 You wrap your arms around yourself. Self-love is important! ❤️', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    const randomAction = HUG_ACTIONS[Math.floor(Math.random() * HUG_ACTIONS.length)].replace('{target}', `**${target.username}**`);
    const randomGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#FFC0CB')
      .setTitle(isCuteActive ? '✨ 🤗 WHOLESOME EMBRACE ✨' : '🤗 Virtual Hug!')
      .setDescription(`**${caller.username}** ${randomAction}`)
      .setImage(randomGif); // 🌟 Lock the GIF inside the embed frame
      
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

    // Resolve targeted user via mention or raw trailing ID strings
    let target = message.mentions.users.first();
    if (!target && args && args.length > 0) {
      const pureId = args[0].replace(/[^0-9]/g, '');
      if (pureId.length >= 17 && pureId.length <= 20) {
        target = await client.users.fetch(pureId).catch(() => null);
      }
    }

    if (!target) return message.reply('❌ Please mention a valid user to hug! Usage: `|hug @user`').catch(() => null);
    if (target.id === message.author.id) {
      return message.reply('🤗 You wrap your arms around yourself. Self-love is important! ❤️').catch(() => null);
    }

    const randomAction = HUG_ACTIONS[Math.floor(Math.random() * HUG_ACTIONS.length)].replace('{target}', `**${target.username}**`);
    const randomGif = HUG_GIFS[Math.floor(Math.random() * HUG_GIFS.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[message.guild?.id] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embedPrefix = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#FFC0CB')
      .setTitle(isCuteActive ? '✨ 🤗 WHOLESOME EMBRACE ✨' : '🤗 Virtual Hug!')
      .setDescription(`**${message.author.username}** ${randomAction}`)
      .setImage(randomGif); // 🌟 Lock the GIF inside the embed frame here too

    return message.reply({ 
      embeds: [embedPrefix] 
    }).catch(() => null);
  }
};
