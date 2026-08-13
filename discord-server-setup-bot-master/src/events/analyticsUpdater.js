const { Events } = require('discord.js');
const mongoose = require('mongoose');

// Shared multi-event logic handler loop
async function runLiveAnalyticsSync(guild) {
    if (!guild) return;

    try {
        // Access your compiled Mongoose stats tracker model out of application cache streams
        const AnalyticsModel = mongoose.models.AnalyticsRule;
        if (!AnalyticsModel) return;

        const doc = await AnalyticsModel.findOne({ guildId: guild.id });
        if (!doc || !doc.enabled || !doc.channelId) return;

        const counterChannel = guild.channels.cache.get(doc.channelId);
        if (!counterChannel) return;

        // Calculate live matching numerical metrics
        let calculatedValue = guild.memberCount;
        if (doc.metricType === 'organic_humans') {
            calculatedValue = guild.members.cache.filter(m => !m.user.bot).size || guild.memberCount;
        } else if (doc.metricType === 'total_bots') {
            calculatedValue = guild.members.cache.filter(m => m.user.bot).size || 0;
        } else if (doc.metricType === 'booster_count') {
            calculatedValue = guild.premiumSubscriptionCount || 0;
        } else if (doc.metricType === 'active_roles') {
            calculatedValue = guild.roles.cache.size || 0;
        }

        const expectedName = `${doc.customLabel} ${calculatedValue}`;

        // Prevent unnecessary Discord API rate limits by checking names first
        if (counterChannel.name !== expectedName) {
            await counterChannel.setName(expectedName).catch(() => null);
            await counterChannel.setPosition(0).catch(() => null); // Re-enforce top priority sort anchoring position
        }
    } catch (err) {
        console.error('[Analytics Event Sync Error]:', err.message);
    }
}

// Binds all required event hooks uniformly to the single update engine
module.exports = [
    {
        name: Events.GuildMemberAdd,
        once: false,
        async execute(member) { await runLiveAnalyticsSync(member.guild); }
    },
    {
        name: Events.GuildMemberRemove,
        once: false,
        async execute(member) { await runLiveAnalyticsSync(member.guild); }
    },
    {
        name: Events.GuildUpdate,
        once: false,
        async execute(oldGuild, newGuild) { 
            // Fired if server boost levels scale or slide downwards
            if (oldGuild.premiumSubscriptionCount !== newGuild.premiumSubscriptionCount) {
                await runLiveAnalyticsSync(newGuild);
            }
        }
    },
    {
        name: Events.RoleCreate,
        once: false,
        async execute(role) { await runLiveAnalyticsSync(role.guild); }
    },
    {
        name: Events.RoleDelete,
        once: false,
        async execute(role) { await runLiveAnalyticsSync(role.guild); }
    }
];
