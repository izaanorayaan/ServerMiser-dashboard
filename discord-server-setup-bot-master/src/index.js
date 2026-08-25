require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const { Client, Collection, GatewayIntentBits, Partials, REST, Routes, ActivityType } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { pingBotList } = require('./utils/botListPinger');
const database = require('./utils/database');

const { syncCommandsToBotNexus, pushStatsToBotNexus } = require('./sync-botnexus-commands');
const { pingDashboard } = require('./utils/Dashboardstatspinger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.GuildMember,
    Partials.User,
  ],
});

client.commands = new Collection();

const rawToken = process.env.DISCORD_TOKEN || process.env.TOKEN || '';
const TOKEN = String(rawToken).trim();
const TOKEN_HAS_HIDDEN_WHITESPACE = /[\u200B\u00A0\t\r\n ]/.test(String(rawToken));

if (!TOKEN) {
  console.error('❌ [FATAL] DISCORD_TOKEN / TOKEN environment variable is not set.');
  process.exit(1);
}

console.log(`[DISCORD] Token present: true, length=${TOKEN.length}, hiddenWhitespace=${TOKEN_HAS_HIDDEN_WHITESPACE}`);

client.on('warn', (warning) => {
  console.warn(`[DISCORD WARN] ${warning}`);
});

client.on('error', (error) => {
  console.error('[DISCORD CLIENT ERROR]', error);
});

client.on('shardError', (error, shardId) => {
  console.error(`[WS ERROR] shard=${shardId}`, error);
});

client.on('shardDisconnect', (event, shardId) => {
  console.warn(`[WS DISCONNECT] shard=${shardId} code=${event?.code ?? 'n/a'} reason=${event?.reason ?? 'n/a'}`);
});

const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  console.log(`📂 [LOADER] Loading ${commandFiles.length} commands from ${commandsPath}`);

  for (const file of commandFiles) {
    try {
      const command = require(path.join(commandsPath, file));
      const name = command.name || command.data?.name;

      if (name) {
        client.commands.set(name.toLowerCase(), command);
        console.log(` ✅ Loaded command: ${name}`);

        if (command.init) {
          command.init(client);
        }
      }
    } catch (err) {
      console.error(` ❌ Failed to load ${file}:`, err.message);
    }
  }

  console.log(`✅ [LOADER] Total commands loaded: ${client.commands.size}`);
} else {
  console.error(`❌ [LOADER ERROR] Commands path not found at: ${commandsPath}`);
}

const eventsPath = path.join(__dirname, 'events');
const readyEventHandlers = [];
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
  console.log(`📂 [LOADER] Loading ${eventFiles.length} event files from ${eventsPath}`);

  for (const file of eventFiles) {
    const loaded = require(path.join(eventsPath, file));
    const eventList = Array.isArray(loaded) ? loaded : [loaded];

    for (const event of eventList) {
      if (!event || !event.name) {
        console.warn(` ⚠️ Skipping invalid event export in ${file}`);
        continue;
      }

      if (event.name === 'ready' || event.name === 'clientReady') {
        console.log(` ✅ Loaded event: ${event.name} (once) - will execute inline`);
        readyEventHandlers.push(event);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      console.log(` ✅ Loaded event: ${event.name}${event.once ? ' (once)' : ''}`);
    }
  }
}

let readyTimer = null;

