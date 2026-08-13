const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../utils/database.js');

// Expanded pool to 40 unique geographic entries
const capitalPool = [
    { country: "UAE", capital: "Abu Dhabi" },
    { country: "Pakistan", capital: "Islamabad" },
    { country: "Japan", capital: "Tokyo" },
    { country: "France", capital: "Paris" },
    { country: "Canada", capital: "Ottawa" },
    { country: "Brazil", capital: "Brasília" },
    { country: "Egypt", capital: "Cairo" },
    { country: "Germany", capital: "Berlin" },
    { country: "Italy", capital: "Rome" },
    { country: "South Korea", capital: "Seoul" },
    { country: "United Kingdom", capital: "London" },
    { country: "India", capital: "New Delhi" },
    { country: "Mexico", capital: "Mexico City" },
    { country: "Spain", capital: "Madrid" },
    { country: "Argentina", capital: "Buenos Aires" },
    { country: "South Africa", capital: "Pretoria / Cape Town / Bloemfontein" },
    { country: "Thailand", capital: "Bangkok" },
    { country: "Turkey", capital: "Ankara" },
    { country: "Greece", capital: "Athens" },
    { country: "New Zealand", capital: "Wellington" },
    { country: "Norway", capital: "Oslo" },
    { country: "Vietnam", capital: "Hanoi" },
    { country: "Australia", capital: "Canberra" },
    { country: "China", capital: "Beijing" },
    { country: "Russia", capital: "Moscow" },
    { country: "Sweden", capital: "Stockholm" },
    { country: "Switzerland", capital: "Bern" },
    { country: "Portugal", capital: "Lisbon" },
    { country: "Netherlands", capital: "Amsterdam" },
    { country: "Ireland", capital: "Dublin" },
    { country: "Austria", capital: "Vienna" },
    { country: "Belgium", capital: "Brussels" },
    { country: "Ukraine", capital: "Kyiv" },
    { country: "Poland", capital: "Warsaw" },
    { country: "Saudi Arabia", capital: "Riyadh" },
    { country: "United Arab Emirates", capital: "Abu Dhabi" },
    { country: "Singapore", capital: "Singapore" },
    { country: "Malaysia", capital: "Kuala Lumpur" },
    { country: "Indonesia", capital: "Jakarta" },
    { country: "Philippines", capital: "Manila" },
    { country: "Colombia", capital: "Bogotá" },
    { country: "Peru", capital: "Lima" }
];

module.exports = {
    name: 'capital-quiz',
    description: 'Tests your geographic knowledge of world capitals.',
    data: new SlashCommandBuilder()
        .setName('capital-quiz')
        .setDescription('Tests your geographic knowledge of world capitals.'),

    async execute(interaction) {
        // Aligned with the database framework configuration utility
        const mainSettings = db.readData('settings.json') || {};
        const currentGuildSettings = mainSettings[interaction.guildId] || {};

        // Safety verification if accessed directly via dynamic slash deployment
        if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
            return interaction.reply({ 
                content: '🔒 The **Fun Module** features have been globally disabled by an administrator.', 
                flags: [MessageFlags.Ephemeral] 
            }).catch(() => null);
        }

        // Randomly extract a country data profile
        const item = capitalPool[Math.floor(Math.random() * capitalPool.length)];
        
        let cuteStyle = 'off';
        try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
        const isCuteActive = cuteStyle !== 'off';

        const embed = new EmbedBuilder()
            .setTitle(isCuteActive ? '✨ 🗺️ CAPITAL QUIZ ✨' : '🗺️ Capital Quiz')
            .setDescription(`**What is the capital city of ${item.country}?**\n\n||*Answer: ${item.capital}*||`)
            .setColor(isCuteActive ? '#FF69B4' : '#9B59B6');

        await interaction.reply({ embeds: [embed] }).catch(() => null);
    },

    async executePrefix(message, args, client) {
        // Synchronous structural check for prefix operations
        const mainSettings = db.readData('settings.json') || {};
        const currentGuildSettings = mainSettings[message.guild?.id] || {};

        if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
            return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
        }

        const item = capitalPool[Math.floor(Math.random() * capitalPool.length)];
        
        let cuteStyle = 'off';
        try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[message.guild?.id] || 'off'; } catch (e) {}
        const isCuteActive = cuteStyle !== 'off';

        const embed = new EmbedBuilder()
            .setTitle(isCuteActive ? '✨ 🗺️ CAPITAL QUIZ ✨' : '🗺️ Capital Quiz')
            .setDescription(`**What is the capital city of ${item.country}?**\n\n||*Answer: ${item.capital}*||`)
            .setColor(isCuteActive ? '#FF69B4' : '#9B59B6');

        await message.reply({ embeds: [embed] }).catch(() => null);
    }
};
