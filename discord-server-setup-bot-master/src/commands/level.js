const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const database = require('../utils/database');
const UserLevel = require('../utils/models/UserLevel');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// @napi-rs/canvas bundles its own text-rendering engine, so unlike
// node-canvas it doesn't depend on the host having Cairo/FreeType/
// fontconfig installed or working correctly — this is what actually
// fixes text silently failing to render on minimal hosts like Render.
try {
    const registered = GlobalFonts.registerFromPath(
        path.join(__dirname, '..', 'assets', 'fonts', 'LevelFont.ttf'),
        'LevelFont'
    );
    console.log('[Leveling] Card font registered:', registered);
} catch (fontError) {
    console.error('[Leveling] Failed to register card font — level-up card text may not render:', fontError.message);
}

// XP needed to go from `level` to `level + 1`. Matches the linear
// scaling used by the background XP engine in messageCreate.js.
function xpNeededForLevel(level) {
    return (level + 1) * 300;
}

// --- Helper: Generate Level Up Card ---
async function generateLevelUpCard(user, oldLevel, newLevel) {
    const canvas = createCanvas(700, 250);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2B2D31';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#5865F2';
    ctx.fillRect(0, 0, 10, canvas.height);

    try {
        const avatarURL = user.displayAvatarURL({ extension: 'png', size: 128 });
        const avatarResponse = await fetch(avatarURL);
        const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
        const avatar = await loadImage(avatarBuffer);
        ctx.save();
        ctx.beginPath();
        ctx.arc(125, 125, 75, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 50, 50, 150, 150);
        ctx.restore();
        ctx.strokeStyle = '#5865F2';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(125, 125, 75, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.stroke();
    } catch (e) {
        console.error('Canvas Avatar Error:', e);
    }

    const drawCenteredText = (text, y, font, color) => {
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.fillText(text, 450, y);
    };

    drawCenteredText('CONGRATS!', 80, 'bold 40px LevelFont', '#FFFFFF');
    drawCenteredText(`@${user.username}`, 130, 'bold 30px LevelFont', '#FFFFFF');
    drawCenteredText(`Level ${oldLevel}  =>  Level ${newLevel}`, 200, 'bold 50px LevelFont', '#5865F2');

    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'levelup.png' });
}