client.once('ready', async () => {
  if (readyTimer) {
    clearTimeout(readyTimer);
    readyTimer = null;
  }

  console.log(`\n✅ [BOT ONLINE] ${client.user.tag} is live!`);
  console.log(` Guilds: ${client.guilds.cache.size}`);
  console.log(` Users: ${client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0)}`);
  console.log(` Ping: ${Math.round(client.ws.ping)}ms`);

  console.log('\n' + '='.repeat(60));
  console.log('🔄 [BOTNEXUS] Starting command sync...');
  console.log('='.repeat(60));

  try {
    await syncCommandsToBotNexus();
    console.log('✅ [BOTNEXUS] Command sync completed successfully!');
  } catch (err) {
    console.error('⚠️ [BOTNEXUS] Command sync failed (non-critical):', err.message);
  }
  console.log('='.repeat(60) + '\n');

  try {
    console.log('🔄 [DISCORD] Deploying slash commands to Discord...');
    const commandPayloads = [];
    for (const cmd of client.commands.values()) {
      if (cmd.data && typeof cmd.data.toJSON === 'function') {
        commandPayloads.push(cmd.data.toJSON());
      }
    }

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commandPayloads }
    );
    console.log(`✅ [DISCORD] Deployed ${commandPayloads.length} global command(s).`);
  } catch (err) {
    console.error('❌ [DISCORD] Command deployment failed:', err.message);
  }

  const selfVoice = client.commands.get('selfvoice');
  if (selfVoice?.startJanitor) {
    console.log('🔄 Starting Self Voice janitor...');
    selfVoice.startJanitor(client);
  }

  const giveawayCmd = client.commands.get('giveaway');
  if (giveawayCmd?.startScheduler) {
    console.log('🔄 Starting Giveaway scheduler...');
    giveawayCmd.startScheduler(client);
  }

  const birthdaysCmd = client.commands.get('birthdays');
  if (birthdaysCmd?.startScheduler) {
    console.log('🔄 Starting Birthday scheduler...');
    birthdaysCmd.startScheduler(client);
  }

  const invitesCmd = client.commands.get('invites');
  if (invitesCmd?.inviteCache != null) {
    console.log('🔄 Populating invite cache...');
    for (const guild of client.guilds.cache.values()) {
      try {
        const invites = await guild.invites.fetch();
        const guildMap = new Map();

        for (const invite of invites.values()) {
          guildMap.set(invite.code, {
            uses: invite.uses,
            inviterId: invite.inviter?.id || null,
            maxUses: invite.maxUses,
            expiresAt: invite.expiresAt,
          });
        }

        invitesCmd.inviteCache.set(guild.id, guildMap);
        console.log(` ✅ Cached ${invites.size} invites for ${guild.name}`);
      } catch (err) {
        console.error(` ❌ Failed to cache invites for ${guild.name}:`, err.message);
      }
    }
  }

  const buildStatuses = () => {
    const guildCount = client.guilds.cache.size;
    const userCount = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
    const ping = Math.max(0, Math.round(client.ws.ping));

    return [
      { text: 'go buy ServerMiser Premium yo i need this', type: ActivityType.Watching },
      { text: '1.99 dollars per week is actually not bad lol', type: ActivityType.Watching },
      { text: 'whop.com/servermiser/servermiser-premium work in progress don\'t blame me yo', type: ActivityType.Watching },
      { text: 'how can a server with 30 members have 239 cases.', type: ActivityType.Streaming },
      { text: 'yo uh, why is the moon blue..', type: ActivityType.Watching },
      { text: 'psst, hey you want some candy..', type: ActivityType.Listening },
      { text: 'your chats are so stupid man.', type: ActivityType.Watching },
      { text: '|help for noobs.', type: ActivityType.Playing },
      { text: 'i am the observer and i will always be observing', type: ActivityType.Watching },
      { text: "formal's new beat is peak", type: ActivityType.Listening },
      { text: 'in a coding match', type: ActivityType.Competing },
      { text: `over ${guildCount.toLocaleString()} servers`, type: ActivityType.Watching },
      { text: `${userCount.toLocaleString()} humans (and bots pretending)`, type: ActivityType.Watching },
      { text: 'servermiser.pntr.dev', type: ActivityType.Watching },
      { text: `at ${ping}ms ping, basically teleporting`, type: ActivityType.Competing },
      { text: 'therapist for your server\'s trust issues', type: ActivityType.Competing },
      { text: 'mute button go brrr', type: ActivityType.Playing },
      { text: 'setup wizard, not a real wizard', type: ActivityType.Playing },
      { text: 'the sound of 47 warnings being issued', type: ActivityType.Listening },
      { text: 'your mods sleep, I do not', type: ActivityType.Watching },
      { text: 'hide and seek with rule breakers', type: ActivityType.Playing },
      { text: 'to the tickets rolling in', type: ActivityType.Listening },
      { text: 'r/wallstreetbets but for XP', type: ActivityType.Watching },
      { text: 'use /setup, I dare you', type: ActivityType.Competing },
      { text: 'imaginary friend to lonely servers', type: ActivityType.Playing },
    ];
  };

  let statusIndex = 0;
  const updateStatus = () => {
    try {
      const statuses = buildStatuses();
      const current = statuses[statusIndex % statuses.length];
      client.user.setActivity(current.text, { type: current.type });
      statusIndex = (statusIndex + 1) % statuses.length;
    } catch (err) {
      // silently fail
    }
  };

  updateStatus();
  setInterval(updateStatus, 3 * 60 * 1000);

  console.log('\n📡 [TELEMETRY] Starting telemetry sync...');
  const sendStatsUpdate = () => {
    try {
      const serverCount = client.guilds.cache.size;
      const userCount = client.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);
      const shardCount = client.shard ? client.shard.count : 1;

      console.log(`📊 [TELEMETRY] Sending stats: ${serverCount} servers, ${userCount} users`);

      pingBotList(serverCount, userCount, shardCount);
      pushStatsToBotNexus(serverCount);
    } catch (syncErr) {
      // silently fail
    }
  };

  sendStatsUpdate();
  pingDashboard(client).catch(() => null);
  setInterval(sendStatsUpdate, 10 * 1000);
  setInterval(() => pingDashboard(client).catch(() => null), 10 * 1000);

  console.log('💻 [DASHBOARD] Starting dashboard metrics...');
  const fallbackDashboardUrl = 'https://servermiser.pntr.dev/api/bot-stats';
  const configuredDashboardUrl = process.env.DASHBOARD_URL;
  const dashboardUrl = (() => {
    if (!configuredDashboardUrl) return fallbackDashboardUrl;
    try {
      const url = new URL(configuredDashboardUrl);
      if (url.hostname.toLowerCase().includes('onrender.com') && url.hostname.toLowerCase().includes('discord-server-setup-bot')) {
        console.warn('⚠️ [DASHBOARD] Ignoring Render bot URL in DASHBOARD_URL and using the dashboard host instead.');
        return fallbackDashboardUrl;
      }
      return configuredDashboardUrl;
    } catch (error) {
      console.warn('⚠️ [DASHBOARD] Invalid DASHBOARD_URL configured; falling back to the dashboard host.');
      return fallbackDashboardUrl;
    }
  })();
  const statsApiKey = process.env.STATS_API_KEY;

  async function pushDashboardStats() {
    if (!statsApiKey) {
      console.warn('⚠️ [DASHBOARD] STATS_API_KEY not set, skipping dashboard sync');
      return;
    }

    try {
      const totalGuilds = client.guilds.cache.size;
      const totalMembers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
      const rawPing = client && client.ws && Number.isFinite(client.ws.ping) ? client.ws.ping : 0;
      const wsPing = Math.max(0, Math.round(rawPing));
      const shardCount = client.shard ? client.shard.count : 1;

      const uptimeMs = client.uptime || 0;
      const totalMinutes = Math.floor(uptimeMs / 60000);
      const days = Math.floor(totalMinutes / 1440);
      const hours = Math.floor((totalMinutes % 1440) / 60);
      const minutes = totalMinutes % 60;
      const uptime = `${days}d ${hours}h ${minutes}m`;

      const memoryUsage = process.memoryUsage();
      const ramUsage = `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`;

      const [counters, guildCategories, totalXp, totalTickets, dailySetups] = await Promise.all([
        database.getCounters().catch(() => ({})),
        database.getGuildCategories().catch(() => []),
        database.getTotalXp().catch(() => 0),
        database.getTotalTickets().catch(() => 0),
        database.getDailySetupCounts().catch(() => [0, 0, 0, 0, 0, 0, 0]),
      ]);

      const totalSetups = Number(counters.totalSetups || 0);
      const successfulSetups = Number(counters.successfulSetups || 0);

      const payload = {
        totalGuilds,
        totalMembers,
        wsPing,
        uptime,
        ramUsage,
        activeShards: `1 / ${shardCount}`,
        securityCompliance: '100%',
        totalTickets,
        totalXp,
        totalSetups,
        setupSuccessRate: totalSetups > 0 ? `${((successfulSetups / totalSetups) * 100).toFixed(1)}%` : '0%',
        ...(Array.isArray(guildCategories) && guildCategories.length > 0 ? { guildCategories } : {}),
        ...(Array.isArray(dailySetups) && dailySetups.length === 7 ? { dailySetups } : {}),
      };

      await fetch(dashboardUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${statsApiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      // silently fail
    }
  }

  pushDashboardStats();
  setInterval(pushDashboardStats, 10 * 1000);

  if (readyEventHandlers.length > 0) {
    console.log(`🔄 [READY EVENT] Executing ${readyEventHandlers.length} ready handler(s)...`);
    for (const readyEventHandler of readyEventHandlers) {
      if (readyEventHandler && typeof readyEventHandler.execute === 'function') {
        try {
          readyEventHandler.execute(client);
        } catch (err) {
          console.error('❌ [READY EVENT] Error executing ready handler:', err.message);
        }
      }
    }
  }
});

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
if (MONGO_URI) {
  console.log('📊 [DATABASE] Connecting to MongoDB...');
  mongoose.connect(MONGO_URI).then(() => {
    console.log('✅ [DATABASE] MongoDB connected.');
  }).catch(err => {
    console.error('❌ [DATABASE] MongoDB connection failed:', err.message);
  });
} else {
  console.warn('⚠️ [DATABASE] No MONGO_URI / MONGODB_URI found.');
}

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => res.json({ status: 'online', tag: client.user?.tag || 'starting' }));

