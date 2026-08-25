const { Events, ActivityType } = require('discord.js');
// 💥 LINK THE UTILITY: Directly reference your custom analytics file
const { pingBotList } = require('../utils/botListPinger');

module.exports = {
  name: Events.ClientReady, // Correctly bound to your system's V14 event lifecycle handler
  once: true,
  execute(client) {
    console.log(`\n==================================================`);
    console.log(`✅ Success! Bot is live and serving as ${client.user.tag}`);
    console.log(`==================================================\n`);

    // ==========================================
    // MODULE A: HIGH-OCTANE ACTIVITY ROTATOR LOOP 🔄
    // ==========================================
    const statuses = [
      { text: '|help for noobs.', type: ActivityType.Playing },
      { text: 'i am the observer and i will always be observing', type: ActivityType.Watching },
      { text: "formal's new beat is peak", type: ActivityType.Listening },
      { text: 'in a coding match', type: ActivityType.Competing }
    ];

    let currentIndex = 0;

    const updateStatus = () => {
      try {
        const current = statuses[currentIndex];
        client.user.setActivity(current.text, { type: current.type });
        console.log(`[STATUS] Changed activity banner to: "${current.text}"`);
        
        currentIndex = (currentIndex + 1) % statuses.length;
      } catch (err) {
        console.error('❌ [STATUS ERROR] Activity rotator assignment issue:', err.message);
      }
    };

    // Initialize presence instantly on server boot
    updateStatus();
    // Rotates the custom activity banner every 12 hours
    setInterval(updateStatus, 43200000);

    // ==========================================
    // MODULE B: RSDASH AUTOMATED TELEMETRY SYNC 📡
    // ==========================================
    console.log('📡 Igniting automated API telemetry engine for rsdash.net...');

    const sendStatsUpdate = () => {
        try {
            const serverCount = client.guilds.cache.size;
            
            // Sums total members across all servers dynamically out of your cache grid
            const userCount = client.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);
            
            // Auto-checks for Shard Managers, defaults to 1 if a standard process single instance
            const shardCount = client.shard ? client.shard.count : 1; 

            console.log(`📊 Collecting matrix metrics... (Servers: ${serverCount} | Users: ${userCount} | Shards: ${shardCount})`);
            
            // Fire the native HTTPS script
            pingBotList(serverCount, userCount, shardCount);
        } catch (syncErr) {
            console.error('❌ [TELEMETRY ERROR] Failure gathering local metrics:', syncErr.message);
        }
    };

    // ⚡ Strike 1: Push statistics immediately the moment the process hooks into Discord
    sendStatsUpdate();

    // ⏰ Routine Sync: Keep charts flawless with an updated backend push every 30 minutes
    setInterval(sendStatsUpdate, 30 * 60 * 1000); 


    // ==========================================
    // MODULE C: SERVERMISER DASHBOARD TELEMETRY SYNC 💻
    // ==========================================
    console.log('💻 Launching internal metrics loop for your web dashboard...');

    // Full URL including the actual endpoint path — this must point to the dashboard backend,
    // not the Render bot service itself. If an old Render URL is still stuck in the env, ignore it.
    const fallbackDashboardUrl = 'https://servermiser.pntr.dev/api/bot-stats';
    const configuredDashboardUrl = process.env.DASHBOARD_URL;
    const dashboardUrl = (() => {
      if (!configuredDashboardUrl) return fallbackDashboardUrl;
      try {
        const url = new URL(configuredDashboardUrl);
        if (url.hostname.toLowerCase().includes('onrender.com') && url.hostname.toLowerCase().includes('discord-server-setup-bot')) {
          console.warn('[Dashboard] Ignoring Render bot URL in DASHBOARD_URL and using the dashboard host instead.');
          return fallbackDashboardUrl;
        }
        return configuredDashboardUrl;
      } catch (error) {
        console.warn('[Dashboard] Invalid DASHBOARD_URL configured; falling back to the dashboard host.');
        return fallbackDashboardUrl;
      }
    })();
    const apiKey = process.env.STATS_API_KEY;

    async function pushDashboardStats() {
      if (!apiKey) {
        console.warn('[Dashboard] Missing STATS_API_KEY environment variable. Skipping dashboard sync.');
        return;
      }

      try {
        const totalGuilds = client.guilds.cache.size;
        const totalMembers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
        const wsPing = Math.max(0, Math.round(client.ws.ping));
        const shardCount = client.shard ? client.shard.count : 1;

        // Format uptime as "Nd Nh Nm" to match what the dashboard expects/displays
        const uptimeMs = client.uptime || 0;
        const totalMinutes = Math.floor(uptimeMs / 60000);
        const days = Math.floor(totalMinutes / 1440);
        const hours = Math.floor((totalMinutes % 1440) / 60);
        const minutes = totalMinutes % 60;
        const uptime = `${days}d ${hours}h ${minutes}m`;

        // Format RAM usage as a display string, e.g. "142 MB"
        const memoryUsage = process.memoryUsage();
        const ramUsageMb = Math.round(memoryUsage.rss / 1024 / 1024);
        const ramUsage = `${ramUsageMb} MB`;

        const payload = {
          totalGuilds,
          totalMembers,
          wsPing,
          uptime,
          ramUsage,
          activeShards: `1 / ${shardCount}`,
          securityCompliance: "100%"
          // Optional fields you can add once you track them:
          // totalTickets, totalXp, totalSetups, setupSuccessRate, genTime,
          // guildCategories: [{ name, count, color, desc }],
          // dailySetups: [mon, tue, wed, thu, fri, sat, sun]
        };

        const response = await fetch(dashboardUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new Error(`Dashboard API rejected request with status: ${response.status} ${body}`);
        }

        console.log(`✅ [Dashboard] Stats pushed successfully. (Servers: ${totalGuilds} | Users: ${totalMembers} | Ping: ${wsPing}ms)`);
      } catch (error) {
        console.error('🚨 [Dashboard Error] Failed to push data to website:', error.message);
      }
    }

    // Push right away when the bot loads
    pushDashboardStats();

    // Repeat every 5 minutes to keep charts updated
    setInterval(pushDashboardStats, 5 * 60 * 1000);

    // ==========================================
    // MODULE D: ANALYTICS AUTO-UPDATE EVERY MINUTE 📊
    // ==========================================
    console.log('📊 Launching analytics auto-refresh loop...');

    const autoUpdateAnalytics = async () => {
      try {
        const mongoose = require('mongoose');
        const AnalyticsModel = mongoose.models.AnalyticsRule;
        
        if (!AnalyticsModel) return;

        // Find all guilds with analytics enabled
        const allAnalytics = await AnalyticsModel.find({ enabled: true }).catch(() => []);
        
        if (allAnalytics.length === 0) return;

        for (const doc of allAnalytics) {
          try {
            const guild = client.guilds.cache.get(doc.guildId);
            if (!guild) continue;

            const totalMembers = guild.memberCount || 0;
            let totalBots = 0;
            try {
              const members = await guild.members.fetch();
              totalBots = members.filter((m) => m.user.bot).size || 0;
            } catch (fetchErr) {
              totalBots = guild.members.cache.filter((m) => m.user.bot).size || 0;
            }
            const totalHumans = Math.max(0, totalMembers - totalBots);

            // Update total members channel
            if (doc.totalChannelId) {
              const tc = guild.channels.cache.get(doc.totalChannelId);
              if (tc) await tc.setName(`👥 Total Members: ${totalMembers}`).catch(() => null);
            }

            // Update humans channel
            if (doc.humansChannelId) {
              const hc = guild.channels.cache.get(doc.humansChannelId);
              if (hc) await hc.setName(`🙋 Humans: ${totalHumans}`).catch(() => null);
            }

            // Update bots channel
            if (doc.botsChannelId) {
              const bc = guild.channels.cache.get(doc.botsChannelId);
              if (bc) await bc.setName(`🤖 Bots: ${totalBots}`).catch(() => null);
            }
          } catch (guildErr) {
            // Silently continue if one guild fails
          }
        }
      } catch (err) {
        console.error('[Analytics Auto-Update Error]:', err.message);
      }
    };

    const warmMemberCache = async () => {
      for (const guild of client.guilds.cache.values()) {
        await guild.members.fetch().catch(() => null);
      }
    };

    // Warm the full member cache before the first run so bot/human totals
    // are accurate immediately on startup instead of waiting for the first timer cycle.
    warmMemberCache().catch(() => null);

    // Update analytics immediately on startup
    autoUpdateAnalytics();

    // Auto-update every 60 seconds (1 minute)
    setInterval(autoUpdateAnalytics, 60 * 1000);
  },
};