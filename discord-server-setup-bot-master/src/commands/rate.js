const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

const RATING_COMMENTARY = {
  low: ["Honestly, this ain't it chief. 📉", "Big yikes from me. 💀", "Absolute bottom tier content. 🗑️"],
  mid: ["Not terrible, but could be a lot better. 😐", "Perfectly balanced, as all things should be. ⚖️", "Pretty average, nothing crazy. 🎟️"],
  high: ["Wow, an absolute masterpiece! 🌟", "This is phenomenal! 🔥", "10/10, certified legendary state! 👑"]
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rate')
    .setDescription('Have the bot rate anything out of 10.')
    .addStringOption(opt => opt.setName('item').setDescription('What should I rate?').setRequired(true)),
  name: 'rate',

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
    
    const item = interaction.options.getString('item');
    if (!item) {
      return interaction.reply({ content: '❌ You must specify an item to rate!', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    const rating = Math.floor(Math.random() * 11);
    
    let commentaryPool = RATING_COMMENTARY.mid;
    if (rating <= 3) commentaryPool = RATING_COMMENTARY.low;
    if (rating >= 8) commentaryPool = RATING_COMMENTARY.high;
    const comment = commentaryPool[Math.floor(Math.random() * commentaryPool.length)];

    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#F1C40F')
      .setTitle(isCuteActive ? '✨ 📊 BOT RATING SYSTEM ✨' : '📊 Bot Rating System')
      .setDescription(`I rate **${item}** a solid **${rating}/10**!\n\n*"${comment}"*`)
      .setFooter({ text: 'Opinions are computer-generated and definitive.' });
      
    await interaction.reply({ embeds: [embed] }).catch(() => null);
  },

  async executePrefix(message, argsArray, client) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[message.guild?.id] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
    }

    const rawInput = argsArray ? argsArray.join(' ').trim() : '';
    if (!rawInput) {
      return message.reply('❌ Usage: `|rate <item or user>`').catch(() => null);
    }

    // Construct the context wrapper compatibility variables
    const mockContextInteraction = {
      guild: message.guild,
      guildId: message.guild.id,
      user: message.author,
      member: message.member,
      options: {
        getString: (name) => rawInput
      },
      reply: async (options) => message.reply(options)
    };

    const targetCommand = client.commands.get('rate');
    if (targetCommand) {
      await targetCommand.execute(mockContextInteraction).catch(err => console.error('Error in rate prefix route execution:', err));
    }
  }
};