module.exports = {
    generateLevelUpCard,
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Leveling system commands')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // Applied to the main command

        // Public Commands
        .addSubcommand(sub =>
            sub.setName('rank')
                .setDescription('Show your or another user\'s rank and XP')
                .addUserOption(opt => opt.setName('user').setDescription('User to check (defaults to you)').setRequired(false))
        )
        .addSubcommand(sub => sub.setName('leaderboard').setDescription('Show the top 10 users by XP'))

        // Admin Configuration
        .addSubcommand(sub => sub.setName('settings').setDescription('Configure leveling settings'))
        .addSubcommand(sub => sub.setName('multiplier').setDescription('Set a server-wide XP multiplier (e.g., 2 for Double XP)').addIntegerOption(opt => opt.setName('amount').setDescription('Multiplier amount (1-10)').setRequired(true).setMinValue(1).setMaxValue(10)))

        // Admin XP Management Group
        .addSubcommandGroup(group =>
            group.setName('xp').setDescription('Manage user XP')
                .addSubcommand(sub => sub.setName('add').setDescription('Add XP to a user').addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true)).addIntegerOption(opt => opt.setName('amount').setDescription('Amount of XP').setRequired(true).setMinValue(1)))
                .addSubcommand(sub => sub.setName('remove').setDescription('Remove XP from a user').addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true)).addIntegerOption(opt => opt.setName('amount').setDescription('Amount of XP').setRequired(true).setMinValue(1)))
                .addSubcommand(sub => sub.setName('set').setDescription('Set a user\'s exact XP').addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true)).addIntegerOption(opt => opt.setName('amount').setDescription('Exact XP amount').setRequired(true).setMinValue(0)))
                .addSubcommand(sub => sub.setName('reset').setDescription('Reset a user\'s XP and Level').addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true)))
        ),

    name: 'level',
    prefix: '|level',

    async execute(interaction, client) {
        // Permission check for admin commands
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand();
        const adminCommands = ['settings', 'multiplier', 'xp'];

        if (adminCommands.includes(subcommand) || adminCommands.includes(subcommandGroup)) {
            if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: '❌ You need **Manage Server** permissions to use this command.', ephemeral: true }).catch(() => null);
            }
        }

        const { guild } = interaction;

        try {
            if (subcommand === 'rank') return await this.handleRankCommand(interaction, interaction.options.getUser('user')?.id, client);
            if (subcommand === 'leaderboard') return await this.handleLeaderboardCommand(interaction);
            if (subcommand === 'settings') return await this.handleSettingsCommand(interaction);

            if (subcommand === 'multiplier') {
                const amount = interaction.options.getInteger('amount');
                await database.findOneAndUpdate({ guildId: guild.id }, { $set: { 'levelConfig.multiplier': amount } }, { upsert: true }).catch(() => null);
                const embed = new EmbedBuilder().setColor('#5865F2').setTitle('✅ XP Multiplier Updated').setDescription(`Users will now earn **${amount}x** the normal amount of XP per message!`);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (subcommandGroup === 'xp') {
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('amount') || 0;

                if (subcommand === 'add') {
                    const guildConfig = await database.findOne({ guildId: guild.id }).catch(() => null);
                    const multiplier = guildConfig?.levelConfig?.multiplier || 1;
                    const finalAmount = amount * multiplier;

                    const record = await UserLevel.findOneAndUpdate(
                        { guildId: guild.id, userId: targetUser.id },
                        { $inc: { xp: finalAmount } },
                        { upsert: true, new: true }
                    );
                    await this.recomputeLevel(record);

                    const embed = new EmbedBuilder().setColor('#57F287').setTitle('✅ XP Added').setDescription(`Added **${finalAmount} XP** to ${targetUser.username}.\n*(Server Multiplier applied: ${multiplier}x)*`);
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }
                if (subcommand === 'remove') {
                    const record = await UserLevel.findOneAndUpdate(
                        { guildId: guild.id, userId: targetUser.id },
                        { $inc: { xp: -amount } },
                        { upsert: true, new: true }
                    );
                    if (record.xp < 0) {
                        record.xp = 0;
                        await record.save();
                    }
                    const embed = new EmbedBuilder().setColor('#ED4245').setTitle('✅ XP Removed').setDescription(`Removed **${amount} XP** from ${targetUser.username}.`);
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }
                if (subcommand === 'set') {
                    const record = await UserLevel.findOneAndUpdate(
                        { guildId: guild.id, userId: targetUser.id },
                        { $set: { xp: amount } },
                        { upsert: true, new: true }
                    );
                    await this.recomputeLevel(record);
                    const embed = new EmbedBuilder().setColor('#5865F2').setTitle('✅ XP Set').setDescription(`Set ${targetUser.username}'s XP to exactly **${amount}**.`);
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }
                if (subcommand === 'reset') {
                    await UserLevel.findOneAndUpdate(
                        { guildId: guild.id, userId: targetUser.id },
                        { $set: { xp: 0, level: 0 } },
                        { upsert: true }
                    );
                    const embed = new EmbedBuilder().setColor('#ED4245').setTitle('🔄 XP Reset').setDescription(`${targetUser.username}'s XP and Level have been reset to 0.`);
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }
            }
        } catch (error) {
            console.error('Level command error:', error);
            if (interaction.deferred || interaction.replied) return interaction.editReply({ content: '❌ An error occurred.' }).catch(() => null);
            return interaction.reply({ content: '❌ An error occurred.', ephemeral: true }).catch(() => null);
        }
    },

    // Recomputes `level` from `xp` using the same linear thresholds
    // (300 * (level+1) per level) as the background XP engine, then
    // saves the record if the level changed. Handles admin XP set/add
    // adjustments that jump across multiple level thresholds at once.
    async recomputeLevel(record) {
        let level = record.level || 0;
        let xp = record.xp || 0;
        while (xp >= xpNeededForLevel(level)) {
            level += 1;
        }
        if (level !== record.level) {
            record.level = level;
            await record.save();
        }
        return record;
    },

    // --- Prefix Command Handler ---
    // NOTE: not currently invoked directly — prefix commands are routed
    // through messageCreate.js's mockInteraction into execute() above.
    // Kept here in case that routing changes.
    async executePrefix(message, args, client) {
        const subcommand = args[0]?.toLowerCase();

        if (!subcommand || subcommand === 'help') {
            return message.reply('Usage: `|level rank [@user]`, `|level leaderboard`, `|level settings`');
        }

        const mockInteraction = {
            deferReply: async () => {},
            editReply: async (content) => message.reply(content),
            reply: async (content) => message.reply(content),
            guild: message.guild,
            member: message.member,
            user: message.author,
            client: client,
            channel: message.channel,
            options: {
                getSubcommand: () => subcommand,
                getUser: (name) => message.mentions.users.first(),
                getInteger: (name) => parseInt(args[2]),
                getSubcommandGroup: () => args[0]?.toLowerCase() === 'xp' ? 'xp' : null
            }
        };

        if (subcommand === 'xp') {
            const xpAction = args[1]?.toLowerCase();
            mockInteraction.options.getSubcommand = () => xpAction;
            return this.execute(mockInteraction, client);
        }

        return this.execute(mockInteraction, client);
    },

    // --- Handlers ---

    async handleRankCommand(interaction, targetUserId, client) {
        const guild = interaction.guild;
        let targetUser;
        if (targetUserId) {
            targetUser = await client.users.fetch(targetUserId).catch(() => null);
            if (!targetUser) return interaction.reply({ content: '❌ User not found.', ephemeral: true }).catch(() => null);
        } else {
            targetUser = interaction.user;
        }

        const userRecord = await UserLevel.findOne({ guildId: guild.id, userId: targetUser.id }).lean().catch(() => null);
        const xp = userRecord?.xp || 0;
        const level = userRecord?.level || 0;

        const rank = await UserLevel.countDocuments({ guildId: guild.id, xp: { $gt: xp } }).catch(() => 0);

        const xpForNextLevel = xpNeededForLevel(level);
        const xpProgress = xp; // xp resets to 0 on level-up in this schema, so xp IS the progress
        const progressPercent = xpForNextLevel > 0 ? Math.floor((xpProgress / xpForNextLevel) * 100) : 0;

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📊 ${targetUser.username}'s Rank`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'Rank', value: `#${rank + 1}`, inline: true },
                { name: 'Level', value: `${level}`, inline: true },
                { name: 'XP', value: `${xp}`, inline: true },
                { name: 'Progress to Next Level', value: `${xpProgress}/${xpForNextLevel} XP (${progressPercent}%)` }
            );
        return interaction.reply({ embeds: [embed] }).catch(() => null);
    },

    async handleLeaderboardCommand(interaction) {
        const users = await UserLevel.find({ guildId: interaction.guild.id, xp: { $gt: 0 } })
            .sort({ level: -1, xp: -1 })
            .limit(10)
            .lean()
            .catch(() => null) || [];

        if (users.length === 0) {
            const embed = new EmbedBuilder().setColor('#99AAB5').setTitle('🏆 XP Leaderboard').setDescription('No users with XP yet.');
            return interaction.reply({ embeds: [embed] }).catch(() => null);
        }
        const leaderboard = users.map((u, i) => `**${i + 1}.** <@${u.userId}> — **Level ${u.level || 0}** (${u.xp} XP)`).join('\n');
        const embed = new EmbedBuilder().setColor('#FAA61A').setTitle('🏆 XP Leaderboard').setDescription(leaderboard);
        return interaction.reply({ embeds: [embed] }).catch(() => null);
    },

    async handleSettingsCommand(interaction) {
        const config = await database.findOne({ guildId: interaction.guild.id }).catch(() => null) || {};
        const levelConfig = config.levelConfig || {};

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('⚙️ Leveling Settings')
            .setDescription('Select an option below to configure the leveling system.')
            .addFields(
                { name: 'Status', value: levelConfig.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                { name: 'Announcement Channel', value: levelConfig.channelId ? `<#${levelConfig.channelId}>` : 'Not set', inline: true },
                { name: 'Level-Up Style', value: levelConfig.cardStyle === 'card' ? '🎨 Visual Card' : '📝 Text Message', inline: true },
                { name: 'Ping on Level-Up', value: levelConfig.pingUser ? '🔔 Yes' : '🔕 No', inline: true },
                { name: 'XP Multiplier', value: `${levelConfig.multiplier || 1}x`, inline: true },
                { name: 'Role Rewards', value: levelConfig.rewards?.length ? `${levelConfig.rewards.length} configured` : 'None configured', inline: true },
                { name: 'Custom Level-Up Text', value: levelConfig.levelUpText ? `\`\`\`${levelConfig.levelUpText}\`\`\`` : 'Not set', inline: false }
            );

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('level_settings_menu')
                .setPlaceholder('Choose a setting to configure...')
                .addOptions([
                    { label: 'Toggle Status', value: 'toggle_status', description: 'Enable or disable leveling' },
                    { label: 'Set Announcement Channel', value: 'set_channel', description: 'Where level-up messages are sent' },
                    { label: 'Set Level-Up Style', value: 'set_style', description: 'Visual Card vs Text Message' },
                    { label: 'Toggle Ping on Level-Up', value: 'toggle_ping', description: 'Ping the user when they level up' },
                    { label: 'Set Custom Level-Up Text', value: 'set_text', description: 'Customize the level-up message' },
                    { label: 'Manage Role Rewards', value: 'manage_rewards', description: 'Add or remove role rewards' }
                ])
        );

        return interaction.reply({ embeds: [embed], components: [row] });
    },

    // --- Interaction Handler (Dropdowns & Buttons) ---
    async handleInteraction(interaction, client) {
        if (!interaction.isStringSelectMenu() && !interaction.isButton() && !interaction.isModalSubmit()) return;
        const id = interaction.customId;

        try {
            // These two must run BEFORE deferUpdate() — showModal()/reply()
            // must be the first response to an interaction.
            if (interaction.isStringSelectMenu() && id === 'level_settings_menu' && interaction.values[0] === 'set_text') {
                const config = await database.findOne({ guildId: interaction.guild.id }).catch(() => null) || {};
                const currentText = config.levelConfig?.levelUpText || 'Congratulations {user}! You reached Level {level}!';
                const modal = new ModalBuilder().setCustomId('level_text_modal').setTitle('Set Custom Level-Up Text');
                const textInput = new TextInputBuilder()
                    .setCustomId('levelUpText')
                    .setLabel("Enter the message. Use {user} and {level}")
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(currentText)
                    .setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(textInput));
                return interaction.showModal(modal);
            }

            if (interaction.isButton() && id === 'level_reward_add') {
                return interaction.reply({ content: '➕ **Add Reward**\nPlease type the level and mention the role in this format:\n`<level> @role`\nExample: `10 @Verified`', ephemeral: true }).then(() => {
                    const filter = m => m.author.id === interaction.user.id;
                    interaction.channel.awaitMessages({ filter, max: 1, time: 60000, errors: ['time'] })
                        .then(async collected => {
                            const msg = collected.first();
                            const args = msg.content.split(' ');
                            const level = parseInt(args[0]);
                            const role = msg.mentions.roles.first();
                            if (!level || !role) return msg.reply('❌ Invalid format.');
                            await database.findOneAndUpdate({ guildId: interaction.guild.id }, { $push: { 'levelConfig.rewards': { level, roleId: role.id } } }, { upsert: true }).catch(() => null);
                            msg.reply(`✅ Added reward: **Level ${level}** -> ${role.name}`);
                        }).catch(() => interaction.followUp({ content: '❌ Timed out.', ephemeral: true }).catch(() => null));
                }).catch(() => null);
            }

            if (interaction.isStringSelectMenu() || interaction.isButton()) {
                await interaction.deferUpdate().catch(() => {});
            }

            if (id === 'level_settings_menu') {
                const selection = interaction.values[0];
                if (selection === 'toggle_status') {
                    const config = await database.findOne({ guildId: interaction.guild.id }).catch(() => null) || {};
                    const newState = !(config.levelConfig?.enabled ?? false);
                    await database.findOneAndUpdate({ guildId: interaction.guild.id }, { $set: { 'levelConfig.enabled': newState, 'levelConfig.status': newState ? 'on' : 'off' } }, { upsert: true }).catch(() => null);
                    return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#57F287').setTitle('✅ Updated').setDescription(`Leveling system is now **${newState ? 'ENABLED' : 'DISABLED'}**.`)], components: [] }).catch(() => null);
                }
                if (selection === 'toggle_ping') {
                    const config = await database.findOne({ guildId: interaction.guild.id }).catch(() => null) || {};
                    const newState = !(config.levelConfig?.pingUser ?? true);
                    await database.findOneAndUpdate({ guildId: interaction.guild.id }, { $set: { 'levelConfig.pingUser': newState } }, { upsert: true }).catch(() => null);
                    return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#57F287').setTitle('✅ Updated').setDescription(`Level-up pings are now **${newState ? 'ENABLED' : 'DISABLED'}**.`)], components: [] }).catch(() => null);
                }
                if (selection === 'set_channel') {
                    const channels = interaction.guild.channels.cache.filter(c => c.type === 0).first(24);
                    if (!channels.length) return interaction.editReply({ content: '❌ No text channels found.', embeds: [], components: [] }).catch(() => null);
                    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('level_set_channel_menu').setPlaceholder('Select a channel...').addOptions(channels.map(c => ({ label: `#${c.name}`.slice(0, 90), value: c.id }))));
                    return interaction.editReply({ content: '📢 **Select Announcement Channel**', embeds: [], components: [row] }).catch(() => null);
                }
                if (selection === 'set_style') {
                    const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('level_set_style_menu').setPlaceholder('Select level-up style...').addOptions([ { label: '🎨 Visual Card', value: 'card', description: 'Generate an image card' }, { label: '📝 Text Message', value: 'text', description: 'Send a standard text message' } ]));
                    return interaction.editReply({ content: '🎨 **Select Level-Up Style**', embeds: [], components: [row] }).catch(() => null);
                }
                if (selection === 'manage_rewards') {
                    const config = await database.findOne({ guildId: interaction.guild.id }).catch(() => null) || {};
                    const rewards = config.levelConfig?.rewards || [];
                    const rewardList = rewards.length > 0 ? rewards.map(r => `• Level ${r.level}: <@&${r.roleId}>`).join('\n') : 'No rewards configured yet.';
                    const embed = new EmbedBuilder().setColor('#5865F2').setTitle('🎁 Manage Role Rewards').setDescription(rewardList);
                    const row1 = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('level_reward_add').setLabel('Add Reward').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('level_reward_remove').setLabel('Remove Reward').setStyle(ButtonStyle.Danger).setDisabled(rewards.length === 0)
                    );
                    const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('level_settings_back').setLabel('Back to Settings').setStyle(ButtonStyle.Secondary));
                    return interaction.editReply({ embeds: [embed], components: [row1, row2] }).catch(() => null);
                }
            }

            if (id === 'level_set_channel_menu') {
                const channelId = interaction.values[0];
                await database.findOneAndUpdate({ guildId: interaction.guild.id }, { $set: { 'levelConfig.channelId': channelId } }, { upsert: true }).catch(() => null);
                return interaction.editReply({ content: `✅ Announcement channel set to <#${channelId}>.`, embeds: [], components: [] }).catch(() => null);
            }

            if (id === 'level_set_style_menu') {
                const style = interaction.values[0];
                await database.findOneAndUpdate({ guildId: interaction.guild.id }, { $set: { 'levelConfig.cardStyle': style } }, { upsert: true }).catch(() => null);
                return interaction.editReply({ content: `✅ Level-up style set to **${style === 'card' ? 'Visual Card' : 'Text Message'}**.`, embeds: [], components: [] }).catch(() => null);
            }

            if (id === 'level_text_modal') {
                const text = interaction.fields.getTextInputValue('levelUpText');
                await database.findOneAndUpdate({ guildId: interaction.guild.id }, { $set: { 'levelConfig.levelUpText': text } }, { upsert: true }).catch(() => null);
                return interaction.reply({ content: `✅ Custom level-up text updated!`, ephemeral: true }).catch(() => null);
            }

            if (id === 'level_reward_remove') {
                const config = await database.findOne({ guildId: interaction.guild.id }).catch(() => null) || {};
                const rewards = config.levelConfig?.rewards || [];
                if (rewards.length === 0) return interaction.editReply({ content: '❌ No rewards to remove.', embeds: [], components: [] }).catch(() => null);
                const row = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('level_reward_remove_menu').setPlaceholder('Select a reward to remove...').addOptions(rewards.map(r => ({ label: `Level ${r.level}`, value: `${r.level}` }))));
                return interaction.editReply({ content: '➖ **Remove Reward**', embeds: [], components: [row] }).catch(() => null);
            }

            if (id === 'level_reward_remove_menu') {
                const levelToRemove = parseInt(interaction.values[0]);
                await database.findOneAndUpdate({ guildId: interaction.guild.id }, { $pull: { 'levelConfig.rewards': { level: levelToRemove } } }, { upsert: true }).catch(() => null);
                return interaction.editReply({ content: `✅ Removed reward for **Level ${levelToRemove}**.`, embeds: [], components: [] }).catch(() => null);
            }

            if (id === 'level_settings_back') {
                const config = await database.findOne({ guildId: interaction.guild.id }).catch(() => null) || {};
                const levelConfig = config.levelConfig || {};
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('⚙️ Leveling Settings')
                    .setDescription('Select an option below to configure the leveling system.')
                    .addFields(
                        { name: 'Status', value: levelConfig.enabled ? '✅ Enabled' : '❌ Disabled', inline: true },
                        { name: 'Announcement Channel', value: levelConfig.channelId ? `<#${levelConfig.channelId}>` : 'Not set', inline: true },
                        { name: 'Level-Up Style', value: levelConfig.cardStyle === 'card' ? '🎨 Visual Card' : '📝 Text Message', inline: true },
                        { name: 'Ping on Level-Up', value: levelConfig.pingUser ? '🔔 Yes' : '🔕 No', inline: true },
                        { name: 'XP Multiplier', value: `${levelConfig.multiplier || 1}x`, inline: true },
                        { name: 'Role Rewards', value: levelConfig.rewards?.length ? `${levelConfig.rewards.length} configured` : 'None configured', inline: true },
                        { name: 'Custom Level-Up Text', value: levelConfig.levelUpText ? `\`\`\`${levelConfig.levelUpText}\`\`\`` : 'Not set', inline: false }
                    );
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('level_settings_menu')
                        .setPlaceholder('Choose a setting to configure...')
                        .addOptions([
                            { label: 'Toggle Status', value: 'toggle_status', description: 'Enable or disable leveling' },
                            { label: 'Set Announcement Channel', value: 'set_channel', description: 'Where level-up messages are sent' },
                            { label: 'Set Level-Up Style', value: 'set_style', description: 'Visual Card vs Text Message' },
                            { label: 'Toggle Ping on Level-Up', value: 'toggle_ping', description: 'Ping the user when they level up' },
                            { label: 'Set Custom Level-Up Text', value: 'set_text', description: 'Customize the level-up message' },
                            { label: 'Manage Role Rewards', value: 'manage_rewards', description: 'Add or remove role rewards' }
                        ])
                );
                return interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
            }

        } catch (err) {
            console.error('Level settings interaction error:', err);
        }
    },

    // --- Level Up Logic ---
    // NOTE: this is currently dead code — the actual leveling engine
    // lives in messageCreate.js (Part B) and messageCreateLeveling.js,
    // neither of which calls this. See note below.
    async checkLevelUp(userId, guildId, client) {
        const userRecord = await UserLevel.findOne({ guildId, userId }).catch(() => null);
        if (!userRecord || !userRecord.xp) return;
        const oldLevel = userRecord.level || 0;
        await this.recomputeLevel(userRecord);
        const newLevel = userRecord.level;
        if (newLevel <= oldLevel) return;

        const config = await database.findOne({ guildId }).catch(() => null);
        const levelConfig = config?.levelConfig;
        if (!levelConfig?.enabled) return;

        const rewards = levelConfig.rewards || [];
        const guild = client.guilds.cache.get(guildId);
        const member = guild?.members.cache.get(userId);
        if (member && rewards.length > 0) {
            for (const reward of rewards) {
                if (reward.level <= newLevel) {
                    const role = guild.roles.cache.get(reward.roleId);
                    if (role && !member.roles.cache.has(role.id)) await member.roles.add(role).catch(() => null);
                }
            }
        }

        if (levelConfig.channelId) {
            const channel = guild?.channels.cache.get(levelConfig.channelId);
            if (channel) {
                const user = client.users.cache.get(userId);
                const pingContent = levelConfig.pingUser ? `${user}` : `🎉 ${user.username} just leveled up!`;
                let customText = levelConfig.levelUpText || 'Congratulations {user}! You reached Level {level}!';
                customText = customText.replace(/{user}/g, user.toString()).replace(/{level}/g, newLevel).replace(/{oldlevel}/g, oldLevel);
                if (levelConfig.cardStyle === 'card') {
                    try {
                        const card = await generateLevelUpCard(user, oldLevel, newLevel);
                        await channel.send({ content: pingContent, files: [card] }).catch(() => null);
                    } catch(e) {
                        const embed = new EmbedBuilder().setColor('#57F287').setTitle('🎉 Level Up!').setDescription(customText);
                        await channel.send({ content: pingContent, embeds: [embed] }).catch(() => null);
                    }
                } else {
                    const embed = new EmbedBuilder().setColor('#57F287').setTitle('🎉 Level Up!').setDescription(customText);
                    await channel.send({ content: pingContent, embeds: [embed] }).catch(() => null);
                }
            }
        }
    }
};