const discord = require('discord.js');
const db = require('../utils/database');
const UserLevel = require('../utils/models/UserLevel');
const formatter = require('../utils/textFormatter.js');
const mongoose = require('mongoose');

const xpCooldowns = new Map();

async function refreshStickyMessage(message, client) {
    try {
        if (!message?.guild || !message.channel || message.author.bot || message.webhookId) return;
        if (client && message.author.id === client.user?.id) return;

        const guildConfig = await db.findOne({ guildId: message.guild.id }).catch(() => null) || {};
        const sticky = guildConfig.sticky || {};

        if (!sticky?.channelId || sticky.channelId !== message.channel.id || !sticky.messageId) return;
        if (sticky.messageId === message.id) return;

        const targetChannel = message.guild.channels.cache.get(sticky.channelId) || await message.guild.channels.fetch(sticky.channelId).catch(() => null);
        if (!targetChannel || !targetChannel.isTextBased?.()) return;

        // Verify the old sticky message actually exists before trying to delete it
        let previousSticky;
        try {
            previousSticky = await targetChannel.messages.fetch(sticky.messageId);
        } catch (e) {
            // Message was already deleted, continue to post new sticky
        }

        // Delete the old sticky if it still exists
        if (previousSticky) {
            await previousSticky.delete().catch(() => null);
        }

        // Rebuild the exact payload that was originally sent
        let payload;
        if (sticky.style === 'embed') {
            payload = {
                embeds: [
                    new discord.EmbedBuilder()
                        .setColor(0x5865F2)
                        .setDescription(sticky.text || 'Sticky message')
                        .setFooter({ text: 'This is a sticky message' })
                ],
                allowedMentions: { parse: [] },
            };
        } else {
            // Plain message - use the exact stored content
            payload = {
                content: sticky.text || 'Sticky message',
                allowedMentions: { parse: [] },
            };
        }

        // Send the new sticky message
        const newSticky = await targetChannel.send(payload).catch((err) => {
            console.error('[sticky] Failed to send refresh message:', err.message);
            return null;
        });
        
        if (!newSticky) {
            console.error('[sticky] Failed to create new sticky message for guild', message.guild.id);
            return;
        }

        // Update the database with the new message ID
        await db.findOneAndUpdate(
            { guildId: message.guild.id },
            { $set: { 'sticky.messageId': newSticky.id, 'sticky.updatedAt': new Date().toISOString() } },
            { upsert: true }
        ).catch((err) => {
            console.error('[sticky] Failed to update database:', err.message);
        });
    } catch (error) {
        console.error('[sticky] Refresh failed:', error.message);
    }
}

// XP needed to go from `level` to `level + 1`. Must match level.js's
// xpNeededForLevel() so /level rank and the live XP engine agree.
function xpNeededForLevel(level) {
    return (level + 1) * 300;
}