app.get('/test/health', (_req, res) => {
  res.json({
    ok: true,
    status: 'online',
    uptime: process.uptime(),
    time: new Date().toISOString(),
    user: client.user?.tag || null,
    isReady: client.isReady(),
    wsStatus: client.ws?.status ?? null,
    wsReady: client.ws?.ready ?? null,
    guilds: client.guilds.cache.size,
  });
});

app.get('/test/discord-login', async (_req, res) => {
  const ws = client.ws;
  const payload = {
    ok: Boolean(TOKEN),
    tokenLength: TOKEN.length,
    tokenTrimmed: TOKEN !== (process.env.DISCORD_TOKEN || process.env.TOKEN || ''),
    hiddenWhitespace: TOKEN_HAS_HIDDEN_WHITESPACE,
    user: client.user?.tag || null,
    isReady: client.isReady(),
    wsStatus: ws?.status ?? null,
    wsReady: ws?.ready ?? null,
    envSource: process.env.DISCORD_TOKEN ? 'DISCORD_TOKEN' : (process.env.TOKEN ? 'TOKEN' : 'missing'),
  };

  try {
    const response = await fetch('https://discord.com/api/v10/gateway/bot', {
      method: 'GET',
      headers: { Authorization: `Bot ${TOKEN}` },
    });
    payload.gatewayHttpStatus = response.status;
    payload.gatewayHttpStatusText = response.statusText;
    payload.gatewayMessage = response.ok ? 'Discord API reachable' : 'Discord API responded with error';
  } catch (err) {
    payload.gatewayHttpStatus = null;
    payload.gatewayError = err.message || String(err);
    payload.gatewayMessage = 'Discord API unreachable from this environment';
  }

  res.json(payload);
});

