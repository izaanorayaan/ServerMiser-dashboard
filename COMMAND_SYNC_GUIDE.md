# Command Sync System

This dashboard now automatically syncs all bot commands from your Discord.js bot repository.

## How It Works

The command sync system has three main components:

1. **`sync-commands.cjs`** - Node.js script that extracts command data from the bot repository
2. **`src/generated-commands.ts`** - Auto-generated TypeScript file with all commands
3. **`src/App.tsx`** - Uses the generated commands (no more hardcoding!)

## Quick Start

### Sync Commands
Run this command whenever you add, remove, or update commands in your bot:

```bash
npm run sync-commands
```

This will:
- ✅ Scan all files in `discord-server-setup-bot-master/src/commands/`
- ✅ Extract command names, descriptions, subcommands, and categories
- ✅ Generate `src/generated-commands.ts` with the latest data
- ✅ Automatically update the dashboard UI with new commands

### Example Output
```
🚀 Starting Command Sync...
📂 Loading commands from: discord-server-setup-bot-master/src/commands
📋 Found 66 command files
✅ analytics setup
  ├─ analytics edit
  ├─ analytics delete
  ├─ analytics update
✅ ban (moderation)
✅ birthdays (social)
... [117 total commands extracted] ...
✨ Sync complete! All 117 commands are ready.
```

## Features

### ✨ Automatic Extraction
- Parses Discord.js `SlashCommandBuilder` definitions
- Extracts subcommands and subcommand groups
- Infers categories from command names
- Auto-generates example outputs
- Identifies required permissions

### 📊 Command Data Included
Each command includes:
- `name` - Full command name (including subcommands)
- `description` - Command description from Discord.js builder
- `usage` - Usage string with prefix
- `category` - Inferred category (moderation, setup, roles, etc.)
- `exampleOutput` - Example output/response
- `permission` - Required permission (if any)

### 🔄 Always In Sync
The generated commands file is ready to use immediately:
```typescript
import { COMMANDS } from "./generated-commands";
// All 117+ commands available automatically
```

## Supported Command Types

✅ **Base Commands** - Simple standalone commands
```
name: "|ban", category: "moderation"
```

✅ **Subcommands** - Commands with multiple subcommands
```
name: "|role user", "|role remove", "|role create"
```

✅ **Subcommand Groups** - Nested command structures  
```
name: "|reactionroles create", "|reactionroles add-role"
```

✅ **Categories** - Auto-inferred from command names
```
"moderation", "setup", "roles", "automod", "fun", "social", etc.
```

## File Structure

```
/workspaces/ServerMiser-dashboard/
├── sync-commands.cjs                    # Main sync script
├── discord-server-setup-bot-master/     # Your bot repo
│   └── src/commands/                    # Bot command files
├── src/
│   ├── generated-commands.ts            # Auto-generated (DO NOT EDIT)
│   └── App.tsx                          # Uses generated-commands
└── package.json                         # npm run sync-commands
```

## Updating Commands

### When to Sync
- ✏️ Added new commands to your bot
- 🗑️ Removed commands from your bot
- 📝 Updated command descriptions or subcommands
- 🏷️ Changed command categories or permissions

### How to Sync
```bash
npm run sync-commands
```

**That's it!** The dashboard will automatically reflect all changes on the next refresh.

## Manual Updates

If you need to manually fine-tune the sync script:

1. Edit `sync-commands.cjs`
2. Run `npm run sync-commands` again
3. Review changes in `src/generated-commands.ts`

## Categories Auto-Mapped

The script automatically categorizes commands:
- `moderation` - ban, kick, mute, warn, etc.
- `setup` - setup, welcome, cute, etc.
- `roles` - role, reactionroles, autorole, etc.
- `automod` - automodrule, autoresponder, etc.
- `tickets` - ticket commands
- `verification` - verification commands
- `voice` - selfvoice commands
- `analytics` - analytics commands
- `leveling` - level commands
- `fun` - 8ball, joke, meme, dice-duel, etc.
- `social` - birthdays, suggestions, poll, giveaway, etc.
- `utility` - default category

## Troubleshooting

### "Commands folder not found"
Ensure `discord-server-setup-bot-master/` is extracted in the workspace root.

### "No commands found"
Check that command files are in `/src/commands/` and export properly via `SlashCommandBuilder`.

### Missing command descriptions
The script parses `.setDescription()` calls. Verify all commands have descriptions defined.

## Example: Adding a New Command

1. **Add command to bot:**
```javascript
// discord-server-setup-bot-master/src/commands/mynewcmd.js
module.exports = {
  data: new SlashCommandBuilder()
    .setName('mynewcmd')
    .setDescription('Does something cool')
    .addSubcommand(...)
};
```

2. **Sync to dashboard:**
```bash
npm run sync-commands
```

3. **Dashboard auto-updates** with your new command! ✨

---

**Note:** The `generated-commands.ts` file is auto-generated. Never edit it manually — always run `npm run sync-commands` to update.
