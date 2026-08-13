const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

const SLAP_ACTIONS = [
  "slapped {target} across the face with a giant, smelly yellow trout! 🐟",
  "clobbered {target} with a loud, squeaky cartoon toy mallet! 🔨",
  "slapped the mechanical keyboard right out from under {target}'s hands! ⌨️",
  "hit {target} with a legendary, ultra-powerful anime-style backhand slap! 💥",
  "challenges {target} to reality with a sudden, comedic wake-up slap! ⏰",
  "launches a high-velocity slice of wet pizza directly at {target}'s face! 🍕",
  "smacks {target} lightly upside the head with a rolled-up programming magazine! 🗞️",
  "winds up for an absolute mega-slap that sends {target} flying into the next channel! 🚀",
  "playfully slaps a glowing neon sticker onto {target}'s forehead that reads 'LOUSER'! 🏷️",
  "hits {target} with a swift, perfectly timed triple-slap combination! 🌪️"
];

const SLAP_GIFS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTZmMGttaThicmc4cWRkYWVic2k5enNjMXZyYTZ2Y2hwODUxa2hweiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/XHzDQSWl8wC7VhWz4d/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTZmMGttaThicmc4cWRkYWVic2k5enNjMXZyYTZ2Y2hwODUxa2hweiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/UtGH7Lez5X3vomTWSB/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTZmMGttaThicmc4cWRkYWVic2k5enNjMXZyYTZ2Y2hwODUxa2hweiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/arHk362F33HGh0y83C/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOTZmMGttaThicmc4cWRkYWVic2k5enNjMXZyYTZ2Y2hwODUxa2hweiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/MdvyuBd0fdGYWmAQ35/giphy.gif"
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slap')
    .setDescription('Slap another user with a hilarious item.')
    .addUserOption(option => option.setName('user').setDescription('The user to slap').setRequired(true)),
  name: 'slap',

  async execute(interaction, client) {
    // Correct checking layer to see if it is a real interaction or text mock
    const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : (interaction.options && !interaction.isMock ? true : false);

    const settings = (await db.readData('settings.json')) || {};
    const currentGuildSettings = settings[interaction.guildId] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false || currentGuildSettings.funModule === 'off') {
      const disabledMsg = '❌ The Fun Module is currently disabled on this server!';
      return isInteraction 
        ? interaction.reply({ content: disabledMsg, flags: [MessageFlags.Ephemeral] }).catch(() => null)
        : interaction.reply({ content: disabledMsg }).catch(() => null);
    }
    
    const target = interaction.options.getUser('user');
    if (!target) {
      const missingUserMsg = '❌ Could not resolve that user profile target.';
      return isInteraction 
        ? interaction.reply({ content: missingUserMsg, flags: [MessageFlags.Ephemeral] }).catch(() => null)
        : interaction.reply({ content: missingUserMsg }).catch(() => null);
    }

    const caller = isInteraction ? interaction.user : interaction.author;
    if (target.id === caller.id) {
      const selfSlapMsg = '💥 You swing and somehow wind up slapping your own face. Ouch! 🤕';
      return isInteraction 
        ? interaction.reply({ content: selfSlapMsg, flags: [MessageFlags.Ephemeral] }).catch(() => null)
        : interaction.reply({ content: selfSlapMsg }).catch(() => null);
    }

    const randomAction = SLAP_ACTIONS[Math.floor(Math.random() * SLAP_ACTIONS.length)].replace('{target}', `**${target.username}**`);
    const randomGif = SLAP_GIFS[Math.floor(Math.random() * SLAP_GIFS.length)];
    
    const cuteData = (await db.readData('cute.json')) || {};
    const cuteStyle = cuteData[interaction.guildId] || 'off';
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#E74C3C')
      .setTitle(isCuteActive ? '✨ 💥 COMEDIC CLOBBER STATE ✨' : '💥 Direct Hit!')
      .setDescription(`**${caller.username}** ${randomAction}`)
      .setImage(randomGif);
      
    await interaction.reply({ embeds: [embed] }).catch(() => null);
  },

  // 🌟 FIXED: Fixed array selection index to block runtime crashes completely
  async executePrefix(message, argsArray, client) {
    let targetUser = message.mentions.users.first();
    
    // Fix: Access index 0 of argsArray instead of replacing string methods across arrays
    if (!targetUser && argsArray && argsArray.length > 0) {
      const pureId = argsArray[0].replace(/[^0-9]/g, '');
      if (pureId.length >= 17 && pureId.length <= 20) {
        targetUser = await client.users.fetch(pureId).catch(() => null);
      }
    }

    if (!targetUser) {
      return message.reply('❌ Please mention a valid user to slap! Usage: `|slap @user`').catch(() => null);
    }

    const mockInteraction = {
      isMock: true,
      guild: message.guild,
      guildId: message.guild?.id,
      member: message.member,
      author: message.author,
      options: {
        getUser: (name) => targetUser
      },
      // Safely process nested options payload objects without crashing
      reply: async (options) => {
        if (options.embeds) return message.reply({ embeds: options.embeds });
        return message.reply(options.content || options);
      }
    };

    await this.execute(mockInteraction, client).catch(() => null);
  }
};
