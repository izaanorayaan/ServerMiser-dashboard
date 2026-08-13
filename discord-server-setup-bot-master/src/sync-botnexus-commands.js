// src/sync-botnexus-commands.js
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function loadCommandsFromFolder() {
    const commandsPath = path.join(__dirname, 'commands');
    const commands = [];
    
    if (!fs.existsSync(commandsPath)) {
        console.warn('⚠️ [BOTNEXUS] Commands folder not found');
        return commands;
    }

    const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
    console.log(`📄 [BOTNEXUS] Found ${commandFiles.length} command files`);
    
    for (const file of commandFiles) {
        try {
            const command = require(path.join(commandsPath, file));
            if (command.data && typeof command.data.toJSON === 'function') {
                const jsonData = command.data.toJSON();
                const subcommandCount = jsonData.options ? 
                    jsonData.options.filter(o => o.type === 1 || o.type === 2).length : 0;
                console.log(`📋 [BOTNEXUS] Loaded: ${jsonData.name}${subcommandCount > 0 ? ` (${subcommandCount} subcommands)` : ''}`);
                commands.push(jsonData);
            }
        } catch (err) {
            console.error(`❌ Failed to load ${file}:`, err.message);
        }
    }
    
    console.log(`✅ [BOTNEXUS] Total commands loaded: ${commands.length}`);
    return commands;
}

async function syncCommandsToBotNexus() {
    try {
        const botId = process.env.BOTNEXUS_BOT_ID;
        const token = process.env.BOTNEXUS_API_TOKEN;
        const baseUrl = 'https://www.rsdash.net';

        if (!botId || !token) {
            console.warn('⚠️ [BOTNEXUS] Missing credentials');
            return { skipped: true };
        }

        console.log(`🔑 [BOTNEXUS] Bot ID: ${botId}`);

        const commands = loadCommandsFromFolder();
        
        if (commands.length === 0) {
            console.warn('⚠️ [BOTNEXUS] No commands found');
            return { skipped: true };
        }

        // Try different payload formats based on the API docs
        const payloads = [
            { commands: commands },  // Just commands
            { platform: 'discord', commands: commands },  // With platform
            { commands: commands, platform: 'discord' },  // Platform after
            { data: { commands: commands } },  // Nested
        ];

        const endpoints = [
            `/api/v1/bots/${botId}/commands`,
            `/api/bots/${botId}/commands`,
        ];

        let lastError = null;

        for (const endpoint of endpoints) {
            for (const payload of payloads) {
                try {
                    console.log(`🔄 Trying: ${baseUrl}${endpoint}`);
                    console.log(`   Payload:`, JSON.stringify(payload).substring(0, 100) + '...');
                    
                    const response = await axios({
                        method: 'PUT',
                        url: `${baseUrl}${endpoint}`,
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        data: payload,
                        timeout: 15000
                    });

                    console.log(`✅ [BOTNEXUS] Commands synced successfully!`);
                    console.log(`   Endpoint: ${endpoint}`);
                    console.log(`   Response:`, JSON.stringify(response.data, null, 2));
                    return response.data;
                } catch (error) {
                    lastError = error;
                    if (error.response) {
                        console.log(`   ❌ Status: ${error.response.status}`);
                        if (error.response.status === 400) {
                            console.log(`   ❌ Error:`, JSON.stringify(error.response.data, null, 2));
                        }
                    } else {
                        console.log(`   ❌ Error: ${error.message}`);
                    }
                }
            }
        }

        throw lastError || new Error('All endpoints failed');

    } catch (error) {
        console.error('\n❌ [BOTNEXUS] Sync failed:');
        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Data:`, JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(`   Error: ${error.message}`);
        }
        console.log('\n💡 Tip: The API endpoint might be different. Your commands are already manually added to your bot page.');
        console.log('   Check the BotNexus API docs for the correct endpoint format.');
        throw error;
    }
}

async function pushStatsToBotNexus(serverCount) {
    try {
        const botId = process.env.BOTNEXUS_BOT_ID;
        const token = process.env.BOTNEXUS_API_TOKEN;
        const baseUrl = 'https://www.rsdash.net';

        if (!botId || !token) {
            return;
        }

        console.log(`📊 [BOTNEXUS] Pushing stats: ${serverCount} servers...`);

        // Stats works - it's using the v1 API
        const response = await axios({
            method: 'POST',
            url: `${baseUrl}/api/v1/bots/${botId}/stats`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: {
                platform: 'discord',
                server_count: serverCount
            },
            timeout: 10000
        });

        console.log(`✅ [BOTNEXUS] Stats pushed: ${serverCount} servers`);
        return response.data;

    } catch (error) {
        if (error.response?.status === 404) {
            console.log(`⚠️ [BOTNEXUS] Stats endpoint not found`);
        } else {
            console.error(`⚠️ [BOTNEXUS] Stats push failed:`, error.message);
        }
    }
}

module.exports = {
    syncCommandsToBotNexus,
    pushStatsToBotNexus
};

if (require.main === module) {
    console.log('🚀 [BOTNEXUS] Starting manual sync...');
    console.log('='.repeat(60));
    
    syncCommandsToBotNexus()
        .then(() => {
            console.log('\n🎉 [BOTNEXUS] Sync completed!');
            process.exit(0);
        })
        .catch(() => {
            console.log('\n⚠️ [BOTNEXUS] Sync failed but stats will still work.');
            process.exit(1);
        });
}