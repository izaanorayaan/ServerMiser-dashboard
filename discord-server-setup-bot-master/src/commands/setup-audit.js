const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../utils/database.js'); // Points back to your native helper wrapper

module.exports = {
    name: 'setup-audit',
    description: 'Configure, enable, or disable the server audit log channel.',
    data: new SlashCommandBuilder()
        .setName('setup-audit')
        .setDescription('Configure, enable, or disable the server audit log channel.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option.setName('action')
                .setDescription('Select whether to enable or disable the audit log engine')
                .setRequired(true)
                .addChoices(
                    { name: 'Enable Logs', value: 'enable' },
                    { name: 'Disable Logs', value: 'disable' }
                )
        )
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The target channel to send logs to (Required if enabling)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        ),

    async execute(interaction) {
        const isInteraction = interaction.isCommand ? interaction.isCommand() : false;

        // Extend interaction token lifetime right away to stop timeout crashes
        if (isInteraction) {
            await interaction.deferReply().catch(() => null);
        }

        const guildId = interaction.guildId;
        const actionOption = isInteraction ? interaction.options.getString('action') : interaction.options.getString('action');
        const channelOption = isInteraction ? interaction.options.getChannel('channel') : interaction.options.getChannel('channel');

        // Fetch current active server settings through your specific dynamic adapter format
        const settings = (await db.readData('settings.json')) || {};
        if (!settings[guildId]) settings[guildId] = {};

        if (actionOption === 'disable') {
            settings[guildId].auditChannelId = null;
            await db.writeData('settings.json', settings);

            const msg = '🛑 Audit logs have been successfully disabled for this server.';
            return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
        }

        if (actionOption === 'enable') {
            if (!channelOption) {
                const msg = '❌ Please specify a target channel to send logs to! Usage: `/setup-audit action:Enable Logs channel:#channel`';
                return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
            }

            settings[guildId].auditChannelId = channelOption.id;
            await db.writeData('settings.json', settings);

            const msg = `✅ Audit logs have been successfully enabled and routed to ${channelOption}!`;
            return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
        }
    },

    async executePrefix(message, argsArray, client) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ You need **Manage Server** or **Administrator** permissions to use this command!").catch(() => null);
        }

        const action = argsArray && argsArray[0] ? argsArray[0].toLowerCase().trim() : null;
        if (action !== 'enable' && action !== 'disable') {
            return message.reply('❌ Usage: `|setup-audit enable #channel` or `|setup-audit disable`.').catch(() => null);
        }

        const targetChannel = message.mentions.channels.first() || (argsArray && argsArray[1] ? message.guild.channels.cache.get(argsArray[1]) : null);

        // Build a mock interaction options setup mirroring the core slash subcommands
        const mockInteraction = {
            guild: message.guild,
            guildId: message.guild.id,
            member: message.member,
            user: message.author,
            options: {
                getString: (name) => action,
                getChannel: (name) => targetChannel
            },
            reply: async (options) => message.reply(options)
        };

        await this.execute(mockInteraction).catch(err => console.error('Error handling inline setup-audit prefix wrapper:', err));
    }
};
