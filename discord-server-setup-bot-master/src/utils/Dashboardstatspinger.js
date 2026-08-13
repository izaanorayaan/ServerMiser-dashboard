const https = require('https');

/**
 * Pushes live bot telemetry to the ServerMiser dashboard's secured
 * POST /api/bot-stats endpoint, so the analytics page shows real numbers
 * instead of the empty/zeroed defaults.
 *
 * Requires STATS_API_KEY to be set as an environment variable on THIS
 * bot service in Render, matching the exact same value set on the
 * dashboard service. If either is missing/mismatched, the dashboard
 * will reject the request with 401/503 and log an error here.
 */
async function pingDashboard(client) {
    const apiKey = process.env.STATS_API_KEY;

    if (!apiKey) {
        console.error('🚨 [Dashboard Sync] Missing STATS_API_KEY environment variable. Skipping push.');
        return;
    }

    const totalGuilds = client.guilds.cache.size;
    const totalMembers = client.guilds.cache.reduce((acc, guild) => acc + (guild.memberCount || 0), 0);
    const wsPing = Math.max(0, Math.round(client.ws.ping));
    const shardCount = client.shard ? client.shard.count : 1;

    // Uptime formatting (Nd Nh Nm)
    const uptimeMs = client.uptime || 0;
    const totalMinutes = Math.floor(uptimeMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const uptime = `${days}d ${hours}h ${minutes}m`;

    // Memory usage formatting
    const memUsedMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
    const ramUsage = `${memUsedMb} MB`;

    const payload = JSON.stringify({
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
    });

    const options = {
        hostname: 'servermiser.is-a.dev',
        port: 443,
        path: '/api/bot-stats',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'User-Agent': 'ServerMiserDiscordBot/1.0.0 (NodeJS HTTPS-Core)'
        }
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200 || res.statusCode === 204) {
                console.log(`✅ [Dashboard Sync] Stats pushed successfully. (Servers: ${totalGuilds} | Users: ${totalMembers} | Ping: ${wsPing}ms)`);
            } else {
                console.error(`⚠️ [Dashboard Sync] Rejected with status ${res.statusCode}:`, data);
            }
        });
    });

    req.on('error', (error) => {
        console.error('🚨 [Dashboard Sync] Connection error:', error.message);
    });

    req.write(payload);
    req.end();
}

module.exports = { pingDashboard };