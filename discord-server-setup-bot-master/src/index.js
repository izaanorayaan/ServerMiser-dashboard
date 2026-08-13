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
let readyEventHandler = null;
if (fs.existsSync(eventsPath)) {
  const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));
  console.log(`📂 [LOADER] Loading ${eventFiles.length} events from ${eventsPath}`);
  
  for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    
    if (event.name === 'ready' || event.name === 'clientReady') {
      console.log(` ✅ Loaded event: ${event.name} (once) - will execute inline`);
      readyEventHandler = event;
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

client.once('ready', async () => {
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

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
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

  // FIX: Populate invite cache properly
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
      { text: 'whop.com/servermiser/servermiser-premium work in progress don\'t blame me yo', type: ActivityType.Watching},
      { text: 'how can a server with 30 members have 239 cases.', type: ActivityType.Streaming},
      { text: 'yo uh, why is the moon blue..', type: ActivityType.Watching},
      { text: 'psst, hey you want some candy..', type: ActivityType.Listening},
      { text: 'your chats are so stupid man.', type: ActivityType.Watching},
      { text: '|help for noobs.', type: ActivityType.Playing },
      { text: 'i am the observer and i will always be observing', type: ActivityType.Watching },
      { text: "formal's new beat is peak", type: ActivityType.Listening },
      { text: 'in a coding match', type: ActivityType.Competing },
      { text: `over ${guildCount.toLocaleString()} servers`, type: ActivityType.Watching },
      { text: `${userCount.toLocaleString()} humans (and bots pretending)`, type: ActivityType.Watching },
      { text: `servermiser.pntr.dev`, type: ActivityType.Watching },
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
      // Silently fail
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
      // Silent fail
    }
  };
  
  sendStatsUpdate();
  pingDashboard(client).catch(() => null);
  setInterval(sendStatsUpdate, 60 * 1000);
  setInterval(() => pingDashboard(client).catch(() => null), 60 * 1000);

  console.log('💻 [DASHBOARD] Starting dashboard metrics...');
  const dashboardUrl = process.env.DASHBOARD_URL || 'https://servermiser.pntr.dev/api/bot-stats';
  const statsApiKey = process.env.STATS_API_KEY;

  async function pushDashboardStats() {
    if (!statsApiKey) {
      console.warn('⚠️ [DASHBOARD] STATS_API_KEY not set, skipping dashboard sync');
      return;
    }
    
    try {
      const totalGuilds = client.guilds.cache.size;
      const totalMembers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
      const wsPing = Math.max(0, Math.round(client.ws.ping));
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
        database.getDailySetupCounts().catch(() => [0, 0, 0, 0, 0, 0, 0])
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
        securityCompliance: "100%",
        totalTickets,
        totalXp,
        totalSetups,
        setupSuccessRate: totalSetups > 0 ? `${((successfulSetups / totalSetups) * 100).toFixed(1)}%` : "0%",
        ...(Array.isArray(guildCategories) && guildCategories.length > 0 ? { guildCategories } : {}),
        ...(Array.isArray(dailySetups) && dailySetups.length === 7 ? { dailySetups } : {})
      };

      await fetch(dashboardUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${statsApiKey}`
        },
        body: JSON.stringify(payload)
      });
    } catch (error) {
      // Silent fail
    }
  }

  pushDashboardStats();
  setInterval(pushDashboardStats, 5 * 60 * 1000);

  // ==========================================
  // Execute ready.js module for analytics auto-update
  // ==========================================
  if (readyEventHandler && typeof readyEventHandler.execute === 'function') {
    console.log('🔄 [READY EVENT] Executing ready.js module...');
    try {
      readyEventHandler.execute(client);
    } catch (err) {
      console.error('❌ [READY EVENT] Error executing ready.js:', err.message);
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

const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
if (!TOKEN) {
  console.error('❌ [FATAL] DISCORD_TOKEN / TOKEN environment variable is not set.');
  process.exit(1);
}

console.log('🔑 [DISCORD] Logging in...');
client.login(TOKEN).catch(err => {
  console.error('❌ [FATAL] Login failed:', err.message);
  process.exit(1);
});