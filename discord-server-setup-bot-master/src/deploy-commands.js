// 🛑 NODE 17 COMPATIBILITY PATCH (Fixes: ReadableStream is not defined)
if (typeof globalThis.ReadableStream === 'undefined') {
    try {
        const { ReadableStream } = require('node:stream/web');
        globalThis.ReadableStream = ReadableStream;
    } catch (e) {
        console.warn("Could not polyfill ReadableStream automatically.");
    }
}

const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// 🛡️ Try reading .env from both the root folder and the src folder
const rootEnvPath = path.join(__dirname, '../.env');
const localEnvPath = path.join(__dirname, '.env');

if (fs.existsSync(rootEnvPath)) {
    require('dotenv').config({ path: rootEnvPath });
} else if (fs.existsSync(localEnvPath)) {
    require('dotenv').config({ path: localEnvPath });
} else {
    require('dotenv').config();
}

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// 🔄 Only validate TOKEN and CLIENT_ID since this is a global bot
if (!TOKEN || !CLIENT_ID) {
    console.error("❌ ERROR: Missing DISCORD_TOKEN or CLIENT_ID in your .env file!");
    process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');

// 📊 Conflict Validation Tracking Map
const loadedCommandNames = new Map(); 

if (fs.existsSync(commandsPath)) {
    // Read all JavaScript files inside the commands folder
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        // Explicitly skip mydata.js completely
        if (file === 'mydata.js') {
            console.log(`[SKIPPED] Expressly bypassing registration loop for: ${file}`);
            continue;
        }
    
        // Fix: Allow commands that use execute OR executeSlash (like autorole.js)
        const hasValidExecutor = typeof command?.execute === 'function' || 
                                 typeof command?.executeSlash === 'function';
    
        if (command?.data?.toJSON && hasValidExecutor) {
            const internalName = command.data.name;

            // 🔍 Conflict Check: Verify if another file already registered this exact slash command name
            if (loadedCommandNames.has(internalName)) {
                console.error('\n' + '='.repeat(50));
                console.error(`🚨 [DUPLICATE DETECTED] Conflict found in your registry mapping arrays!`);
                console.error(`• Conflict Slash Trigger: "/${internalName}"`);
                console.error(`• Existing Loaded File:  "${loadedCommandNames.get(internalName)}"`);
                console.error(`• New Conflicting File:  "${file}"`);
                console.error('='.repeat(50) + '\n');
                console.error("❌ DEPLOYMENT HALTED: Fix the internal duplicated .setName() property or rename the file before reloading.");
                process.exit(1);
            }

            // Track this unique payload map slot string handle reference
            loadedCommandNames.set(internalName, file);

            commands.push(command.data.toJSON());
            console.log(`Loaded command: /${internalName} (from ${file})`);
        } else {
            console.log(`[WARNING] The command at ${file} was skipped. (Ensure it has a valid SlashCommandBuilder setup)`);
        }
    }    
} else {
    console.error(`❌ ERROR: The commands directory does not exist at path: ${commandsPath}`);
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
	try {
		console.log(`⏳ Started refreshing ${commands.length} global application (/) commands.`);

		// 🌐 Registers commands GLOBALLY so they work across all servers
		const data = await rest.put(
			Routes.applicationCommands(CLIENT_ID),
			{ body: commands },
		);

		console.log(`✅ Successfully reloaded ${data.length} global application (/) commands for everyone!`);
		console.log(`⚠️ Note: Global commands can take anywhere from 10 seconds to an hour to appear everywhere due to Discord caching.`);
	} catch (error) {
		console.error('Deployment error:', error);
	}
})();