app.listen(PORT, () => {
  console.log(`✅ [WEB] Keep-alive server running on port ${PORT}.`);
});

client.on('guildCreate', async (guild) => {
  console.log(`➕ [GUILD] Joined: ${guild.name} (${guild.id})`);

  const invitesCmd = client.commands.get('invites');
  if (!invitesCmd?.inviteCache) return;

  try {
    const invites = await guild.invites.fetch();
    const guildMap = new Map();

    for (const invite of invites.values()) {
      guildMap.set(invite.code, {
        uses: invite.uses,
        inviterId: invite.inviter?.id || null,
        maxUses: invite.maxUses,
        expiresAt: invite.expiresAt,
      });
    }

    invitesCmd.inviteCache.set(guild.id, guildMap);
    console.log(` ✅ Cached ${invites.size} invites for new guild ${guild.name}`);
  } catch (err) {
    console.error(` ❌ Failed to cache invites for ${guild.name}:`, err.message);
  }
});

process.on('unhandledRejection', (err) => {
  console.error('❌ [UNHANDLED REJECTION]', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ [UNCAUGHT EXCEPTION]', err);
});

let loginAttempts = 0;
const MAX_LOGIN_ATTEMPTS = 3;

const loginBot = async () => {
  loginAttempts += 1;
  console.log(`🔑 [DISCORD] Login attempt ${loginAttempts}/${MAX_LOGIN_ATTEMPTS}...`);

  if (readyTimer) clearTimeout(readyTimer);
  readyTimer = setTimeout(() => {
    if (!client.user) {
      console.warn('[DISCORD] Gateway did not become ready after 30s. Retrying login...');
      if (loginAttempts < MAX_LOGIN_ATTEMPTS) {
        client.destroy().catch(() => {});
        setTimeout(loginBot, 10000);
      } else {
        console.error('[DISCORD] Max login retries reached. Exiting.');
        process.exit(1);
      }
    }
  }, 30000);

  try {
    await client.login(TOKEN);
    if (readyTimer) {
      clearTimeout(readyTimer);
      readyTimer = null;
    }
  } catch (err) {
    console.error('❌ [FATAL] Login failed:', err.message || err);

    if (readyTimer) {
      clearTimeout(readyTimer);
      readyTimer = null;
    }

    if (loginAttempts < MAX_LOGIN_ATTEMPTS) {
      console.warn('[DISCORD] Retrying login in 10s...');
      setTimeout(loginBot, 10000);
      return;
    }

    console.error('❌ [DISCORD] Max login attempts reached. Exiting.');
    process.exit(1);
  }
};

console.log('🔑 [DISCORD] Logging in...');
loginBot();
