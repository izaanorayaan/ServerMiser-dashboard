import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory telemetry cache with zeroed initial values
let botStats = {
  totalGuilds: 0,
  totalMembers: 0,
  wsPing: 0,
  uptime: "0d 0h 0m",
  ramUsage: "0 MB",
  activeShards: "0 / 0",
  securityCompliance: "0%",
  recentLogs: [] as string[],
  radarNodes: [] as any[],
  segments: [] as any[],
  barData: [] as any[]
};

// GET ENDPOINT - Fetches stats to render on the React front-end, proxying from the external Render URL
app.get("/api/bot-stats", async (req, res) => {
  try {
    // Render free-tier apps take some time to cold start. We use a 45-second timeout to allow spin-up.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const externalResponse = await fetch("https://discord-server-setup-bot.onrender.com", {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (externalResponse.ok) {
      const data: any = await externalResponse.json();
      console.log("[server.ts] Successfully proxied telemetry from Render bot:", data);

      // Map external bot payload to our cache cleanly
      if (data.totalServers !== undefined) botStats.totalGuilds = Number(data.totalServers);
      if (data.totalUsers !== undefined) botStats.totalMembers = Number(data.totalUsers);
      if (data.botPing !== undefined) botStats.wsPing = Number(data.botPing);
      
      // Store custom variables on the telemetry cache object
      if (data.totalTickets !== undefined) (botStats as any).totalTickets = Number(data.totalTickets);
      if (data.totalXp !== undefined) (botStats as any).totalXp = Number(data.totalXp);
      if (data.uptime !== undefined) botStats.uptime = data.uptime;
      if (data.ramUsage !== undefined) botStats.ramUsage = data.ramUsage;
      if (data.activeShards !== undefined) botStats.activeShards = data.activeShards;
      if (data.securityCompliance !== undefined) botStats.securityCompliance = data.securityCompliance;
      if (data.recentLogs !== undefined) botStats.recentLogs = data.recentLogs;
    }
  } catch (err: any) {
    console.warn("[server.ts] Could not retrieve telemetry from Render bot directly (e.g. cold starts or offline), returning cached values:", err.message);
  }

  res.json(botStats);
});

// POST ENDPOINT - Allows your discord.js bot (either running in another process, or separate server)
// to securely push its live statistics up to this dashboard!
app.post("/api/bot-stats", (req, res) => {
  const authHeader = req.headers.authorization;
  const secretKey = process.env.STATS_API_KEY || "servermiser_secret_1337";

  if (!authHeader || authHeader !== `Bearer ${secretKey}`) {
    return res.status(401).json({ error: "Unauthorized. Missing or invalid STATS_API_KEY." });
  }

  const {
    totalGuilds,
    totalMembers,
    wsPing,
    uptime,
    ramUsage,
    activeShards,
    securityCompliance,
    recentLogs,
    radarNodes,
    segments,
    barData
  } = req.body;

  // Update stats incrementally if provided
  if (totalGuilds !== undefined) botStats.totalGuilds = totalGuilds;
  if (totalMembers !== undefined) botStats.totalMembers = totalMembers;
  if (wsPing !== undefined) botStats.wsPing = wsPing;
  if (uptime !== undefined) botStats.uptime = uptime;
  if (ramUsage !== undefined) botStats.ramUsage = ramUsage;
  if (activeShards !== undefined) botStats.activeShards = activeShards;
  if (securityCompliance !== undefined) botStats.securityCompliance = securityCompliance;
  if (recentLogs !== undefined) botStats.recentLogs = recentLogs;
  if (radarNodes !== undefined) botStats.radarNodes = radarNodes;
  if (segments !== undefined) botStats.segments = segments;
  if (barData !== undefined) botStats.barData = barData;

  res.json({ message: "Telemetry successfully synchronized with ServerMiser web server.", currentStats: botStats });
});

// ==========================================
// OPTIONAL: INTEGRATING DISCORD.JS DIRECTLY
// ==========================================
// If you want to host your Discord bot inside the exact same Render app
// to keep your deployment fully unified and free, you can uncomment this block:
/*
import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

client.on("ready", () => {
  console.log(`[discord.js] Logged in as ${client.user?.tag}!`);
  
  // Continuously update local memory state with live metrics
  setInterval(() => {
    try {
      const guildsCount = client.guilds.cache.size;
      const membersCount = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);
      const ping = client.ws.ping;
      const memoryUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1) + " MB";
      
      // Compute simple dynamic uptime format
      const upSeconds = Math.floor(process.uptime());
      const d = Math.floor(upSeconds / (3600*24));
      const h = Math.floor((upSeconds % (3600*24)) / 3600);
      const m = Math.floor((upSeconds % 3600) / 60);
      const uptimeStr = `${d}d ${h}h ${m}m`;

      botStats.totalGuilds = guildsCount;
      botStats.totalMembers = membersCount;
      botStats.wsPing = ping >= 0 ? ping : 15;
      botStats.ramUsage = memoryUsed;
      botStats.uptime = uptimeStr;
      
      // Sync the primary radar nodes latency too
      botStats.radarNodes[0].latency = Math.max(1, ping); // Discord API Gateway latency
      botStats.radarNodes[1].latency = Math.max(1, ping + 2); // Shard latency
    } catch (err) {
      console.error("[discord.js] Error updating telemetry cache:", err);
    }
  }, 10000); // update every 10 seconds
});

if (process.env.DISCORD_BOT_TOKEN) {
  client.login(process.env.DISCORD_BOT_TOKEN);
} else {
  console.log("[discord.js] No DISCORD_BOT_TOKEN found in environment. Running dashboard solo with API sync mode.");
}
*/

// ==========================================
// VITE AND STATIC ASSETS MIDDLEWARE
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // In development mode, load Vite's HMR middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production mode, serve compiled static site files from dist/
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ServerMiser Web Desk] Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
