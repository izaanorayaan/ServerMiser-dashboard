const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database');

const ROASTS = [
  "your secrets are safe with me. I never even listened in the first place.",
  "I'm not saying I hate you, but I would unplug your life support to charge my phone.",
  "light travels faster than sound. This is why some people appear bright until they speak.",
  "you bring everyone so much joy... when you leave the room.",
  "I'd agree with you, but then we'd both be wrong.",
  "if I had a face like yours, I'd sue my parents.",
  "your Wi-Fi signal is stronger than your life choices.",
  "you are proof that evolution can go in reverse.",
  "you're like a cloud. When you disappear, it's a beautiful day.",
  "I envy people who haven't met you yet.",
  "you have a face for radio and a voice for silent movies.",
  "if laughter is the best medicine, your face is curing the world.",
  "I can explain it to you, but I can't understand it for you.",
  "you're the reason the shampoo bottle has instructions.",
  "somewhere out there is a tree tirelessly producing oxygen for you. I think you owe it an apology.",
  "your vocabulary is as empty as your bank account.",
  "if ignorance is bliss, you must be the happiest person on earth.",
  "you have two brains cells left, and they are both fighting for third place.",
  "I would insult you, but nature has already done such a thorough job.",
  "you are about as useful as an un-sharpened pencil."
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roast')
    .setDescription('Deliver a savage, good-natured roast to a user.')
    .addUserOption(option => option.setName('user').setDescription('The user to roast').setRequired(true)),
  name: 'roast',

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
    if (!target) {
      return interaction.reply({ content: '❌ Could not resolve that user profile target.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    const caller = interaction.user;
    if (target.id === activeClientUser(interaction).id) {
      return interaction.reply({ content: '🤖 Nice try! You cannot roast me; my code is flawless.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    const randomRoast = ROASTS[Math.floor(Math.random() * ROASTS.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embed = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#D35400')
      .setTitle(isCuteActive ? '✨ 🔥 SAVAGE ROAST 🔥 ✨' : '🔥 Roasted!')
      .setDescription(`**${target.username}**, ${randomRoast}`)
      .setFooter({ text: `Requested by ${caller.username}` });
      
    await interaction.reply({ embeds: [embed] }).catch(() => null);
  },

  async executePrefix(message, args, client) {
    const settings = db.readData('settings.json') || {};
    const currentGuildSettings = settings[message.guild?.id] || {};

    if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
      return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
    }

    // RESOLVE USER: Target via mention or trailing raw snowflake string IDs
    let target = message.mentions.users.first();
    if (!target && args && args.length > 0) {
      const pureId = args.replace(/[^0-9]/g, '');
      if (pureId.length >= 17 && pureId.length <= 20) {
        target = await client.users.fetch(pureId).catch(() => null);
      }
    }

    if (!target) {
      return message.reply('❌ Please mention a valid user to roast! Usage: `|roast @user`').catch(() => null);
    }

    if (target.id === client.user.id) {
      return message.reply('🤖 Nice try! You cannot roast me; my code is flawless.').catch(() => null);
    }

    const randomRoast = ROASTS[Math.floor(Math.random() * ROASTS.length)];
    
    let cuteStyle = 'off';
    try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[message.guild?.id] || 'off'; } catch (e) {}
    const isCuteActive = cuteStyle !== 'off';

    const embedPrefix = new EmbedBuilder()
      .setColor(isCuteActive ? '#FF69B4' : '#D35400')
      .setTitle(isCuteActive ? '✨ 🔥 SAVAGE ROAST 🔥 ✨' : '🔥 Roasted!')
      .setDescription(`**${target.username}**, ${randomRoast}`)
      .setFooter({ text: `Requested by ${message.author.username}` });

    return message.reply({ embeds: [embedPrefix] }).catch(() => null);
  }
};

function activeClientUser(interaction) {
  return interaction.client?.user || interaction.user;
}