module.exports = {
    name: discord.Events.MessageCreate,
    once: false,
    async execute(message, client) {
        try {
            // 1. Safety Gate: Completely ignore bots, webhooks, and empty contents
            if (!message || !message.author || message.author.bot || message.webhookId) return;
            if (message.author.id === client?.user?.id) return;

            await refreshStickyMessage(message, client);

            // ==========================================
            // 🛡️ BACKGROUND AUTOMOD CRITERIA MESSAGE SCANNER
            // ==========================================
            try {
                const HoneypotModel = mongoose.models.Honeypot;
                const honeypot = HoneypotModel && message.guild
                    ? await HoneypotModel.findOne({ guildId: message.guild.id, channelId: message.channel.id, enabled: true })
                    : null;
                if (honeypot && !message.member?.permissions.has(discord.PermissionFlagsBits.ManageMessages)) {
                    await message.delete().catch(() => null);
                    if (honeypot.messageType === 'embed') {
                        const warningEmbed = new discord.EmbedBuilder()
                            .setColor(honeypot.embedColor || '#ED4245')
                            .setTitle(honeypot.embedTitle || 'Honeypot triggered')
                            .setDescription(honeypot.message);
                        if (honeypot.embedFooter) warningEmbed.setFooter({ text: honeypot.embedFooter });
                        await message.channel.send({ embeds: [warningEmbed] }).then(sent => setTimeout(() => sent.delete().catch(() => null), 4000));
                    } else {
                        await message.channel.send({ content: honeypot.message }).then(sent => setTimeout(() => sent.delete().catch(() => null), 4000));
                    }
                    const action = honeypot.action || 'ban';
                    if (action === 'softban' && message.member?.bannable) {
                        await message.member.ban({ deleteMessageSeconds: honeypot.deleteMessages === false ? 0 : 604800, reason: 'Honeypot trap triggered (softban)' }).catch(() => null);
                        await message.guild.members.unban(message.author.id, 'Honeypot softban completed').catch(() => null);
                    } else if (action === 'ban' && message.member?.bannable) {
                        await message.member.ban({ deleteMessageSeconds: honeypot.deleteMessages === false ? 0 : 604800, reason: 'Honeypot trap triggered' }).catch(() => null);
                    } else if (action === 'kick' && message.member?.kickable) {
                        await message.member.kick('Honeypot trap triggered').catch(() => null);
                    } else if (action === 'mute' && message.member?.moderatable) {
                        await message.member.timeout(2419200000, 'Honeypot trap triggered').catch(() => null);
                    }
                    return;
                }
                const AutoModModel = mongoose.models.AutoModRule;
                const recentMessages = global.recentMessagesMap || (global.recentMessagesMap = new Map());
                const linkCooldowns = global.linkCooldownsMap || (global.linkCooldownsMap = new Map());
                const mentionCooldowns = global.mentionCooldownsMap || (global.mentionCooldownsMap = new Map());
                const stickerCooldowns = global.stickerCooldownsMap || (global.stickerCooldownsMap = new Map());

                if (AutoModModel && message.guild && !message.member?.permissions.has(discord.PermissionFlagsBits.ManageMessages)) {
                    const automodRules = await AutoModModel.find({ guildId: message.guild.id, enabled: true });
                    if (automodRules.length > 0) {

                        let violatesFilter = null;
                        const content = message.content || '';
                        const contentLower = content.toLowerCase();
                        const normalizedContent = contentLower.replace(/[^a-z]/g, '');
                        const now = Date.now();
                        const userKey = `${message.guild.id}-${message.author.id}`;

                        automodRules.forEach((rule) => {
                            if (!rule.enabled) return;

                            // 1. ALL CAPS
                            if (rule.filterType === 'all_caps' && content.length > 6) {
                                const letters = content.replace(/[^a-zA-Z]/g, '');
                                if (letters.length > 0 && letters === letters.toUpperCase()) violatesFilter = rule;
                            }
                            // 2. BAD WORDS
                            if (rule.filterType === 'bad_words') {
                                const blacklist = [
                                    'fuck', 'fucking', 'fucked', 'fk', 'fck', 'fuk', 'fuh', 'dih', 'dick',
                                    'shi', 'shit', 'shitty', 'sh1t', 'sh!t', 'foid',
                                    'bitch', 'bitches', 'b1tch', 'biatch', 'ass', 'asshole', 'bastard', 'damn',
                                    'crap', 'hell', 'motherfucker', 'motherfukker', 'mfer', 'nigga', 'niga', 'nga', 'nigger',
                                    'whore', 'slut', 'retard', 'cunt', 'rape', 'sexist', 'porn', 'sex'
                                ];

                                const normalizedBlacklist = blacklist.map(word => word.toLowerCase().replace(/[^a-z]/g, ''));
                                if (normalizedBlacklist.some(word => normalizedContent.includes(word))) {
                                    violatesFilter = rule;
                                }
                            }
                            // 3. CHAT CLEARING NEW LINES
                            if (rule.filterType === 'new_lines' && (content.match(/\n/g) || []).length > 8) {
                                violatesFilter = rule;
                            }
                            // 4. DUPLICATE TEXTS
                            if (rule.filterType === 'duplicate_texts') {
                                const userHistory = recentMessages.get(userKey) || [];
                                if (userHistory.includes(contentLower)) violatesFilter = rule;
                            }
                            // 5. CHARACTER COUNT
                            if (rule.filterType === 'character_count' && content.length > 1500) {
                                violatesFilter = rule;
                            }
                            // 6. EMOJI SPAM
                            if (rule.filterType === 'emoji_spam') {
                                const emojiMatch = content.match(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g);
                                if (emojiMatch && emojiMatch.length > 6) violatesFilter = rule;
                            }
                            // 7. FAST MESSAGE SPAM
                            if (rule.filterType === 'fast_spam') {
                                const timestamps = recentMessages.get(`${userKey}-times`) || [];
                                timestamps.push(now);
                                const activeBursts = timestamps.filter(t => now - t < 4000);
                                recentMessages.set(`${userKey}-times`, activeBursts);
                                if (activeBursts.length > 4) violatesFilter = rule;
                            }
                            // 8. IMAGE SPAM
                            if (rule.filterType === 'image_spam' && message.attachments.size > 3) {
                                violatesFilter = rule;
                            }
                            // 9. INVITE LINKS
                            if (rule.filterType === 'invite_links' && /(discord\.gg|discord\.com\/invite)/.test(contentLower)) {
                                violatesFilter = rule;
                            }
                            // 10. LINKS
                            if (rule.filterType === 'links' && /(https?:\/\/[^\s]+)/.test(contentLower)) {
                                violatesFilter = rule;
                            }
                            // 11. LINKS COOLDOWN
                            if (rule.filterType === 'links_cooldown' && /(https?:\/\/[^\s]+)/.test(contentLower)) {
                                const lastLink = linkCooldowns.get(userKey) || 0;
                                if (now - lastLink < 15000) violatesFilter = rule;
                                else linkCooldowns.set(userKey, now);
                            }
                            // 12. MASS MENTIONS
                            if (rule.filterType === 'mass_mentions' && (message.mentions.users.size + message.mentions.roles.size) > 4) {
                                violatesFilter = rule;
                            }
                            // 13. MENTIONS COOLDOWN
                            if (rule.filterType === 'mentions_cooldown' && (message.mentions.users.size > 0)) {
                                const lastMention = mentionCooldowns.get(userKey) || 0;
                                if (now - lastMention < 10000) violatesFilter = rule;
                                else mentionCooldowns.set(userKey, now);
                            }
                            // 14. SPOILERS
                            if (rule.filterType === 'spoilers' && content.includes('||')) {
                                violatesFilter = rule;
                            }
                            // 15. MASKED LINKS
                            if (rule.filterType === 'masked_links' && /\[.+?\]\(https?:\/\/[^\s]+\)/.test(contentLower)) {
                                violatesFilter = rule;
                            }
                            // 16. STICKERS
                            if (rule.filterType === 'stickers' && message.stickers.size > 0) {
                                violatesFilter = rule;
                            }
                            // 17. STICKERS COOLDOWN
                            if (rule.filterType === 'stickers_cooldown' && message.stickers.size > 0) {
                                const lastSticker = stickerCooldowns.get(userKey) || 0;
                                if (now - lastSticker < 12000) violatesFilter = rule;
                                else stickerCooldowns.set(userKey, now);
                            }
                            // 18. ZALGO TEXT
                            if (rule.filterType === 'zalgo_text' && /[\u0300-\u036F\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]{6,}/.test(content)) {
                                violatesFilter = rule;
                            }
                            // 19. KNOWN PHISHING LINKS
                            if (rule.filterType === 'phishing_links' && /(https?:\/\/[^\s]+)/.test(contentLower)) {
                                const phishingSignatures = [
                                    'dlscord-', 'discord-nitro', 'discorcl', 'discord-app', 'discords',
                                    'free-nitro', 'steam-nitro', 'boost-nitro', 'nitro-gift', 'giveaway-nitro',
                                    'cliscord', 'd1scord', 'gift-discord', 'nitro-drop', 'claim-nitro',
                                    'collab-land', 'metamask-security', 'phantom-wallet-update', 'airdrop-claim'
                                ];
                                if (phishingSignatures.some(sig => contentLower.includes(sig))) {
                                    violatesFilter = rule;
                                    if (!rule.actions.includes('block_message')) rule.actions.push('block_message');
                                    if (!rule.actions.includes('timeout_user')) rule.actions.push('timeout_user');
                                }
                            }
                            // 20. RAID BOT DEFENSES
                            if (rule.filterType === 'raid_bots') {
                                const isNewAccount = (now - message.author.createdTimestamp) < 432000000;
                                const containsMassLinks = (contentLower.match(/(https?:\/\/[^\s]+)/g) || []).length > 2;
                                const userHistory = recentMessages.get(userKey) || [];

                                if (isNewAccount && (containsMassLinks || userHistory.length >= 2)) {
                                    violatesFilter = rule;
                                    if (!rule.actions.includes('block_message')) rule.actions.push('block_message');
                                    if (message.member?.kickable && !rule.actions.includes('kick_user')) rule.actions.push('kick_user');
                                }
                            }
                        });

                        if (!violatesFilter) {
                            const history = recentMessages.get(userKey) || [];
                            history.push(contentLower);
                            if (history.length > 3) history.shift();
                            recentMessages.set(userKey, history);
                        } else {
                            if (violatesFilter.actions.includes('block_message')) {
                                await message.delete().catch(() => null);
                                await message.channel.send({ content: `⚠️ ${message.author}, flagged by AutoMod filter: **${violatesFilter.ruleName}**!` }).then(m => setTimeout(() => m.delete().catch(() => null), 4000));
                            }
                            if (violatesFilter.actions.includes('timeout_user') && message.member?.moderatable) {
                                await message.member.timeout(300000, `AutoMod Violation: ${violatesFilter.ruleName}`).catch(() => null);
                            }
                            if (violatesFilter.actions.includes('kick_user') && message.member?.kickable) {
                                await message.member.kick(`AutoMod Escalation: ${violatesFilter.ruleName}`).catch(() => null);
                            }
                            if (violatesFilter.actions.includes('log_to_channel')) {
                                const logChannel = message.guild.channels.cache.find(c => c.name.includes('mod-logs'));
                                if (logChannel) {
                                    const alert = new discord.EmbedBuilder()
                                        .setTitle('🚨 AutoMod Rule Violation Intercepted')
                                        .setColor('#ED4245')
                                        .setDescription(`User ${message.author} triggered safety filter \`${violatesFilter.filterType.toUpperCase()}\`.`)
                                        .setTimestamp();
                                    await logChannel.send({ embeds: [alert] }).catch(() => null);
                                }
                            }
                            return;
                        }
                    }
                }
            } catch (err) {
                console.error('[AutoMod Engine Scanner Error]:', err.message);
            }

            // ==========================================
            // BACKGROUND XP ENGINE
            // Uses the same UserLevel model and the same guild_config
            // store (db.findOne/findOneAndUpdate) that /level settings
            // actually reads and writes, so toggling leveling on/off,
            // the multiplier, channel, and rewards here now take effect.
            // ==========================================
            const guildId = message.guild?.id;
            if (!guildId) return;

            const guildConfig = await db.findOne({ guildId }).catch(() => null) || {};
            const levelConfig = guildConfig.levelConfig || {};

            if (!levelConfig.enabled) return;

            const cooldownKey = `${guildId}-${message.author.id}`;
            const now = Date.now();
            if (xpCooldowns.has(cooldownKey) && now < (xpCooldowns.get(cooldownKey) + 60000)) return;
            xpCooldowns.set(cooldownKey, now);

            const multiplier = levelConfig.multiplier || 1;
            const baseXp = Math.floor(Math.random() * 6) + 5;
            const xpGained = baseXp * multiplier;

            const userRecord = await UserLevel.findOneAndUpdate(
                { guildId, userId: message.author.id },
                { $inc: { xp: xpGained } },
                { upsert: true, new: true }
            ).catch(() => null);

            if (!userRecord) return;

            const oldLevel = userRecord.level || 0;
            let newLevel = oldLevel;
            let xp = userRecord.xp;

            // Climb thresholds, resetting xp to the remainder each time
            // (matches the original level-up-then-reset-to-0 behavior).
            while (xp >= xpNeededForLevel(newLevel)) {
                xp -= xpNeededForLevel(newLevel);
                newLevel += 1;
            }

            if (newLevel !== oldLevel || xp !== userRecord.xp) {
                userRecord.level = newLevel;
                userRecord.xp = xp;
                await userRecord.save().catch(() => null);
            }

            if (newLevel > oldLevel) {
                // --- HANDLE ROLE REWARDS ---
                const rewards = levelConfig.rewards || [];
                if (rewards.length > 0) {
                    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
                    if (member) {
                        for (const reward of rewards) {
                            if (reward.level <= newLevel) {
                                const role = message.guild.roles.cache.get(reward.roleId);
                                if (role && !member.roles.cache.has(role.id)) {
                                    await member.roles.add(role).catch(() => null);
                                }
                            }
                        }
                    }
                }

                // --- HANDLE CUSTOM LEVEL UP MESSAGE & PING ---
                const pingUser = levelConfig.pingUser !== false; // Default to true
                const pingContent = pingUser ? `${message.author}` : `🎉 ${message.author.username} just leveled up!`;

                let customText = levelConfig.levelUpText || `🎉 **Level Up!** ${message.author} has reached **Level ${newLevel}**! ✨`;
                customText = customText.replace(/{user}/g, message.author.toString())
                                       .replace(/{level}/g, newLevel)
                                       .replace(/{oldlevel}/g, oldLevel);

                let cuteStyle = 'off';
                try {
                    const cuteData = (await db.readData('cute.json')) || {};
                    cuteStyle = cuteData[guildId] || 'off';
                } catch (e) {}
                const isCuteActive = cuteStyle !== 'off';

                const embed = new discord.EmbedBuilder()
                    .setColor(isCuteActive ? '#FF69B4' : '#00FF00')
                    .setTitle(isCuteActive ? '✨ LEVEL UP! ✨' : '🎉 Level Up!')
                    .setDescription(customText)
                    .setThumbnail(message.author.displayAvatarURL({ dynamic: true }));

                let targetChannelId = levelConfig.channelId || null;
                let targetChannel = message.channel;
                if (targetChannelId) {
                    try {
                        targetChannel = message.guild.channels.cache.get(targetChannelId) ||
                            await message.guild.channels.fetch(targetChannelId) ||
                            message.channel;
                    } catch (fetchError) {
                        targetChannel = message.channel;
                    }
                }

                if (levelConfig.cardStyle === 'card') {
                    try {
                        const levelCommand = client.commands.get('level');
                        const card = await levelCommand.generateLevelUpCard(message.author, oldLevel, newLevel);
                        await targetChannel.send({ content: pingContent, files: [card] }).catch(() => null);
                    } catch (cardError) {
                        console.error('[Leveling] Card generation failed, falling back to embed:', cardError.message);
                        await targetChannel.send({ content: pingContent, embeds: [embed] }).catch(() => null);
                    }
                } else {
                    await targetChannel.send({ content: pingContent, embeds: [embed] }).catch(() => null);
                }
            }

            // ==========================================
            // 🔄 BACKGROUND AUTOMATION INTEGRATION LOOPS
            // ==========================================
            try {
                const autoDeleteModule = client.commands.get('autodelete') || require('./commands/moderation/autodelete.js');
                if (autoDeleteModule && typeof autoDeleteModule.trackAndQueueDeletion === 'function') {
                    await autoDeleteModule.trackAndQueueDeletion(message);
                }
            } catch (automationErr) {
                console.error('[Automation Background Integration Loop Error]:', automationErr.message);
            }

        } catch (globalError) {
            console.error('XP Global Catch Error:', globalError);
        }
    },
};