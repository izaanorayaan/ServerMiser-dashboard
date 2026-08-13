const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database.js');

// Permanent, working coin flip animations optimized for native chat layout embeds
const COIN_GIFS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeGtyenI4dGN6MGFkNjFxcGthcW00czJqM21lbTNlMWhob2QzZjEyZiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/6jqfXikz9yzhS/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExeGtyenI4dGN6MGFkNjFxcGthcW00czJqM21lbTNlMWhob2QzZjEyZiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/6jqfXikz9yzhS/giphy.gif"
];

module.exports = {
    name: 'coinflip',
    description: 'Flip an animated coin and see what it lands on.',
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip an animated coin and see what it lands on.'),

    async execute(interaction) {
        const mainSettings = db.readData('settings.json') || {};
        const currentGuildSettings = mainSettings[interaction.guildId] || {};

        if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
            return interaction.reply({ 
                content: '🔒 The **Fun Module** features have been globally disabled by an administrator.', 
                flags: [MessageFlags.Ephemeral] 
            }).catch(() => null);
        }

        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const randomCoinGif = COIN_GIFS[Math.floor(Math.random() * COIN_GIFS.length)];
        
        let cuteStyle = 'off';
        try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
        const isCuteActive = cuteStyle !== 'off';

        const embed = new EmbedBuilder()
            .setTitle(isCuteActive ? '✨ 🪙 ANIMATED COIN FLIP ✨' : '🪙 Coin Flip')
            .setDescription(`The coin spins high through the air and lands flat...\n\n🎯 It's **${result}**!`)
            .setColor(isCuteActive ? '#FF69B4' : '#3498DB')
            .setImage(randomCoinGif); // 🌟 Lock the GIF inside the card!

        // Removed the external text content link parameter layout completely
        await interaction.reply({ 
            embeds: [embed] 
        }).catch(() => null);
    },

    async executePrefix(message, args, client) {
        const mainSettings = db.readData('settings.json') || {};
        const currentGuildSettings = mainSettings[message.guild?.id] || {};

        if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
            return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
        }

        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
        const randomCoinGif = COIN_GIFS[Math.floor(Math.random() * COIN_GIFS.length)];
        
        let cuteStyle = 'off';
        try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[message.guild?.id] || 'off'; } catch (e) {}
        const isCuteActive = cuteStyle !== 'off';

        const embed = new EmbedBuilder()
            .setTitle(isCuteActive ? '✨ 🪙 ANIMATED COIN FLIP ✨' : '🪙 Coin Flip')
            .setDescription(`The coin spins high through the air and lands flat...\n\n🎯 It's **${result}**!`)
            .setColor(isCuteActive ? '#FF69B4' : '#3498DB')
            .setImage(randomCoinGif); // 🌟 Lock the GIF inside the card here too!

        // Removed the external text content link parameter layout here too
        return message.reply({ 
            embeds: [embed] 
        }).catch(() => null);
    }
};
