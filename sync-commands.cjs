#!/usr/bin/env node
/**
 * Command Sync Script
 * Extracts all Discord.js bot commands and generates the dashboard command template
 */

const fs = require('fs');
const path = require('path');

// Path to bot commands directory
const BOT_COMMANDS_PATH = path.join(__dirname, 'discord-server-setup-bot-master/src/commands');
const OUTPUT_FILE = path.join(__dirname, 'src/generated-commands.ts');
const COMMAND_FILE_EXTENSIONS = new Set(['.js', '.cjs', '.mjs']);

function findCommandFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...findCommandFiles(entryPath));
    } else if (COMMAND_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

/**
 * Extract command data from Discord.js command builder
 */
function extractCommandData(filePath, fileName) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    const nameMatch = content.match(/(?:new\s+SlashCommandBuilder\s*\(\)|\bdata\s*=\s*new\s+SlashCommandBuilder\s*\(\))\s*\.?\s*\.setName\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/s);
    if (!nameMatch) {
      console.warn(`⚠️ Skipping ${fileName}: no SlashCommandBuilder .setName() found`);
      return null;
    }
    const name = nameMatch[1];

    const descMatch = content.match(/new\s+SlashCommandBuilder\s*\(\)\s*\.?\s*\.setName\s*\(\s*['"`][^'"`]+['"`]\s*\)\s*\.?\s*\.setDescription\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/s);
    const description = descMatch ? descMatch[1] : 'No description';

    const permMatch = content.match(/PermissionFlagsBits\.(\w+)/);
    const permission = permMatch ? permMatch[1] : undefined;

    const subcommands = extractSubcommands(content, name);

    return {
      name,
      description: cleanDescription(description),
      subcommands,
      permission,
      fileName
    };
  } catch (err) {
    console.error(`❌ Error parsing ${fileName}:`, err.message);
    return null;
  }
}

/**
 * Read balanced parentheses so we can safely capture nested subcommand groups.
 */
function readBalancedCall(source, openParenIndex) {
  if (openParenIndex < 0 || openParenIndex >= source.length) return null;

  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escaped = false;

  for (let i = openParenIndex; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inSingle) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === "'") inSingle = false;
      continue;
    }

    if (inDouble) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inDouble = false;
      continue;
    }

    if (inTemplate) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '`') inTemplate = false;
      continue;
    }

    if (ch === '(') {
      depth += 1;
      continue;
    }

    if (ch === ')') {
      depth -= 1;
      if (depth === 0) {
        return {
          body: source.slice(openParenIndex + 1, i),
          endIndex: i + 1
        };
      }
      continue;
    }

    if (ch === "'") inSingle = true;
    else if (ch === '"') inDouble = true;
    else if (ch === '`') inTemplate = true;
    else if (ch === '/' && next && next !== '/') {
      // ignore regex literal edges when scanning; this is a safe fallback for typical SlashCommandBuilder chains
    }
  }

  return null;
}

function findMethodCalls(source, methodName) {
  const calls = [];
  const regex = new RegExp(`\\.${methodName}\\s*\\(`, 'g');
  let match;

  while ((match = regex.exec(source)) !== null) {
    const openParenIndex = source.indexOf('(', match.index + match[0].length - 1);
    const parsed = readBalancedCall(source, openParenIndex);
    if (!parsed) continue;
    calls.push({
      index: match.index,
      endIndex: match.index + match[0].length - 1 + parsed.endIndex - openParenIndex,
      body: parsed.body
    });
  }

  return calls;
}

function extractSetName(body) {
  const match = body.match(/\.setName\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/s);
  return match ? match[1] : null;
}

function extractSetDescription(body) {
  const match = body.match(/\.setDescription\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/s);
  return match ? match[1] : null;
}

function extractDirectSubcommands(body, commandName, groupName = null) {
  const subcommands = [];
  const calls = findMethodCalls(body, 'addSubcommand');

  for (const call of calls) {
    const subName = extractSetName(call.body);
    const subDesc = extractSetDescription(call.body);
    if (!subName || !subDesc) continue;

    const fullName = groupName ? `${commandName} ${groupName} ${subName}` : `${commandName} ${subName}`;
    subcommands.push({
      name: fullName,
      description: cleanDescription(subDesc),
      usage: fullName,
      category: inferCategory(commandName),
      exampleOutput: generateExampleOutput(commandName, subName),
      permission: inferPermission(commandName)
    });
  }

  return subcommands;
}

/**
 * Extract subcommands and subcommand groups from command builder
 */
function extractSubcommands(content, commandName) {
  const subcommands = [];
  const groupCalls = findMethodCalls(content, 'addSubcommandGroup');

  if (groupCalls.length > 0) {
    const excludedRanges = [];
    for (const groupCall of groupCalls) {
      const groupName = extractSetName(groupCall.body);
      const groupDesc = extractSetDescription(groupCall.body);
      if (!groupName || !groupDesc) continue;

      excludedRanges.push([groupCall.index, groupCall.endIndex]);
      const groupSubs = extractDirectSubcommands(groupCall.body, commandName, groupName);
      subcommands.push(...groupSubs);
    }

    const topLevelSource = content;
    const topLevelCalls = findMethodCalls(topLevelSource, 'addSubcommand');
    for (const call of topLevelCalls) {
      const insideExcludedRange = excludedRanges.some(([start, end]) => call.index >= start && call.endIndex <= end);
      if (insideExcludedRange) continue;

      const subName = extractSetName(call.body);
      const subDesc = extractSetDescription(call.body);
      if (!subName || !subDesc) continue;

      subcommands.push({
        name: `${commandName} ${subName}`,
        description: cleanDescription(subDesc),
        usage: `${commandName} ${subName}`,
        category: inferCategory(commandName),
        exampleOutput: generateExampleOutput(commandName, subName),
        permission: inferPermission(commandName)
      });
    }

    return subcommands;
  }

  const calls = findMethodCalls(content, 'addSubcommand');
  for (const call of calls) {
    const subName = extractSetName(call.body);
    const subDesc = extractSetDescription(call.body);
    if (!subName || !subDesc) continue;

    subcommands.push({
      name: `${commandName} ${subName}`,
      description: cleanDescription(subDesc),
      usage: `${commandName} ${subName}`,
      category: inferCategory(commandName),
      exampleOutput: generateExampleOutput(commandName, subName),
      permission: inferPermission(commandName)
    });
  }

  return subcommands;
}

/**
 * Infer command category from command name
 */
function inferCategory(commandName) {
  const categoryMap = {
    ban: 'moderation',
    kick: 'moderation',
    mute: 'moderation',
    unmute: 'moderation',
    warn: 'moderation',
    warnings: 'moderation',
    unban: 'moderation',
    'mod-logs': 'moderation',
    purge: 'moderation',
    slowmode: 'moderation',
    lockdown: 'moderation',
    setup: 'setup',
    'clear-channels': 'setup',
    cute: 'setup',
    welcome: 'setup',
    'setup-audit': 'setup',
    'fun-module': 'setup',
    role: 'roles',
    clearroles: 'roles',
    reactionroles: 'roles',
    autorole: 'roles',
    ticket: 'tickets',
    automodrule: 'automod',
    autoresponder: 'automod',
    verification: 'verification',
    selfvoice: 'voice',
    analytics: 'analytics',
    level: 'leveling',
    birthdays: 'social',
    suggestions: 'social',
    poll: 'social',
    giveaway: 'social',
    trivia: 'fun',
    'capital-quiz': 'fun',
    '8ball': 'fun',
    joke: 'fun',
    'dadjoke': 'fun',
    meme: 'fun',
    'fun-menu': 'fun',
    coinflip: 'fun',
    roll: 'fun',
    rate: 'fun',
    'predict-love': 'fun',
    roast: 'fun',
    hug: 'fun',
    slap: 'fun',
    cat: 'fun',
    dog: 'fun',
    spacefact: 'fun',
    fortune: 'fun',
    'wouldyourather': 'fun',
    'dice-duel': 'fun'
  };

  return categoryMap[commandName] || 'utility';
}

/**
 * Infer permission from command name
 */
function inferPermission(commandName) {
  const permissionMap = {
    ban: 'Ban Members',
    kick: 'Kick Members',
    mute: 'Moderate Members',
    unmute: 'Moderate Members',
    warn: 'Moderate Members',
    setup: 'Manage Server',
    'clear-channels': 'Manage Server',
    cute: 'Manage Server',
    welcome: 'Manage Server',
    'setup-audit': 'Manage Server',
    'fun-module': 'Manage Server',
    role: 'Manage Roles',
    reactionroles: 'Manage Roles',
    autorole: 'Manage Roles',
    verification: 'Administrator',
    selfvoice: 'Manage Server',
    analytics: 'Manage Server',
    'mod-logs': 'Manage Server'
  };

  return permissionMap[commandName];
}

/**
 * Generate example output for a command
 */
function generateExampleOutput(commandName, subName) {
  const examples = {
    ban: `✓ Banned member @user (Reason: Malicious activity)`,
    kick: `✓ Kicked member @user`,
    mute: `✓ Timed out @user for 10m`,
    unmute: `✓ Removed timeout from @user`,
    warn: `⚠ Official warning registered for @user (1st warning point)`,
    warnings: `Warnings profile for @user:\n- 1st Warn: Spam (Logged by @staff)\n- Total: 1`,
    unban: `✅ User Unbanned\n**john_doe** has been successfully unbanned.`,
    setup: `✓ Setup complete! Deployed: 📁 Welcome, 📁 Chats, 7 channels, and Admin/Mod/Member roles.`,
    'clear-channels': `🗑️ Total channels and categories wiped successfully.`,
    cute: `✨ Cute Mode Configured! Layouts will now use Small Caps (sᴍᴀʟʟ ᴄᴀᴘs)!`,
    role: `✓ Role management command executed successfully.`,
    reactionroles: `✅ Role panel deployed successfully.`,
    autorole: `✓ Autorole configured successfully.`,
    ticket: `🎫 Ticket system configured.`,
    verification: `✓ Verification system activated.`,
    selfvoice: `🔊 Voice room created successfully.`,
    analytics: `📊 Analytics tracking deployed.`,
    level: `📈 Leveling system updated.`
  };

  return examples[commandName] || `✓ ${commandName} ${subName} executed successfully.`;
}

/**
 * Clean up description text
 */
function cleanDescription(desc) {
  return desc
    .replace(/^[⚙️🎯📋⏳✨🔊📊📈🎫🔗🌐👤]/g, '')
    .replace(/\n/g, ' ')
    .trim();
}

/**
 * Load all commands and generate template
 */
function generateCommandsTemplate() {
  console.log('📂 Loading commands from:', BOT_COMMANDS_PATH);

  if (!fs.existsSync(BOT_COMMANDS_PATH)) {
    console.error('❌ Bot commands directory not found!');
    process.exit(1);
  }

  const commandFiles = findCommandFiles(BOT_COMMANDS_PATH);

  console.log(`\n📋 Found ${commandFiles.length} command files\n`);

  const commands = [];
  const commandsByCategory = {};

  for (const filePath of commandFiles) {
    const file = path.relative(BOT_COMMANDS_PATH, filePath);
    const cmdData = extractCommandData(filePath, file);

    if (cmdData) {
      // Add base command if no subcommands
      if (cmdData.subcommands.length === 0) {
        const baseCmd = {
          name: cmdData.name,
          description: cmdData.description,
          usage: cmdData.name,
          category: inferCategory(cmdData.name),
          exampleOutput: generateExampleOutput(cmdData.name, ''),
          permission: cmdData.permission
        };
        commands.push(baseCmd);
        
        const cat = baseCmd.category;
        if (!commandsByCategory[cat]) commandsByCategory[cat] = [];
        commandsByCategory[cat].push(baseCmd);

        console.log(`✅ ${baseCmd.name} (${baseCmd.category})`);
      } else {
        // Add subcommands
        for (const sub of cmdData.subcommands) {
          commands.push(sub);
          const cat = sub.category;
          if (!commandsByCategory[cat]) commandsByCategory[cat] = [];
          commandsByCategory[cat].push(sub);
          console.log(`  ├─ ${sub.name}`);
        }
      }
    }
  }

  console.log(`\n✅ Total commands extracted: ${commands.length}\n`);

  // Generate TypeScript file
  const tsContent = generateTypeScriptFile(commands);
  fs.writeFileSync(OUTPUT_FILE, tsContent, 'utf-8');

  console.log(`📝 Generated: ${OUTPUT_FILE}`);
  console.log(`\n✨ Sync complete! All ${commands.length} commands are ready.\n`);

  return commands;
}

/**
 * Generate TypeScript export file
 */
function generateTypeScriptFile(commands) {
  const content = `// Auto-generated command template
// Generated by sync-commands.js
// DO NOT EDIT MANUALLY

export interface Command {
  name: string;
  description: string;
  usage: string;
  category: string;
  exampleOutput: string;
  permission?: string;
}

export const COMMANDS: Command[] = ${JSON.stringify(commands, null, 2)};

export const COMMAND_CATEGORIES = ${JSON.stringify(
    Array.from(new Set(commands.map(c => c.category))).sort(),
    null,
    2
  )};

export const COMMANDS_BY_CATEGORY = ${JSON.stringify(
    commands.reduce((acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = [];
      acc[cmd.category].push(cmd);
      return acc;
    }, {}),
    null,
    2
  )};
`;

  return content;
}

// Run the sync
console.log('🚀 Starting Command Sync...\n');
generateCommandsTemplate();
