const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database.js');

// Expanded pool featuring 20 unique ice cream flavor profiles
const FLAVORS = [
    "Classic Vanilla", 
    "Dark Chocolate Spark", 
    "Mint Condition Chip", 
    "Salty Caramel Chaos", 
    "Rocky Road to Success",
    "Strawberry Dreamwave",
    "Cookies & Cream Conundrum",
    "Pistachio Perfection",
    "Mango Madness Sorbet",
    "Matcha Zen Swirl",
    "Espresso Energizer",
    "Birthday Cake Celebration",
    "Cotton Candy Cloud",
    "Bubblegum Blast",
    "Peanut Butter Cup Crunch",
    "Lemon Sorbet Sunshine",
    "Raspberry Ripple Romance",
    "Coconut Paradise Creame",
    "Red Velvet Velvet",
    "Banana Split Bonanza"
];

module.exports = {
    name: 'flavor',
    description: 'Discover your current ice cream flavor personality.',
    data: new SlashCommandBuilder()
        .setName('flavor')
        .setDescription('Discover your current ice cream flavor personality.'),

    async execute(interaction) {
        // 1. Unified database architecture lookup
        const mainSettings = db.readData('settings.json') || {};
        const currentGuildSettings = mainSettings[interaction.guildId] || {};

        if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
            return interaction.reply({ 
                content: '🔒 The **Fun Module** features have been globally disabled by an administrator.', 
                flags: [MessageFlags.Ephemeral] 
            }).catch(() => null);
        }

        // 2. Perform randomization calculation
        const chosenFlavor = FLAVORS[Math.floor(Math.random() * FLAVORS.length)];
        
        // 3. Dynamic Font Style Layout Extraction
        let cuteStyle = 'off';
        try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
        const isCuteActive = cuteStyle !== 'off';

        // 4. Construct high-quality embed response
        const embed = new EmbedBuilder()
            .setTitle(isCuteActive ? '✨ 🍦 FLAVOR PERSONALITY ✨' : '🍦 Flavor Personality')
            .setDescription(`Analyzing your current energy levels... 🍧\n\nYour ice cream flavor personality right now is:\n**✨ ${chosenFlavor} ✨**`)
            .setColor(isCuteActive ? '#FF69B4' : '#E91E63')
            .setFooter({ text: 'Stay cool!' });

        await interaction.reply({ embeds: [embed] }).catch(() => null);
    },

    async executePrefix(message, args, client) {
        // 1. Framework switch verification for prefix calls
        const mainSettings = db.readData('settings.json') || {};
        const currentGuildSettings = mainSettings[message.guild?.id] || {};

        if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
            return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
        }

        const chosenFlavor = FLAVORS[Math.floor(Math.random() * FLAVORS.length)];
        
        let cuteStyle = 'off';
        try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[message.guild?.id] || 'off'; } catch (e) {}
        const isCuteActive = cuteStyle !== 'off';

        const embed = new EmbedBuilder()
            .setTitle(isCuteActive ? '✨ 🍦 FLAVOR PERSONALITY ✨' : '🍦 Flavor Personality')
            .setDescription(`Analyzing your current energy levels... 🍧\n\nYour ice cream flavor personality right now is:\n**✨ ${chosenFlavor} ✨**`)
            .setColor(isCuteActive ? '#FF69B4' : '#E91E63')
            .setFooter({ text: 'Stay cool!' });

        await message.reply({ embeds: [embed] }).catch(() => null);
    }
};
