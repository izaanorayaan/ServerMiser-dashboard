var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = Number(process.env.PORT || 7860);
var PRIMARY_STATS_SOURCE = process.env.BOT_STATS_SOURCE_URL || process.env.VITE_STATS_API_BASE_URL || "https://discord-server-setup-bot-w22o.onrender.com/api/bot-stats";
function hasLiveTelemetryPayload(data) {
  if (!data || typeof data !== "object") return false;
  const hasCoreCounts = data.totalGuilds !== void 0 && data.totalGuilds !== null && data.totalGuilds !== "" || data.totalMembers !== void 0 && data.totalMembers !== null && data.totalMembers !== "" || data.totalServers !== void 0 && data.totalServers !== null && data.totalServers !== "" || data.totalUsers !== void 0 && data.totalUsers !== null && data.totalUsers !== "";
  const hasPing = data.wsPing !== void 0 && data.wsPing !== null && data.wsPing !== "" || data.botPing !== void 0 && data.botPing !== null && data.botPing !== "";
  if (!hasCoreCounts || !hasPing) {
    return false;
  }
  const syntheticOnlyKeys = ["totalTickets", "totalXp", "totalSetups", "setupSuccessRate", "genTime"];
  const hasSyntheticOnlyPayload = syntheticOnlyKeys.some((key) => data[key] !== void 0 && data[key] !== null && data[key] !== "") && !hasCoreCounts && !hasPing;
  if (hasSyntheticOnlyPayload) return false;
  return true;
}
app.use(import_express.default.json());
var botStats = {
  totalGuilds: 0,
  totalMembers: 0,
  wsPing: 0,
  uptime: "0d 0h 0m",
  ramUsage: "0 MB",
  activeShards: "0 / 0",
  securityCompliance: "0%",
  recentLogs: [],
  radarNodes: [],
  segments: [],
  barData: [],
  totalTickets: 0,
  totalXp: 0,
  totalSetups: 0,
  setupSuccessRate: "0%",
  genTime: "0.0s",
  guildCategories: [],
  dailySetups: []
};
app.get("/api/bot-stats", async (req, res) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45e3);
    const externalResponse = await fetch(PRIMARY_STATS_SOURCE, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (externalResponse.ok) {
      const data = await externalResponse.json();
      if (!hasLiveTelemetryPayload(data)) {
        console.warn("[server.ts] Ignoring placeholder telemetry payload from upstream; keeping last known live stats.", data);
      } else {
        console.log("[server.ts] Successfully proxied telemetry from upstream:", data);
        if (data.totalServers !== void 0) botStats.totalGuilds = Number(data.totalServers);
        if (data.totalGuilds !== void 0) botStats.totalGuilds = Number(data.totalGuilds);
        if (data.totalUsers !== void 0) botStats.totalMembers = Number(data.totalUsers);
        if (data.totalMembers !== void 0) botStats.totalMembers = Number(data.totalMembers);
        if (data.botPing !== void 0) botStats.wsPing = Number(data.botPing);
        if (data.wsPing !== void 0) botStats.wsPing = Number(data.wsPing);
        if (data.totalTickets !== void 0) botStats.totalTickets = Number(data.totalTickets);
        if (data.totalXp !== void 0) botStats.totalXp = Number(data.totalXp);
        if (data.totalSetups !== void 0) botStats.totalSetups = Number(data.totalSetups);
        if (data.setupSuccessRate !== void 0) botStats.setupSuccessRate = data.setupSuccessRate;
        if (data.genTime !== void 0) botStats.genTime = data.genTime;
        if (data.guildCategories !== void 0) botStats.guildCategories = data.guildCategories;
        if (data.dailySetups !== void 0) botStats.dailySetups = data.dailySetups;
        if (data.uptime !== void 0) botStats.uptime = data.uptime;
        if (data.ramUsage !== void 0) botStats.ramUsage = data.ramUsage;
        if (data.activeShards !== void 0) botStats.activeShards = data.activeShards;
        if (data.securityCompliance !== void 0) botStats.securityCompliance = data.securityCompliance;
        if (data.recentLogs !== void 0) botStats.recentLogs = data.recentLogs;
      }
    }
  } catch (err) {
    console.warn("[server.ts] Could not retrieve telemetry from Render bot directly (e.g. cold starts or offline), returning cached values:", err.message);
  }
  res.json(botStats);
});
app.post("/api/bot-stats", (req, res) => {
  const authHeader = req.headers.authorization;
  const secretKey = process.env.STATS_API_KEY;
  if (!secretKey) {
    console.error("[server.ts] STATS_API_KEY is not set in the environment. Refusing all writes to /api/bot-stats.");
    return res.status(503).json({ error: "Server misconfigured: STATS_API_KEY is not set." });
  }
  if (!authHeader || authHeader !== `Bearer ${secretKey}`) {
    return res.status(401).json({ error: "Unauthorized. Missing or invalid STATS_API_KEY." });
  }
  console.log("[server.ts] DEBUG payload received at /api/bot-stats:", JSON.stringify(req.body, null, 2));
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
    barData,
    totalTickets,
    totalXp,
    totalSetups,
    setupSuccessRate,
    genTime,
    guildCategories,
    dailySetups
  } = req.body;
  if (totalGuilds !== void 0) botStats.totalGuilds = totalGuilds;
  if (totalMembers !== void 0) botStats.totalMembers = totalMembers;
  if (wsPing !== void 0) botStats.wsPing = wsPing;
  if (uptime !== void 0) botStats.uptime = uptime;
  if (ramUsage !== void 0) botStats.ramUsage = ramUsage;
  if (activeShards !== void 0) botStats.activeShards = activeShards;
  if (securityCompliance !== void 0) botStats.securityCompliance = securityCompliance;
  if (recentLogs !== void 0) botStats.recentLogs = recentLogs;
  if (radarNodes !== void 0) botStats.radarNodes = radarNodes;
  if (segments !== void 0) botStats.segments = segments;
  if (barData !== void 0) botStats.barData = barData;
  if (totalTickets !== void 0) botStats.totalTickets = Number(totalTickets);
  if (totalXp !== void 0) botStats.totalXp = Number(totalXp);
  if (totalSetups !== void 0) botStats.totalSetups = Number(totalSetups);
  if (setupSuccessRate !== void 0) botStats.setupSuccessRate = setupSuccessRate;
  if (genTime !== void 0) botStats.genTime = genTime;
  if (guildCategories !== void 0) botStats.guildCategories = guildCategories;
  if (dailySetups !== void 0) botStats.dailySetups = dailySetups;
  res.json({ message: "Telemetry successfully synchronized with ServerMiser web server.", currentStats: botStats });
});
app.get("/api/debug/bot-stats", (req, res) => {
  res.json({
    message: "Latest dashboard telemetry cache",
    stats: botStats,
    source: PRIMARY_STATS_SOURCE
  });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ServerMiser Web Desk] Server active on http://0.0.0.0:${PORT}`);
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[ServerMiser Web Desk] Port ${PORT} is already in use. Retrying...`);
      setTimeout(() => {
        server.close();
        server.listen(PORT, "0.0.0.0");
      }, 1e3);
    } else {
      throw err;
    }
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
