const { MessageFlags } = require('discord.js');
const db = require('../utils/database');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        const activeClient = client || interaction.client;
        const cid = interaction.customId || '';

        // ========================================================
        // A. ONBOARDING VERIFICATION ROUTER
        // ========================================================
        if (cid.startsWith('verify_')) {
            const cmd = activeClient.commands.get('verification');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return;
        }

        // ========================================================
        // B. STATS ANALYTICS WIZARD
        // ========================================================
        if (cid.startsWith('analytics_')) {
            const cmd = activeClient.commands.get('analytics');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return;
        }

        // ========================================================
        // C. TICKET SYSTEM
        // ========================================================
        if (cid.startsWith('ticket_system_')) {
            const cmd = activeClient.commands.get('ticket');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return;
        }

        // ========================================================
        // E. SELF VOICE
        // ========================================================
        if (cid.startsWith('selfvoice_')) {
            const cmd = activeClient.commands.get('selfvoice');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return;
        }

        // ========================================================
        // F. AUTO RESPONDER
        // ========================================================
        if (cid.startsWith('autoresponder_')) {
            const cmd = activeClient.commands.get('autoresponder');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return;
        }

        // ========================================================
        // F2. STARBOARD WIZARD
        // ========================================================
        if (cid.startsWith('starboard_')) {
            const cmd = activeClient.commands.get('starboard');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return interaction.deferUpdate().catch(() => null);
        }

        // ========================================================
        // G. SUGGESTIONS (vote buttons + staff modals)
        // ========================================================
        if (cid.startsWith('suggestions_')) {
            const cmd = activeClient.commands.get('suggestions');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return interaction.deferUpdate().catch(() => null);
        }

        // ========================================================
        // H. GIVEAWAY (entry button + modals)
        // ========================================================
        if (cid.startsWith('giveaway_')) {
            const cmd = activeClient.commands.get('giveaway');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return interaction.deferUpdate().catch(() => null);
        }

        // ========================================================
        // I. EMBED BUILDER (preview buttons + modals)
        // ========================================================
        if (cid.startsWith('embed_')) {
            const cmd = activeClient.commands.get('embed');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return interaction.deferUpdate().catch(() => null);
        }

        // ========================================================
        // I2. POLLS (vote buttons/select + close button)
        // ========================================================
        if (cid.startsWith('poll_')) {
            const cmd = activeClient.commands.get('poll');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return interaction.deferUpdate().catch(() => null);
        }

        // ========================================================
        // J. BIRTHDAY WIZARD
        // ========================================================
        if (cid.startsWith('birthday_wizard_')) {
            const cmd = activeClient.commands.get('birthdays');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return interaction.deferUpdate().catch(() => null);
        }

        // ========================================================
        // K. INVITE TRACKING WIZARD
        // ========================================================
        if (cid.startsWith('invites_wizard_')) {
            const cmd = activeClient.commands.get('invites');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return interaction.deferUpdate().catch(() => null);
        }

        // ========================================================
        // L. CAPABILITIES MENU
        // ========================================================
        if (cid === 'capabilities_select') {
            const cmd = activeClient.commands.get('capabilities');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return interaction.deferUpdate().catch(() => null);
        }

        // ========================================================
        // M. RULES CUSTOMIZATION
        // ========================================================
        if (cid.startsWith('rules_')) {
            const cmd = activeClient.commands.get('rules');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return interaction.deferUpdate().catch(() => null);
        }

        // ========================================================
        // K. MODAL SAFETY NET (any remaining unmatched modals)
        // ========================================================
        if (typeof interaction.isModalSubmit === 'function' && interaction.isModalSubmit()) {
            // Already handled by the prefixed sections above; silently ack anything that falls through
            return interaction.deferUpdate?.().catch(() => null);
        }

        // ========================================================
        // REACTION ROLES FALLBACK (buttons & selects not matched above)
        // ========================================================
        if (interaction.isButton() || interaction.isStringSelectMenu()) {
            const cmd = activeClient.commands.get('reactionroles');
            if (cmd?.handleInteraction) return await cmd.handleInteraction(interaction, activeClient);
            return;
        }

        // ========================================================
        // L. SLASH COMMAND ENGINE
        // ========================================================
        if (!interaction.isChatInputCommand()) return;

        const commandName = interaction.commandName;
        if (!commandName) return;

        const command = activeClient.commands.get(commandName.toLowerCase());
        if (!command) {
            console.warn(`[WARNING] Received slash interaction for /${commandName}, but it is not registered.`);
            return;
        }

        const mainSettings = (await db.readData('settings.json')) || {};
        const currentGuildSettings = mainSettings[interaction.guildId] || {};

        const coreUtilityCommands = [
            'setup', 'cute', 'fun-module', 'help', 'setup-audit',
            'mod-logs-toggle', 'reactionroles', 'autorole', 'automodrule',
            'ticket', 'verification', 'leaderboard', 'rank', 'analytics',
            'selfvoice', 'autoresponder', 'capabilities', 'stickies', 'channels', 'rules',
            // new modules
            'starboard', 'suggestions', 'giveaway', 'embed', 'birthdays', 'invites', 'poll',
        ];

        if (!coreUtilityCommands.includes(commandName.toLowerCase())) {
            if (
                currentGuildSettings.funModule === 'disabled' ||
                currentGuildSettings.funModule === false ||
                currentGuildSettings.funModule === 'off'
            ) {
                return interaction.reply({
                    content: '❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.',
                    flags: [MessageFlags.Ephemeral],
                }).catch(() => null);
            }
        }

        try {
            if (typeof command.executeSlash === 'function') {
                await command.executeSlash(interaction, activeClient);
            } else if (typeof command.execute === 'function') {
                await command.execute(interaction, activeClient);
            }
        } catch (error) {
            console.error(`❌ Slash Command Error [/${commandName}]:`, error);
            const errorPayload = {
                content: '❌ There was an internal error executing this command!',
                flags: [MessageFlags.Ephemeral],
            };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorPayload).catch(() => null);
            } else {
                await interaction.reply(errorPayload).catch(() => null);
            }
        }
    },
};