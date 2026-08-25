const { Events } = require('discord.js');
const mongoose = require('mongoose');

function buildLabels(style, totalMembers, totalHumans, totalBots) {
  if (style === 'tech') {
    return {
      categoryName: '⚙️ DATA CORE ──',
      totalLabel: `├ 🛰️ ALL FIELDS: ${totalMembers}`,
      humansLabel: `├ 👥 POPULATION: ${totalHumans}`,
      botsLabel: `└ 🤖 CONNECTORS: ${totalBots}`,
    };
  }

  if (style === 'secure') {
    return {
      categoryName: '🔒 PROTECTION METRICS',
      totalLabel: `🔒 Verified Node: ${totalMembers}`,
      humansLabel: `🔒 Human Access: ${totalHumans}`,
      botsLabel: `🔒 Core Apps: ${totalBots}`,
    };
  }

  return {
    categoryName: '📊 SERVER STATS',
    totalLabel: `👥 Total Members: ${totalMembers}`,
    humansLabel: `🙋 Humans: ${totalHumans}`,
    botsLabel: `🤖 Bots: ${totalBots}`,
  };
}

async function getMemberCounts(guild) {
  const totalMembers = guild.memberCount || 0;

  let totalBots = 0;
  try {
    const members = await guild.members.fetch();
    totalBots = members.filter((m) => m.user.bot).size || 0;
  } catch (err) {
    totalBots = guild.members.cache.filter((m) => m.user.bot).size || 0;
  }

  const totalHumans = Math.max(0, totalMembers - totalBots);
  return { totalMembers, totalBots, totalHumans };
}

async function runLiveAnalyticsSync(guild) {
  if (!guild) return;

  try {
    const AnalyticsModel = mongoose.models.AnalyticsRule;
    if (!AnalyticsModel) return;

    const doc = await AnalyticsModel.findOne({ guildId: guild.id }).catch(() => null);
    if (!doc || !doc.enabled || !doc.categoryId) return;

    const { totalMembers, totalBots, totalHumans } = await getMemberCounts(guild);
    const { categoryName, totalLabel, humansLabel, botsLabel } = buildLabels(
      doc.labelStyle || 'clean',
      totalMembers,
      totalHumans,
      totalBots
    );

    const category = guild.channels.cache.get(doc.categoryId);
    if (category && category.name !== categoryName) {
      await category.setName(categoryName).catch(() => null);
    }

    if (doc.totalChannelId) {
      const totalChannel = guild.channels.cache.get(doc.totalChannelId);
      if (totalChannel && totalChannel.name !== totalLabel) {
        await totalChannel.setName(totalLabel).catch(() => null);
      }
    }

    if (doc.humansChannelId) {
      const humansChannel = guild.channels.cache.get(doc.humansChannelId);
      if (humansChannel && humansChannel.name !== humansLabel) {
        await humansChannel.setName(humansLabel).catch(() => null);
      }
    }

    if (doc.botsChannelId) {
      const botsChannel = guild.channels.cache.get(doc.botsChannelId);
      if (botsChannel && botsChannel.name !== botsLabel) {
        await botsChannel.setName(botsLabel).catch(() => null);
      }
    }
  } catch (err) {
    console.error('[Analytics Event Sync Error]:', err.message);
  }
}

async function preloadGuildMembers(client) {
  if (!client?.guilds?.cache) return;

  for (const guild of client.guilds.cache.values()) {
    await guild.members.fetch().catch(() => null);
  }
}

async function refreshAllAnalyticsGuilds(client) {
  if (!client?.guilds?.cache) return;

  for (const guild of client.guilds.cache.values()) {
    await runLiveAnalyticsSync(guild);
  }
}

module.exports = [
  {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
      await preloadGuildMembers(client);
      await refreshAllAnalyticsGuilds(client);
      setInterval(() => refreshAllAnalyticsGuilds(client).catch(() => null), 60 * 1000);
    },
  },
  {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member) {
      await runLiveAnalyticsSync(member.guild);
    },
  },
  {
    name: Events.GuildMemberRemove,
    once: false,
    async execute(member) {
      await runLiveAnalyticsSync(member.guild);
    },
  },
  {
    name: Events.GuildUpdate,
    once: false,
    async execute(oldGuild, newGuild) {
      if (oldGuild.premiumSubscriptionCount !== newGuild.premiumSubscriptionCount) {
        await runLiveAnalyticsSync(newGuild);
      }
    },
  },
  {
    name: Events.RoleCreate,
    once: false,
    async execute(role) {
      await runLiveAnalyticsSync(role.guild);
    },
  },
  {
    name: Events.RoleDelete,
    once: false,
    async execute(role) {
      await runLiveAnalyticsSync(role.guild);
    },
  },
];
