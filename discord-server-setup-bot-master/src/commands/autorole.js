const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// ==========================================
// 1. EMBEDDED MONGOOSE DATABASE SCHEMA
// ==========================================
const AutoRoleSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    allRole: { type: String, default: null },   // Role ID for everyone
    humanRole: { type: String, default: null }, // Role ID for humans
    botRole: { type: String, default: null }    // Role ID for bots
});

const AutoRole = mongoose.models.AutoRole || mongoose.model('AutoRole', AutoRoleSchema);

// ==========================================
// 2. HELPER ROLE ID RESOLVER
// ==========================================
function targetRoleID(input, guild) {
    if (!input) return null;
    
    // Check if input is a direct Mention (<@&1234...>) or raw ID
    const cleanId = input.replace(/[^0-9]/g, '');
    if (guild.roles.cache.has(cleanId)) return cleanId;
    
    // Check if input is a Role Name (case-insensitive search)
    const foundRole = guild.roles.cache.find(r => r.name.toLowerCase() === input.toLowerCase());
    return foundRole ? foundRole.id : null;
}

// ==========================================
// 3. CENTRALIZED SUBCOMMAND ROUTER
// ==========================================
async function runSubcommand(interactionOrMessage, subCommand, roleInput, isSlash = false) {
    const guild = interactionOrMessage.guild;
    const guildId = guild.id;

    // Abstract responses to work uniformly across message strings and interactive payloads
    const reply = async (payload) => {
        if (isSlash) {
            return interactionOrMessage.deferred ? interactionOrMessage.editReply(payload) : interactionOrMessage.reply(payload);
        }
        return interactionOrMessage.channel.send(payload);
    };

    // SUBCOMMAND: ALL
    if (subCommand === 'all') {
        const roleId = targetRoleID(roleInput, guild);
        if (!roleId) return reply({ content: '❌ Provide a valid role name, role mention, or numerical role ID.' });
        
        await AutoRole.findOneAndUpdate({ guildId }, { allRole: roleId }, { upsert: true });
        return reply({ content: `✅ **AutoRole Configured:** All joining profiles will receive <@&${roleId}>.` });
    }

    // SUBCOMMAND: HUMANS
    if (subCommand === 'humans') {
        const roleId = targetRoleID(roleInput, guild);
        if (!roleId) return reply({ content: '❌ Provide a valid role name, role mention, or numerical role ID.' });
        
        await AutoRole.findOneAndUpdate({ guildId }, { humanRole: roleId }, { upsert: true });
        return reply({ content: `✅ **AutoRole Configured:** Human accounts joining will receive <@&${roleId}>.` });
    }

    // SUBCOMMAND: BOTS
    if (subCommand === 'bots') {
        const roleId = targetRoleID(roleInput, guild);
        if (!roleId) return reply({ content: '❌ Provide a valid role name, role mention, or numerical role ID.' });
        
        await AutoRole.findOneAndUpdate({ guildId }, { botRole: roleId }, { upsert: true });
        return reply({ content: `✅ **AutoRole Configured:** Automated bot applications joining will receive <@&${roleId}>.` });
    }

    // SUBCOMMAND: ONGOING-AUTOROLES
    if (subCommand === 'ongoing') {
        const config = await AutoRole.findOne({ guildId });
        if (!config || (!config.allRole && !config.humanRole && !config.botRole)) {
            return reply({ content: '📭 There are currently no active ongoing automated role sessions configured.' });
        }

        const embed = new EmbedBuilder()
            .setTitle('📋 Ongoing Server AutoRole Configurations')
            .setColor('#5865F2')
            .addFields(
                { name: '👤 Everyone Session', value: config.allRole ? `<@&${config.allRole}>` : '`Disabled`', inline: true },
                { name: '🌱 Humans Session', value: config.humanRole ? `<@&${config.humanRole}>` : '`Disabled`', inline: true },
                { name: '🤖 Bots Session', value: config.botRole ? `<@&${config.botRole}>` : '`Disabled`', inline: true }
            );

        return reply({ embeds: [embed] });
    }

    // SUBCOMMAND: DELETE
    if (subCommand === 'delete') {
        const config = await AutoRole.findOne({ guildId });
        if (!config) return reply({ content: '❌ No active automated sessions found to purge.' });

        await AutoRole.deleteOne({ guildId });

        const embed = new EmbedBuilder()
            .setTitle('🗑️ AutoRole Configurations Purged')
            .setColor('#ED4245')
            .setDescription('All active ongoing automations for everyone, bots, and humans have been completely removed.')
            .addFields(
                { name: 'Everyone Session', value: '🔴 Cleared', inline: true },
                { name: 'Humans Session', value: '🔴 Cleared', inline: true },
                { name: 'Bots Session', value: '🔴 Cleared', inline: true }
            );

        return reply({ embeds: [embed] });
    }
}

// ==========================================
// 4. EXPORTED DISCORD.JS COMMAND INTERFACE
// ==========================================
module.exports = {
    // Slash Configuration Definition mapping core
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Manage automated member role configurations on join.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub => sub.setName('all').setDescription('Apply role to everyone').addRoleOption(opt => opt.setName('role').setDescription('Target role').setRequired(true)))
        .addSubcommand(sub => sub.setName('humans').setDescription('Apply role to humans only').addRoleOption(opt => opt.setName('role').setDescription('Target role').setRequired(true)))
        .addSubcommand(sub => sub.setName('bots').setDescription('Apply role to bots only').addRoleOption(opt => opt.setName('role').setDescription('Target role').setRequired(true)))
        .addSubcommand(sub => sub.setName('ongoing').setDescription('Inspect current active configurations'))
        .addSubcommand(sub => sub.setName('delete').setDescription('Purge all ongoing configs for everyone, bots, and humans')),

    // Handles text prefix operations (|autorole <subcommand> [role])
    async executePrefix(message, args) {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return;

        const subCommand = args[0]?.toLowerCase();
        const roleInput = args.slice(1).join(' ');

        const viableSubCommands = ['all', 'humans', 'bots', 'ongoing', 'delete'];
        if (!viableSubCommands.includes(subCommand)) {
            return message.channel.send('❌ **Usage:** `|autorole <all/humans/bots/ongoing/delete> [role]`');
        }

        await runSubcommand(message, subCommand, roleInput, false);
    },

    async executeSlash(interaction) {
        await interaction.deferReply();
        const subCommand = interaction.options.getSubcommand();
        
        // Fix: Safely extract the ID string directly so targetRoleID doesn't fail on Slash selections
        const roleOption = interaction.options.getRole('role');
        const roleInput = roleOption ? roleOption.id : null;

        await runSubcommand(interaction, subCommand, roleInput, true);
    }
};
