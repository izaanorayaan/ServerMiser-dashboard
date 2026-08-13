const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType, 
    MessageFlags 
} = require('discord.js');
const db = require('../utils/database.js');

module.exports = {
    name: 'dice-duel',
    description: 'Challenge another user to an interactive dice rolling duel.',
    data: new SlashCommandBuilder()
        .setName('dice-duel')
        .setDescription('Challenge another user to an instant dice rolling duel.')
        .addUserOption(option => option.setName('opponent').setDescription('The member you want to duel').setRequired(true)),

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

        const opponent = interaction.options.getUser('opponent');
        const challenger = interaction.user;

        // Validation gate checks
        if (!opponent) return interaction.reply({ content: '❌ Could not resolve the specified opponent user.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
        if (opponent.id === challenger.id) return interaction.reply({ content: '❌ You cannot duel yourself!', flags: [MessageFlags.Ephemeral] }).catch(() => null);
        if (opponent.bot) return interaction.reply({ content: '❌ You cannot challenge AI bots to a duel!', flags: [MessageFlags.Ephemeral] }).catch(() => null);

        // Fetch font modification styles
        let cuteStyle = 'off';
        try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
        const isCuteActive = cuteStyle !== 'off';

        // 2. Build Interactive Component Buttons
        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`duel-accept-${interaction.id}`)
                .setLabel('Accept Duel')
                .setStyle(ButtonStyle.Success)
                .setEmoji('⚔️'),
            new ButtonBuilder()
                .setCustomId(`duel-reject-${interaction.id}`)
                .setLabel('Decline')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('🛡️')
        );

        const inviteEmbed = new EmbedBuilder()
            .setTitle(isCuteActive ? '✨ 🎲 DICE DUEL CHALLENGE ✨' : '🎲 Dice Duel Challenge')
            .setDescription(`💥 **${challenger.username}** has challenged **${opponent.toString()}** to an instant dice duel!\n\n*Click a button below to respond. This invite expires in 30 seconds.*`)
            .setColor(isCuteActive ? '#FF69B4' : '#E67E22');

        // Send initialization message pairing standard mention ping strings
        const initialResponse = await interaction.reply({
            content: `${opponent.toString()}, you have been challenged!`,
            embeds: [inviteEmbed],
            components: [actionRow]
        });

        // 3. Construct Message Component Interaction Collector
        const collector = initialResponse.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000 // Challenge runtime duration: 30 seconds
        });

        collector.on('collect', async (btnInteraction) => {
            // Guard gate: Only allow the explicit target user to select actions
            if (btnInteraction.user.id !== opponent.id) {
                return btnInteraction.reply({ 
                    content: `❌ This invitation is for ${opponent.username}. You cannot interact with this menu.`, 
                    flags: [MessageFlags.Ephemeral] 
                }).catch(() => null);
            }

            // Defer changes instantly to gain extra API execution runway time
            await btnInteraction.deferUpdate().catch(() => null);

            if (btnInteraction.customId === `duel-reject-${interaction.id}`) {
                const rejectEmbed = new EmbedBuilder()
                    .setTitle(isCuteActive ? '✨ 🛡️ DUEL DECLINED ✨' : '🛡️ Duel Declined')
                    .setDescription(`Cowardice! **${opponent.username}** tucked their tail and declined the challenge from **${challenger.username}**.`)
                    .setColor('#7F8C8D');

                collector.stop('declined');
                return interaction.editReply({ content: ' ', embeds: [rejectEmbed], components: [] }).catch(() => null);
            }

            if (btnInteraction.customId === `duel-accept-${interaction.id}`) {
                collector.stop('accepted');

                // Execute random rolling math parameters
                const p1 = Math.floor(Math.random() * 6) + 1;
                const p2 = Math.floor(Math.random() * 6) + 1;
                
                let subtext = "";
                if (p1 === 6 && p2 === 1) subtext = "\n\n*Total devastation! Absolute critical smash!*";
                if (p1 === 1 && p2 === 1) subtext = "\n\n*Double snake eyes! Incredible disappointment for everyone.*";

                let outcomeText = p1 > p2 
                    ? `🏆 **${challenger.username}** wins the duel!` 
                    : p1 < p2 
                        ? `🏆 **${opponent.username}** wins the duel!` 
                        : "🎲 It's a dead heat flat tie!";

                const battleEmbed = new EmbedBuilder()
                    .setTitle(isCuteActive ? '✨ 🎲 DUEL RESULTS ✨' : '🎲 Duel Results')
                    .setDescription(`⚔️ The dice hit the floor and settle...\n\n🔴 **${challenger.username}** rolled: \`${p1}\`\n🔵 **${opponent.username}** rolled: \`${p2}\`\n\n${outcomeText}${subtext}`)
                    .setColor(isCuteActive ? '#FF69B4' : '#9B59B6')
                    .setFooter({ text: 'Duel settled instantly.' });

                return interaction.editReply({ content: ' ', embeds: [battleEmbed], components: [] }).catch(() => null);
            }
        });

        collector.on('end', (collected, reason) => {
            // Clean components safely upon timeout intervals
            if (reason === 'time') {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏳ Challenge Expired')
                    .setDescription(`The duel invitation from **${challenger.username}** to **${opponent.username}** expired with no response.`)
                    .setColor('#95A5A6');

                interaction.editReply({ content: ' ', embeds: [timeoutEmbed], components: [] }).catch(() => null);
            }
        });
    },

    async executePrefix(message, args, client) {
        const settings = db.readData('settings.json') || {};
        const currentGuildSettings = settings[message.guild?.id] || {};

        if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
            return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
        }

        // Target extractor emulating standard Slash lookups
        const targetOpponent = message.mentions.users.first();
        if (!targetOpponent) return message.reply('❌ Please mention a user to challenge! Example: `|dice-duel @user`').catch(() => null);

        // Hand over flow metrics directly into the contextual wrapper adapter
        const mockContextInteraction = {
            id: message.id,
            guildId: message.guild.id,
            interaction: message,
            user: message.author,
            member: message.member,
            options: { getUser: (name) => targetOpponent },
            reply: async (options) => message.reply(options),
            editReply: async (options) => {
                // Ensure it targets the original sent bot response to edit message states smoothly
                if (mockContextInteraction.sentBotMessage) {
                    return mockContextInteraction.sentBotMessage.edit(options);
                }
                return message.reply(options);
            }
        };

        // Capture initial response variable targets to map multi-stage button updates cleanly
        const targetCommand = client.commands.get('dice-duel');
        if (targetCommand) {
            // Overriding custom placeholder assignments to capture response reference values
            const originalReply = mockContextInteraction.reply;
            mockContextInteraction.reply = async (options) => {
                const responseRef = await originalReply(options);
                mockContextInteraction.sentBotMessage = responseRef;
                return responseRef;
            };

            await targetCommand.execute(mockContextInteraction).catch(err => console.error('Interactive duel runtime tracking error:', err));
        }
    }
};
