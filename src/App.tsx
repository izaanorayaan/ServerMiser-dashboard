import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Activity,
  Shield,
  Zap,
  Check,
  Plus,
  Users,
  Settings,
  X,
  MessageSquare,
  Lock,
  ArrowRight,
  Search,
  Terminal,
  Award,
  HelpCircle,
  FolderOpen,
  RefreshCcw,
  Sliders,
  Fingerprint,
  Trash2,
  Sun,
  Moon,
  Copy,
  Play,
  Download,
  Volume2,
  Key
} from "lucide-react";
import Logo from "./components/Logo";
import AnalyticsDashboard from "./components/AnalyticsDashboard";

// Command type definition
interface Command {
  name: string;
  description: string;
  usage: string;
  category: string;
  exampleOutput: string;
  permission?: string;
}

const COMMANDS: Command[] = [
  // Moderation
  {
    name: "ban",
    description: "Permanently ban a user from the server/guild and log the action securely.",
    usage: "|ban <@user> [reason]",
    category: "moderation",
    exampleOutput: "✓ Banned member @spammer69 (Reason: Malicious phishing)",
    permission: "Ban Members"
  },
  {
    name: "kick",
    description: "Kick a user from the server immediately.",
    usage: "|kick <@user> [reason]",
    category: "moderation",
    exampleOutput: "✓ Kicked member @impatient_user",
    permission: "Kick Members"
  },
  {
    name: "mute",
    description: "Mute/timeout a member in text and voice channels for a set duration.",
    usage: "|mute <@user> <duration> [reason]",
    category: "moderation",
    exampleOutput: "✓ Timed out @noisy_speaker for 10m (Reason: Chat spam)",
    permission: "Moderate Members"
  },
  {
    name: "unmute",
    description: "Remove the active timeout or mute status from a member immediately.",
    usage: "|unmute <@user>",
    category: "moderation",
    exampleOutput: "✓ Removed active timeout from @noisy_speaker",
    permission: "Moderate Members"
  },
  {
    name: "warn",
    description: "Register an official warning infraction against a user's server profile.",
    usage: "|warn <@user> <reason>",
    category: "moderation",
    exampleOutput: "⚠ Official warning registered for @rebel-user (1st warning point)",
    permission: "Moderate Members"
  },
  {
    name: "warnings",
    description: "View the warning history and active warning score of a server member.",
    usage: "|warnings <@user>",
    category: "moderation",
    exampleOutput: "Warnings profile for @rebel-user:\n- 1st Warn: CAPS Spam (Logged by @staff)\n- Total Warnings: 1",
    permission: "Moderate Members"
  },
  {
    name: "unban",
    description: "Unban a user from the server using their exact username.",
    usage: "|unban <username> [reason]",
    category: "moderation",
    exampleOutput: "✅ User Unbanned\n**john_doe** has been successfully unbanned.\nReason: Recanted post / completed duration.",
    permission: "Ban Members"
  },
  {
    name: "mod-logs-toggle",
    description: "Toggle on or off and set the designated logs channel to record all administrator actions securely.",
    usage: "|mod-logs-toggle <#channel | off>",
    category: "moderation",
    exampleOutput: "🛡️ Mod Logs toggled on! All administrative events will now stream to #mod-logs.",
    permission: "Manage Server"
  },

  // Server Setup
  {
    name: "setup",
    description: "Deploy categorized channel structures, categories, and core roles automatically using a predefined template.",
    usage: "|setup <template>",
    category: "setup",
    exampleOutput: "✓ Setup complete! Deployed: 📁 Welcome, 📁 Chats, 📁 Staff categories, 7 channels, and Admin/Mod/Member roles.",
    permission: "Manage Server"
  },
  {
    name: "clear-channels",
    description: "🗑️ total wipeout: Purges all existing channels and categories from the server. (Manage Server permissions required)",
    usage: "|clear-channels",
    category: "setup",
    exampleOutput: "🗑️ Total channels and categories wiped successfully.",
    permission: "Manage Server"
  },
  {
    name: "cute",
    description: "Configure beautiful fancy font layouts (wide, small-caps, bubbles) for your setup templates.",
    usage: "|cute <wide | small-caps | bubbles | off>",
    category: "setup",
    exampleOutput: "✨ Cute Mode Configured! Setup layouts will now build using the Small Caps Layout (sᴍᴀʟʟ ᴄᴀᴘs)! (´｀)♡",
    permission: "Manage Server"
  },
  {
    name: "welcome",
    description: "Configure the welcome and leave announcements channel and toggles with custom variables: {user}, {server}, {memberCount}.",
    usage: "|welcome <#channel> <true/false>",
    category: "setup",
    exampleOutput: "✓ Welcome system enabled in #welcome with custom joins & leaves.",
    permission: "Manage Server"
  },
  {
    name: "setup-audit",
    description: "Configure or disable the server audit log channel for tracking server updates and invites.",
    usage: "|setup-audit <#channel | disable>",
    category: "setup",
    exampleOutput: "✅ Audit logs have been successfully enabled in #audit-log!",
    permission: "Manage Server"
  },
  {
    name: "fun-module",
    description: "Toggle status configurations for the interactive fun systems (games, quizzes, trivia) on or off.",
    usage: "|fun-module",
    category: "setup",
    exampleOutput: "🎮 Fun Module Configurations: Server Status is now set to ENABLED.",
    permission: "Manage Server"
  },

  // Roles System
  {
    name: "clearroles",
    description: "Clean up and delete all unused roles to prune server list safely.",
    usage: "|clearroles",
    category: "roles",
    exampleOutput: "🧹 Pruned 4 empty roles from server hierarchy.",
    permission: "Manage Server"
  },
  {
    name: "reactionroles create",
    description: "Deploy a brand-new self-assignable interactive role button or selection dropdown panel inside a designated channel.",
    usage: "|reactionroles create <#channel> <@roles...>",
    category: "roles",
    exampleOutput: "✅ Successfully deployed role layout configuration inside #roles! (Message ID: `1224597022`)",
    permission: "Manage Roles"
  },
  {
    name: "reactionroles edit",
    description: "Modify options, custom emojis, button colors, or role mappings in an existing role panel.",
    usage: "|reactionroles edit <message_id> <options>",
    category: "roles",
    exampleOutput: "✏️ Panel settings updated. Self-assignable button layouts rebuilt successfully.",
    permission: "Manage Roles"
  },
  {
    name: "reactionroles add-role",
    description: "Add a new self-assignable role choice node to an existing active selection panel.",
    usage: "|reactionroles add-role <message_id> <@role> [label] [emoji]",
    category: "roles",
    exampleOutput: "➕ Added role @Special Member with label 'Special' and emoji ✨ to panel 1224597022.",
    permission: "Manage Roles"
  },
  {
    name: "reactionroles remove-role",
    description: "Remove an existing self-assignable role choice node from an active selection panel.",
    usage: "|reactionroles remove-role <message_id> <@role>",
    category: "roles",
    exampleOutput: "➖ Removed role @Special Member assignment node from panel 1224597022.",
    permission: "Manage Roles"
  },
  {
    name: "reactionroles delete-panel",
    description: "Delete an existing active self-assignable role panel from a channel and clean up mappings.",
    usage: "|reactionroles delete-panel <message_id>",
    category: "roles",
    exampleOutput: "🗑️ Deleted reaction role panel associated with Message ID `1224597022`.",
    permission: "Manage Roles"
  },
  {
    name: "reactionroles test",
    description: "Dispatch a temporary sandbox configuration of your role selection panel to verify layouts before live deployment.",
    usage: "|reactionroles test <#channel>",
    category: "roles",
    exampleOutput: "🧪 Dispatching temporary test panel inside #test-roles.",
    permission: "Manage Roles"
  },
  {
    name: "autorole all",
    description: "Automatically grant a specific role to all users upon joining.",
    usage: "|autorole all <@role>",
    category: "roles",
    exampleOutput: "✓ Set automatic join role for everyone to @Verified Member",
    permission: "Manage Roles"
  },
  {
    name: "autorole humans",
    description: "Automatically grant a specific role to human members upon joining.",
    usage: "|autorole humans <@role>",
    category: "roles",
    exampleOutput: "✓ Set automatic join role for humans to @Unlocks",
    permission: "Manage Roles"
  },
  {
    name: "autorole bots",
    description: "Automatically grant a specific role to newly authorized bot clients.",
    usage: "|autorole bots <@role>",
    category: "roles",
    exampleOutput: "✓ Set automatic join role for bots to @Assigned Bot",
    permission: "Manage Roles"
  },
  {
    name: "autorole ongoing",
    description: "Inspect active automatic join-role configurations.",
    usage: "|autorole ongoing",
    category: "roles",
    exampleOutput: "Active Join-Roles:\n- Humans: @Unlocks\n- Bots: @Assigned Bot",
    permission: "Manage Roles"
  },
  {
    name: "autorole delete",
    description: "Wipe all automatic join-role mappings from server registers.",
    usage: "|autorole delete",
    category: "roles",
    exampleOutput: "✓ Deleted all automatic join-role configurations.",
    permission: "Manage Roles"
  },
  {
    name: "role user",
    description: "Add or remove a role from a specific member instantly.",
    usage: "|role user <@user> <@role>",
    category: "roles",
    exampleOutput: "✓ Toggled role [Prestige Chatter] for member @active-user",
    permission: "Manage Roles"
  },
  {
    name: "role remove",
    description: "Remove a specific role from a designated member.",
    usage: "|role remove <@user> <@role>",
    category: "roles",
    exampleOutput: "✓ Removed role [Staff Mod] from member @retired-mod",
    permission: "Manage Roles"
  },
  {
    name: "role create",
    description: "Create a new role on the server with optional hex color configuration.",
    usage: "|role create <name> [hex_color]",
    category: "roles",
    exampleOutput: "✓ Created new role [Vip Member] with color #ff3b5c",
    permission: "Manage Roles"
  },
  {
    name: "role delete",
    description: "Delete an existing role from the server configuration.",
    usage: "|role delete <@role>",
    category: "roles",
    exampleOutput: "✓ Deleted role [Temp Role] from the server guild",
    permission: "Manage Roles"
  },
  {
    name: "role everyone",
    description: "Toggle a role for all non-bot members in the server.",
    usage: "|role everyone <@role>",
    category: "roles",
    exampleOutput: "✓ Toggling role [General Member] for all 450 server users...",
    permission: "Manage Roles"
  },
  {
    name: "role bots",
    description: "Toggle a specific role for all bots present in the server.",
    usage: "|role bots <@role>",
    category: "roles",
    exampleOutput: "✓ Role toggled successfully for all server bots.",
    permission: "Manage Roles"
  },
  {
    name: "role humans",
    description: "Toggle a specific role for all human members in the server.",
    usage: "|role humans <@role>",
    category: "roles",
    exampleOutput: "✓ Role toggled successfully for all human members.",
    permission: "Manage Roles"
  },
  {
    name: "role info",
    description: "Retrieve comprehensive configuration and permission info of a role.",
    usage: "|role info <@role>",
    category: "roles",
    exampleOutput: "Role details for [Moderator]:\n- Color: #ff3b5c\n- Hoisted: Yes\n- Members: 5",
    permission: "Manage Roles"
  },
  {
    name: "role list",
    description: "List all existing server roles and their respective member counts.",
    usage: "|role list",
    category: "roles",
    exampleOutput: "Roles List:\n- Admin (2 members)\n- Moderator (5 members)",
    permission: "Manage Roles"
  },
  {
    name: "role color",
    description: "Modify the hex color configuration of an existing role.",
    usage: "|role color <@role> <hex>",
    category: "roles",
    exampleOutput: "✓ Set color of role [Vip Member] to #e2f9b8",
    permission: "Manage Roles"
  },
  {
    name: "role rename",
    description: "Rename an existing role in the server hierarchy.",
    usage: "|role rename <@role> <new_name>",
    category: "roles",
    exampleOutput: "✓ Renamed role [Old Helper] to [Staff helper]",
    permission: "Manage Roles"
  },
  {
    name: "role hoist",
    description: "Toggle whether a role is shown separately in the member list.",
    usage: "|role hoist <@role>",
    category: "roles",
    exampleOutput: "✓ Toggled hoist settings for role [Staff Mod]",
    permission: "Manage Roles"
  },
  {
    name: "role mentionable",
    description: "Toggle whether a role can be mentioned by anyone in channels.",
    usage: "|role mentionable <@role>",
    category: "roles",
    exampleOutput: "✓ Toggled mentionable settings for role [Staff Mod]",
    permission: "Manage Roles"
  },

  // Auto-Moderation (Automod & Autoresponder)
  {
    name: "automodrule setup",
    description: "Configure automatic safety checks, anti-spam thresholds, and word filters inside the server.",
    usage: "|automodrule setup",
    category: "automod",
    exampleOutput: "✓ Setup active. Safety checks and anti-spam protocols deployed.",
    permission: "Manage Server"
  },
  {
    name: "automodrule edit",
    description: "Modify active anti-spam thresholds, white-lists, or word triggers.",
    usage: "|automodrule edit <setting> <value>",
    category: "automod",
    exampleOutput: "✓ Updated link-spam limits to: BLOCK_ALL.",
    permission: "Manage Server"
  },
  {
    name: "automodrule delete",
    description: "Prune and delete all active automod parameters completely.",
    usage: "|automodrule delete",
    category: "automod",
    exampleOutput: "✓ All custom automod profiles have been deleted.",
    permission: "Manage Server"
  },
  {
    name: "autoresponder setup",
    description: "Launch interactive wizard to build custom command responses and autoresponders.",
    usage: "|autoresponder setup",
    category: "automod",
    exampleOutput: "✓ Responder console initialized. Ready to record triggers.",
    permission: "Manage Server"
  },
  {
    name: "autoresponder add",
    description: "Add a rapid static trigger text auto-response card.",
    usage: "|autoresponder add <trigger> <response>",
    category: "automod",
    exampleOutput: "✓ Trigger: '!ip' -> Response: 'mc.gamerhub.net'. Responder registered.",
    permission: "Manage Server"
  },
  {
    name: "autoresponder edit",
    description: "Edit an existing auto-response trigger message or parameters inside the wizard.",
    usage: "|autoresponder edit <id>",
    category: "automod",
    exampleOutput: "✓ Edited autoresponder AR-0428 settings. Custom parameters recorded.",
    permission: "Manage Server"
  },
  {
    name: "autoresponder remove",
    description: "Remove an auto-response trigger by its serial ID.",
    usage: "|autoresponder remove <id>",
    category: "automod",
    exampleOutput: "✓ Removed auto-response profile (ID: `AR-0428`).",
    permission: "Manage Server"
  },
  {
    name: "autoresponder list",
    description: "List all active custom autoresponder triggers.",
    usage: "|autoresponder list",
    category: "automod",
    exampleOutput: "Active Responders:\n- [AR-0428] !ip: mc.gamerhub.net\n- [AR-0429] !rules: Check rules channel",
    permission: "Manage Server"
  },
  {
    name: "autoresponder info",
    description: "Inspect details, analytics, and stats for a specific autoresponder card.",
    usage: "|autoresponder info <id>",
    category: "automod",
    exampleOutput: "Responder Card Details [AR-0428]:\n- Trigger: !ip\n- Response: mc.gamerhub.net\n- Hits: 124 times",
    permission: "Manage Server"
  },
  {
    name: "autoresponder toggle",
    description: "Toggle a specific auto-response trigger offline/online.",
    usage: "|autoresponder toggle <id>",
    category: "automod",
    exampleOutput: "✓ Toggled status for [AR-0428] !ip. Current status: DISABLED.",
    permission: "Manage Server"
  },
  {
    name: "autoresponder test",
    description: "Simulate a responder trigger response to verify tags and formats.",
    usage: "|autoresponder test <id>",
    category: "automod",
    exampleOutput: "🧪 Test output for [AR-0428]: 'Welcome to the server! we have 124 members.'",
    permission: "Manage Server"
  },
  {
    name: "autoresponder variables",
    description: "See and display every placeholder variable you can use in custom auto-replies.",
    usage: "|autoresponder variables",
    category: "automod",
    exampleOutput: "Placeholder Variables:\n- {user}: Mentions the user\n- {server}: Server name\n- {memberCount}: Total server members",
    permission: "Manage Server"
  },
  {
    name: "autoresponder config",
    description: "View the overall module configuration, active limits, and analytics dashboard.",
    usage: "|autoresponder config",
    category: "automod",
    exampleOutput: "Autoresponder System Status:\n- Enabled: True\n- Active Responders: 8\n- Rate Limit: 3s cooldown",
    permission: "Manage Server"
  },
  {
    name: "autoresponder enable",
    description: "Globally activate the server's autoresponder module.",
    usage: "|autoresponder enable",
    category: "automod",
    exampleOutput: "✓ Autoresponder engine is now ONLINE.",
    permission: "Manage Server"
  },
  {
    name: "autoresponder disable",
    description: "Globally suspend all custom autoresponders.",
    usage: "|autoresponder disable",
    category: "automod",
    exampleOutput: "✓ Autoresponder engine is now SUSPENDED.",
    permission: "Manage Server"
  },

  // Verification System
  {
    name: "verification setup",
    description: "Launch interactive gatekeeper onboarding / verification system wizard.",
    usage: "|verification setup",
    category: "verification",
    exampleOutput: "✓ Setup active. Onboarding verification card generated.",
    permission: "Administrator"
  },
  {
    name: "verification edit",
    description: "Modify current verification requirements, logs, or verification roles.",
    usage: "|verification edit <setting> <value>",
    category: "verification",
    exampleOutput: "✓ Verification target role adjusted to: @Verified Member.",
    permission: "Administrator"
  },
  {
    name: "verification delete",
    description: "Delete verification gatekeepers and interactive panels cleanly.",
    usage: "|verification delete",
    category: "verification",
    exampleOutput: "✓ Verification system purged. Mappings deleted.",
    permission: "Administrator"
  },
  {
    name: "verification disable",
    description: "Turn off verification check protocols globally.",
    usage: "|verification disable",
    category: "verification",
    exampleOutput: "✓ Onboarding verification layer is now OFFLINE.",
    permission: "Administrator"
  },

  // On-Demand Voice (Selfvoice)
  {
    name: "selfvoice create",
    description: "Establish a customized temporary on-demand voice room instantly.",
    usage: "|selfvoice create [name] [limit]",
    category: "voice",
    exampleOutput: "🔊 Temp room generated! Enjoy your private lounge."
  },
  {
    name: "selfvoice setup",
    description: "Establish the Join-to-Create voice generator interface.",
    usage: "|selfvoice setup",
    category: "voice",
    exampleOutput: "✓ Join-to-Create voice node spawned successfully in #lobby.",
    permission: "Manage Server"
  },
  {
    name: "selfvoice set",
    description: "Modify temporary channel name templates, limits, bitrates, or settings.",
    usage: "|selfvoice set <setting> <value>",
    category: "voice",
    exampleOutput: "✓ Adjusted default name template: '🎮 {user}'s lobby'.",
    permission: "Manage Server"
  },
  {
    name: "selfvoice config",
    description: "View current configurations for on-demand temporary voice rooms.",
    usage: "|selfvoice config",
    category: "voice",
    exampleOutput: "Selfvoice Settings:\n- Node: #Join-To-Create\n- Default Limit: 5 users\n- Bitrate: 64kbps",
    permission: "Manage Server"
  },
  {
    name: "selfvoice panel",
    description: "Deploy the interactive owner controls panel for temporary room managers.",
    usage: "|selfvoice panel",
    category: "voice",
    exampleOutput: "✓ Temporary Voice Controls panel dispatched to current channel.",
    permission: "Manage Server"
  },
  {
    name: "selfvoice enable",
    description: "Globally activate the temporary voice room system.",
    usage: "|selfvoice enable",
    category: "voice",
    exampleOutput: "✓ On-demand voice system is now ONLINE.",
    permission: "Manage Server"
  },
  {
    name: "selfvoice disable",
    description: "Globally disable temporary voice creations.",
    usage: "|selfvoice disable",
    category: "voice",
    exampleOutput: "✓ On-demand voice system is now OFFLINE.",
    permission: "Manage Server"
  },

  // Analytics System
  {
    name: "analytics setup",
    description: "Deploy real-time updating voice channels tracking guild member metrics.",
    usage: "|analytics setup",
    category: "analytics",
    exampleOutput: "✓ Active tracking nodes deployed: Total Members, Bots, and Active Role counts.",
    permission: "Manage Server"
  },
  {
    name: "analytics edit",
    description: "Configure metric targets, names, or refresh rates.",
    usage: "|analytics edit <setting> <value>",
    category: "analytics",
    exampleOutput: "✓ Set counter update interval to: 10 minutes.",
    permission: "Manage Server"
  },
  {
    name: "analytics update",
    description: "Force immediate on-demand synchronization of statistics counter channels.",
    usage: "|analytics update",
    category: "analytics",
    exampleOutput: "✓ Forced re-indexing. Live counter channels updated immediately.",
    permission: "Manage Server"
  },
  {
    name: "analytics delete",
    description: "Cleanly delete analytics counter channels and delete tracking schedules.",
    usage: "|analytics delete",
    category: "analytics",
    exampleOutput: "✓ Wiped statistics counter channels successfully.",
    permission: "Manage Server"
  },

  // Support Ticketing
  {
    name: "ticket create",
    description: "Establish a new private support ticket channel for staff inquiries.",
    usage: "|ticket create",
    category: "ticketing",
    exampleOutput: "✓ Private support channel generated: #ticket-0428"
  },
  {
    name: "ticket close",
    description: "Close an active support room, compile a secure transcript, and archive it.",
    usage: "|ticket close",
    category: "ticketing",
    exampleOutput: "✓ support-0428 closed. Safe text transcript generated and logged."
  },
  {
    name: "ticket panel",
    description: "Deploy a persistent, interactive support ticket panel inside a designated text channel.",
    usage: "|ticket panel <#channel>",
    category: "ticketing",
    exampleOutput: "✅ Success: Interactive Support Panel deployed cleanly into #support-desk.",
    permission: "Manage Server"
  },
  {
    name: "ticket ongoing",
    description: "Inspect and view all live, active ongoing support ticket sessions in the server.",
    usage: "|ticket ongoing",
    category: "ticketing",
    exampleOutput: "📋 Live Ongoing Support Ticket Sessions:\n• Channel: #ticket-1224 | Owner: @chatter_pro",
    permission: "Manage Server"
  },
  {
    name: "ticket purge",
    description: "Safely wipe all active ticket logs from the database configuration. (Keeps existing channels intact)",
    usage: "|ticket purge",
    category: "ticketing",
    exampleOutput: "⚠️ Cloud Datastore Cleared. All active ticket records purged from database.",
    permission: "Manage Server"
  },

  // Leveling Engine
  {
    name: "leveling enable",
    description: "Enable the passive chat leveling XP accrual system in the server.",
    usage: "|leveling enable [#channel]",
    category: "leveling",
    exampleOutput: "⚙️ Leveling Enabled. Announcements will post in #levels-chat.",
    permission: "Manage Server"
  },
  {
    name: "leveling disable",
    description: "Disable the passive chat leveling XP accrual system.",
    usage: "|leveling disable",
    category: "leveling",
    exampleOutput: "⚙️ Leveling Disabled. Passive XP gains are now paused.",
    permission: "Manage Server"
  },
  {
    name: "rank",
    description: "Display current speaking level, XP milestones, and local server leaderboard rank.",
    usage: "|rank [@user]",
    category: "leveling",
    exampleOutput: "Level 14 • 8,420 XP total (Ranked #8 / 450 active chatters)"
  },
  {
    name: "leaderboard",
    description: "Retrieve and view a list of the server's top 10 most active chatters.",
    usage: "|leaderboard",
    category: "leveling",
    exampleOutput: "🏆 TOP CHAT ENGAGEMENT LEADERBOARD:\n1. @alpha (Level 34)\n2. @beta (Level 31)\n3. @gamma (Level 29)"
  },

  // Interactive Fun
  {
    name: "8ball",
    description: "Presents a random mystical prophetic answer to your yes/no question.",
    usage: "|8ball <question>",
    category: "fun",
    exampleOutput: "🎱 Question: Will I win this match?\nAnswer: Signs point to yes!"
  },
  {
    name: "capital-quiz",
    description: "Tests your geographic knowledge of world capitals with clickable hidden answers.",
    usage: "|capital-quiz",
    category: "fun",
    exampleOutput: "🗺️ What is the capital city of Japan?\nAnswer: Tokyo (Click to reveal)"
  },
  {
    name: "trivia",
    description: "Spits out a random brain-teaser trivia question to test your knowledge.",
    usage: "|trivia",
    category: "fun",
    exampleOutput: "🧠 Question: Which planet is known as the Red Planet?\nAnswer: Mars (Click to reveal)"
  },
  {
    name: "wouldyourather",
    description: "Presents an impossible Choice A or Choice B split decision prompt to discuss with your server.",
    usage: "|wouldyourather",
    category: "fun",
    exampleOutput: "🤔 Would You Rather:\nOption A: Have the ability to fly but only at 2 mph\nOption B: Teleport but only to places you've been today"
  },
  {
    name: "dice-duel",
    description: "Challenge another user to an instant randomized dice duel. Higher roll wins!",
    usage: "|dice-duel <@user>",
    category: "fun",
    exampleOutput: "🎲 DICE DUEL:\n@challenger rolled a 6!\n@opponent rolled a 4!\n🏆 @challenger wins the duel!"
  },
  {
    name: "coinflip",
    description: "Flip a high-fidelity virtual gold coin to get Heads or Tails.",
    usage: "|coinflip",
    category: "fun",
    exampleOutput: "🪙 Coinflip Result: Heads!"
  },
  {
    name: "roll",
    description: "Roll a standard six-sided die to get a random number.",
    usage: "|roll",
    category: "fun",
    exampleOutput: "🎲 You rolled a 4!"
  },
  {
    name: "dadjoke",
    description: "Get a funny, extremely corny, clean dad joke.",
    usage: "|dadjoke",
    category: "fun",
    exampleOutput: "👴 Why don't skeletons fight each other?\nAnswer: They don't have the guts!"
  },
  {
    name: "joke",
    description: "Get a classic, clean, funny general joke.",
    usage: "|joke",
    category: "fun",
    exampleOutput: "😂 Why did the scarecrow win an award?\nAnswer: Because he was outstanding in his field!"
  },
  {
    name: "spacefact",
    description: "Get a mind-blowing cosmic space fact retrieved from scientific archives.",
    usage: "|spacefact",
    category: "fun",
    exampleOutput: "🌌 Space Fact: One day on Venus is longer than one year on Earth!"
  },
  {
    name: "fortune",
    description: "Reveals a prophetic, fun, or cryptic prediction about your future.",
    usage: "|fortune",
    category: "fun",
    exampleOutput: "🔮 Prediction: A thrilling opportunity is just around the corner!"
  },
  {
    name: "cat",
    description: "Fetch a random, incredibly cute cat or kitten picture.",
    usage: "|cat",
    category: "fun",
    exampleOutput: "🐱 Here is your cute cat picture! [r/memes image link attached]"
  },
  {
    name: "dog",
    description: "Fetch a random cute dog or puppy picture to brighten your day.",
    usage: "|dog",
    category: "fun",
    exampleOutput: "🐶 Here is your cute dog picture! [r/me_irl image link attached]"
  },
  {
    name: "meme",
    description: "Fetch a highly-upvoted random meme from popular subreddits like r/dankmemes, r/me_irl, etc.",
    usage: "|meme",
    category: "fun",
    exampleOutput: "😂 [Meme Image From Reddit]\n👍 4200 Upvotes | Subreddit: r/dankmemes"
  },
  {
    name: "flavour",
    description: "Reveals your custom personality ice cream flavor right now.",
    usage: "|flavour",
    category: "fun",
    exampleOutput: "🍦 Your personality flavor right now is: Dark Chocolate Spark!"
  },
  {
    name: "rate",
    description: "Ask the bot to rate any item, person, or concept from 0 to 10.",
    usage: "|rate <thing>",
    category: "fun",
    exampleOutput: "⭐ I rate 'server design' a solid 10/10!"
  },
  {
    name: "roast",
    description: "Playfully roast another server member or yourself with a clean, funny comeback.",
    usage: "|roast <@user>",
    category: "fun",
    exampleOutput: "🔥 I'd roast you, but my mom told me not to burn trash!"
  },
  {
    name: "hug",
    description: "Give a member a warm, fuzzy virtual hug to show support.",
    usage: "|hug <@user>",
    category: "fun",
    exampleOutput: "💖 @user1 gave @user2 a warm, cozy virtual hug!"
  },
  {
    name: "slap",
    description: "Slap another user with a giant, smelly yellow trout.",
    usage: "|slap <@user>",
    category: "fun",
    exampleOutput: "💥 @user1 slaps @user2 with a giant, smelly yellow trout!"
  },
  {
    name: "predict-love",
    description: "Calculate the funny compatibility percentage between two objects, concepts, or users.",
    usage: "|predict-love <item1> <item2>",
    category: "fun",
    exampleOutput: "💕 Compatibility calculation between Alice and Bob: 84% Love match!"
  },
  {
    name: "fun-menu",
    description: "Explore what the Fun Module is and view its available commands and interactive sections.",
    usage: "|fun-menu",
    category: "fun",
    exampleOutput: "🎯 Interactive Fun Module\nWelcome to the server's entertainment hub! Mini-games, trivia, photo feeds, and community interactions."
  },

  // Utility & Core
  {
    name: "purpose",
    description: "Learn about the bot's features, creator details, and view its profile avatar.",
    usage: "|purpose",
    category: "utility",
    exampleOutput: "🤖 About Me: I'm a Discord bot designed to organize and manage your server! Features: templates, roles, moderation, levels, and cute modes."
  },
  {
    name: "help",
    description: "Display the interactive helper manual of all commands and features.",
    usage: "|help",
    category: "utility",
    exampleOutput: "ServerMiser Manual v2.4\n- Type |help to show this command list!"
  },
  {
    name: "capabilities",
    description: "Run diagnostic overview of all deployed system integrations and modules.",
    usage: "|capabilities",
    category: "utility",
    exampleOutput: "🔍 Active Capabilities:\n- Setup Engine: Online\n- Automod Filters: Active\n- Leveling: 100% Operational"
  },

  // Moderation (Extended)
  {
    name: "unwarn",
    description: "Remove a specific logged warning infraction from a server member's profile.",
    usage: "|unwarn <@user> [index]",
    category: "moderation",
    exampleOutput: "✓ Removed warning #1 from @rebel-user's profile. Total warnings: 0",
    permission: "Moderate Members"
  },

  // Birthdays
  {
    name: "birthdays set",
    description: "Register your birthday so the server can celebrate it automatically.",
    usage: "|birthdays set <month> <day> [year] [timezone]",
    category: "utility",
    exampleOutput: "🎂 Birthday saved! We'll celebrate you on March 14th."
  },
  {
    name: "birthdays remove",
    description: "Remove your saved birthday from the server's records.",
    usage: "|birthdays remove",
    category: "utility",
    exampleOutput: "✓ Your birthday has been removed from our records."
  },
  {
    name: "birthdays check",
    description: "Check the saved birthday of yourself or another member.",
    usage: "|birthdays check [@user]",
    category: "utility",
    exampleOutput: "🎂 @user1's birthday is on March 14th (Age: 24)"
  },
  {
    name: "birthdays today",
    description: "Show every member in the server celebrating a birthday today.",
    usage: "|birthdays today",
    category: "utility",
    exampleOutput: "🎉 Birthdays Today:\n- @user1\n- @user2"
  },
  {
    name: "birthdays upcoming",
    description: "List the next upcoming birthdays within a chosen number of days.",
    usage: "|birthdays upcoming [days]",
    category: "utility",
    exampleOutput: "📅 Upcoming Birthdays (Next 30 Days):\n- @user1: March 14\n- @user2: March 22"
  },
  {
    name: "birthdays list",
    description: "List every member who currently has a birthday saved on file.",
    usage: "|birthdays list",
    category: "utility",
    exampleOutput: "📋 Saved Birthdays: 12 members on file."
  },
  {
    name: "birthdays config",
    description: "View the current birthday module configuration for this server.",
    usage: "|birthdays config",
    category: "utility",
    exampleOutput: "⚙️ Birthday Config:\n- Announce Channel: #general\n- Birthday Role: @Birthday\n- Announce Time: 09:00 UTC",
    permission: "Manage Server"
  },
  {
    name: "birthdays set-channel",
    description: "Set the channel where birthday announcements will be posted.",
    usage: "|birthdays set-channel <#channel>",
    category: "utility",
    exampleOutput: "✓ Birthday announcements will now post in #general.",
    permission: "Manage Server"
  },
  {
    name: "birthdays set-role",
    description: "Set a role to be automatically granted to a member on their birthday.",
    usage: "|birthdays set-role <@role>",
    category: "utility",
    exampleOutput: "✓ @Birthday will now be granted to members on their special day.",
    permission: "Manage Server"
  },
  {
    name: "birthdays set-time",
    description: "Set the time of day birthday announcements are posted.",
    usage: "|birthdays set-time <HH:MM UTC>",
    category: "utility",
    exampleOutput: "✓ Birthday announcements will now post at 09:00 UTC daily.",
    permission: "Manage Server"
  },
  {
    name: "birthdays toggle",
    description: "Enable or disable the birthday module for this server.",
    usage: "|birthdays toggle",
    category: "utility",
    exampleOutput: "✓ Birthday module is now ENABLED.",
    permission: "Manage Server"
  },
  {
    name: "birthdays test",
    description: "Preview your own birthday announcement instantly without waiting for the real date.",
    usage: "|birthdays test",
    category: "utility",
    exampleOutput: "🧪 Test announcement dispatched: 🎉 Happy Birthday @user1!",
    permission: "Manage Server"
  },

  // Giveaways
  {
    name: "giveaway start",
    description: "Launch an interactive giveaway with a prize, duration, and winner count.",
    usage: "|giveaway start",
    category: "utility",
    exampleOutput: "🎉 Giveaway started! Prize: Discord Nitro | Winners: 1 | Ends in 24h",
    permission: "Manage Server"
  },
  {
    name: "giveaway end",
    description: "Manually end an active giveaway early and select the winners.",
    usage: "|giveaway end <id>",
    category: "utility",
    exampleOutput: "🏆 Giveaway ended early! Winner: @user1",
    permission: "Manage Server"
  },
  {
    name: "giveaway reroll",
    description: "Reroll new winners for a giveaway that has already ended.",
    usage: "|giveaway reroll <id> [count]",
    category: "utility",
    exampleOutput: "🔄 Rerolled! New winner: @user2",
    permission: "Manage Server"
  },
  {
    name: "giveaway list",
    description: "List every currently active giveaway running in the server.",
    usage: "|giveaway list",
    category: "utility",
    exampleOutput: "📋 Active Giveaways:\n- [GW-01] Discord Nitro (Ends in 12h)"
  },
  {
    name: "giveaway entries",
    description: "View the number of entries currently logged for a specific giveaway.",
    usage: "|giveaway entries <id>",
    category: "utility",
    exampleOutput: "🎟️ Giveaway [GW-01] currently has 84 entries."
  },
  {
    name: "giveaway cancel",
    description: "Cancel an active giveaway completely with no winners selected.",
    usage: "|giveaway cancel <id>",
    category: "utility",
    exampleOutput: "✓ Giveaway [GW-01] has been cancelled.",
    permission: "Manage Server"
  },
  {
    name: "giveaway edit",
    description: "Edit the details of an active giveaway, such as its prize or duration.",
    usage: "|giveaway edit <id>",
    category: "utility",
    exampleOutput: "✏️ Giveaway [GW-01] details updated successfully.",
    permission: "Manage Server"
  },

  // Invite Tracking
  {
    name: "invites check",
    description: "Check the invite statistics for yourself or another member.",
    usage: "|invites check [@user]",
    category: "utility",
    exampleOutput: "📊 @user1's Invites: 14 joins, 2 leaves, 12 net."
  },
  {
    name: "invites leaderboard",
    description: "View the top 10 inviters in the server ranked by net invites.",
    usage: "|invites leaderboard",
    category: "utility",
    exampleOutput: "🏆 Invite Leaderboard:\n1. @user1 - 45 net\n2. @user2 - 30 net"
  },
  {
    name: "invites reset",
    description: "Reset invite counts for a single member or every member in the server.",
    usage: "|invites reset [@user]",
    category: "utility",
    exampleOutput: "✓ Invite counts have been reset.",
    permission: "Manage Server"
  },
  {
    name: "invites config",
    description: "Set the channel where new-member join logs are posted with inviter credit.",
    usage: "|invites config <#channel>",
    category: "utility",
    exampleOutput: "✓ Invite join logs will now post in #welcome-logs.",
    permission: "Manage Server"
  },
  {
    name: "invites add",
    description: "Manually grant bonus invites to a member's tracked total.",
    usage: "|invites add <@user> <count>",
    category: "utility",
    exampleOutput: "✓ Added 5 bonus invites to @user1's total.",
    permission: "Manage Server"
  },
  {
    name: "invites remove",
    description: "Manually deduct invites from a member's tracked total.",
    usage: "|invites remove <@user> <count>",
    category: "utility",
    exampleOutput: "✓ Removed 5 invites from @user1's total.",
    permission: "Manage Server"
  },
  {
    name: "invites toggle",
    description: "Enable or disable invite tracking for this server.",
    usage: "|invites toggle",
    category: "utility",
    exampleOutput: "✓ Invite tracking is now ENABLED.",
    permission: "Manage Server"
  },
  {
    name: "invites stats",
    description: "View server-wide invite statistics, including total joins and top sources.",
    usage: "|invites stats",
    category: "utility",
    exampleOutput: "📈 Server Invite Stats:\n- Total Joins: 1,204\n- Top Inviter: @user1",
    permission: "Manage Server"
  },
  {
    name: "invites code",
    description: "Look up which member owns a specific invite code and its usage count.",
    usage: "|invites code <code>",
    category: "utility",
    exampleOutput: "🔗 Invite `abc123` belongs to @user1 (32 uses)."
  },
  {
    name: "invites fake-threshold",
    description: "Set the account-age threshold used to flag suspiciously new accounts as fake invites.",
    usage: "|invites fake-threshold <days>",
    category: "utility",
    exampleOutput: "✓ Fake invite threshold set to accounts younger than 7 days.",
    permission: "Manage Server"
  },

  // Starboard
  {
    name: "starboard setup",
    description: "Launch the setup wizard to configure the starboard, or pass a channel to skip it.",
    usage: "|starboard setup [#channel]",
    category: "utility",
    exampleOutput: "⭐ Starboard configured! Highlighted messages will post in #starboard.",
    permission: "Manage Server"
  },
  {
    name: "starboard config",
    description: "Modify an individual starboard setting, such as the star threshold.",
    usage: "|starboard config <setting> <value>",
    category: "utility",
    exampleOutput: "✓ Starboard threshold updated to 5 stars.",
    permission: "Manage Server"
  },
  {
    name: "starboard ignore",
    description: "Add a channel to the starboard's ignore list so its messages can't be starred.",
    usage: "|starboard ignore <#channel>",
    category: "utility",
    exampleOutput: "✓ #spam is now ignored by the starboard module.",
    permission: "Manage Server"
  },
  {
    name: "starboard unignore",
    description: "Remove a channel from the starboard's ignore list.",
    usage: "|starboard unignore <#channel>",
    category: "utility",
    exampleOutput: "✓ #spam has been removed from the starboard ignore list.",
    permission: "Manage Server"
  },
  {
    name: "starboard toggle",
    description: "Enable or disable the starboard module for this server.",
    usage: "|starboard toggle",
    category: "utility",
    exampleOutput: "✓ Starboard module is now ENABLED.",
    permission: "Manage Server"
  },
  {
    name: "starboard force",
    description: "Force a specific message onto the starboard regardless of its star count.",
    usage: "|starboard force <message_id>",
    category: "utility",
    exampleOutput: "⭐ Message `1224597022` has been forced onto the starboard.",
    permission: "Manage Server"
  },
  {
    name: "starboard stats",
    description: "View statistics for the starboard, including top-starred messages and users.",
    usage: "|starboard stats",
    category: "utility",
    exampleOutput: "📊 Starboard Stats:\n- Total Starred: 214\n- Top Message: 42 ⭐"
  },

  // Suggestions
  {
    name: "suggestions setup",
    description: "Launch the guided setup wizard for the suggestions module, or provide a channel directly.",
    usage: "|suggestions setup [#channel] [#staff-channel]",
    category: "utility",
    exampleOutput: "✓ Suggestions module configured! Submissions will post in #suggestions.",
    permission: "Manage Server"
  },
  {
    name: "suggestions config",
    description: "Configure individual suggestion module settings.",
    usage: "|suggestions config <setting> <value>",
    category: "utility",
    exampleOutput: "✓ Suggestion setting updated successfully.",
    permission: "Manage Server"
  },
  {
    name: "suggestions toggle",
    description: "Enable or disable the suggestions module for this server.",
    usage: "|suggestions toggle",
    category: "utility",
    exampleOutput: "✓ Suggestions module is now ENABLED.",
    permission: "Manage Server"
  },
  {
    name: "suggestions submit",
    description: "Submit a new suggestion for staff to review.",
    usage: "|suggestions submit <content>",
    category: "utility",
    exampleOutput: "💡 Suggestion #24 submitted for review!"
  },
  {
    name: "suggestions approve",
    description: "Approve a pending suggestion with an optional staff note.",
    usage: "|suggestions approve <id> [note]",
    category: "utility",
    exampleOutput: "✅ Suggestion #24 has been approved.",
    permission: "Manage Server"
  },
  {
    name: "suggestions deny",
    description: "Deny a pending suggestion with an optional staff note.",
    usage: "|suggestions deny <id> [note]",
    category: "utility",
    exampleOutput: "❌ Suggestion #24 has been denied.",
    permission: "Manage Server"
  },
  {
    name: "suggestions implement",
    description: "Mark a suggestion as implemented with an optional staff note.",
    usage: "|suggestions implement <id> [note]",
    category: "utility",
    exampleOutput: "🚀 Suggestion #24 has been marked as implemented.",
    permission: "Manage Server"
  },
  {
    name: "suggestions delete",
    description: "Permanently delete a suggestion from the records.",
    usage: "|suggestions delete <id>",
    category: "utility",
    exampleOutput: "🗑️ Suggestion #24 has been deleted.",
    permission: "Manage Server"
  },
  {
    name: "suggestions list",
    description: "List suggestions filtered by their current status.",
    usage: "|suggestions list [status]",
    category: "utility",
    exampleOutput: "📋 Suggestions (Pending): #24, #25, #26"
  },
  {
    name: "suggestions my",
    description: "View all of your own submitted suggestions and their current status.",
    usage: "|suggestions my",
    category: "utility",
    exampleOutput: "📋 Your Suggestions:\n- #24: Pending\n- #19: Approved"
  },

  // Embed Builder
  {
    name: "embed create",
    description: "Open a guided modal to start building a brand-new rich embed.",
    usage: "|embed create",
    category: "utility",
    exampleOutput: "✓ New embed session started. Use the modal to fill in your content.",
    permission: "Manage Server"
  },
  {
    name: "embed edit",
    description: "Load an existing bot-sent embed message into your session for editing.",
    usage: "|embed edit <message_id>",
    category: "utility",
    exampleOutput: "✓ Loaded embed from message `1224597022` into your editing session.",
    permission: "Manage Server"
  },
  {
    name: "embed send",
    description: "Send your in-progress embed session to a target channel.",
    usage: "|embed send <#channel>",
    category: "utility",
    exampleOutput: "✓ Embed sent successfully to #announcements.",
    permission: "Manage Server"
  },
  {
    name: "embed field add",
    description: "Open a modal to add a new field to your in-progress embed.",
    usage: "|embed field add",
    category: "utility",
    exampleOutput: "✓ Field added to your embed session.",
    permission: "Manage Server"
  },
  {
    name: "embed field remove",
    description: "Remove a field from your in-progress embed by its index number.",
    usage: "|embed field remove <index>",
    category: "utility",
    exampleOutput: "✓ Field #2 removed from your embed session.",
    permission: "Manage Server"
  },
  {
    name: "embed image",
    description: "Set the large image URL displayed on your in-progress embed.",
    usage: "|embed image <url>",
    category: "utility",
    exampleOutput: "✓ Image set on your embed session.",
    permission: "Manage Server"
  },
  {
    name: "embed thumbnail",
    description: "Set the thumbnail URL displayed on your in-progress embed.",
    usage: "|embed thumbnail <url>",
    category: "utility",
    exampleOutput: "✓ Thumbnail set on your embed session.",
    permission: "Manage Server"
  },
  {
    name: "embed color",
    description: "Set the accent color of your in-progress embed using a hex code.",
    usage: "|embed color <hex>",
    category: "utility",
    exampleOutput: "✓ Embed color set to #ff3b5c.",
    permission: "Manage Server"
  },
  {
    name: "embed footer",
    description: "Set the footer text and optional icon of your in-progress embed.",
    usage: "|embed footer <text> [icon_url]",
    category: "utility",
    exampleOutput: "✓ Footer set on your embed session.",
    permission: "Manage Server"
  },
  {
    name: "embed author",
    description: "Set the author name, icon, and link of your in-progress embed.",
    usage: "|embed author <name> [icon_url] [url]",
    category: "utility",
    exampleOutput: "✓ Author set on your embed session.",
    permission: "Manage Server"
  },
  {
    name: "embed preview",
    description: "Preview your current in-progress embed before sending it.",
    usage: "|embed preview",
    category: "utility",
    exampleOutput: "👁️ Preview generated for your current embed session.",
    permission: "Manage Server"
  },
  {
    name: "embed clear",
    description: "Clear your in-progress embed session and start over.",
    usage: "|embed clear",
    category: "utility",
    exampleOutput: "✓ Embed session cleared.",
    permission: "Manage Server"
  },
  {
    name: "embed template save",
    description: "Save your current in-progress embed as a reusable named template.",
    usage: "|embed template save <name>",
    category: "utility",
    exampleOutput: "💾 Embed saved as template 'announcement'.",
    permission: "Manage Server"
  },
  {
    name: "embed template load",
    description: "Load a previously saved embed template into your active session.",
    usage: "|embed template load <name>",
    category: "utility",
    exampleOutput: "✓ Loaded template 'announcement' into your session.",
    permission: "Manage Server"
  },
  {
    name: "embed template list",
    description: "List every saved embed template available for this server.",
    usage: "|embed template list",
    category: "utility",
    exampleOutput: "📋 Saved Templates: announcement, rules, giveaway-card"
  },
  {
    name: "embed template delete",
    description: "Delete a saved embed template permanently.",
    usage: "|embed template delete <name>",
    category: "utility",
    exampleOutput: "🗑️ Template 'announcement' has been deleted.",
    permission: "Manage Server"
  }
];

// FAQ type definition
interface FAQItem {
  question: string;
  answer: string;
}

const FAQS: FAQItem[] = [
  {
    question: "What are the core modules of ServerMiser?",
    answer: "ServerMiser is an all-in-one Discord application focusing on four core pillars: automated server setup (creating organized layout structures, categories, channels, and basic roles), active moderation protection (warnings, temporary timeouts, kicks, and bans), custom ticketing desks for support inquiries, and gamified leveling systems complete with rank cards and prestige roles."
  },
  {
    question: "Why is the bot called ServerMiser if it doesn't prune servers?",
    answer: "ServerMiser is a title chosen for its sleek, high-contrast aesthetic and memorable presence. While the literal definition of 'miser' relates to hoarding, our bot's true purpose is to act as your complete server administration and engagement partner — saving you time, de-cluttering manual management, and boosting user chatter."
  },
  {
    question: "How does the server setup module work?",
    answer: "Our automated setup engine is ServerMiser's main module. In 1-click, you can trigger `/setup` or `/setup-custom` to instantly establish organized categories, voice lobbies, ticketing hubs, staff desks, and basic roles. This eliminates manual configuration entirely."
  },
  {
    question: "Can I customize the leveling yet?",
    answer: "As ServerMiser is a brand-new application, the leveling engine is currently operating in standard automatic mode. Passive XP accrual rates are fixed to ensure optimal performance. However, rich customization options—including custom multipliers, role rewards, and custom rank card backgrounds—will be added very soon in an upcoming update!"
  },
  {
    question: "How does the ticketing system manage support queries?",
    answer: "ServerMiser allows you to deploy interactive support button panels in any channel. When a member clicks a button, a private ticket channel is generated, granting view permissions to staff and the user. On ticket closure, a complete transcript is archived and dispatched to your logs."
  }
];

// Dilemmas definition for custom Decision Terminal
interface Dilemma {
  id: string;
  question: string;
  context: string;
  miserPath: {
    title: string;
    description: string;
    terminalLogs: string[];
    endingHealth: number;
    impactText: string;
  };
  nudgePath: {
    title: string;
    description: string;
    terminalLogs: string[];
    endingHealth: number;
    impactText: string;
  };
}

const DILEMMAS: Dilemma[] = [
  {
    id: "prune",
    question: "Should we prune 500 members inactive for 60+ days?",
    context: "Our member count is high, but chat activity feels quiet and server loading times are slowing down.",
    miserPath: {
      title: "Miser Sweep: Automated Purging",
      description: "Prune them instantly! Free up the roster, improve member quality ratio, and restore active server speed.",
      terminalLogs: [
        "[miser-audit]: Initializing dry-run member scan...",
        "[miser-audit]: Scanned 842 total guild members.",
        "[miser-audit]: Detected 512 accounts with 0 activity metrics for 60+ days.",
        "[miser-action]: Initiating /prune dry-run evictions...",
        "[miser-action]: Safely removed 512 inactive nodes.",
        "[miser-status]: Server index database size compressed by 38%."
      ],
      endingHealth: 98,
      impactText: "✓ EVISCERATED 512 SILENT SLOTS // HEALTH INCREASED TO 98% // DATABASE RE-INDEXED"
    },
    nudgePath: {
      title: "Active Nudge: Automated Surveys",
      description: "Keep them, but trigger a wake-up campaign. Push a custom automated survey or server game invite to see who stays.",
      terminalLogs: [
        "[miser-audit]: Scanning cold-interest accounts...",
        "[miser-audit]: Detected 512 high-probability churn nodes.",
        "[miser-action]: Triggering /engage start with interactive gamified polls...",
        "[miser-action]: Dispatched low-stress, playful nudges in DM channels.",
        "[miser-engagement]: 142 members responded and revived their roles.",
        "[miser-status]: Recovered active ratio by +17%."
      ],
      endingHealth: 85,
      impactText: "⚠ DM CAMPAIGN DEPLOYED // 142 CHATTER ACCOUNTS REVIVED // HEALTH AT 85%"
    }
  },
  {
    id: "roles",
    question: "Should we delete 20+ unused booster/event staff roles?",
    context: "Our roles directory stretches forever. Staff are confused, and permissions are overlapping dangerously.",
    miserPath: {
      title: "Miser Sweep: Role Liquidation",
      description: "Wipe them out. Consolidate into 3 simple role groups. Prevent 'permission creep' where retired mods still have admin access.",
      terminalLogs: [
        "[miser-audit]: Auditing guild role matrices...",
        "[miser-audit]: Found 28 custom roles assigned to 0 active members.",
        "[miser-audit]: WARNING: 4 legacy roles contain redundant administrator scopes.",
        "[miser-action]: Purging 25 redundant role IDs...",
        "[miser-action]: Pruned empty booster tags and event descriptors.",
        "[miser-status]: Permissions lock verified. Role directory clean."
      ],
      endingHealth: 96,
      impactText: "✓ DELETED 25 EMPTY STACK ROLES // PERMISSIONS FULLY SECURED // HEALTH AT 96%"
    },
    nudgePath: {
      title: "Active Nudge: Structured Role Archive",
      description: "Keep the roles but completely strip their active permissions, moving them to a locked folder for historical record.",
      terminalLogs: [
        "[miser-audit]: Analyzing legacy security profile...",
        "[miser-audit]: 28 legacy roles flagged for permission stripping.",
        "[miser-action]: Locking permission modifiers...",
        "[miser-action]: Moved legacy roles into read-only archive categories.",
        "[miser-status]: Roles preserved, active permissions nullified."
      ],
      endingHealth: 82,
      impactText: "✓ ROLE PERMISSIONS SHIELDED // 28 STAGED IN BACKUP LABELS // HEALTH AT 82%"
    }
  },
  {
    id: "bot_spam",
    question: "Should we delete spam commands 5 minutes after they run?",
    context: "Bots are filling our channels with music, rank, and coin command spam, making conversations unreadable.",
    miserPath: {
      title: "Miser Sweep: Absolute Auto-Clean",
      description: "Delete them! Keep channels pristine. Let people play, but wipe all prefix and slash commands after 5 minutes.",
      terminalLogs: [
        "[miser-audit]: Monitoring channel chat logs...",
        "[miser-audit]: Spam density in general-chat is 42% prefix commands.",
        "[miser-action]: Activating auto-miser sweep channel:#bot-commands delay:5m.",
        "[miser-action]: Sweep script running. Periodically sweeping bot output.",
        "[miser-status]: Chat readability index increased by 90%."
      ],
      endingHealth: 95,
      impactText: "✓ AUTO-CLEAN ENABLED // 5-MIN SWEEP TRIGGER RUNNING // HEALTH AT 95%"
    },
    nudgePath: {
      title: "Active Nudge: Isolated Thread Redirect",
      description: "Redirect all bot commands into automated private threads that auto-archive themselves after 1 hour of silence.",
      terminalLogs: [
        "[miser-audit]: Tracking bot command triggers...",
        "[miser-action]: Creating dynamic isolated thread for active bot sessions...",
        "[miser-action]: Configured auto-redirect rules for 8 known gaming bots.",
        "[miser-thread]: Active sessions moved safely to temporary thread.",
        "[miser-status]: General channels clean. Temporary threads active."
      ],
      endingHealth: 88,
      impactText: "✓ COMMAND REDIRECT TO THREADS LIVE // CHANNELS CLEAN // HEALTH AT 88%"
    }
  }
];

interface ChannelNode {
  name: string;
  type: "text" | "voice";
  roles?: string[];
}

interface CategoryNode {
  name: string;
  channels: ChannelNode[];
}

interface TemplateHierarchy {
  id: string;
  name: string;
  emoji: string;
  description: string;
  roles: string[];
  categories: CategoryNode[];
}

const SETUP_TEMPLATES: TemplateHierarchy[] = [
  {
    id: "community",
    name: "COMMUNITY HUB",
    emoji: "🌐",
    description: "Ideal for general hangouts, gaming groups, and multi-interest servers.",
    roles: ["@System Administrator", "@Server Moderator", "@Trial Staff", "@Premium Server Booster", "@Verified Member"],
    categories: [
      {
        name: "📢 IMPORTANT (READ-ONLY)",
        channels: [
          { name: "welcome-gate", type: "text" },
          { name: "server-rules", type: "text" },
          { name: "announcements", type: "text" }
        ]
      },
      {
        name: "🎀 GENERAL",
        channels: [
          { name: "global-chat", type: "text" },
          { name: "media-vault", type: "text" },
          { name: "introductions-lobby", type: "text" },
          { name: "server-events", type: "text" },
          { name: "meme-dump", type: "text" }
        ]
      },
      {
        name: "🤖 SYSTEMS",
        channels: [
          { name: "level-tracking", type: "text" },
          { name: "bot-commands", type: "text" }
        ]
      },
      {
        name: "🔊 VOICE LOUNGES",
        channels: [
          { name: "Main Public Lounge", type: "voice" },
          { name: "Quiet Study Node", type: "voice" },
          { name: "Casual Chat 1", type: "voice" }
        ]
      },
      {
        name: "🔒 STAFF ZONE",
        channels: [
          { name: "audit-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "mod-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "staff-headquarters", type: "text", roles: ["@System Administrator", "@Server Moderator"] }
        ]
      }
    ]
  },
  {
    id: "gaming",
    name: "GAMING SQUAD",
    emoji: "🎮",
    description: "Tailored for guild leagues, tournament brackets, and streaming networks.",
    roles: ["@System Administrator", "@Server Moderator", "@Trial Staff", "@Premium Server Booster", "@Verified Member"],
    categories: [
      {
        name: "📢 IMPORTANT (READ-ONLY)",
        channels: [
          { name: "welcome-gate", type: "text" },
          { name: "server-rules", type: "text" },
          { name: "announcements", type: "text" }
        ]
      },
      {
        name: "🎀 GENERAL",
        channels: [
          { name: "global-chat", type: "text" },
          { name: "media-vault", type: "text" },
          { name: "tournament-hub", type: "text" },
          { name: "brackets-standings", type: "text" },
          { name: "meta-theorycrafting", type: "text" }
        ]
      },
      {
        name: "🤖 SYSTEMS",
        channels: [
          { name: "level-tracking", type: "text" },
          { name: "bot-commands", type: "text" }
        ]
      },
      {
        name: "🔊 VOICE LOUNGES",
        channels: [
          { name: "Squad Room Alpha", type: "voice" },
          { name: "Squad Room Beta", type: "voice" }
        ]
      },
      {
        name: "🔒 STAFF ZONE",
        channels: [
          { name: "audit-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "mod-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "staff-headquarters", type: "text", roles: ["@System Administrator", "@Server Moderator"] }
        ]
      }
    ]
  },
  {
    id: "study",
    name: "STUDY HUB",
    emoji: "📚",
    description: "Configured for student groups, classes, bootcamps, or research guilds.",
    roles: ["@System Administrator", "@Server Moderator", "@Trial Staff", "@Premium Server Booster", "@Verified Member"],
    categories: [
      {
        name: "📢 IMPORTANT (READ-ONLY)",
        channels: [
          { name: "welcome-gate", type: "text" },
          { name: "server-rules", type: "text" },
          { name: "announcements", type: "text" }
        ]
      },
      {
        name: "🎀 GENERAL",
        channels: [
          { name: "global-chat", type: "text" },
          { name: "media-vault", type: "text" },
          { name: "study-materials", type: "text" },
          { name: "research-archives", type: "text" },
          { name: "peer-tutoring", type: "text" }
        ]
      },
      {
        name: "🤖 SYSTEMS",
        channels: [
          { name: "level-tracking", type: "text" },
          { name: "bot-commands", type: "text" }
        ]
      },
      {
        name: "🔊 VOICE LOUNGES",
        channels: [
          { name: "Silent Library Room", type: "voice" },
          { name: "Group Work Desk", type: "voice" }
        ]
      },
      {
        name: "🔒 STAFF ZONE",
        channels: [
          { name: "audit-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "mod-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "staff-headquarters", type: "text", roles: ["@System Administrator", "@Server Moderator"] }
        ]
      }
    ]
  },
  {
    id: "business",
    name: "BUSINESS CO",
    emoji: "💼",
    description: "Sleek organizational layout for commercial products and corporations.",
    roles: ["@System Administrator", "@Server Moderator", "@Trial Staff", "@Premium Server Booster", "@Verified Member"],
    categories: [
      {
        name: "📢 IMPORTANT (READ-ONLY)",
        channels: [
          { name: "welcome-gate", type: "text" },
          { name: "server-rules", type: "text" },
          { name: "announcements", type: "text" }
        ]
      },
      {
        name: "🎀 GENERAL",
        channels: [
          { name: "global-chat", type: "text" },
          { name: "media-vault", type: "text" },
          { name: "corporate-meetings", type: "text" },
          { name: "product-roadmap", type: "text" },
          { name: "sprint-schedules", type: "text" }
        ]
      },
      {
        name: "🤖 SYSTEMS",
        channels: [
          { name: "level-tracking", type: "text" },
          { name: "bot-commands", type: "text" }
        ]
      },
      {
        name: "🔊 VOICE LOUNGES",
        channels: [
          { name: "Boardroom Alpha Node", type: "voice" },
          { name: "Project Team Sync", type: "voice" }
        ]
      },
      {
        name: "🔒 STAFF ZONE",
        channels: [
          { name: "audit-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "mod-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "staff-headquarters", type: "text", roles: ["@System Administrator", "@Server Moderator"] }
        ]
      }
    ]
  },
  {
    id: "creative",
    name: "CREATIVE STUDIO",
    emoji: "🎨",
    description: "Optimized for art portfolios, critique ateliers, and gallery events.",
    roles: ["@System Administrator", "@Server Moderator", "@Trial Staff", "@Premium Server Booster", "@Verified Member"],
    categories: [
      {
        name: "📢 IMPORTANT (READ-ONLY)",
        channels: [
          { name: "welcome-gate", type: "text" },
          { name: "server-rules", type: "text" },
          { name: "announcements", type: "text" }
        ]
      },
      {
        name: "🎀 GENERAL",
        channels: [
          { name: "global-chat", type: "text" },
          { name: "media-vault", type: "text" },
          { name: "portfolio-showcase", type: "text" },
          { name: "art-wip-critique", type: "text" },
          { name: "open-commissions", type: "text" }
        ]
      },
      {
        name: "🤖 SYSTEMS",
        channels: [
          { name: "level-tracking", type: "text" },
          { name: "bot-commands", type: "text" }
        ]
      },
      {
        name: "🔊 VOICE LOUNGES",
        channels: [
          { name: "Live Atelier Audio", type: "voice" },
          { name: "Co-Working Studio", type: "voice" }
        ]
      },
      {
        name: "🔒 STAFF ZONE",
        channels: [
          { name: "audit-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "mod-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "staff-headquarters", type: "text", roles: ["@System Administrator", "@Server Moderator"] }
        ]
      }
    ]
  },
  {
    id: "development",
    name: "DEV ENG FORGE",
    emoji: "💻",
    description: "Brutalist software development layout for git webhooks and code pairings.",
    roles: ["@System Administrator", "@Server Moderator", "@Trial Staff", "@Premium Server Booster", "@Verified Member"],
    categories: [
      {
        name: "📢 IMPORTANT (READ-ONLY)",
        channels: [
          { name: "welcome-gate", type: "text" },
          { name: "server-rules", type: "text" },
          { name: "announcements", type: "text" }
        ]
      },
      {
        name: "🎀 GENERAL",
        channels: [
          { name: "global-chat", type: "text" },
          { name: "media-vault", type: "text" },
          { name: "production-changelogs", type: "text" },
          { name: "git-webhook-feed", type: "text" },
          { name: "api-specifications", type: "text" }
        ]
      },
      {
        name: "🤖 SYSTEMS",
        channels: [
          { name: "level-tracking", type: "text" },
          { name: "bot-commands", type: "text" }
        ]
      },
      {
        name: "🔊 VOICE LOUNGES",
        channels: [
          { name: "Pair Coding Terminals", type: "voice" },
          { name: "Standup Sync voice", type: "voice" }
        ]
      },
      {
        name: "🔒 STAFF ZONE",
        channels: [
          { name: "audit-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "mod-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "staff-headquarters", type: "text", roles: ["@System Administrator", "@Server Moderator"] }
        ]
      }
    ]
  },
  {
    id: "finance",
    name: "FINTECH DESK",
    emoji: "💵",
    description: "Configured for on-chain telemetry, technical news feeds, and macro charts.",
    roles: ["@System Administrator", "@Server Moderator", "@Trial Staff", "@Premium Server Booster", "@Verified Member"],
    categories: [
      {
        name: "📢 IMPORTANT (READ-ONLY)",
        channels: [
          { name: "welcome-gate", type: "text" },
          { name: "server-rules", type: "text" },
          { name: "announcements", type: "text" }
        ]
      },
      {
        name: "🎀 GENERAL",
        channels: [
          { name: "global-chat", type: "text" },
          { name: "media-vault", type: "text" },
          { name: "macro-market-news", type: "text" },
          { name: "on-chain-analytics", type: "text" },
          { name: "technical-charts", type: "text" }
        ]
      },
      {
        name: "🤖 SYSTEMS",
        channels: [
          { name: "level-tracking", type: "text" },
          { name: "bot-commands", type: "text" }
        ]
      },
      {
        name: "🔊 VOICE LOUNGES",
        channels: [
          { name: "Live Squawk Pit", type: "voice" },
          { name: "Trading Desk Comms", type: "voice" }
        ]
      },
      {
        name: "🔒 STAFF ZONE",
        channels: [
          { name: "audit-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "mod-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "staff-headquarters", type: "text", roles: ["@System Administrator", "@Server Moderator"] }
        ]
      }
    ]
  },
  {
    id: "roleplay",
    name: "ROLEPLAY WORLD",
    emoji: "🎭",
    description: "Immersive narrative structures with lorebooks and character profiles.",
    roles: ["@System Administrator", "@Server Moderator", "@Trial Staff", "@Premium Server Booster", "@Verified Member"],
    categories: [
      {
        name: "📢 IMPORTANT (READ-ONLY)",
        channels: [
          { name: "welcome-gate", type: "text" },
          { name: "server-rules", type: "text" },
          { name: "announcements", type: "text" }
        ]
      },
      {
        name: "🎀 GENERAL",
        channels: [
          { name: "global-chat", type: "text" },
          { name: "media-vault", type: "text" },
          { name: "world-lorebook", type: "text" },
          { name: "character-compendium", type: "text" },
          { name: "out-of-character", type: "text" }
        ]
      },
      {
        name: "🤖 SYSTEMS",
        channels: [
          { name: "level-tracking", type: "text" },
          { name: "bot-commands", type: "text" }
        ]
      },
      {
        name: "🔊 VOICE LOUNGES",
        channels: [
          { name: "The Drifting Tavern", type: "voice" },
          { name: "Campfire Chat voice", type: "voice" }
        ]
      },
      {
        name: "🔒 STAFF ZONE",
        channels: [
          { name: "audit-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "mod-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "staff-headquarters", type: "text", roles: ["@System Administrator", "@Server Moderator"] }
        ]
      }
    ]
  },
  {
    id: "minimalist",
    name: "MINIMALIST STARTER",
    emoji: "⚡",
    description: "Clean slate layout focusing on conversation basics without category clutter.",
    roles: ["@System Administrator", "@Server Moderator", "@Trial Staff", "@Premium Server Booster", "@Verified Member"],
    categories: [
      {
        name: "📢 IMPORTANT (READ-ONLY)",
        channels: [
          { name: "welcome-gate", type: "text" },
          { name: "server-rules", type: "text" },
          { name: "announcements", type: "text" }
        ]
      },
      {
        name: "🎀 GENERAL",
        channels: [
          { name: "global-chat", type: "text" },
          { name: "media-vault", type: "text" },
          { name: "clean-slate", type: "text" }
        ]
      },
      {
        name: "🤖 SYSTEMS",
        channels: [
          { name: "level-tracking", type: "text" },
          { name: "bot-commands", type: "text" }
        ]
      },
      {
        name: "🔊 VOICE LOUNGES",
        channels: [
          { name: "zen-focus-node", type: "voice" }
        ]
      },
      {
        name: "🔒 STAFF ZONE",
        channels: [
          { name: "audit-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "mod-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "staff-headquarters", type: "text", roles: ["@System Administrator", "@Server Moderator"] }
        ]
      }
    ]
  },
  {
    id: "history",
    name: "HISTORY ARCHIVE",
    emoji: "🏛️",
    description: "Ideal for chronicling historical topics, museum exhibits, and archives.",
    roles: ["@System Administrator", "@Server Moderator", "@Trial Staff", "@Premium Server Booster", "@Verified Member"],
    categories: [
      {
        name: "📢 IMPORTANT (READ-ONLY)",
        channels: [
          { name: "welcome-gate", type: "text" },
          { name: "server-rules", type: "text" },
          { name: "announcements", type: "text" }
        ]
      },
      {
        name: "🎀 GENERAL",
        channels: [
          { name: "global-chat", type: "text" },
          { name: "media-vault", type: "text" },
          { name: "ancient-archives", type: "text" },
          { name: "museum-exhibits", type: "text" },
          { name: "chronicle-debates", type: "text" }
        ]
      },
      {
        name: "🤖 SYSTEMS",
        channels: [
          { name: "level-tracking", type: "text" },
          { name: "bot-commands", type: "text" }
        ]
      },
      {
        name: "🔊 VOICE LOUNGES",
        channels: [
          { name: "Grand Lyceum Hall", type: "voice" }
        ]
      },
      {
        name: "🔒 STAFF ZONE",
        channels: [
          { name: "audit-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "mod-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "staff-headquarters", type: "text", roles: ["@System Administrator", "@Server Moderator"] }
        ]
      }
    ]
  },
  {
    id: "geography",
    name: "GEOGRAPHY CORPS",
    emoji: "🗺️",
    description: "Optimized for cartography charts, geology, and expedition journals.",
    roles: ["@System Administrator", "@Server Moderator", "@Trial Staff", "@Premium Server Booster", "@Verified Member"],
    categories: [
      {
        name: "📢 IMPORTANT (READ-ONLY)",
        channels: [
          { name: "welcome-gate", type: "text" },
          { name: "server-rules", type: "text" },
          { name: "announcements", type: "text" }
        ]
      },
      {
        name: "🎀 GENERAL",
        channels: [
          { name: "global-chat", type: "text" },
          { name: "media-vault", type: "text" },
          { name: "atlas-cartography", type: "text" },
          { name: "expedition-journals", type: "text" },
          { name: "geology-seismic-info", type: "text" }
        ]
      },
      {
        name: "🤖 SYSTEMS",
        channels: [
          { name: "level-tracking", type: "text" },
          { name: "bot-commands", type: "text" }
        ]
      },
      {
        name: "🔊 VOICE LOUNGES",
        channels: [
          { name: "Basecamp Comms Link", type: "voice" }
        ]
      },
      {
        name: "🔒 STAFF ZONE",
        channels: [
          { name: "audit-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "mod-logs", type: "text", roles: ["@System Administrator", "@Server Moderator"] },
          { name: "staff-headquarters", type: "text", roles: ["@System Administrator", "@Server Moderator"] }
        ]
      }
    ]
  }
];

// Discord Bot Configuration - loaded from environment variables
const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || "1518952247927640276";

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  
  // Setup Preview expanded state
  const [selectedPreviewTemplate, setSelectedPreviewTemplate] = useState<string>("community");
  const [previewTemplateExpanded, setPreviewTemplateExpanded] = useState<boolean>(false);

  // Command simulation state
  const [activeSimulatingCommand, setActiveSimulatingCommand] = useState<Command | null>(null);
  const [simInputArguments, setSimInputArguments] = useState<string>("");
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [simState, setSimState] = useState<"idle" | "running" | "success">("idle");
  const [simProgress, setSimProgress] = useState<number>(0);

  const runCommandSimulation = (cmd: Command, customArgs?: string) => {
    const input = customArgs !== undefined ? customArgs : cmd.usage;
    setSimInputArguments(input);
    setSimState("running");
    setSimProgress(0);
    setSimLogs([]);

    const steps: string[] = [];
    const commandLabel = cmd.name;

    if (commandLabel === "ban") {
      steps.push(
        `[miser-auth]: Validating Admin credentials...`,
        `[miser-target]: Scanning user snowflake: ${input.split(" ")[1] || "@spammer69"}`,
        `[miser-audit]: Checking infractions database... 1 warn found.`,
        `[miser-action]: Executing REST-API call to ban...`,
        `[miser-action]: Evicted member and purged 7 days of message cache.`,
        `[miser-status]: Ban log recorded in #miser-audit-log.`
      );
    } else if (commandLabel === "kick") {
      steps.push(
        `[miser-auth]: Validating Moderator credentials...`,
        `[miser-target]: Scanning user snowflake: ${input.split(" ")[1] || "@impatient_user"}`,
        `[miser-action]: Transmitting KICK payload to members api...`,
        `[miser-action]: Member evicted successfully.`,
        `[miser-status]: Kick log archived.`
      );
    } else if (commandLabel === "mute") {
      const args = input.split(" ");
      const user = args[1] || "@noisy_speaker";
      const duration = args[2] || "10m";
      steps.push(
        `[miser-auth]: Authorizing TIMEOUT privileges...`,
        `[miser-target]: Target member: ${user}`,
        `[miser-action]: Overriding text/voice permissions for ${duration}...`,
        `[miser-action]: Applied temporary timeout successfully.`,
        `[miser-status]: Mute profile registered.`
      );
    } else if (commandLabel === "unmute") {
      steps.push(
        `[miser-auth]: Authorizing UNMUTE privileges...`,
        `[miser-target]: Target member: ${input.split(" ")[1] || "@noisy_speaker"}`,
        `[miser-action]: Resetting timeout duration flag...`,
        `[miser-action]: Restored voice and text permissions.`,
        `[miser-status]: Active timeout removed.`
      );
    } else if (commandLabel === "unban") {
      const username = input.split(" ")[1] || "john_doe";
      steps.push(
        `[miser-auth]: Authorizing BAN_MEMBERS privileges...`,
        `[miser-target]: Fetching server ban registry directly from Discord API...`,
        `[miser-scan]: Searching for banned user profile: "${username}"`,
        `[miser-action]: Match found! Revoking ban registry for user ID 48219482...`,
        `[miser-status]: User successfully unbanned. Action logged in mod-logs.`
      );
    } else if (commandLabel === "warn") {
      const args = input.split(" ");
      const user = args[1] || "@rebel-user";
      const reason = args.slice(2).join(" ") || "General rule breach";
      steps.push(
        `[miser-auth]: Authorizing WARN privileges...`,
        `[miser-target]: User targeted: ${user}`,
        `[miser-action]: Appending warning card to infraction index...`,
        `[miser-db]: New warning recorded: "${reason}"`,
        `[miser-status]: Warning registered. User notified via DM.`
      );
    } else if (commandLabel === "warnings") {
      steps.push(
        `[miser-db]: Connecting to infraction database clusters...`,
        `[miser-query]: Querying logs for ${input.split(" ")[1] || "@rebel-user"}`,
        `[miser-action]: Aggregating historic warnings... 1 match found.`,
        `[miser-status]: Outputting infraction profile.`
      );
    } else if (commandLabel === "setup") {
      const template = input.split(" ")[1] || "community";
      steps.push(
        `[miser-setup]: Reading channel template database key: "${template}"`,
        `[miser-setup]: Purging active layout draft...`,
        `[miser-setup]: Deploying structured category folders...`,
        `[miser-setup]: Creating channels...`,
        `[miser-setup]: Injecting basic permission matrices for roles: Admin, Mod, Member...`,
        `[miser-status]: Deploy complete! Your server is now fully organized.`
      );
    } else if (commandLabel === "clear-channels") {
      steps.push(
        `[miser-auth]: CRITICAL ACTION AUTHORIZED (Manage Server Required)`,
        `[miser-setup]: Scanning all existing guild channels and categories...`,
        `[miser-setup]: Flagged all channels for direct liquidation...`,
        `[miser-action]: Initiating multi-node recursive delete...`,
        `[miser-action]: Deleted 12 text channels, 6 voice channels, and 4 categories.`,
        `[miser-status]: Total channels purged. Server layout is now blank.`
      );
    } else if (commandLabel.startsWith("reactionroles")) {
      steps.push(
        `[miser-roles]: Authorizing Manage Roles privilege...`,
        `[miser-roles]: Parsing roles mapping structure...`,
        `[miser-roles]: Building modern buttons / dropdown elements...`,
        `[miser-roles]: Dispatching self-assignable component panel...`,
        `[miser-db]: Saved active role panel mapping to MongoDB registry.`,
        `[miser-status]: Role panel successfully deployed in specified channel.`
      );
    } else if (commandLabel === "cute") {
      steps.push(
        `[miser-config]: Reading typographic preference...`,
        `[miser-config]: Modifying template name format to: ${input.split(" ")[1] || "small-caps"}`,
        `[miser-status]: Cute mode layout registered for subsequent setups.`
      );
    } else if (commandLabel === "welcome") {
      steps.push(
        `[miser-config]: Binding join event triggers to gateway...`,
        `[miser-config]: Webhook targets set to: ${input.split(" ")[1] || "#welcome"}`,
        `[miser-status]: Welcome announcer successfully enabled.`
      );
    } else if (commandLabel.startsWith("role")) {
      steps.push(
        `[miser-auth]: Validating Role Management authority...`,
        `[miser-db]: Querying server role configurations...`,
        `[miser-action]: Modifying permission/color/membership details...`,
        `[miser-status]: Role command action executed successfully.`
      );
    } else if (commandLabel.startsWith("ticket")) {
      if (commandLabel === "ticket panel") {
        steps.push(
          `[miser-auth]: Validating Admin permissions...`,
          `[miser-ticket]: Creating support panel layout embed and action row buttons...`,
          `[miser-action]: Dispatching interactive button component into target channel...`,
          `[miser-status]: Support ticket panel deployed successfully.`
        );
      } else if (commandLabel === "ticket ongoing") {
        steps.push(
          `[miser-db]: Querying active support channels from MongoDB database...`,
          `[miser-action]: Compiling active ticket threads and user configurations...`,
          `[miser-status]: Ongoing tickets profile dispatched successfully.`
        );
      } else if (commandLabel === "ticket purge") {
        steps.push(
          `[miser-auth]: CRITICAL ACTION AUTHORIZED (Manage Server Required)`,
          `[miser-db]: Deleting active ticket mapping entries...`,
          `[miser-action]: Database cleared. Wiped active ticket document nodes.`,
          `[miser-status]: Support ticket datastore cleanly purged.`
        );
      } else {
        steps.push(
          `[miser-ticket]: Resolving ticketing desk channel settings...`,
          `[miser-action]: Creating isolated channel thread...`,
          `[miser-status]: support action completed.`
        );
      }
    } else if (commandLabel.startsWith("leveling")) {
      steps.push(
        `[miser-db]: Toggling leveling state inside database config...`,
        `[miser-status]: Chat XP accrual updated.`
      );
    } else if (commandLabel === "rank") {
      steps.push(
        `[miser-db]: Querying message stats and active chatter index...`,
        `[miser-status]: Level card compiled.`
      );
    } else if (commandLabel === "leaderboard") {
      steps.push(
        `[miser-db]: Sorting top active participants by XP counts...`,
        `[miser-status]: Leaderboard calculated.`
      );

    } else {
      steps.push(
        `[miser-core]: Executing basic system inquiry...`,
        `[miser-status]: Manual output returned.`
      );
    }

    let idx = 0;
    const runStep = () => {
      if (idx < steps.length) {
        setSimLogs(prev => [...prev, steps[idx]]);
        setSimProgress(Math.min(100, Math.floor(((idx + 1) / steps.length) * 100)));
        idx++;
        setTimeout(runStep, 450);
      } else {
        setSimState("success");
      }
    };

    setTimeout(runStep, 300);
  };

  const downloadOfflineHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ServerMiser Web Desk - Desktop Standalone Edition</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            display: ['Space Grotesk', 'sans-serif'],
            mono: ['JetBrains Mono', 'monospace'],
          },
          colors: {
            brandRed: '#ff3b5c',
            brandGreen: '#e2f9b8',
          }
        }
      }
    }
  </script>
  <style>
    @keyframes scrollTicker {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }
    .ticker-animate {
      animation: scrollTicker 30s linear infinite;
    }
    .scrollbar-thin::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    .scrollbar-thin::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
    }
    .scrollbar-thin::-webkit-scrollbar-thumb {
      background: #ff3b5c;
    }
  </style>
</head>
<body id="body" class="dark bg-[#040406] text-slate-100 min-h-screen selection:bg-[#ff3b5c]/30 selection:text-[#e2f9b8] relative overflow-x-hidden transition-colors duration-500 bg-[linear-gradient(rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:40px_40px]">

  <!-- TOP DECORATIVE BARS -->
  <div class="fixed top-0 left-0 right-0 h-1 bg-[#e2f9b8] z-50"></div>
  <div class="fixed bottom-0 left-0 right-0 h-1 bg-[#ff3b5c] z-50"></div>

  <!-- BRUTALIST TICKER -->
  <div class="bg-[#e2f9b8] text-black py-2 overflow-hidden whitespace-nowrap border-b border-black font-mono font-bold text-[10px] tracking-widest uppercase z-30 relative select-none">
    <div class="flex whitespace-nowrap gap-8 ticker-animate w-[200%]">
      <span>● SYSTEM STATUS: OPTIMIZED ● SERVER-MISER STANDALONE EDITION ● CHANNEL HYPER-DE-CLUTTER ACTIVE ● PRIVACY VERIFIED ● NO MORE DISCORD BLOAT ●</span>
      <span>● SYSTEM STATUS: OPTIMIZED ● SERVER-MISER STANDALONE EDITION ● CHANNEL HYPER-DE-CLUTTER ACTIVE ● PRIVACY VERIFIED ● NO MORE DISCORD BLOAT ●</span>
    </div>
  </div>

  <!-- NAVIGATION HEADER -->
  <header class="sticky top-0 z-40 w-full bg-[#040406]/95 border-b border-slate-900 text-slate-100 py-4 px-6 backdrop-blur-md transition-colors duration-500">
    <div class="container mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3">
        <!-- Embedded SVG Vector Logo (Pristine Cyber Planet) -->
        <svg width="36" height="36" viewBox="0 0 100 100" fill="none" class="animate-pulse">
          <circle cx="50" cy="50" r="30" fill="black" stroke="#ff3b5c" stroke-width="4" stroke-dasharray="8 4" />
          <ellipse cx="50" cy="50" rx="45" ry="12" fill="none" stroke="#e2f9b8" stroke-width="3" transform="rotate(-25 50 50)" />
          <circle cx="42" cy="40" r="4" fill="#ff3b5c" />
          <circle cx="62" cy="58" r="6" fill="#e2f9b8" />
          <circle cx="55" cy="35" r="2" fill="#ff3b5c" />
        </svg>
        <div class="flex flex-col">
          <span class="font-display font-black text-lg tracking-tighter leading-none">
            SERVER<span class="text-[#ff3b5c]">MISER</span>
          </span>
          <span class="font-mono text-[8px] tracking-widest uppercase mt-0.5 text-[#2e7b8f]">
            STANDALONE CLIENT
          </span>
        </div>
      </div>

      <!-- Theme & Action controls -->
      <div class="flex items-center gap-3">
        <button id="themeToggleBtn" class="p-2 border border-slate-800 bg-[#0d0f18] hover:bg-slate-900 text-yellow-400 hover:text-white transition-all w-9 h-9 flex items-center justify-center font-mono text-sm">
          💡
        </button>
        <button onclick="window.open('https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}', '_blank')" class="px-4 py-2 border border-[#e2f9b8] bg-transparent text-[#e2f9b8] hover:bg-[#e2f9b8] hover:text-black transition-all font-mono text-[10px] tracking-widest uppercase font-bold">
          AUTHORIZE
        </button>
      </div>
    </div>
  </header>

  <!-- MAIN BODY WRAPPER -->
  <main class="container mx-auto px-4 py-8 lg:py-12 max-w-6xl">
    
    <!-- HERO INTRO -->
    <section class="mb-12 text-center lg:text-left flex flex-col lg:flex-row items-center justify-between gap-8 border-b border-slate-900 pb-12">
      <div class="max-w-2xl">
        <span class="px-2.5 py-1 border border-[#ff3b5c] text-[#ff3b5c] font-mono text-[8px] tracking-widest uppercase font-extrabold bg-[#ff3b5c]/5">
          OFFLINE PORTABLE BUILD
        </span>
        <h1 class="font-display font-black text-4xl sm:text-5xl uppercase tracking-tighter mt-4 mb-6 leading-none">
          THE MOST EFFICIENT <br>
          <span class="text-[#ff3b5c]">DISCORD ADMINISTRATOR</span>
        </h1>
        <p class="text-slate-400 font-sans text-sm sm:text-base leading-relaxed mb-6">
          ServerMiser is built for absolute architectural purity. It consolidates scattered Discord roles, compacts bloated support systems, shears unused channel trees, and hoards system resource allocations. No useless animations, no bloated features, no telemetry spyware. Pure compliance and performance.
        </p>
        <div class="flex flex-wrap gap-3 justify-center lg:justify-start">
          <button onclick="scrollToSandbox()" class="px-6 py-3 bg-[#ff3b5c] text-white hover:bg-red-600 transition-all font-mono text-xs tracking-widest uppercase font-bold">
            OPEN SANDBOX
          </button>
          <button onclick="scrollToCommands()" class="px-6 py-3 border border-slate-700 hover:border-[#e2f9b8] transition-all font-mono text-xs tracking-widest uppercase font-bold">
            VIEW COMMANDS
          </button>
        </div>
      </div>
      
      <!-- CYBER MOCKUP -->
      <div class="w-full max-w-sm border border-slate-800 bg-black/40 p-4 font-mono text-[9px] relative overflow-hidden">
        <div class="absolute top-0 right-0 w-24 h-24 bg-[#ff3b5c]/5 blur-2xl"></div>
        <div class="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
          <span class="text-[#ff3b5c] font-bold uppercase">● LIVE COMPLIANCE NODE</span>
          <span class="text-slate-500">SHARD_01</span>
        </div>
        <div class="flex flex-col gap-2 text-slate-400">
          <div>RAM Usage: <span class="text-[#e2f9b8] font-bold">14.2 MB</span></div>
          <div>Websocket latency: <span class="text-[#e2f9b8] font-bold">18ms</span></div>
          <div>Active Shards: <span class="text-[#e2f9b8] font-bold">1 / 1</span></div>
          <div>Security Compliance: <span class="text-green-400 font-bold">100% SECURE</span></div>
        </div>
      </div>
    </section>

    <!-- LIVE INTERACTIVE COMMAND SANDBOX -->
    <section id="sandboxSection" class="mb-12 border-2 border-[#ff3b5c] bg-black/40 p-6 relative">
      <div class="absolute top-0 right-0 transform translate-x-3 -translate-y-3 px-2 py-0.5 bg-[#ff3b5c] text-white font-mono text-[8px] tracking-widest uppercase font-extrabold">
        SIMULATION
      </div>
      
      <h2 class="font-display font-bold text-xl uppercase tracking-wider mb-2">
        COMMAND SIMULATION DESK
      </h2>
      <p class="text-xs text-slate-400 font-sans mb-6">
        Select a template or command, edit parameters below, and simulate the Discord WebSocket execution directly in real-time.
      </p>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Interactive controls panel -->
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="font-mono text-[8px] tracking-widest text-slate-500 font-bold uppercase">SELECT COMMAND SYSTEM TO TEST:</label>
            <div class="grid grid-cols-3 gap-1.5">
              <button onclick="selectCommandForSim('setup', 'setup community')" class="sim-cmd-btn px-2.5 py-2 border border-[#ff3b5c] bg-[#ff3b5c]/10 text-[#ff3b5c] font-mono text-[9px] font-bold uppercase">|setup</button>
              <button onclick="selectCommandForSim('ban', 'ban @spammer69 Raid attempts')" class="sim-cmd-btn px-2.5 py-2 border border-slate-800 bg-black hover:border-slate-700 text-slate-300 font-mono text-[9px] font-bold uppercase">|ban</button>
              <button onclick="selectCommandForSim('kick', 'kick @impatient_user')" class="sim-cmd-btn px-2.5 py-2 border border-slate-800 bg-black hover:border-slate-700 text-slate-300 font-mono text-[9px] font-bold uppercase">|kick</button>
              <button onclick="selectCommandForSim('mute', 'mute @noisy_speaker 10m')" class="sim-cmd-btn px-2.5 py-2 border border-slate-800 bg-black hover:border-slate-700 text-slate-300 font-mono text-[9px] font-bold uppercase">|mute</button>
              <button onclick="selectCommandForSim('warn', 'warn @rebel-user Rules violation')" class="sim-cmd-btn px-2.5 py-2 border border-slate-800 bg-black hover:border-slate-700 text-slate-300 font-mono text-[9px] font-bold uppercase">|warn</button>
              <button onclick="selectCommandForSim('clear', 'clear-channels')" class="sim-cmd-btn px-2.5 py-2 border border-slate-800 bg-black hover:border-slate-700 text-slate-300 font-mono text-[9px] font-bold uppercase">|clear</button>
            </div>
          </div>

          <div class="flex flex-col gap-1.5 mt-2">
            <label class="font-mono text-[8px] tracking-widest text-slate-500 font-bold uppercase">EDIT SIMULATOR INPUT:</label>
            <div class="flex gap-2">
              <span class="font-mono text-sm font-bold text-[#ff3b5c] self-center">|</span>
              <input type="text" id="simArgsInput" value="setup community" class="flex-1 bg-black border border-slate-800 rounded-none px-3 py-2 text-xs font-mono text-[#e2f9b8] outline-none focus:border-[#ff3b5c]">
              <button id="runSimBtn" onclick="runSimulatedCommand()" class="px-5 py-2 bg-[#ff3b5c] hover:bg-red-600 text-white font-mono text-[10px] tracking-widest font-black uppercase transition-all">
                RUN TEST
              </button>
            </div>
          </div>

          <!-- SETUP SPECIFIC PREVIEW HIERARCHY -->
          <div id="setupPreviewBox" class="border border-slate-800 bg-[#07070a]/50 p-3 mt-2">
            <div class="flex items-center justify-between border-b border-slate-900 pb-2 mb-2 font-mono text-[9px] uppercase">
              <span class="text-[#ff3b5c] font-black">📁 HIERARCHY PREVIEWS (AUTO-GENERATION)</span>
              <span class="text-slate-500">SELECT TEMPLATE</span>
            </div>
            
            <div class="flex gap-1 mb-2.5">
              <button onclick="toggleTplPreview('community')" id="tpl-community" class="tpl-btn px-2 py-1 bg-[#ff3b5c] text-white border border-[#ff3b5c] font-mono text-[8px] uppercase">🌐 COMMUNITY</button>
              <button onclick="toggleTplPreview('gaming')" id="tpl-gaming" class="tpl-btn px-2 py-1 bg-black text-slate-400 border border-slate-800 hover:text-white font-mono text-[8px] uppercase">🎮 GAMING</button>
              <button onclick="toggleTplPreview('study')" id="tpl-study" class="tpl-btn px-2 py-1 bg-black text-slate-400 border border-slate-800 hover:text-white font-mono text-[8px] uppercase">📚 STUDY</button>
            </div>

            <div id="tpl-display-area" class="font-mono text-[8px] p-2 bg-black border border-slate-900 max-h-32 overflow-y-auto scrollbar-thin text-slate-300">
              <!-- Default community tree -->
              <div class="text-[#ff3b5c] font-black uppercase">📌 INFORMATION (READ-ONLY)</div>
              <div class="pl-3 text-slate-400">├─ #rules-and-faq</div>
              <div class="pl-3 text-slate-400">├─ #announcements</div>
              <div class="text-[#ff3b5c] font-black uppercase mt-1.5">💬 PUBLIC CHATS</div>
              <div class="pl-3 text-slate-400">├─ #general-chat</div>
              <div class="pl-3 text-slate-400">├─ #memes-and-media</div>
              <div class="text-[#ff3b5c] font-black uppercase mt-1.5">🔒 STAFF ZONE</div>
              <div class="pl-3 text-slate-400">├─ #moderator-chat <span class="text-[6px] text-red-500">[STAFF_ONLY]</span></div>
            </div>
          </div>
        </div>

        <!-- Terminal Output simulation -->
        <div class="flex flex-col gap-2">
          <div class="flex justify-between items-center font-mono text-[8px] text-slate-500">
            <span>● CONSOLE LOGS DIAGNOSTICS</span>
            <span id="progPercentage">PROG: 0%</span>
          </div>
          
          <div id="terminalLogs" class="bg-black border border-slate-900 rounded-none p-4 h-44 overflow-y-auto font-mono text-[10px] text-cyan-400 flex flex-col gap-1.5 scrollbar-thin">
            <div class="text-slate-600 italic uppercase">[SIM_IDLE] EDIT ARGUMENTS ON THE LEFT AND CLICK "RUN TEST" TO EMIT REAL-TIME OUTBOUND TRIGGERS...</div>
          </div>

          <!-- Mock Discord Response UI -->
          <div id="mockDiscordEmbed" class="hidden animate-fade-in bg-[#313338] border border-black/30 p-3.5 font-sans text-xs rounded shadow-md text-slate-200 mt-2">
            <div class="flex items-center gap-1.5 mb-1.5">
              <span class="font-bold text-[#248046] text-sm">ServerMiser</span>
              <span class="bg-[#5865F2] text-white text-[8px] font-mono font-bold px-1 rounded-sm leading-none tracking-wider">BOT</span>
              <span class="text-[9px] text-[#949ba4] font-mono">Today at 12:00 PM</span>
            </div>
            
            <div class="pl-3.5 border-l-4 border-[#ff3b5c] bg-[#2b2d31] p-2.5 rounded-r border border-[#1e1f22]/40">
              <div class="font-bold text-slate-100 uppercase tracking-tight text-[10px] mb-1 font-mono">SYSTEM EXECUTION RECORD</div>
              <pre id="discordEmbedText" class="font-mono text-[10px] text-[#e2f9b8] whitespace-pre-wrap leading-relaxed select-text bg-[#1e1f22] p-2 border border-black/30 rounded-sm">
✓ Setup complete! Deployed Community Template.
              </pre>
              <div class="mt-1 font-mono text-[7px] text-slate-500 uppercase tracking-widest">
                STATUS: GREEN • SHARD_01
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- LIST OF COMMANDS -->
    <section id="commandsSection" class="mb-12">
      <div class="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 border-b border-slate-900 pb-4">
        <div>
          <h2 class="font-display font-bold text-xl uppercase tracking-wider">
            COMMAND DICTIONARY
          </h2>
          <p class="text-xs text-slate-400 font-sans mt-0.5">
            Full registry of automated ServerMiser command codes.
          </p>
        </div>
        
        <!-- Search bar -->
        <input type="text" id="commandSearch" onkeyup="filterCommands()" placeholder="Search commands..." class="w-full md:w-64 bg-black border border-slate-800 rounded-none px-3.5 py-2 font-mono text-xs text-[#e2f9b8] outline-none focus:border-[#ff3b5c]">
      </div>

      <!-- Categories switcher -->
      <div class="flex flex-wrap gap-1.5 mb-6 font-mono text-[9px] uppercase font-bold">
        <button onclick="filterCat('all')" id="cat-all" class="cat-btn px-2.5 py-1 bg-[#ff3b5c] text-white">ALL</button>
        <button onclick="filterCat('moderation')" id="cat-moderation" class="cat-btn px-2.5 py-1 bg-black text-slate-400 border border-slate-800 hover:text-slate-200">MODERATION</button>
        <button onclick="filterCat('setup')" id="cat-setup" class="cat-btn px-2.5 py-1 bg-black text-slate-400 border border-slate-800 hover:text-slate-200">SETUP/UTILITY</button>
        <button onclick="filterCat('ticketing')" id="cat-ticketing" class="cat-btn px-2.5 py-1 bg-black text-slate-400 border border-slate-800 hover:text-slate-200">TICKETS</button>
        <button onclick="filterCat('leveling')" id="cat-leveling" class="cat-btn px-2.5 py-1 bg-black text-slate-400 border border-slate-800 hover:text-slate-200">XP PROGRESSION</button>
      </div>

      <!-- Commands Grid -->
      <div id="commandsGrid" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <!-- Command 1 -->
        <div class="cmd-card border border-slate-900 bg-black/25 p-5 flex flex-col justify-between" data-category="setup">
          <div class="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
            <span class="font-mono text-sm font-bold text-[#ff3b5c]">|setup &lt;template&gt;</span>
            <button onclick="simulateFromList('setup', 'setup community')" class="px-2 py-0.5 border border-[#ff3b5c] text-[#ff3b5c] hover:bg-[#ff3b5c] hover:text-white transition-all font-mono text-[8px] font-bold">TRY</button>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed mb-4">
            Deploys automated, fully permission-configured categories and channel trees immediately. Choose "community", "gaming", "study", or "minimal".
          </p>
          <div class="bg-black/50 border border-slate-900 p-2 text-[9px] font-mono text-slate-500">
            Usage: <span class="text-slate-300">|setup community</span>
          </div>
        </div>

        <!-- Command 2 -->
        <div class="cmd-card border border-slate-900 bg-black/25 p-5 flex flex-col justify-between" data-category="moderation">
          <div class="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
            <span class="font-mono text-sm font-bold text-[#ff3b5c]">|ban &lt;user&gt; [reason]</span>
            <button onclick="simulateFromList('ban', 'ban @spammer69 Raid behavior')" class="px-2 py-0.5 border border-[#ff3b5c] text-[#ff3b5c] hover:bg-[#ff3b5c] hover:text-white transition-all font-mono text-[8px] font-bold">TRY</button>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed mb-4">
            Evicts the target user permanently and completely wipes their past 7 days of message logs from all servers.
          </p>
          <div class="bg-black/50 border border-slate-900 p-2 text-[9px] font-mono text-slate-500">
            Usage: <span class="text-slate-300">|ban @spammer69 Raid behavior</span>
          </div>
        </div>

        <!-- Command 3 -->
        <div class="cmd-card border border-slate-900 bg-black/25 p-5 flex flex-col justify-between" data-category="moderation">
          <div class="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
            <span class="font-mono text-sm font-bold text-[#ff3b5c]">|kick &lt;user&gt;</span>
            <button onclick="simulateFromList('kick', 'kick @noisy_guest')" class="px-2 py-0.5 border border-[#ff3b5c] text-[#ff3b5c] hover:bg-[#ff3b5c] hover:text-white transition-all font-mono text-[8px] font-bold">TRY</button>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed mb-4">
            Evicts the specified user from the Discord server. They retain permission to return via an active invite code.
          </p>
          <div class="bg-black/50 border border-slate-900 p-2 text-[9px] font-mono text-slate-500">
            Usage: <span class="text-slate-300">|kick @noisy_guest</span>
          </div>
        </div>

        <!-- Command 4 -->
        <div class="cmd-card border border-slate-900 bg-black/25 p-5 flex flex-col justify-between" data-category="moderation">
          <div class="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
            <span class="font-mono text-sm font-bold text-[#ff3b5c]">|mute &lt;user&gt; [duration]</span>
            <button onclick="simulateFromList('mute', 'mute @noisy_speaker 1h')" class="px-2 py-0.5 border border-[#ff3b5c] text-[#ff3b5c] hover:bg-[#ff3b5c] hover:text-white transition-all font-mono text-[8px] font-bold">TRY</button>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed mb-4">
            Applies temporary text and voice communication silence to prevent chat flooding or verbal arguments.
          </p>
          <div class="bg-black/50 border border-slate-900 p-2 text-[9px] font-mono text-slate-500">
            Usage: <span class="text-slate-300">|mute @noisy_speaker 10m</span>
          </div>
        </div>

        <!-- Command 5 -->
        <div class="cmd-card border border-slate-900 bg-black/25 p-5 flex flex-col justify-between" data-category="moderation">
          <div class="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
            <span class="font-mono text-sm font-bold text-[#ff3b5c]">|warn &lt;user&gt; [reason]</span>
            <button onclick="simulateFromList('warn', 'warn @rebel-user Rule breach')" class="px-2 py-0.5 border border-[#ff3b5c] text-[#ff3b5c] hover:bg-[#ff3b5c] hover:text-white transition-all font-mono text-[8px] font-bold">TRY</button>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed mb-4">
            Registers a persistent warning infraction inside ServerMiser's database. Users receive an direct notification in their DMs.
          </p>
          <div class="bg-black/50 border border-slate-900 p-2 text-[9px] font-mono text-slate-500">
            Usage: <span class="text-slate-300">|warn @rebel-user Caps spam</span>
          </div>
        </div>

        <!-- Command 6 -->
        <div class="cmd-card border border-slate-900 bg-black/25 p-5 flex flex-col justify-between" data-category="setup">
          <div class="flex items-center justify-between border-b border-slate-900 pb-2 mb-3">
            <span class="font-mono text-sm font-bold text-[#ff3b5c]">|clear-channels</span>
            <button onclick="simulateFromList('clear', 'clear-channels')" class="px-2 py-0.5 border border-[#ff3b5c] text-[#ff3b5c] hover:bg-[#ff3b5c] hover:text-white transition-all font-mono text-[8px] font-bold">TRY</button>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed mb-4">
            CRITICAL PURGE: Instantly and recursively purges every single text, voice, and category folder from the Discord Server.
          </p>
          <div class="bg-black/50 border border-slate-900 p-2 text-[9px] font-mono text-slate-500">
            Usage: <span class="text-slate-300">|clear-channels</span>
          </div>
        </div>

      </div>
    </section>

    <!-- POLICIES COMPLIANCE -->
    <section class="border-t border-slate-900 pt-12 mb-12">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs font-sans leading-relaxed text-slate-400">
        <div>
          <h3 class="font-display font-bold text-sm text-slate-100 uppercase tracking-wider mb-3">TERMS OF SERVICE</h3>
          <p class="mb-3">
            By deploying ServerMiser or accessing its control consoles, you agree to be fully bound by these legal covenants. All tools are provided purely on an "as is" baseline without express warranty or uptime SLA guarantees.
          </p>
          <p>
            We strictly prohibit using this bot to artificially flood leveling API gates, inject malicious code via tickets, or attempt decompilation of core WebSocket wrappers. Violations result in instant server banishment.
          </p>
        </div>
        <div>
          <h3 class="font-display font-bold text-sm text-slate-100 uppercase tracking-wider mb-3">PRIVACY POLICY</h3>
          <p class="mb-3">
            We value maximum logical isolation and user privacy. We harvest and record only the bare minimum telemetry required to support leveling and channel operations (guild ID keys and snowflake member IDs).
          </p>
          <p>
            We do not under any circumstance sell, exchange, rent, or lease your guild metrics or chat interactions to advertising servers or statistical sponsors. You may request to wipe all your cached data instantly via our Support Server.
          </p>
        </div>
      </div>
    </section>

  </main>

  <!-- FOOTER -->
  <footer class="bg-black/60 border-t border-slate-900 py-8 px-6 text-center font-mono text-[9px] text-slate-500">
    <div class="container mx-auto">
      <div>SERVERMISER CLOUD REPOSITORY © 2026. ALL RIGHTS REGISTERED.</div>
      <div class="text-[#2e7b8f] mt-1.5 uppercase tracking-wider">● ENGINEERED FOR ARCHITECTURAL COMPACTNESS ●</div>
    </div>
  </footer>

  <!-- STANDALONE JS ENGINE -->
  <script>
    // Theme Switcher
    const body = document.getElementById('body');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    themeToggleBtn.addEventListener('click', () => {
      if (body.classList.contains('dark')) {
        body.classList.remove('dark');
        body.classList.remove('bg-[#040406]');
        body.classList.remove('text-slate-100');
        body.classList.add('bg-[#f4f5f8]');
        body.classList.add('text-slate-900');
        themeToggleBtn.innerHTML = '🌙';
      } else {
        body.classList.add('dark');
        body.classList.add('bg-[#040406]');
        body.classList.add('text-slate-100');
        body.classList.remove('bg-[#f4f5f8]');
        body.classList.remove('text-slate-900');
        themeToggleBtn.innerHTML = '💡';
      }
    });

    // Setup Hierarchy preview templates toggle
    const templatesData = {
      community: \`<div class="text-[#ff3b5c] font-black uppercase">📌 INFORMATION (READ-ONLY)</div>
<div class="pl-3 text-slate-400">├─ #rules-and-faq</div>
<div class="pl-3 text-slate-400">├─ #announcements</div>
<div class="text-[#ff3b5c] font-black uppercase mt-1.5">💬 PUBLIC CHATS</div>
<div class="pl-3 text-slate-400">├─ #general-chat</div>
<div class="pl-3 text-slate-400">├─ #memes-and-media</div>
<div class="text-[#ff3b5c] font-black uppercase mt-1.5">🔒 STAFF ZONE</div>
<div class="pl-3 text-slate-400">├─ #moderator-chat <span class="text-[6px] text-red-500">[STAFF_ONLY]</span></div>\`,
      gaming: \`<div class="text-[#ff3b5c] font-black uppercase">📢 COMMAND DECK</div>
<div class="pl-3 text-slate-400">├─ #welcome-and-rules</div>
<div class="pl-3 text-slate-400">├─ #squad-news</div>
<div class="text-[#ff3b5c] font-black uppercase mt-1.5">⚔️ TACTICAL BASE</div>
<div class="pl-3 text-slate-400">├─ #lfg-looking-for-group</div>
<div class="pl-3 text-slate-400">├─ #clips-highlights</div>
<div class="text-[#ff3b5c] font-black uppercase mt-1.5">🔊 COMMS VOICE</div>
<div class="pl-3 text-slate-400">├─ 🔊 Squad Alpha</div>
<div class="pl-3 text-slate-400">├─ 🔊 Squad Bravo</div>\`,
      study: \`<div class="text-[#ff3b5c] font-black uppercase">🏫 COURSE BULLETIN</div>
<div class="pl-3 text-slate-400">├─ #syllabus-and-info</div>
<div class="pl-3 text-slate-400">├─ #homework-assignments</div>
<div class="text-[#ff3b5c] font-black uppercase mt-1.5">🧠 COLLABORATION</div>
<div class="pl-3 text-slate-400">├─ #general-questions</div>
<div class="pl-3 text-slate-400">├─ #resources-links</div>
<div class="text-[#ff3b5c] font-black uppercase mt-1.5">🔊 AUDIO HALLS</div>
<div class="pl-3 text-slate-400">├─ 🔊 Study Room A</div>
<div class="pl-3 text-slate-400">├─ 🔊 Study Room B</div>\`
    };

    function toggleTplPreview(tplId) {
      document.querySelectorAll('.tpl-btn').forEach(btn => {
        btn.classList.remove('bg-[#ff3b5c]', 'text-white');
        btn.classList.add('bg-black', 'text-slate-400');
      });
      const selectedBtn = document.getElementById('tpl-' + tplId);
      if (selectedBtn) {
        selectedBtn.classList.remove('bg-black', 'text-slate-400');
        selectedBtn.classList.add('bg-[#ff3b5c]', 'text-white');
      }
      document.getElementById('tpl-display-area').innerHTML = templatesData[tplId] || templatesData.community;
    }

    // Scroll helpers
    function scrollToSandbox() {
      document.getElementById('sandboxSection').scrollIntoView({ behavior: 'smooth' });
    }
    function scrollToCommands() {
      document.getElementById('commandsSection').scrollIntoView({ behavior: 'smooth' });
    }

    // Command Simulation system
    let activeSimCmd = 'setup';
    function selectCommandForSim(cmdName, sampleArgs) {
      activeSimCmd = cmdName;
      document.querySelectorAll('.sim-cmd-btn').forEach(btn => {
        btn.classList.remove('border-[#ff3b5c]', 'bg-[#ff3b5c]/10', 'text-[#ff3b5c]');
        btn.classList.add('border-slate-800', 'bg-black', 'text-slate-300');
      });
      // Highlight selected
      event.target.classList.remove('border-slate-800', 'bg-black', 'text-slate-300');
      event.target.classList.add('border-[#ff3b5c]', 'bg-[#ff3b5c]/10', 'text-[#ff3b5c]');
      
      document.getElementById('simArgsInput').value = sampleArgs;
    }

    function simulateFromList(cmdName, sampleArgs) {
      scrollToSandbox();
      const matchingBtn = Array.from(document.querySelectorAll('.sim-cmd-btn')).find(b => b.innerText.toLowerCase().includes(cmdName));
      if (matchingBtn) {
        matchingBtn.click();
      } else {
        document.getElementById('simArgsInput').value = sampleArgs;
      }
    }

    function runSimulatedCommand() {
      const logsEl = document.getElementById('terminalLogs');
      const progEl = document.getElementById('progPercentage');
      const inputVal = document.getElementById('simArgsInput').value;
      const runBtn = document.getElementById('runSimBtn');
      const discordEmbed = document.getElementById('mockDiscordEmbed');
      const embedText = document.getElementById('discordEmbedText');

      runBtn.disabled = true;
      runBtn.innerText = 'TESTING...';
      discordEmbed.classList.add('hidden');

      logsEl.innerHTML = '<div class="text-[#ff3b5c] uppercase animate-pulse">● INITIALIZING WEB-GATEWAY PORTAL DIRECTIVE...</div>';
      
      let logsSteps = [];
      let finalDiscordText = '';

      if (activeSimCmd === 'setup') {
        const tplName = inputVal.split(' ')[1] || 'community';
        logsSteps = [
          '[miser-setup]: Reading channel template registry key: "' + tplName + '"',
          '[miser-setup]: Purging active layout categories...',
          '[miser-setup]: Creating structures and permissions rules...',
          '[miser-setup]: Finalizing API payload deployment...',
          '[miser-status]: Build completed! Server fully condensed and optimized.'
        ];
        finalDiscordText = '✓ Setup complete! Deployed ' + tplName.toUpperCase() + ' channel tree template successfully. Configured Admin and Moderator permission locks.';
      } else if (activeSimCmd === 'ban') {
        const targetUsr = inputVal.split(' ')[1] || '@spammer69';
        logsSteps = [
          '[miser-auth]: Validating administrator credentials...',
          '[miser-db]: Target member: ' + targetUsr,
          '[miser-action]: Transmitting permanent eviction signal...',
          '[miser-action]: Wiping all messaging logs from past 7 days...',
          '[miser-status]: Ban action archived inside audit channels.'
        ];
        finalDiscordText = '✓ Permanently banned ' + targetUsr + ' and cleared all trace message records.';
      } else if (activeSimCmd === 'kick') {
        const targetUsr = inputVal.split(' ')[1] || '@impatient_user';
        logsSteps = [
          '[miser-auth]: Validating moderator permission scopes...',
          '[miser-action]: Removing member ' + targetUsr + ' from active guilds...',
          '[miser-status]: Eviction complete.'
        ];
        finalDiscordText = '✓ Kicked ' + targetUsr + ' from server.';
      } else if (activeSimCmd === 'mute') {
        const targetUsr = inputVal.split(' ')[1] || '@noisy_speaker';
        const dur = inputVal.split(' ')[2] || '10m';
        logsSteps = [
          '[miser-auth]: Authorizing TIMEOUT rules...',
          '[miser-action]: Overriding text and voice speech states for ' + dur + '...',
          '[miser-status]: Mute profile registered.'
        ];
        finalDiscordText = '✓ Muted ' + targetUsr + ' for ' + dur + '.';
      } else if (activeSimCmd === 'warn') {
        const targetUsr = inputVal.split(' ')[1] || '@rebel-user';
        logsSteps = [
          '[miser-auth]: Authorizing WARNING token entry...',
          '[miser-db]: Registering infractions into cluster indices...',
          '[miser-status]: Direct notice dispatched to user inbox.'
        ];
        finalDiscordText = '⚠ Warning registered for ' + targetUsr + ' (Logged by moderator).';
      } else {
        logsSteps = [
          '[miser-auth]: Validating high risk manage-server credentials...',
          '[miser-action]: Sweeping all categories and text hubs recursively...',
          '[miser-status]: Server is now completely empty and optimized.'
        ];
        finalDiscordText = '✓ Completed recursion! Total channel sweep executed successfully.';
      }

      let currentStep = 0;
      const interval = setInterval(() => {
        if (currentStep < logsSteps.length) {
          const logDiv = document.createElement('div');
          logDiv.className = 'leading-relaxed';
          logDiv.innerText = logsSteps[currentStep];
          logsEl.appendChild(logDiv);
          logsEl.scrollTop = logsEl.scrollHeight;
          
          currentStep++;
          const progress = Math.round((currentStep / logsSteps.length) * 100);
          progEl.innerText = 'PROG: ' + progress + '%';
        } else {
          clearInterval(interval);
          runBtn.disabled = false;
          runBtn.innerText = 'RUN TEST';
          discordEmbed.classList.remove('hidden');
          embedText.innerText = finalDiscordText;
        }
      }, 450);
    }

    // Command filter
    let selectedCat = 'all';
    function filterCat(catId) {
      selectedCat = catId;
      document.querySelectorAll('.cat-btn').forEach(btn => {
        btn.className = "cat-btn px-2.5 py-1 bg-black text-slate-400 border border-slate-800 hover:text-slate-200";
      });
      document.getElementById('cat-' + catId).className = "cat-btn px-2.5 py-1 bg-[#ff3b5c] text-white";
      filterCommands();
    }

    function filterCommands() {
      const query = document.getElementById('commandSearch').value.toLowerCase();
      document.querySelectorAll('.cmd-card').forEach(card => {
        const text = card.innerText.toLowerCase();
        const cat = card.getAttribute('data-category');
        const matchesQuery = text.includes(query);
        const matchesCat = (selectedCat === 'all' || cat === selectedCat);
        
        if (matchesQuery && matchesCat) {
          card.classList.remove('hidden');
        } else {
          card.classList.add('hidden');
        }
      });
    }
  </script>
</body>
</html>`;

    // Download file flow
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "servermiser-webdesk-standalone.html");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [activeFaqIdx, setActiveFaqIdx] = useState<number | null>(null);
  const [currentView, setCurrentView] = useState<"home" | "sandbox" | "commands" | "analytics" | "support">("home");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [pendingScrollTarget, setPendingScrollTarget] = useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [copiedCommandName, setCopiedCommandName] = useState<string | null>(null);
  const [isSupportDropdownOpen, setIsSupportDropdownOpen] = useState(false);
  const [supportTab, setSupportTab] = useState<"terms" | "privacy" | "formal">("terms");

  const handleCopyCommand = (usage: string, name: string) => {
    navigator.clipboard.writeText(usage);
    setCopiedCommandName(name);
    setTimeout(() => {
      setCopiedCommandName(null);
    }, 2000);
  };

  // loading timer for blood pumping heart beating logo
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Smooth scroll back to home section
  useEffect(() => {
    if (currentView === "home" && pendingScrollTarget) {
      setTimeout(() => {
        const el = document.getElementById(pendingScrollTarget);
        if (el) {
          el.scrollIntoView({ behavior: "smooth" });
        }
      }, 150);
    }
  }, [currentView, pendingScrollTarget]);

  // Custom pointer trail position and hover state
  const [mousePos, setMousePos] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);

  // Mouse trail effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Scroll tracker
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Custom mock authorization modal state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState("");
  const [authStep, setAuthStep] = useState<"form" | "loading" | "success">("form");

  // Command Center States
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sandbox simulation states
  const [selectedDilemmaIdx, setSelectedDilemmaIdx] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedChoice, setSimulatedChoice] = useState<"miser" | "nudge" | null>(null);
  const [simulatedLogs, setSimulatedLogs] = useState<string[]>([]);
  const [simulatedHealth, setSimulatedHealth] = useState(62);
  const [simComplete, setSimComplete] = useState(false);

  const activeDilemma = DILEMMAS[selectedDilemmaIdx];

  // Helper to trigger simulated run
  const runDecisionSimulation = (choice: "miser" | "nudge") => {
    if (isSimulating) return;

    setIsSimulating(true);
    setSimulatedChoice(choice);
    setSimulatedLogs([]);
    setSimulatedHealth(62);
    setSimComplete(false);

    const path = choice === "miser" ? activeDilemma.miserPath : activeDilemma.nudgePath;
    const steps = path.terminalLogs;
    const targetHealth = path.endingHealth;

    // Typewriter effect for simulated logs
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setSimulatedLogs(prev => [...prev, steps[currentStep]]);
        // Animate health value upwards
        const ratio = (currentStep + 1) / steps.length;
        setSimulatedHealth(Math.round(62 + (targetHealth - 62) * ratio));
        currentStep++;
      } else {
        clearInterval(interval);
        setIsSimulating(false);
        setSimComplete(true);
      }
    }, 450);
  };

  const toggleFaq = (idx: number) => {
    setActiveFaqIdx(activeFaqIdx === idx ? null : idx);
  };

  const triggerAuthFlow = () => {
    window.open(`https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}`, "_blank");
  };

  const handleAuthorize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServer) return;
    
    // Open real Discord invitation link in a new window/tab
    window.open(`https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}`, "_blank");
    
    setAuthStep("loading");
    setTimeout(() => {
      setAuthStep("success");
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#020204] flex flex-col items-center justify-center select-none overflow-hidden">
        {/* Blood red pumping beat animation for the logo */}
        <motion.div
          animate={{
            scale: [1, 1.25, 1.05, 1.35, 1.05, 1],
            filter: [
              "drop-shadow(0 0 15px rgba(255,59,92,0.4))",
              "drop-shadow(0 0 45px rgba(255,59,92,0.95))",
              "drop-shadow(0 0 25px rgba(255,59,92,0.5))",
              "drop-shadow(0 0 65px rgba(255,59,92,1))",
              "drop-shadow(0 0 35px rgba(255,59,92,0.65))",
              "drop-shadow(0 0 15px rgba(255,59,92,0.4))"
            ]
          }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="flex flex-col items-center justify-center"
        >
          <Logo size={240} glow={true} />
        </motion.div>
        
        <div className="mt-12 flex flex-col items-center gap-2">
          <h2 className="font-display font-black text-3xl uppercase tracking-tighter text-slate-100">
            SERVER<span className="text-[#ff3b5c]">MISER</span>
          </h2>
          <div className="flex items-center gap-2 text-[#ff3b5c] font-mono text-[10px] tracking-[0.25em] animate-pulse font-black uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
            <span>HEARTBEAT ENGINE PUMPING BLOOD...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 selection:bg-[#ff3b5c]/30 selection:text-[#e2f9b8] relative overflow-x-hidden cursor-none ${
      isDarkMode 
        ? "bg-[#040406] text-slate-100 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)]" 
        : "bg-[#f4f5f8] text-slate-900 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)]"
    } bg-[size:40px_40px]`}>
      
      {/* Custom Pointer replacing the standard system default cursor */}
      <motion.div
        className="hidden md:block fixed pointer-events-none z-50 rounded-full border"
        style={{
          width: 32,
          height: 32,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          x: mousePos.x,
          y: mousePos.y,
          scale: isHovering ? 1.6 : 1,
          backgroundColor: isDarkMode 
            ? (isHovering ? "rgba(226, 249, 184, 0.45)" : "rgba(226, 249, 184, 0.15)") 
            : (isHovering ? "rgba(59, 7, 100, 0.45)" : "rgba(59, 7, 100, 0.15)"),
          borderColor: isDarkMode ? "#e2f9b8" : "#3b0764",
          borderWidth: isHovering ? "2px" : "1.5px",
        }}
        transition={{ type: "spring", stiffness: 900, damping: 40 }}
      />

      {/* Small ServerMiser Logo following the cursor on the right */}
      <motion.div
        className="hidden md:block fixed pointer-events-none z-50"
        style={{
          translateX: "20px",
          translateY: "-50%",
        }}
        animate={{
          x: mousePos.x,
          y: mousePos.y,
          rotate: scrollY * 0.15,
        }}
        transition={{ type: "spring", stiffness: 220, damping: 20 }}
      >
        <Logo size={20} glow={isDarkMode} className="drop-shadow-[0_2px_5px_rgba(0,0,0,0.35)]" />
      </motion.div>

      {/* Decorative Brand Borders */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-[#e2f9b8] z-50" />
      <div className="fixed bottom-0 left-0 right-0 h-1 bg-[#ff3b5c] z-50" />

      {/* --- INFINITE SCROLLING BRUTALIST TICKER (TOP) --- */}
      <div className="bg-[#e2f9b8] text-black py-2.5 overflow-hidden whitespace-nowrap border-b border-black font-mono font-bold text-[10px] tracking-widest uppercase z-30 relative select-none">
        <motion.div
          animate={{ x: [0, -1000] }}
          transition={{ ease: "linear", duration: 30, repeat: Infinity }}
          className="flex whitespace-nowrap gap-8"
        >
          <span>● SYSTEM STATUS: OPTIMIZED ● SERVER-MISER V2.4 ● CHANNEL HYPER-DE-CLUTTER ACTIVE ● PRIVACY VERIFIED ● PROTECT PERMISSIONS ● NO MORE DISCORD BLOAT ●</span>
          <span>● SYSTEM STATUS: OPTIMIZED ● SERVER-MISER V2.4 ● CHANNEL HYPER-DE-CLUTTER ACTIVE ● PRIVACY VERIFIED ● PROTECT PERMISSIONS ● NO MORE DISCORD BLOAT ●</span>
        </motion.div>
      </div>

      {/* --- NAVIGATION HEADER --- */}
      <header className={`sticky top-0 z-40 w-full transition-all duration-500 border-b ${
        isDarkMode 
          ? `bg-[#040406]/95 border-slate-900 text-slate-100 ${scrollY > 20 ? "py-3 px-6 shadow-2xl backdrop-blur-md" : "py-5 px-6 bg-transparent"}` 
          : `bg-[#fcfdfd]/95 border-slate-200 text-slate-900 ${scrollY > 20 ? "py-3 px-6 shadow-md backdrop-blur-md" : "py-5 px-6 bg-white/95"}`
      }`}>
        <div className="container mx-auto flex flex-col lg:flex-row items-center justify-between gap-3 lg:gap-0">
          
          {/* Controls + Mobile Logo Row */}
          <div className="flex items-center justify-between w-full lg:w-auto gap-4">
            
            {/* Header Controls (Theme switch + Invite Bot button) */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle Flip Switch with Framer Motion transition */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className={`p-2 border transition-all duration-300 rounded-none cursor-pointer flex items-center justify-center w-9 h-9 overflow-hidden relative ${
                  isDarkMode 
                    ? "bg-[#0d0f18] border-slate-800 text-yellow-400 hover:text-white" 
                    : "bg-white border-slate-300 text-slate-700 hover:text-slate-900 shadow-sm"
                }`}
                title={isDarkMode ? "Switch to Light Theme" : "Switch to Dark Theme"}
                id="theme-toggle"
              >
                <div className="relative w-4 h-4 flex items-center justify-center">
                  <AnimatePresence mode="wait" initial={false}>
                    {isDarkMode ? (
                      <motion.div
                        key="sun"
                        initial={{ rotate: -90, scale: 0, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ rotate: 90, scale: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="absolute flex items-center justify-center"
                      >
                        <Sun className="w-4 h-4" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="moon"
                        initial={{ rotate: 90, scale: 0, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ rotate: -90, scale: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="absolute flex items-center justify-center"
                      >
                        <Moon className="w-4 h-4" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>

              {/* Brutalist Button CTA */}
              <button
                onClick={triggerAuthFlow}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className={`relative px-4 py-2 rounded-none border text-[10px] font-mono tracking-widest uppercase transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                  isDarkMode 
                    ? "border-slate-700 bg-transparent text-slate-300 hover:text-black hover:bg-[#e2f9b8] hover:border-[#e2f9b8]" 
                    : "border-slate-300 bg-white text-slate-800 hover:text-white hover:bg-[#ff3b5c] hover:border-[#ff3b5c] shadow-sm"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full animate-ping ${isDarkMode ? "bg-[#e2f9b8]" : "bg-[#ff3b5c]"}`} />
                <span>AUTHORIZE</span>
              </button>
            </div>

            {/* Mobile Logo on Top Right of header (placed on the same row as controls for mobile) */}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setCurrentView("home");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              className="flex lg:hidden items-center gap-2 group select-none cursor-pointer"
            >
              <Logo size={32} glow={true} className="transition-transform duration-500 group-hover:rotate-180 shrink-0" />
              <div className="flex flex-col text-right items-end">
                <span className={`font-display font-black text-base tracking-tighter leading-none transition-colors ${
                  isDarkMode 
                    ? "text-slate-100 group-hover:text-[#e2f9b8]" 
                    : "text-slate-950 group-hover:text-[#ff3b5c]"
                }`}>
                  SERVER<span className="font-light tracking-normal opacity-75">MISER</span>
                </span>
                <span className={`font-mono text-[7px] tracking-widest uppercase mt-0.5 ${
                  isDarkMode ? "text-[#2e7b8f]" : "text-[#1f6475]"
                }`}>
                  ALL-IN-ONE DISCORD ENGINE
                </span>
              </div>
            </a>

          </div>

          {/* Minimized Categories Row for Mobile/Phone View (placed beneath logo, above hero) */}
          <div className="lg:hidden flex flex-wrap justify-center items-center gap-x-3.5 gap-y-1.5 py-2 border-t border-slate-900/10 dark:border-slate-100/10 w-full">
            <button
              onClick={() => {
                setCurrentView("home");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`font-mono text-[9px] uppercase tracking-wider font-bold transition-colors duration-250 cursor-pointer ${
                currentView === "home" 
                  ? (isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c]") 
                  : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950")
              }`}
            >
              Home
            </button>
            <button
              onClick={() => {
                setCurrentView("home");
                setPendingScrollTarget("about");
              }}
              className={`font-mono text-[9px] uppercase tracking-wider font-bold transition-colors duration-250 cursor-pointer ${
                isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950"
              }`}
            >
              About
            </button>
            <button
              onClick={() => {
                setCurrentView("sandbox");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`font-mono text-[9px] uppercase tracking-wider font-bold transition-colors duration-250 cursor-pointer ${
                currentView === "sandbox" 
                  ? (isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c]") 
                  : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950")
              }`}
            >
              Sandbox
            </button>
            <button
              onClick={() => {
                setCurrentView("commands");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`font-mono text-[9px] uppercase tracking-wider font-bold transition-colors duration-250 cursor-pointer ${
                currentView === "commands" 
                  ? (isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c]") 
                  : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950")
              }`}
            >
              Commands
            </button>
            <button
              onClick={() => {
                setCurrentView("home");
                setPendingScrollTarget("faq");
              }}
              className={`font-mono text-[9px] uppercase tracking-wider font-bold transition-colors duration-250 cursor-pointer ${
                isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950"
              }`}
            >
              FAQ
            </button>
            <button
              onClick={() => {
                setCurrentView("support");
                setSupportTab("terms");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`font-mono text-[9px] uppercase tracking-wider font-bold transition-colors duration-250 cursor-pointer ${
                currentView === "support" 
                  ? (isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c]") 
                  : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950")
              }`}
            >
              Support
            </button>
            <button
              onClick={() => {
                setCurrentView("analytics");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`font-mono text-[9px] uppercase tracking-wider font-bold transition-colors duration-250 cursor-pointer ${
                currentView === "analytics" 
                  ? "text-[#ff3b5c]" 
                  : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950")
              }`}
            >
              Analytics
            </button>
          </div>

          {/* Desktop Left Side: Navigation Links & Controls */}
          <div className="hidden lg:flex items-center gap-6 sm:gap-8">
            {/* Minimalist Brutalist Navigation */}
            <nav className="flex items-center gap-6 font-mono text-xs tracking-widest uppercase text-slate-400">
              <button
                onClick={() => {
                  setCurrentView("home");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`transition-colors relative group py-1 cursor-pointer font-mono text-xs tracking-widest uppercase ${
                  currentView === "home" 
                    ? (isDarkMode ? "text-[#e2f9b8] font-bold" : "text-[#ff3b5c] font-bold") 
                    : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950")
                }`}
              >
                Home
                {currentView === "home" && (
                  <span className={`absolute bottom-0 left-0 w-full h-0.5 ${isDarkMode ? "bg-[#e2f9b8]" : "bg-[#ff3b5c]"}`} />
                )}
              </button>
              <button
                onClick={() => {
                  setCurrentView("home");
                  setPendingScrollTarget("about");
                }}
                className={`transition-colors relative group py-1 cursor-pointer font-mono text-xs tracking-widest uppercase ${
                  isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                About
                <span className={`absolute bottom-0 left-0 w-0 h-0.5 ${isDarkMode ? "bg-[#e2f9b8]" : "bg-[#ff3b5c]"} group-hover:w-full transition-all duration-300`} />
              </button>
              <button
                onClick={() => {
                  setCurrentView("sandbox");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`transition-colors relative group py-1 cursor-pointer font-mono text-xs tracking-widest uppercase ${
                  currentView === "sandbox"
                    ? (isDarkMode ? "text-[#e2f9b8] font-bold" : "text-[#ff3b5c] font-bold")
                    : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950")
                }`}
              >
                Sandbox
                {currentView === "sandbox" && (
                  <span className={`absolute bottom-0 left-0 w-full h-0.5 ${isDarkMode ? "bg-[#e2f9b8]" : "bg-[#ff3b5c]"}`} />
                )}
              </button>
              <button
                onClick={() => {
                  setCurrentView("commands");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`transition-colors relative group py-1 cursor-pointer font-mono text-xs tracking-widest uppercase ${
                  currentView === "commands"
                    ? (isDarkMode ? "text-[#e2f9b8] font-bold" : "text-[#ff3b5c] font-bold")
                    : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950")
                }`}
              >
                Commands
                {currentView === "commands" && (
                  <span className={`absolute bottom-0 left-0 w-full h-0.5 ${isDarkMode ? "bg-[#e2f9b8]" : "bg-[#ff3b5c]"}`} />
                )}
              </button>
              <button
                onClick={() => {
                  setCurrentView("home");
                  setPendingScrollTarget("faq");
                }}
                className={`transition-colors relative group py-1 cursor-pointer font-mono text-xs tracking-widest uppercase ${
                  isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                FAQ
                <span className={`absolute bottom-0 left-0 w-0 h-0.5 ${isDarkMode ? "bg-[#e2f9b8]" : "bg-[#ff3b5c]"} group-hover:w-full transition-all duration-300`} />
              </button>

              {/* Support Dropdown Container */}
              <div 
                className="relative py-1"
                onMouseEnter={() => setIsSupportDropdownOpen(true)}
                onMouseLeave={() => setIsSupportDropdownOpen(false)}
              >
                <button
                  onClick={() => {
                    setCurrentView("support");
                    setSupportTab("terms");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`transition-colors relative flex items-center gap-1 cursor-pointer font-mono text-xs tracking-widest uppercase ${
                    currentView === "support"
                      ? (isDarkMode ? "text-[#e2f9b8] font-bold" : "text-[#ff3b5c] font-bold")
                      : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950")
                  }`}
                >
                  <span>Support</span>
                  <ChevronDown className="w-3.5 h-3.5 transition-transform duration-300" />
                  {currentView === "support" && (
                    <span className={`absolute bottom-0 left-0 w-full h-0.5 ${isDarkMode ? "bg-[#e2f9b8]" : "bg-[#ff3b5c]"}`} />
                  )}
                </button>

                <AnimatePresence>
                  {isSupportDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className={`absolute left-0 mt-2 w-56 rounded-none border shadow-xl z-50 ${
                        isDarkMode 
                          ? "bg-[#0b0c10] border-slate-800 text-slate-300" 
                          : "bg-white border-black text-slate-800"
                      }`}
                    >
                      <div className="flex flex-col p-1.5 font-mono text-[10px] tracking-wider uppercase">
                        
                        {/* Option 1: Support Server (FIRST OPTION) */}
                        <a
                          href="https://discord.gg/H36QXKB6R6"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center justify-between p-2.5 transition-all ${
                            isDarkMode 
                              ? "hover:bg-slate-900 hover:text-[#e2f9b8]" 
                              : "hover:bg-slate-100 hover:text-[#ff3b5c]"
                          }`}
                          onClick={() => setIsSupportDropdownOpen(false)}
                        >
                          <span className="font-bold">🌐 Support Server</span>
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </a>

                        <hr className={`my-1 ${isDarkMode ? "border-slate-900" : "border-slate-200"}`} />

                        {/* Option 2: Terms of Service */}
                        <button
                          onClick={() => {
                            setCurrentView("support");
                            setSupportTab("terms");
                            setIsSupportDropdownOpen(false);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`text-left p-2.5 transition-colors cursor-pointer w-full text-xs font-mono tracking-wider ${
                            isDarkMode ? "hover:bg-slate-900 hover:text-white" : "hover:bg-slate-100 hover:text-slate-950"
                          }`}
                        >
                          📜 Terms of Service
                        </button>

                        {/* Option 3: Privacy Policy */}
                        <button
                          onClick={() => {
                            setCurrentView("support");
                            setSupportTab("privacy");
                            setIsSupportDropdownOpen(false);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`text-left p-2.5 transition-colors cursor-pointer w-full text-xs font-mono tracking-wider ${
                            isDarkMode ? "hover:bg-slate-900 hover:text-white" : "hover:bg-slate-100 hover:text-slate-950"
                          }`}
                        >
                          🔒 Privacy Policy
                        </button>

                        {/* Option 4: Behind the Name */}
                        <button
                          onClick={() => {
                            setCurrentView("support");
                            setSupportTab("formal");
                            setIsSupportDropdownOpen(false);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`text-left p-2.5 transition-colors cursor-pointer w-full text-xs font-mono tracking-wider ${
                            isDarkMode ? "hover:bg-slate-900 hover:text-white" : "hover:bg-slate-100 hover:text-slate-950"
                          }`}
                        >
                          👑 Brand Origin
                        </button>

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => {
                  setCurrentView("analytics");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`transition-colors relative group py-1 cursor-pointer font-mono text-xs tracking-widest uppercase ${
                  currentView === "analytics"
                    ? "text-[#ff3b5c] font-black"
                    : (isDarkMode ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-950")
                }`}
              >
                Analytics
                {currentView === "analytics" && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#ff3b5c]" />
                )}
              </button>
            </nav>
          </div>

          {/* Right Side: Logo & Brutalist Brand Link (Desktop only) */}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setCurrentView("home");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className="hidden lg:flex items-center gap-3 group transition-transform duration-350 select-none cursor-pointer"
            style={{ 
              transform: `translateY(${scrollY * 0.45}px)`,
              transition: "transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)"
            }}
          >
            <Logo size={40} glow={true} className="transition-transform duration-500 group-hover:rotate-180 shrink-0" />
            <div className="flex flex-col text-right items-end">
              <span className={`font-display font-black text-xl tracking-tighter leading-none transition-colors ${
                isDarkMode 
                  ? "text-slate-100 group-hover:text-[#e2f9b8]" 
                  : "text-slate-950 group-hover:text-[#ff3b5c]"
              }`}>
                SERVER<span className="font-light tracking-normal opacity-75">MISER</span>
              </span>
              <span className={`font-mono text-[8px] tracking-widest uppercase mt-0.5 ${
                isDarkMode ? "text-[#2e7b8f]" : "text-[#1f6475]"
              }`}>
                ALL-IN-ONE DISCORD ENGINE
              </span>
            </div>
          </a>

        </div>
      </header>

      {/* --- RENDER CURRENT VIEW --- */}
      {currentView === "analytics" && (
        <AnalyticsDashboard onBack={() => setCurrentView("home")} setIsHovering={setIsHovering} isDarkMode={isDarkMode} />
      )}

      {currentView === "support" && (
        <div className={`py-16 transition-colors duration-500 ${
          isDarkMode ? "bg-[#040406] text-slate-100" : "bg-[#f4f5f8] text-slate-900"
        }`}>
          <div className="container mx-auto px-6 max-w-7xl">
            {/* Back to Home Button */}
            <div className="mb-8">
              <button
                onClick={() => {
                  setCurrentView("home");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`font-mono text-xs uppercase tracking-widest px-4 py-2 border cursor-pointer transition-all flex items-center gap-2 ${
                  isDarkMode 
                    ? "border-slate-800 hover:border-[#e2f9b8] text-slate-400 hover:text-white bg-[#0a0a0f]" 
                    : "border-slate-300 hover:border-black text-slate-600 hover:text-black bg-white shadow-sm"
                }`}
              >
                ← Back to Home
              </button>
            </div>

            {/* Support Hero Block */}
            <div className={`border-2 p-8 mb-12 relative overflow-hidden transition-all duration-300 ${
              isDarkMode ? "border-slate-800 bg-[#07070c]" : "border-black bg-white shadow-[6px_6px_0px_#ff3b5c]"
            }`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,59,92,0.06)_0%,transparent_50%)] pointer-events-none" />
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div>
                  <span className={`font-mono text-xs tracking-widest uppercase ${isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c]"}`}>
                    ★ ACTIVE COMMUNITY SUPPORT ★
                  </span>
                  <h1 className="font-display font-black text-3xl sm:text-4xl uppercase tracking-tighter mt-2">
                    SERVERMISER DISCORD HELP DESK
                  </h1>
                  <p className={`font-mono text-[10px] sm:text-xs uppercase mt-3 tracking-wider leading-relaxed max-w-2xl ${
                    isDarkMode ? "text-slate-400" : "text-slate-600"
                  }`}>
                    Need instant technical assistance, custom template advice, or want to report server performance bugs? Speak directly with our developers and certified moderators on the Guild network.
                  </p>
                </div>

                {/* FEATURED: SUPPORT SERVER BUTTON (MUST BE THE FIRST OPTION FEATURED!) */}
                <a
                  href="https://discord.gg/H36QXKB6R6"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-8 py-4 font-mono font-bold text-xs tracking-widest uppercase transition-all duration-300 text-center shrink-0 flex items-center gap-2.5 ${
                    isDarkMode 
                      ? "bg-[#e2f9b8] text-black hover:bg-[#c5e691] shadow-[4px_4px_0px_#ff3b5c]" 
                      : "bg-black text-white hover:bg-slate-900 shadow-[4px_4px_0px_#ff3b5c]"
                  }`}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                >
                  <svg viewBox="0 0 127.14 96.36" className="w-4.5 h-4.5 fill-current">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.88-.65,1.72-1.34,2.51-2a75.58,75.58,0,0,0,73,0c.79.71,1.63,1.4,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,49.52,123.6,26.69,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.9,46,53.72,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.14,46,96,53,91,65.69,84.69,65.69Z" />
                  </svg>
                  <span>JOIN SUPPORT SERVER</span>
                </a>
              </div>
            </div>

            {/* Interactive Tab Interface for Support categories */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Tab Navigators */}
              <div className="lg:col-span-3 flex flex-col gap-2.5">
                <button
                  onClick={() => setSupportTab("terms")}
                  className={`text-left font-mono text-xs uppercase tracking-widest px-5 py-4 border-l-4 transition-all duration-300 cursor-pointer ${
                    supportTab === "terms"
                      ? (isDarkMode ? "border-[#e2f9b8] bg-[#12131a] text-white" : "border-black bg-white text-black font-bold shadow-sm")
                      : (isDarkMode ? "border-transparent text-slate-500 hover:text-slate-300 bg-[#07070a]" : "border-transparent text-slate-600 hover:bg-slate-100 bg-slate-50")
                  }`}
                >
                  📜 Terms of Service
                </button>
                <button
                  onClick={() => setSupportTab("privacy")}
                  className={`text-left font-mono text-xs uppercase tracking-widest px-5 py-4 border-l-4 transition-all duration-300 cursor-pointer ${
                    supportTab === "privacy"
                      ? (isDarkMode ? "border-[#ff3b5c] bg-[#12131a] text-white" : "border-black bg-white text-black font-bold shadow-sm")
                      : (isDarkMode ? "border-transparent text-slate-500 hover:text-slate-300 bg-[#07070a]" : "border-transparent text-slate-600 hover:bg-slate-100 bg-slate-50")
                  }`}
                >
                  🔒 Privacy Policy
                </button>
                <button
                  onClick={() => setSupportTab("formal")}
                  className={`text-left font-mono text-xs uppercase tracking-widest px-5 py-4 border-l-4 transition-all duration-300 cursor-pointer ${
                    supportTab === "formal"
                      ? (isDarkMode ? "border-[#2e7b8f] bg-[#12131a] text-white" : "border-black bg-white text-black font-bold shadow-sm")
                      : (isDarkMode ? "border-transparent text-slate-500 hover:text-slate-300 bg-[#07070a]" : "border-transparent text-slate-600 hover:bg-slate-100 bg-slate-50")
                  }`}
                >
                  👑 Behind The Name
                </button>
              </div>

              {/* Active Tab Panel Document Content */}
              <div className="lg:col-span-9">
                <div className={`border-2 p-8 sm:p-10 transition-all duration-300 ${
                  isDarkMode ? "border-slate-900 bg-[#07070b]" : "border-black bg-white shadow-[6px_6px_0px_#2e7b8f]"
                }`}>
                  
                  {supportTab === "terms" && (
                    <div className="flex flex-col gap-6">
                      <div className="border-b pb-4 mb-4 flex items-center justify-between flex-wrap gap-4">
                        <h2 className="font-display font-black text-2xl uppercase tracking-tight text-[#ff3b5c]">
                          📜 TERMS OF SERVICE
                        </h2>
                        <span className="font-mono text-[9px] px-2.5 py-1 bg-[#ff3b5c]/10 text-[#ff3b5c] font-bold">
                          EFFECTIVE: JULY 2026
                        </span>
                      </div>

                      <div className={`font-mono text-xs tracking-wide leading-relaxed uppercase space-y-6 ${
                        isDarkMode ? "text-slate-400" : "text-slate-700"
                      }`}>
                        <div>
                          <h3 className={`font-bold text-sm mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>
                            1. BINDING ACCEPTANCE, COMPLIANCE AND STRUCTURAL OBLIGATION
                          </h3>
                          <p className="mb-2">
                            BY AUTHORIZING, ADDING, DEPLOYING, OR ACTIVATING SERVERMISER ON ANY DISCORD GUILD, CHATROOM, OR PUBLIC/PRIVATE SERVICE NODE, OR BY INTERACTING WITH ITS INTEGRATED API ENGINES, YOU HEREBY EXPRESSLY AND UNCONDITIONALLY COVENANT TO BE FULLY BOUND BY THESE TERMS OF SERVICE, AS WELL AS THE MASTER TERMS OF SERVICE DISPATCHED BY DISCORD INC.
                          </p>
                          <p>
                            IF YOU ACTIVELY INSTIGATE AN AUTHORIZATION FLOW ON BEHALF OF AN INCORPORATED ORGANIZATIONAL CHANNELS OR CLUSTERS, YOU DECREE AND CERTIFY THAT YOU HOLD ADEQUATE STRUCTURAL ADMINISTRATIVE PRIVILEGES TO ACCEPT THESE BINDING COVENANTS AND CONTRACTS. IF YOU DO NOT FULLY CONSENT TO ALL LEGISLATIONS HEREIN, DISMISS THE BOT AND UNINSTALL ITS WEB MANIFEST IMMEDIATELY.
                          </p>
                        </div>

                        <div>
                          <h3 className={`font-bold text-sm mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>
                            2. PROVISION OF SERVICES & COMPREHENSIVE SLA MATRIX
                          </h3>
                          <p className="mb-2">
                            SERVERMISER OFFERS A PLURALITY OF ADMINISTRATIVE TOOLS, INCLUDING BUT NOT LIMITED TO: CHANNEL COMPACTING AND OPTIMIZATION, AUTOMATED SPAM/SQUELCH FILTERS, COMPREHENSIVE TICKETING TRANSCRIPT TRANSFERS, PASSPORT SEED AUTHENTICATION, CHATTER LEVEL PROGRESSION SCHEDULING, AND HISTORIC ANALYTICS COMPILATIONS.
                          </p>
                          <p>
                            ALL SUCH FEATURES ARE DELIVERED SOLELY ON AN "AS IS" AND "AS AVAILABLE" BASELINE DESIGN. WE HEREBY DISCLAIM ALL EXPRESS OR IMPLIED WARRANTY STANDARDS, INCLUDING MERCHANTABILITY AND UNINTERRUPTED UPTIME. IN ACCORDANCE WITH RECURRING PLATFORM CYCLES, WE RESERVE THE DISCRETIONARY RIGHT TO SCHEDULE CYBERNETIC MAINTENANCE PERIODS UP TO SEVENTY-TWO (72) HOURS PER CALENDAR YEAR TO RESET CORRUPTED MEMORY BUFFERS, SOLVE STACK OVERFLOW RISKS, AND MAINTAIN SHARD HEALTH WITHOUT PRIOR NOTIFICATION.
                          </p>
                        </div>

                        <div>
                          <h3 className={`font-bold text-sm mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>
                            3. PROHIBITED INFRASTRUCTURE ABUSE & PENALTIES
                          </h3>
                          <p className="mb-2">
                            TO PRESERVE INTER-NODE STABILITY, GUILD MANAGERS, ADMINISTRATORS, AND GENERAL MEMBERS ARE STRICTLY PROHIBITED FROM ENGAGING IN: (A) FLOODING THE LEVELING APPARATUS BY INORGANIC OR SPAMMING REST-API INJECTION SCHEMES; (B) GENERATING EXPLOITATIVE CHANNELS TO SPAM MODERATION WEBHOOKS; (C) INJECTING HOSTILE SCRIPT CODE, MALICIOUS EXECUTABLES, OR TROJAN EMBEDS INTO SUPPORT TICKETS; OR (D) ATTEMPTING TO REVERSE-ENGINEER OR DECOMPILE THE WEBSOCKET MULTIPLEXOR INTERFACE.
                          </p>
                          <p>
                            VIOLATIONS WILL INSTANTLY VOID ACTIVE GUILD ENFRANCHISEMENT. WE PRESERVE THE ABSOLUTE AND EXCLUSIVE DISCRETION TO PERMANENTLY BAN OR BANISH INDIVIDUAL USER SNOWFLAKES AND HOSTILE SERVER IDENTIFIERS DETECTED TO BE JEOPARDIZING GENERAL INFRASTRUCTURE INTEGRITY.
                          </p>
                        </div>

                        <div>
                          <h3 className={`font-bold text-sm mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>
                            4. STRUCTURAL INDEMNIFICATION & EXCLUSION OF LIABILITY
                          </h3>
                          <p className="mb-2">
                            IN NO EVENT SHALL SERVERMISER, ITS DIRECT SYSTEM REPOSITORIES, CHIEF CODER COOPERATIVE, DATABASE DESIGNERS, SERVER OPERATORS, AND AFFILIATED HOSTS BE LIABLE FOR ANY CONSEQUENTIAL, INDIRECT, INCIDENTAL, STATUTORY, SPECIAL, OR EXEMPLARY DAMAGES.
                          </p>
                          <p>
                            THIS LIMITATION APPLIES DIRECTLY TO SYSTEM DELETIONS CAUSALLY LINKED TO ADMINISTRATOR COMMAND MISUSE, DESTRUCTIVE LOG DATA LOSSES, CRITICAL RAM MISALLOCATIONS, DISCORD API NETWORK INTERRUPTIONS, CORRUPTED LEVEL RE-CALCULATIONS, OR SECURITY CRACKS ARISING FROM COMPROMISED MODERATOR TOKENS. OUR MAXIMUM FINANCIAL LIABILITY UNDER ANY JURISDICTION SHALL NOT EXCEED THE CUMULATIVE SUMS ACTUALLY SPENT BY THE GUILD TO CONFIGURE THE SPECIFIC SERVICE (EQUIVALENT TO ZERO DOLLARS US).
                          </p>
                        </div>

                        <div>
                          <h3 className={`font-bold text-sm mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>
                            5. TERMINATION AND DATA PURGE MECHANICS
                          </h3>
                          <p className="mb-2">
                            GUILD PROPRIETORS RETAIN THE LIBERTY TO KICK, BAN, OR REMOVE SERVERMISER FROM THEIR SERVING CHANNELS AT ANY GIVEN SECOND. TERMINATION SENDS AN AUTOMATED TELEMETRY INTERRUPT SIGNAL WHICH IMMEDIATELY FREEZES ALL ACTIVE READ-WRITE LOGS ASSOCIATED WITH THE DISCHARGED ID.
                          </p>
                          <p>
                            SUBSEQUENT DATA RECORDS ARE AUTOMATICALLY SLATED FOR DESTRUCTION AFTER A COMPLIANCE COOLING INTERVAL OF THIRTY (30) STANDARD WORKING DAYS. ALL BLACKLISTED SERVERS FORFEIT DATA RECOVERY PRIVILEGES TO PREVENT CONTINUOUS EXPLOITATION.
                          </p>
                        </div>

                        <div>
                          <h3 className={`font-bold text-sm mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>
                            6. BINDING ARBITRATION AND GOVERNING JURISDICTION
                          </h3>
                          <p className="mb-2">
                            EVERY POTENTIAL CLAIM, CIVIL DISPUTE, OR SERVICE LITIGATION ARISING OUT OF OR IN RELATION TO THESE STRUCTURAL DOCUMENTS SHALL BE SETTLED EXCLUSIVELY VIA FINAL BINDING PRIVATE ARBITRATION UNDER CYBERNETIC COOPERATIVE JURISDICTIONAL LAWS. INDIVIDUAL CLAIM RESOLUTION SHALL BE CONDUCTED LITERALLY AND FORMALLY ACCORDING TO BINDING DEVELOPER MANDATES.
                          </p>
                          <p>
                            YOU EXPRESSLY WAIVE ANY CLASS-ACTION LITIGATION CONCESSIONS IN DISPUTE CHANNELS. GOVERNING CODES SHALL REMAIN GROUNDED STRICTLY IN TRADITIONAL SYSTEM PURITY AND SECURE SOFTWARE PERSISTENCE STANDARDS.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {supportTab === "privacy" && (
                    <div className="flex flex-col gap-6">
                      <div className="border-b pb-4 mb-4 flex items-center justify-between flex-wrap gap-4">
                        <h2 className="font-display font-black text-2xl uppercase tracking-tight text-[#e2f9b8]">
                          🔒 PRIVACY POLICY
                        </h2>
                        <span className="font-mono text-[9px] px-2.5 py-1 bg-emerald-950/20 text-emerald-400 font-bold">
                          SECURED SHA-256
                        </span>
                      </div>

                      <div className={`font-mono text-xs tracking-wide leading-relaxed uppercase space-y-6 ${
                        isDarkMode ? "text-slate-400" : "text-slate-700"
                      }`}>
                        <div>
                          <h3 className={`font-bold text-sm mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>
                            1. COMPREHENSIVE DATA ELEMENTS INDEXED & HARVESTED
                          </h3>
                          <p className="mb-2">
                            WE HARVEST AND RECORD ONLY THE BARE MINIMUM METRICS AND DATA SYNERGIES MANDATED FOR OPTIMAL GATEWAY PERFORMANCE AND COMPLIANCE:
                          </p>
                          <p className="mb-2">
                            (A) DISCORD GUILD IDENTIFICATION KEYS (FOR ROLE CLASSIFICATION, EMPIRE CATEGORY INDEXING, AND CHANNEL DE-CLUTTERING CONFIGURATIONS);
                          </p>
                          <p className="mb-2">
                            (B) INDIVIDUAL DISCORD SNOWFLAKE ID CODES (TO PROPERLY ASSOCIATE XP LEVELING COMPILATIONS, COMPATIBLE RE-ENGAGE PROGRESSION STATE, COIN FLIP SCORE BALANCES, AND SECURED MODERATOR WARN LOG RECORDS);
                          </p>
                          <p>
                            (C) SECURED SUPPORT TICKET TRANSCRIPT RECORD SEGMENTS AND ASSOCIATED USER METADATA (TEMPORARILY RETAINED UNTIL ARCHIVED OR PURGED BY THE DESIGNATED MODERATOR DESPATCHES).
                          </p>
                        </div>

                        <div>
                          <h3 className={`font-bold text-sm mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>
                            2. STORAGE ISOLATION, NO-ADVERTISING & DATA SECURITY COVENANT
                          </h3>
                          <p className="mb-2">
                            WE MAINTAIN AN UNCONDITIONAL ZERO-SHARING INJUNCTION AND SECURITY PROMISE: WE DO NOT UNDER ANY CIRCUMSTANCE SELL, RENT, LEASE, EXCHANGE, DISCLOSE, OR TRANSPLANT GUILD METRICS, CHAT BEHAVIORS, OR USER DISCORD SNOWFLAKES TO MARKETING REPOSITORIES, SPONSORS, THIRD-PARTY ADVERTISERS, OR STATISTICAL AGENTS.
                          </p>
                          <p>
                            YOUR SERVER STRUCTURE AND VIRTUAL COMMUNICATION SPACE IS CONSIDERED YOUR EXCLUSIVE PRIVATE INTELLECTUAL PROPERTY. ALL COMPLIANCE RECORDS AND LOGS RESIDE ON HIGHLY ISOLATED CLOUD CORES SHIELDED BEHIND INTEGRAL DEFENSE LAYERS WITH STRICT CIPHER COMPLIANCE.
                          </p>
                        </div>

                        <div>
                          <h3 className={`font-bold text-sm mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>
                            3. INSTANT COMMAND PURGES & CLIENT-SIDE PURGE PRIVILEGES
                          </h3>
                          <p className="mb-2">
                            SERVER OWNERS AND APPOINTED ADMINISTRATORS EXERCISE ABSOLUTE DIRECT COMMAND OVER THEIR GUILD EMPIRE. EXECUTING DESTRUCTIVE UTILITY SCHEMES LIKE `|clear-channels` REMOVES THE ASSOCIATED INTERNAL COMPRESSION METRICS IMMEDIATELY.
                          </p>
                          <p>
                            TO RETRIEVE OR ENTIRELY WIPE YOUR HISTORIC INFORMATION STATE, ANY REGISTERED OWNER CAN REQUEST AN INSTANT COMPLETE PURGE VIA THE SUPPORT DESK OR AUTOMATED INTERFACES, DISPATCHING AN OVERWRITE SIGNAL THAT REPLACES AND NULLIFIES EVERY LOGGED RECORD IMMEDIATELY.
                          </p>
                        </div>

                        <div>
                          <h3 className={`font-bold text-sm mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>
                            4. RETENTION SCHEDULING & AUTOMATED CACHE DESTRUCTION TIMERS
                          </h3>
                          <p className="mb-2">
                            EXPERIENCE CHARTS AND MODERATION WARN ARTIFACTS ARE HELD AND CACHED IN PERMANENT PERSISTENT DATABASE SLOTS TO SUPPORT CONTINUOUS COMPETITIVE INTER-GUILD ENGAGEMENT AND RANKS PROGRESSION.
                          </p>
                          <p>
                            SUPPORT TICKET CONTENT BUFFER LOGS ARE RELEGATED TO VOLATILE MEMORY RAM CACHES AND ARE COMPLETELY DESTROYED AND ZEROED OUT TEN (10) SECONDS AFTER TRANSCRIPT TRANSFERS AND SHIPMENT CONFIRMATIONS ARE COMPLETED TO THE GUILD'S AUDIT OUTLET.
                          </p>
                        </div>

                        <div>
                          <h3 className={`font-bold text-sm mb-2 ${isDarkMode ? "text-slate-200" : "text-slate-950"}`}>
                            5. COOKIES & LOCAL STORAGE TELEMETRY PRESERVES
                          </h3>
                          <p className="mb-2">
                            OUR SECURE WEB DESK AND SANDBOX CONSOLE DO NOT UTILIZE IDENTIFYING TRACKING COOKIES TO MONITOR USER WEB-SURFING HABITS OUTSIDE OF THIS PORTAL.
                          </p>
                          <p>
                            WE INSTEAD EMPLOY LOCALSTORAGE TO SECURE AND PRESERVE BASIC CLIENT-SIDE INTERACTION PARAMETERS (E.G., PREFERRED THEME PRESETS: DARK VS LIGHT) STABLE IN YOUR LOCAL BROWSER SANDBOX. WE VALUE AND REINFORCE MAXIMUM USER ANONYMITY AND SECURE LOGICAL ISOLATION.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {supportTab === "formal" && (
                    <div className="flex flex-col gap-6">
                      <div className="border-b pb-4 mb-4 flex items-center justify-between flex-wrap gap-4">
                        <h2 className="font-display font-black text-2xl uppercase tracking-tight text-[#2e7b8f]">
                          👑 BEHIND THE NAME: WHY IS IT FORMAL?
                        </h2>
                        <span className="font-mono text-[9px] px-2.5 py-1 bg-cyan-950/20 text-cyan-400 font-bold">
                          ORIGIN STATEMENT
                        </span>
                      </div>

                      <div className={`font-mono text-xs tracking-wide leading-relaxed uppercase space-y-6 ${
                        isDarkMode ? "text-slate-400" : "text-slate-700"
                      }`}>
                        <p className={`border-l-4 border-[#2e7b8f] pl-4 italic text-sm ${isDarkMode ? "text-slate-200" : "text-slate-900"}`}>
                          "A 'MISER' IS HISTORICALLY DEFINED AS A CONSERVATOR, A HIGHLY VIGILANT AND THRIFTY ENTITY THAT CONSERVES PRECIOUS ASSETS AND SYSTEM RESOURCES RELENTLESSLY TO PREVENT LEAKAGE AND INEFFICIENCY."
                        </p>

                        <p>
                          IN MODERN DISCORD SERVER ARCHITECTURE AND DESIGN, THE FOREMOST IMPEDIMENT TO ENJOYABLE AND LONG-LASTING COMMUNITY INTERACTION IS CLUTTER, REDUNDANT BOT SPRAWL, CPU CHOKES, AND ENDLESS CONVERSATIONAL NOISE. RUNNING SIX OR SEVEN INDEPENDENT BOTS (ONE FOR TICKETS, ONE FOR XP, ONE FOR MINI-GAMES, ONE FOR COMMAND SANDBOXES, AND ANOTHER FOR AUDITING) FLOODS THE SYSTEM SHARDS, CRIPPLES RESPONSIVENESS, AND ACCRUES MASSIVE LOGICAL NOISE.
                        </p>

                        <p>
                          BY COVENANTING WITH THE TITLE <span className="text-[#ff3b5c] font-black">SERVERMISER</span>, WE CONSCIOUSLY ALIGN OUR ENTIRE SOFTWARE CONSOLE WITH AN ETHOS OF RADICAL EFFICIENCY AND COMPUTER RESOURCE CONSERVATION. WE HOARD RAM ALLOCATION, CONSOLIDATE SCATTERED CHANNELS, SHEAR DISUSED ROLE TREE ROOTS, CONDENSE TICKET INTAKES, AND KEEP SERVER FOOTPRINTS RUTHLESSLY DE-CLUTTERED, COMPACT, AND SECURE.
                        </p>

                        <p>
                          THE TERM ORIGINATED FROM TRADITIONAL MAINFRAME OPERATING DESIGNATIONS, WHERE COMPUTING REGISTERS AND BUFFER MEMORIES WERE INHERENTLY PRECIOUS AND DEAR. THE FORMAL AND TRADITIONAL LANGUAGE WE EMPLOY SIGNALS DISCIPLINED ARCHITECTURAL PURITY. WE EXCLUSIVELY DEPLOY LITERAL AND HUMBLE HUMAN LABELS OVER PSEUDO-DRAMATIC SCI-FI BRANDING BEHAVIOR.
                        </p>

                        <p>
                          BEHIND THIS NAME IS AN ACTIVE, RELENTLESS CODING DISCIPLINE: EVERY EVENT EMITTER, EVERY WEBSOCKET CONNECTIVITY BLOCK, AND EVERY INTERACTIVE REACT TRANSITION IN THE SERVERMISER CORE EXISTS ONLY TO ADVANCE YOUR CHANNELS WHILE PURGING UNNECESSARY ACCRUAL OF DIGITAL WASTE. YOUR GUILDS DESERVE STRICT SYSTEM COMPACTNESS AND TOTAL OPERATIONAL PURITY.
                        </p>

                        <div className={`p-4 border-t ${isDarkMode ? "border-slate-900" : "border-slate-200"} flex items-center gap-3 mt-4`}>
                          <div className="w-1.5 h-1.5 rounded-full bg-[#ff3b5c] animate-ping" />
                          <span className={`text-[10px] font-bold ${isDarkMode ? "text-slate-500" : "text-slate-600"}`}>
                            DESIGNED FOR LEAN & INTENTIONAL GUILDS.
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {currentView === "home" && (
        <>
          {/* --- HERO SECTION --- */}
      <section className={`pt-24 pb-32 border-b transition-colors duration-500 relative ${
        isDarkMode ? "bg-transparent border-slate-900" : "bg-white border-slate-200 shadow-sm"
      }`}>
        <div className="container mx-auto px-6 max-w-7xl">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Main Title Hero Text */}
            <div className="lg:col-span-8 flex flex-col items-start">
              
              {/* Micro label */}
              <div className={`flex items-center gap-2 px-3 py-1 border font-mono text-[9px] tracking-widest uppercase mb-6 transition-colors ${
                isDarkMode ? "bg-slate-900 border-slate-800 text-[#e2f9b8]" : "bg-slate-50 border-slate-200 text-[#ff3b5c]"
              }`}>
                <span className={`w-2 h-2 rounded-full animate-pulse ${isDarkMode ? "bg-[#e2f9b8]" : "bg-[#ff3b5c]"}`} />
                <span>ALL-IN-ONE BOT IN SERVICE</span>
              </div>

              {/* Big Horror Athens inspired giant typography */}
              <h1 className={`font-display font-black text-[3.8rem] sm:text-[5.5rem] md:text-[6.5rem] lg:text-[7.2rem] leading-[0.82] tracking-tighter uppercase select-none transition-colors duration-500 ${
                isDarkMode ? "text-slate-100" : "text-slate-950"
              }`}>
                KEEP DISCORD <br />
                <span className={`transition-all duration-500 ${isDarkMode ? "text-[#e2f9b8] hover:text-[#ff3b5c]" : "text-[#ff3b5c] hover:text-[#2e7b8f]"}`}>LEAN, ACTIVE</span> <br />
                <span className={`relative transition-all duration-500 ${isDarkMode ? "text-[#ff3b5c] hover:text-[#e2f9b8]" : "text-[#2e7b8f] hover:text-[#ff3b5c]"}`}>AND CLEAN.</span>
              </h1>

              {/* Subheading styled like metadata snippet */}
              <div className={`mt-8 max-w-xl p-5 border-l-4 border-[#2e7b8f] font-mono text-xs sm:text-sm leading-relaxed uppercase tracking-wider transition-colors duration-500 ${
                isDarkMode ? "bg-[#08080f] text-slate-400" : "bg-slate-50 text-slate-600"
              }`}>
                <span className="text-slate-500 block mb-1">SYSTEM SUMMARY //</span>
                ServerMiser is a fully-featured, all-in-one Discord bot built <span className={isDarkMode ? "text-slate-100 font-bold" : "text-slate-950 font-bold"}>to keep Discord lean, active and clean</span>. By consolidating core modules into a single, high-efficiency client, we eliminate command clutter and protect server hierarchy automatically.
              </div>

              {/* Brutalist Action CTA Buttons */}
              <div className="flex flex-col gap-4 mt-10 w-full sm:max-w-md">
                <div className="flex flex-wrap gap-4 w-full">
                  <button
                    onClick={triggerAuthFlow}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    className="px-8 py-4 bg-[#e2f9b8] text-black font-mono font-bold text-xs tracking-widest uppercase rounded-none border-2 border-black shadow-[4px_4px_0px_#ff3b5c] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all cursor-pointer flex-1 text-center"
                  >
                    INVITE TO DISCORD
                  </button>
                  <button
                    onClick={() => {
                      setCurrentView("sandbox");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    className={`px-8 py-4 font-mono font-bold text-xs tracking-widest uppercase rounded-none border-2 transition-all cursor-pointer flex-1 text-center flex items-center justify-center ${
                      isDarkMode
                        ? "bg-transparent text-slate-100 border-slate-700 hover:border-[#ff3b5c] hover:text-[#ff3b5c]"
                        : "bg-black text-white border-black shadow-[4px_4px_0px_#ff3b5c] hover:shadow-none hover:translate-x-1 hover:translate-y-1 hover:bg-slate-900"
                    }`}
                  >
                    SIMULATE RE-ENGAGE
                  </button>
                </div>
                <a
                  href="https://discord.gg/H36QXKB6R6"
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className={`w-full text-center px-8 py-4 font-mono font-bold text-xs tracking-widest uppercase rounded-none border-2 transition-all block cursor-pointer ${
                    isDarkMode
                      ? "bg-[#0b0c10] text-[#e2f9b8] border-[#e2f9b8] hover:bg-[#e2f9b8] hover:text-black hover:border-black shadow-[4px_4px_0px_#ff3b5c] hover:shadow-none"
                      : "bg-white text-black border-black hover:bg-[#ff3b5c] hover:text-white shadow-[4px_4px_0px_#2e7b8f] hover:shadow-none"
                  }`}
                >
                  💬 JOIN SUPPORT SERVER
                </a>
              </div>

              {/* SMOOTH EXPERIENCE ULTRA-LATENCY BENTO HEADER */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12 w-full max-w-2xl">
                <div className={`p-6 border-2 rounded-none relative overflow-hidden transition-all duration-300 ${
                  isDarkMode ? "border-slate-800 bg-[#07070c]" : "border-black bg-white shadow-[4px_4px_0px_#ff3b5c]"
                }`}>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#2e7b8f] mb-2 font-bold">TELEMETRY SPEED v4.0</div>
                  <h3 className="font-display font-black text-xl uppercase tracking-tight leading-none">
                    0ms PIPELINE DELAY
                  </h3>
                  <p className={`font-mono text-[10px] uppercase mt-2 leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                    Zero memory bottlenecks. Instant state caching routes directly from persistent isolated databases for extreme responsive operations.
                  </p>
                </div>

                <div className={`p-6 border-2 rounded-none relative overflow-hidden transition-all duration-300 ${
                  isDarkMode ? "border-slate-800 bg-[#07070c]" : "border-black bg-white shadow-[4px_4px_0px_#e2f9b8]"
                }`}>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-[#ff3b5c] mb-2 font-bold">REACTIVE CONSOLE</div>
                  <h3 className="font-display font-black text-xl uppercase tracking-tight leading-none">
                    SILKY SMOOTH EXPERIENCE
                  </h3>
                  <p className={`font-mono text-[10px] uppercase mt-2 leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
                    No packet loss, no gateway delays. Parallelized voice and channel shard connections keep your server moving flawlessly under heavy traffic.
                  </p>
                </div>
              </div>

            </div>

            {/* Visual Graphic: Large spinning planetary wireframe / grid */}
            <div className="lg:col-span-4 flex justify-center lg:justify-end relative">
              <div 
                className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center border-2 rounded-full transition-transform duration-100 ease-out"
                style={{ 
                  transform: `translateY(${Math.min(scrollY * 0.22, 90)}px)`,
                  borderColor: isDarkMode ? "rgba(15, 23, 42, 0.6)" : "rgba(226, 232, 240, 0.8)"
                }}
              >
                
                {/* Orbital Rings */}
                <div className={`absolute inset-4 border border-dashed rounded-full animate-[spin_40s_linear_infinite] ${isDarkMode ? "border-slate-800/80" : "border-slate-300"}`} />
                <div className={`absolute inset-12 border border-dashed rounded-full animate-[spin_20s_linear_infinite_reverse] ${isDarkMode ? "border-slate-800/40" : "border-slate-200"}`} />
                <div className={`absolute inset-24 border rounded-full ${isDarkMode ? "border-slate-900" : "border-slate-100"}`} />

                {/* Central Planetary Logo */}
                <Logo size={180} glow={true} className="animate-pulse" />

                {/* Tech specifications label */}
                <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[8px] tracking-widest text-[#2e7b8f] uppercase px-2 transition-colors duration-500 ${
                  isDarkMode ? "bg-[#040406]" : "bg-white"
                }`}>
                  MISER-SHIELD CORE // ACTIVE
                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* --- SECTION DIVIDER TICKER (RIGHT DIRECTION) --- */}
      <div className="bg-[#ff3b5c] text-white py-2 overflow-hidden whitespace-nowrap border-y border-black font-mono font-bold text-[9px] tracking-widest uppercase select-none">
        <motion.div
          animate={{ x: [-1000, 0] }}
          transition={{ ease: "linear", duration: 25, repeat: Infinity }}
          className="flex whitespace-nowrap gap-8"
        >
          <span>● ANTI-BLOAT MECHANISMS ONLINE ● DELETE EMPTY ROLES ● FLUID INTERFACE ● ZERO DISCORD BOT MEMORY FOOTPRINT ● STABILIZED DIRECTORIES ●</span>
          <span>● ANTI-BLOAT MECHANISMS ONLINE ● DELETE EMPTY ROLES ● FLUID INTERFACE ● ZERO DISCORD BOT MEMORY FOOTPRINT ● STABILIZED DIRECTORIES ●</span>
        </motion.div>
      </div>

      {/* --- ABOUT SECTION (MISER PHILOSOPHY) --- */}
      <section id="about" className={`py-28 relative border-b transition-all duration-500 ${isDarkMode ? "bg-[#040406] border-slate-900" : "bg-[#f4f5f8] border-slate-200"}`}>
        <div className="container mx-auto px-6 max-w-7xl">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20">
            <div className="lg:col-span-4">
              <span className="font-mono text-xs tracking-widest uppercase text-[#ff3b5c]">01 / BACKGROUND</span>
              <h2 className={`font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tighter mt-2 transition-colors duration-500 ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
                CORE OF <span className={isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c]"}>SERVERMISER</span>
              </h2>
            </div>
            <div className={`lg:col-span-8 flex flex-col gap-6 font-mono text-xs sm:text-sm tracking-wider leading-relaxed transition-colors duration-500 ${isDarkMode ? "text-slate-400" : "text-slate-600"}`}>
              <p>
                ServerMiser is designed as the ultimate powerhouse, an all-in-one Discord application built to revolutionize how you moderate, engage, and layout your Discord guild. While "Miser" is a stylish title we love, our actual toolset acts as a complete automation hub.
              </p>
              <p className={`border-l-2 border-[#ff3b5c] pl-4 transition-colors duration-500 ${isDarkMode ? "text-slate-300" : "text-slate-800 font-medium"}`}>
                In Discord, server channels, role groups, ticket categories, and active permissions represent critical guild structure. Setting up channels manually or dealing with command bloat clutters server architecture and hurts active communication.
              </p>
              <p>
                From the ground up, we support everything from ironclad automated moderation commands, private ticketing desks, XP and leveling engines, to instant 1-click server configurations. We make server administration a single-command breeze.
              </p>
            </div>
          </div>

          {/* Brutalist Grid of Key Benefits (01, 02, 03, 04, 05, 06) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Benefit Card 1 (Setting Up Servers) */}
            <div className={`p-6 border transition-all duration-300 flex flex-col justify-between h-64 group relative ${isDarkMode ? "border-emerald-900/50 bg-emerald-950/20 hover:bg-emerald-950/30 hover:border-[#e2f9b8]" : "border-emerald-200 bg-emerald-50/50 hover:border-emerald-500 hover:bg-emerald-50/85 shadow-sm"}`}>
              <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l font-mono text-xs flex items-center justify-center transition-colors ${isDarkMode ? "border-emerald-900/50 text-emerald-700/80 group-hover:text-[#e2f9b8] group-hover:border-[#e2f9b8]" : "border-emerald-200 text-emerald-600 group-hover:text-emerald-700 group-hover:border-emerald-450"}`}>
                01
              </div>
              <div className={`p-3 border w-fit transition-colors ${isDarkMode ? "bg-emerald-900/20 border-emerald-800/40 text-[#e2f9b8]" : "bg-emerald-100 border-emerald-200 text-emerald-700"}`}>
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <span className={`font-mono text-[8px] font-extrabold tracking-widest block mb-1 transition-colors ${isDarkMode ? "text-emerald-400" : "text-emerald-600"}`}>★ MAIN MODULE ★</span>
                <h3 className={`font-display font-extrabold text-lg uppercase tracking-tight transition-colors ${isDarkMode ? "text-slate-100 font-black" : "text-slate-950 font-black"}`}>
                  SETTING UP SERVERS
                </h3>
                <p className={`font-mono text-[10px] uppercase mt-1.5 tracking-widest leading-relaxed transition-colors ${isDarkMode ? "text-emerald-300/80" : "text-emerald-800/90 font-medium"}`}>
                  The absolute core of ServerMiser. Instantly deploys clean structures, categorized channels, and default roles in 1-click. This is the literal reason the bot was brought into existence.
                </p>
              </div>
            </div>

            {/* Benefit Card 2 (Moderation) */}
            <div className={`p-6 border transition-colors duration-300 flex flex-col justify-between h-64 group relative ${isDarkMode ? "border-slate-800 bg-[#06060a] hover:border-[#ff3b5c]" : "border-slate-200 bg-white hover:border-[#ff3b5c] shadow-sm"}`}>
              <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l font-mono text-xs flex items-center justify-center group-hover:text-[#ff3b5c] group-hover:border-[#ff3b5c] transition-colors ${isDarkMode ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"}`}>
                02
              </div>
              <div className={`p-3 border w-fit text-[#ff3b5c] transition-colors ${isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-red-50 border-red-100"}`}>
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-display font-extrabold text-lg uppercase tracking-tight transition-colors ${isDarkMode ? "text-slate-200 group-hover:text-slate-100" : "text-slate-800 group-hover:text-slate-950"}`}>
                  MODERATION
                </h3>
                <p className={`font-mono text-[10px] uppercase mt-2 tracking-widest leading-relaxed transition-colors ${isDarkMode ? "text-slate-500" : "text-slate-600 font-medium"}`}>
                  Advanced filters, automatic timeouts, warnings, kicks, and bans to keep your community safe.
                </p>
              </div>
            </div>

            {/* Benefit Card 3 (Ticketing) */}
            <div className={`p-6 border transition-colors duration-300 flex flex-col justify-between h-64 group relative ${isDarkMode ? "border-slate-800 bg-[#06060a] hover:border-[#2e7b8f]" : "border-slate-200 bg-white hover:border-[#2e7b8f] shadow-sm"}`}>
              <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l font-mono text-xs flex items-center justify-center group-hover:text-[#2e7b8f] group-hover:border-[#2e7b8f] transition-colors ${isDarkMode ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"}`}>
                03
              </div>
              <div className={`p-3 border w-fit text-[#2e7b8f] transition-colors ${isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-cyan-50 border-cyan-100"}`}>
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-display font-extrabold text-lg uppercase tracking-tight transition-colors ${isDarkMode ? "text-slate-200 group-hover:text-slate-100" : "text-slate-800 group-hover:text-slate-950"}`}>
                  TICKETING
                </h3>
                <p className={`font-mono text-[10px] uppercase mt-2 tracking-widest leading-relaxed transition-colors ${isDarkMode ? "text-slate-500" : "text-slate-600 font-medium"}`}>
                  Seamless interactive ticketing desks with clean, private channels for user support.
                </p>
              </div>
            </div>

            {/* Benefit Card 4 (Leveling) */}
            <div className={`p-6 border transition-colors duration-300 flex flex-col justify-between h-64 group relative ${isDarkMode ? "border-slate-800 bg-[#06060a] hover:border-[#e2f9b8]" : "border-slate-200 bg-white hover:border-[#ff3b5c] shadow-sm"}`}>
              <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l font-mono text-xs flex items-center justify-center group-hover:text-[#ff3b5c] group-hover:border-[#ff3b5c] transition-colors ${isDarkMode ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"}`}>
                04
              </div>
              <div className={`p-3 border w-fit transition-colors ${isDarkMode ? "bg-slate-900/80 border-slate-800 text-[#e2f9b8]" : "bg-emerald-50 border-emerald-100 text-emerald-600"}`}>
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-display font-extrabold text-lg uppercase tracking-tight transition-colors ${isDarkMode ? "text-slate-200 group-hover:text-slate-100" : "text-slate-800 group-hover:text-slate-950"}`}>
                  LEVELING
                </h3>
                <p className={`font-mono text-[10px] uppercase mt-2 tracking-widest leading-relaxed transition-colors ${isDarkMode ? "text-slate-500" : "text-slate-600 font-medium"}`}>
                  Fully customizable chat XP multipliers, level cards, and milestone role-rewards to boost chatter.
                </p>
              </div>
            </div>

            {/* Benefit Card 5 (Reaction Roles) */}
            <div className={`p-6 border transition-colors duration-300 flex flex-col justify-between h-64 group relative ${isDarkMode ? "border-slate-800 bg-[#06060a] hover:border-[#e2f9b8]" : "border-slate-200 bg-white hover:border-[#ff3b5c] shadow-sm"}`}>
              <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l font-mono text-xs flex items-center justify-center group-hover:text-[#ff3b5c] group-hover:border-[#ff3b5c] transition-colors ${isDarkMode ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"}`}>
                05
              </div>
              <div className={`p-3 border w-fit transition-colors ${isDarkMode ? "bg-slate-900/80 border-slate-800 text-[#e2f9b8]" : "bg-emerald-50 border-emerald-100 text-emerald-600"}`}>
                <Fingerprint className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-display font-extrabold text-lg uppercase tracking-tight transition-colors ${isDarkMode ? "text-slate-200 group-hover:text-slate-100" : "text-slate-800 group-hover:text-slate-950"}`}>
                  REACTION ROLES
                </h3>
                <p className={`font-mono text-[10px] uppercase mt-2 tracking-widest leading-relaxed transition-colors ${isDarkMode ? "text-slate-500" : "text-slate-600 font-medium"}`}>
                  Deploy highly interactive self-assignable button or selection dropdown panels to let members self-assign profile roles.
                </p>
              </div>
            </div>

            {/* Benefit Card 6 (Role System) */}
            <div className={`p-6 border transition-colors duration-300 flex flex-col justify-between h-64 group relative ${isDarkMode ? "border-slate-800 bg-[#06060a] hover:border-[#ff3b5c]" : "border-slate-200 bg-white hover:border-[#ff3b5c] shadow-sm"}`}>
              <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l font-mono text-xs flex items-center justify-center group-hover:text-[#ff3b5c] group-hover:border-[#ff3b5c] transition-colors ${isDarkMode ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"}`}>
                06
              </div>
              <div className={`p-3 border w-fit text-[#ff3b5c] transition-colors ${isDarkMode ? "bg-slate-900/80 border-slate-800" : "bg-red-50 border-red-100"}`}>
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-display font-extrabold text-lg uppercase tracking-tight transition-colors ${isDarkMode ? "text-slate-200 group-hover:text-slate-100" : "text-slate-800 group-hover:text-slate-950"}`}>
                  ROLE SYSTEM
                </h3>
                <p className={`font-mono text-[10px] uppercase mt-2 tracking-widest leading-relaxed transition-colors ${isDarkMode ? "text-slate-500" : "text-slate-600 font-medium"}`}>
                  Complete administrative control of server role hierarchy, including custom colors, renaming, hoisting, and assignment.
                </p>
              </div>
            </div>

            {/* Benefit Card 7 (Auto-Mod) */}
            <div className={`p-6 border transition-all duration-300 flex flex-col justify-between h-64 group relative ${isDarkMode ? "border-amber-900/50 bg-amber-950/20 hover:bg-amber-950/30 hover:border-[#ff9f1c]" : "border-amber-200 bg-amber-50/50 hover:border-amber-500 hover:bg-amber-50/85 shadow-sm"}`}>
              <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l font-mono text-xs flex items-center justify-center transition-colors ${isDarkMode ? "border-amber-900/50 text-amber-700/80 group-hover:text-[#ff9f1c] group-hover:border-[#ff9f1c]" : "border-amber-200 text-amber-600 group-hover:text-amber-700 group-hover:border-amber-450"}`}>
                07
              </div>
              <div className={`p-3 border w-fit transition-colors ${isDarkMode ? "bg-amber-900/20 border-amber-800/40 text-[#ff9f1c]" : "bg-amber-100 border-amber-200 text-amber-700"}`}>
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-display font-extrabold text-lg uppercase tracking-tight transition-colors ${isDarkMode ? "text-slate-200 group-hover:text-slate-100" : "text-slate-800 group-hover:text-slate-950"}`}>
                  AUTO-MOD
                </h3>
                <p className={`font-mono text-[10px] uppercase mt-2 tracking-widest leading-relaxed transition-colors ${isDarkMode ? "text-slate-500" : "text-slate-600 font-medium"}`}>
                  Ironclad automated filters, link protection schemes, anti-spam thresholds, and programmable autoresponders.
                </p>
              </div>
            </div>

            {/* Benefit Card 8 (Verification) */}
            <div className={`p-6 border transition-all duration-300 flex flex-col justify-between h-64 group relative ${isDarkMode ? "border-indigo-900/50 bg-indigo-950/20 hover:bg-indigo-950/30 hover:border-[#8338ec]" : "border-indigo-200 bg-indigo-50/50 hover:border-indigo-500 hover:bg-indigo-50/85 shadow-sm"}`}>
              <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l font-mono text-xs flex items-center justify-center transition-colors ${isDarkMode ? "border-indigo-900/50 text-indigo-700/80 group-hover:text-[#8338ec] group-hover:border-[#8338ec]" : "border-indigo-200 text-indigo-600 group-hover:text-indigo-700 group-hover:border-indigo-450"}`}>
                08
              </div>
              <div className={`p-3 border w-fit transition-colors ${isDarkMode ? "bg-indigo-900/20 border-indigo-800/40 text-[#8338ec]" : "bg-indigo-100 border-indigo-200 text-indigo-700"}`}>
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-display font-extrabold text-lg uppercase tracking-tight transition-colors ${isDarkMode ? "text-slate-200 group-hover:text-slate-100" : "text-slate-800 group-hover:text-slate-950"}`}>
                  VERIFICATION
                </h3>
                <p className={`font-mono text-[10px] uppercase mt-2 tracking-widest leading-relaxed transition-colors ${isDarkMode ? "text-slate-500" : "text-slate-600 font-medium"}`}>
                  Sophisticated interactive onboarding and verification gatekeepers to filter bots and validate new users.
                </p>
              </div>
            </div>

            {/* Benefit Card 9 (Temp Voice) */}
            <div className={`p-6 border transition-all duration-300 flex flex-col justify-between h-64 group relative ${isDarkMode ? "border-blue-900/50 bg-blue-950/20 hover:bg-blue-950/30 hover:border-[#3a86c8]" : "border-blue-200 bg-blue-50/50 hover:border-blue-500 hover:bg-blue-50/85 shadow-sm"}`}>
              <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l font-mono text-xs flex items-center justify-center transition-colors ${isDarkMode ? "border-blue-900/50 text-blue-700/80 group-hover:text-[#3a86c8] group-hover:border-[#3a86c8]" : "border-blue-200 text-blue-600 group-hover:text-blue-700 group-hover:border-blue-450"}`}>
                09
              </div>
              <div className={`p-3 border w-fit transition-colors ${isDarkMode ? "bg-blue-900/20 border-blue-800/40 text-[#3a86c8]" : "bg-blue-100 border-blue-200 text-blue-700"}`}>
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-display font-extrabold text-lg uppercase tracking-tight transition-colors ${isDarkMode ? "text-slate-200 group-hover:text-slate-100" : "text-slate-800 group-hover:text-slate-950"}`}>
                  TEMP VOICE
                </h3>
                <p className={`font-mono text-[10px] uppercase mt-2 tracking-widest leading-relaxed transition-colors ${isDarkMode ? "text-slate-500" : "text-slate-600 font-medium"}`}>
                  On-demand temporary voice lobbies that dynamically scale, configure themselves, and auto-cleanup.
                </p>
              </div>
            </div>

            {/* Benefit Card 10 (Analytics) */}
            <div className={`p-6 border transition-all duration-300 flex flex-col justify-between h-64 group relative ${isDarkMode ? "border-lime-900/50 bg-lime-950/20 hover:bg-lime-950/30 hover:border-[#e2f9b8]" : "border-lime-200 bg-lime-50/50 hover:border-lime-500 hover:bg-lime-50/85 shadow-sm"}`}>
              <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l font-mono text-xs flex items-center justify-center transition-colors ${isDarkMode ? "border-lime-900/50 text-lime-700/80 group-hover:text-[#e2f9b8] group-hover:border-[#e2f9b8]" : "border-lime-200 text-lime-600 group-hover:text-lime-700 group-hover:border-lime-450"}`}>
                10
              </div>
              <div className={`p-3 border w-fit transition-colors ${isDarkMode ? "bg-lime-900/20 border-lime-800/40 text-[#e2f9b8]" : "bg-lime-100 border-lime-200 text-lime-700"}`}>
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-display font-extrabold text-lg uppercase tracking-tight transition-colors ${isDarkMode ? "text-slate-200 group-hover:text-slate-100" : "text-slate-800 group-hover:text-slate-950"}`}>
                  ANALYTICS
                </h3>
                <p className={`font-mono text-[10px] uppercase mt-2 tracking-widest leading-relaxed transition-colors ${isDarkMode ? "text-slate-500" : "text-slate-600 font-medium"}`}>
                  Real-time guild stat-trackers and statistical voice counters tracking human, bot, and member growth indices.
                </p>
              </div>
            </div>

            {/* Benefit Card 11 (Interactive Fun & Games) */}
            <div className={`p-6 border transition-all duration-300 flex flex-col justify-between h-64 group relative ${isDarkMode ? "border-pink-900/50 bg-pink-950/20 hover:bg-pink-950/30 hover:border-[#ff3b5c]" : "border-pink-200 bg-pink-50/50 hover:border-pink-500 hover:bg-pink-50/85 shadow-sm"}`}>
              <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l font-mono text-xs flex items-center justify-center transition-colors ${isDarkMode ? "border-pink-900/50 text-pink-700/80 group-hover:text-[#ff3b5c] group-hover:border-[#ff3b5c]" : "border-pink-200 text-pink-600 group-hover:text-pink-700 group-hover:border-pink-450"}`}>
                11
              </div>
              <div className={`p-3 border w-fit transition-colors ${isDarkMode ? "bg-pink-900/20 border-pink-800/40 text-[#ff3b5c]" : "bg-pink-100 border-pink-200 text-pink-700"}`}>
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-display font-extrabold text-lg uppercase tracking-tight transition-colors ${isDarkMode ? "text-slate-200 group-hover:text-slate-100" : "text-slate-800 group-hover:text-slate-950"}`}>
                  FUN & GAMES
                </h3>
                <p className={`font-mono text-[10px] uppercase mt-2 tracking-widest leading-relaxed transition-colors ${isDarkMode ? "text-slate-500" : "text-slate-600 font-medium"}`}>
                  Interactive geographic quizzes, trivia brain-teasers, Would You Rather cards, dice duels, and randomized memes.
                </p>
              </div>
            </div>

            {/* Benefit Card 12 (Utility & Telemetry) */}
            <div className={`p-6 border transition-all duration-300 flex flex-col justify-between h-64 group relative ${isDarkMode ? "border-cyan-900/50 bg-cyan-950/20 hover:bg-cyan-950/30 hover:border-[#00f5ff]" : "border-cyan-200 bg-cyan-50/50 hover:border-cyan-500 hover:bg-cyan-50/85 shadow-sm"}`}>
              <div className={`absolute top-0 right-0 w-8 h-8 border-b border-l font-mono text-xs flex items-center justify-center transition-colors ${isDarkMode ? "border-cyan-900/50 text-cyan-700/80 group-hover:text-[#00f5ff] group-hover:border-[#00f5ff]" : "border-cyan-200 text-cyan-600 group-hover:text-cyan-700 group-hover:border-cyan-450"}`}>
                12
              </div>
              <div className={`p-3 border w-fit transition-colors ${isDarkMode ? "bg-cyan-900/20 border-cyan-800/40 text-[#00f5ff]" : "bg-cyan-100 border-cyan-200 text-cyan-750"}`}>
                <Terminal className="w-5 h-5" />
              </div>
              <div>
                <h3 className={`font-display font-extrabold text-lg uppercase tracking-tight transition-colors ${isDarkMode ? "text-slate-200 group-hover:text-slate-100" : "text-slate-800 group-hover:text-slate-950"}`}>
                  TELEMETRY UTILS
                </h3>
                <p className={`font-mono text-[10px] uppercase mt-2 tracking-widest leading-relaxed transition-colors ${isDarkMode ? "text-slate-500" : "text-slate-600 font-medium"}`}>
                  Raw server datastore extraction suites, diagnostics capabilities matrix registers, and developer diagnostic utilities.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>
      </>
      )}

      {/* --- PLAYGROUND SECTION (INTERACTIVE DECISION MATRIX) --- */}
      {currentView === "sandbox" && (
      <section id="playground" className={`py-28 border-b relative transition-all duration-500 ${isDarkMode ? "bg-[#030305] border-slate-900" : "bg-[#f4f5f8] border-slate-200"}`}>
        <div className="container mx-auto px-6 max-w-6xl">
          
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-16">
            <div>
              <span className={`font-mono text-xs tracking-widest uppercase ${isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c]"}`}>02 / SANDBOX SIMULATOR</span>
              <h2 className={`font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tighter mt-2 ${isDarkMode ? "text-slate-100" : "text-slate-950"}`}>
                DECISION MATRIX
              </h2>
            </div>
            <p className={`font-mono text-xs tracking-wider max-w-xl leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-600 font-medium"}`}>
              Welcome to the ServerMiser Sandbox! This is a fun, simulated playground where you can try out decision-making protocols. **It is not linked to any real Discord bot**, so feel free to click around, experiment with different infractions, and see how our mock algorithms optimize server health!
            </p>
          </div>

          {/* Brutalist Layout Simulator Block */}
          <div className={`grid grid-cols-1 lg:grid-cols-12 border-2 relative transition-all duration-300 ${
            isDarkMode ? "border-slate-800 bg-[#050508]" : "border-slate-200 bg-white shadow-lg"
          }`}>
            
            {/* Dilemma Selectors Sidebar */}
            <div className={`lg:col-span-5 border-b lg:border-b-0 lg:border-r p-6 flex flex-col gap-4 transition-colors ${
              isDarkMode ? "border-slate-800" : "border-slate-200"
            }`}>
              <span className={`font-mono text-[9px] tracking-widest uppercase font-bold block mb-2 ${
                isDarkMode ? "text-[#2e7b8f]" : "text-[#1f6475]"
              }`}>
                CHOOSE AN ACTIVE INFRACTION //
              </span>

              {DILEMMAS.map((d, index) => {
                const isActive = selectedDilemmaIdx === index;
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      if (isSimulating) return;
                      setSelectedDilemmaIdx(index);
                      setSimulatedLogs([]);
                      setSimulatedHealth(62);
                      setSimComplete(false);
                      setSimulatedChoice(null);
                    }}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    className={`p-4 text-left border rounded-none transition-all duration-300 relative uppercase cursor-pointer ${
                      isActive
                        ? (isDarkMode ? "border-[#e2f9b8] bg-[#0c0d15] text-white" : "border-[#ff3b5c] bg-red-50 text-slate-950 font-bold")
                        : (isDarkMode 
                            ? "border-slate-800 bg-[#060609] hover:border-slate-600 text-slate-400 hover:text-slate-200" 
                            : "border-slate-200 bg-slate-50/50 hover:border-slate-350 text-slate-600 hover:text-slate-900")
                    }`}
                  >
                    {isActive && (
                      <div className={`absolute top-3 right-3 w-1.5 h-1.5 rounded-full animate-ping ${isDarkMode ? "bg-[#e2f9b8]" : "bg-[#ff3b5c]"}`} />
                    )}
                    <div className="font-mono text-[10px] text-slate-500 mb-1">PROBLEM 0{index + 1}</div>
                    <div className="font-display font-extrabold text-xs sm:text-sm tracking-tight">
                      {d.question}
                    </div>
                  </button>
                );
              })}

              <div className={`mt-8 p-4 border font-mono text-[10px] leading-relaxed uppercase transition-colors ${
                isDarkMode ? "bg-slate-900/40 border-slate-800 text-slate-400" : "bg-slate-100 border-slate-200 text-slate-600"
              }`}>
                <span className="text-slate-500 block mb-1">CONTEXT EVALUATION:</span>
                "{activeDilemma.context}"
              </div>
            </div>

            {/* Simulated Live Action Screen */}
            <div className={`lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between transition-colors ${
              isDarkMode ? "bg-[#040407]" : "bg-white"
            }`}>
              
              {/* Simulator Header */}
              <div className={`flex justify-between items-center border-b pb-4 mb-6 font-mono text-[10px] tracking-widest uppercase transition-colors ${
                isDarkMode ? "border-slate-800 text-slate-500" : "border-slate-200 text-slate-400"
              }`}>
                <span>GUILD_STATE: THE GAMER DEN</span>
                <span className={isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c] font-bold"}>● DEPLOYED ACTIVE</span>
              </div>

              {/* Dynamic Health block meter */}
              <div className={`border p-5 mb-6 transition-colors ${
                isDarkMode ? "bg-[#08080c] border-slate-800" : "bg-slate-50 border-slate-200 shadow-inner"
              }`}>
                <div className="flex justify-between items-center mb-3">
                  <span className={`font-mono text-xs uppercase tracking-widest ${isDarkMode ? "text-slate-400" : "text-slate-600 font-medium"}`}>
                    SERVER OPTIMIZATION HEALTH
                  </span>
                  <span className={`font-mono font-bold text-sm ${simulatedHealth > 80 ? "text-emerald-500" : (isDarkMode ? "text-slate-800" : "text-slate-400")}`}>
                    {simulatedHealth}%
                  </span>
                </div>
                
                {/* Visual Brutalist Health Bar */}
                <div className="flex gap-1 h-3">
                  {Array.from({ length: 20 }).map((_, i) => {
                    const threshold = (i / 20) * 100;
                    const isFilled = simulatedHealth >= threshold;
                    return (
                      <div
                        key={i}
                        className={`flex-1 transition-colors duration-200 ${
                          isFilled
                            ? simulatedHealth > 90
                              ? "bg-[#e2f9b8]"
                              : "bg-[#ff3b5c]"
                            : (isDarkMode ? "bg-slate-900" : "bg-slate-200")
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* simulated terminal output logs */}
              <div className={`border rounded p-4 font-mono text-[10px] sm:text-xs h-44 overflow-y-auto mb-6 flex flex-col gap-1.5 select-text transition-colors ${
                isDarkMode ? "bg-black border-slate-900 text-[#2e7b8f]" : "bg-slate-950 border-slate-850 text-cyan-400"
              }`}>
                {simulatedLogs.length === 0 ? (
                  <div className="text-slate-600 italic uppercase">
                    [TERMINAL_IDLE] select a resolution trigger below to execute...
                  </div>
                ) : (
                  simulatedLogs.map((log, i) => (
                    <div key={i} className="leading-relaxed">
                      {log}
                    </div>
                  ))
                )}
                {isSimulating && (
                  <div className="text-slate-300 animate-pulse uppercase">
                    ● MISER ENGINE RESOLVING...
                  </div>
                )}
              </div>

              {/* Completed action metrics block */}
              {simComplete && simulatedChoice && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 border font-mono text-[10px] sm:text-xs uppercase tracking-wider mb-6 transition-colors ${
                    isDarkMode ? "bg-slate-900/60 border-[#e2f9b8]/30 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-700 shadow-sm"
                  }`}
                >
                  <div className={`font-bold mb-1.5 ${isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c]"}`}>
                    {simulatedChoice === "miser" ? "✓ MISER SWEEP COMPLETE" : "⚠ RETENTION EFFORT LOGGED"}
                  </div>
                  <div>
                    {simulatedChoice === "miser" 
                      ? activeDilemma.miserPath.impactText 
                      : activeDilemma.nudgePath.impactText
                    }
                  </div>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <button
                  disabled={isSimulating}
                  onClick={() => runDecisionSimulation("miser")}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className={`px-5 py-3.5 font-mono text-xs tracking-widest font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer rounded-none ${
                    isSimulating
                      ? "opacity-40 cursor-not-allowed border border-slate-800 text-slate-500"
                      : "bg-[#ff3b5c] text-white border-2 border-black shadow-[3px_3px_0px_#e2f9b8] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
                  }`}
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${isSimulating && simulatedChoice === "miser" ? "animate-spin" : ""}`} />
                  <span>MISER SWEEP</span>
                </button>

                <button
                  disabled={isSimulating}
                  onClick={() => runDecisionSimulation("nudge")}
                  onMouseEnter={() => setIsHovering(true)}
                  onMouseLeave={() => setIsHovering(false)}
                  className={`px-5 py-3.5 font-mono text-xs tracking-widest font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer rounded-none ${
                    isSimulating
                      ? "opacity-40 cursor-not-allowed border border-slate-800 text-slate-500"
                      : (isDarkMode 
                          ? "bg-slate-900 text-slate-200 border border-slate-800 hover:border-[#2e7b8f] hover:text-[#2e7b8f]"
                          : "bg-slate-950 text-white border border-black hover:border-[#ff3b5c] hover:text-[#ff3b5c] shadow-sm")
                  }`}
                >
                  <Sliders className={`w-3.5 h-3.5 ${isSimulating && simulatedChoice === "nudge" ? "animate-spin" : ""}`} />
                  <span>ACTIVE NUDGE</span>
                </button>

              </div>

            </div>

          </div>

        </div>
      </section>
      )}

      {/* --- MISER COMMAND CENTER SECTION (COMMANDS VIEW) --- */}
      {currentView === "commands" && (
      <>
        {/* --- SECTION DIVIDER TICKER (LEFT DIRECTION) --- */}
        <div className="bg-[#2e7b8f] text-white py-2 overflow-hidden whitespace-nowrap border-y border-black font-mono font-bold text-[9px] tracking-widest uppercase select-none">
          <motion.div
            animate={{ x: [0, -1000] }}
            transition={{ ease: "linear", duration: 30, repeat: Infinity }}
            className="flex whitespace-nowrap gap-8"
          >
            <span>● AUDIT COMPLETED SUCCESSFULLY ● RE-BUDGET CHANNELS ● NO RISK DATA SCRAPING ● FULLY SECURE DISCORD TOKEN CRYPTO ● RE-INDEX NODES ●</span>
            <span>● AUDIT COMPLETED SUCCESSFULLY ● RE-BUDGET CHANNELS ● NO RISK DATA SCRAPING ● FULLY SECURE DISCORD TOKEN CRYPTO ● RE-INDEX NODES ●</span>
          </motion.div>
        </div>

        <section id="commands" className={`py-28 border-b relative transition-all duration-500 ${isDarkMode ? "bg-[#040406] border-slate-900" : "bg-[#f4f5f8] border-slate-200"}`}>
        <div className="container mx-auto px-6 max-w-6xl">
          
          {/* Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 mb-16">
            <div>
              <span className="font-mono text-xs tracking-widest uppercase text-[#ff3b5c]">03 / INTERACTIVE REFERENCE</span>
              <h2 className={`font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tighter mt-2 ${isDarkMode ? "text-slate-100" : "text-slate-950"}`}>
                MISER MANUAL
              </h2>
            </div>
            <p className={`font-mono text-xs tracking-wider max-w-xl leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-600 font-medium"}`}>
              Browse through ServerMiser's high-efficiency Discord commands. Select a filter to isolate categories or use search keywords to locate specific scripts.
            </p>
          </div>

          <div className="flex flex-col gap-8">
            
            {/* Control Bar: Categories & Search */}
            <div className={`flex flex-col lg:flex-row items-center justify-between gap-6 p-5 rounded-none border transition-colors ${
              isDarkMode ? "bg-[#07070a] border-slate-850" : "bg-white border-slate-200 shadow-sm"
            }`}>
              
              {/* Category Filter Cards */}
              <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                {[
                  { id: "all", label: "📁 ALL MODULES", count: COMMANDS.length },
                  { id: "moderation", label: "🛡️ MODERATION", count: COMMANDS.filter(cmd => cmd.category === "moderation").length },
                  { id: "setup", label: "⚙️ SERVER SETUP", count: COMMANDS.filter(cmd => cmd.category === "setup").length },
                  { id: "roles", label: "🎭 ROLES SYSTEM", count: COMMANDS.filter(cmd => cmd.category === "roles").length },
                  { id: "automod", label: "🤖 AUTO-MOD", count: COMMANDS.filter(cmd => cmd.category === "automod").length },
                  { id: "verification", label: "🔒 VERIFICATION", count: COMMANDS.filter(cmd => cmd.category === "verification").length },
                  { id: "voice", label: "🔊 TEMP VOICE", count: COMMANDS.filter(cmd => cmd.category === "voice").length },
                  { id: "analytics", label: "📈 ANALYTICS", count: COMMANDS.filter(cmd => cmd.category === "analytics").length },
                  { id: "ticketing", label: "🎫 TICKETING", count: COMMANDS.filter(cmd => cmd.category === "ticketing").length },
                  { id: "leveling", label: "🏆 LEVELING", count: COMMANDS.filter(cmd => cmd.category === "leveling").length },
                  { id: "fun", label: "🎮 FUN MODULE", count: COMMANDS.filter(cmd => cmd.category === "fun").length },
                  { id: "utility", label: "💡 UTILITY & CORE", count: COMMANDS.filter(cmd => cmd.category === "utility").length }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedCategory(tab.id as any)}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    className={`px-4 py-2.5 font-mono text-[10px] tracking-widest uppercase font-bold transition-all cursor-pointer rounded-none border ${
                      selectedCategory === tab.id
                        ? "bg-[#e2f9b8] text-black border-[#e2f9b8]"
                        : (isDarkMode 
                            ? "bg-[#040406] text-slate-400 hover:bg-[#0c0d15] hover:text-slate-200 border-slate-800" 
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border-slate-200 shadow-sm")
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>

              {/* Brutalist Search Box */}
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="SEARCH SPECIFICATIONS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full border rounded-none pl-9 pr-8 py-2.5 text-xs font-mono tracking-widest outline-none transition-colors cursor-text ${
                    isDarkMode 
                      ? "bg-[#040406] border-slate-850 text-slate-100 placeholder:text-slate-600 focus:border-[#ff3b5c]" 
                      : "bg-white border-slate-200 text-slate-950 placeholder:text-slate-400 focus:border-[#ff3b5c] shadow-sm"
                  }`}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-300 font-mono"
                  >
                    ×
                  </button>
                )}
              </div>

            </div>

            {/* Grid of Custom Styled Command Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(() => {
                const filtered = COMMANDS.filter(c => {
                  const matchesCat = selectedCategory === "all" || c.category === selectedCategory;
                  const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        c.description.toLowerCase().includes(searchQuery.toLowerCase());
                  return matchesCat && matchesSearch;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="col-span-full text-center py-24 font-mono text-slate-500 italic text-xs uppercase tracking-widest">
                      [0 SECURE REFERENCES FOUND MATCHING "{searchQuery}"]
                    </div>
                  );
                }

                return filtered.map((cmd) => {
                  return (
                    <div
                      key={cmd.name}
                      className={`p-5 border transition-all duration-300 flex flex-col justify-between ${
                        isDarkMode 
                          ? "border-slate-850 bg-[#07070a] hover:border-[#ff3b5c]/50" 
                          : "border-slate-200 bg-white hover:border-[#ff3b5c]/50 shadow-sm hover:shadow-md"
                      }`}
                    >
                      <div>
                        {/* Header metadata tag */}
                        <div className="flex items-center justify-between gap-2 mb-4 font-mono text-[9px] tracking-widest uppercase">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#ff3b5c] text-xs sm:text-sm">
                              |{cmd.name}
                            </span>
                            
                            <button
                              onClick={() => {
                                setActiveSimulatingCommand(cmd);
                                runCommandSimulation(cmd);
                              }}
                              className="px-2 py-0.5 border border-[#ff3b5c] text-[#ff3b5c] hover:bg-[#ff3b5c] hover:text-white transition-all text-[8px] font-mono tracking-widest font-black uppercase rounded-none cursor-pointer flex items-center gap-1 shrink-0"
                              title={`Try |${cmd.name} command simulation`}
                            >
                              <Terminal className="w-2.5 h-2.5" />
                              <span>TRY</span>
                            </button>

                            {cmd.permission && (
                              <span className="px-1.5 py-0.5 bg-[#ff3b5c]/10 text-[#ff3b5c] border border-[#ff3b5c]/30 text-[7px] font-mono tracking-wider uppercase font-black shrink-0" title={`Requires ${cmd.permission} permission`}>
                                {cmd.permission}
                              </span>
                            )}
                          </div>
                          
                          <span className={`px-2 py-0.5 border text-slate-500 font-mono text-[9px] tracking-widest uppercase transition-colors ${
                            isDarkMode ? "bg-[#040406] border-slate-900" : "bg-slate-50 border-slate-200"
                          }`}>
                            {cmd.category}
                          </span>
                        </div>

                        {/* Usage Block */}
                        <div className="mb-4">
                          <span className="text-[8px] font-mono text-slate-600 block mb-1 uppercase tracking-widest">SYNTAX TRIGGER:</span>
                          <div className="relative flex items-center">
                            <code className={`block w-full font-mono text-[11px] text-[#e2f9b8] pr-10 pl-3 py-2 border select-all leading-none transition-colors ${
                              isDarkMode ? "bg-black border-slate-900" : "bg-slate-900 border-slate-800 text-[#e2f9b8]"
                            }`}>
                              {cmd.usage}
                            </code>
                            <button
                              onClick={() => handleCopyCommand(cmd.usage, cmd.name)}
                              className="absolute right-2 p-1 text-slate-500 hover:text-[#e2f9b8] transition-colors cursor-pointer"
                              title="Copy command syntax"
                            >
                              {copiedCommandName === cmd.name ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Description */}
                        <p className={`text-xs sm:text-sm font-sans leading-relaxed mb-4 transition-colors ${
                          isDarkMode ? "text-slate-400" : "text-slate-600 font-medium"
                        }`}>
                          {cmd.description}
                        </p>

                        {/* Setup template visual hierarchy expandable preview */}
                        {cmd.name === "setup" && (
                          <div className={`mt-3 mb-5 border transition-all duration-300 ${
                            isDarkMode ? "border-slate-800 bg-slate-950/40" : "border-slate-200 bg-slate-50/50"
                          }`}>
                            <button
                              onClick={() => setPreviewTemplateExpanded(!previewTemplateExpanded)}
                              className="w-full flex items-center justify-between px-3 py-2 text-left font-mono text-[9px] tracking-widest font-extrabold uppercase border-b border-slate-800/60 transition-colors cursor-pointer select-none"
                            >
                              <span className="flex items-center gap-1.5">
                                <FolderOpen className="w-3.5 h-3.5 text-[#ff3b5c]" />
                                <span>HIERARCHY PREVIEWS {previewTemplateExpanded ? "(OPEN)" : "(CLOSED)"}</span>
                              </span>
                              {previewTemplateExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                            
                            <AnimatePresence>
                              {previewTemplateExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="p-3">
                                    {/* Template Selector tabs */}
                                    <div className="flex flex-wrap gap-1 mb-3 border-b border-slate-850 pb-2">
                                      {SETUP_TEMPLATES.map((tpl) => (
                                        <button
                                          key={tpl.id}
                                          onClick={() => setSelectedPreviewTemplate(tpl.id)}
                                          className={`px-2 py-1 font-mono text-[8px] tracking-wider uppercase font-bold transition-all border rounded-none cursor-pointer ${
                                            selectedPreviewTemplate === tpl.id
                                              ? "bg-[#ff3b5c] text-white border-[#ff3b5c]"
                                              : (isDarkMode 
                                                  ? "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200" 
                                                  : "bg-white text-slate-600 border-slate-200 hover:text-slate-950")
                                          }`}
                                        >
                                          {tpl.emoji} {tpl.name.split(" ")[0]}
                                        </button>
                                      ))}
                                    </div>

                                    {/* Template details */}
                                    {(() => {
                                      const activeTpl = SETUP_TEMPLATES.find(t => t.id === selectedPreviewTemplate) || SETUP_TEMPLATES[0];
                                      return (
                                        <div className="flex flex-col gap-2.5 font-mono text-[9px]">
                                          <p className="text-[9px] italic text-slate-500 lowercase leading-relaxed">
                                            * {activeTpl.description}
                                          </p>
                                          
                                          {/* Roles */}
                                          <div>
                                            <span className="text-[7px] text-slate-500 uppercase tracking-widest block mb-1">Generated Roles:</span>
                                            <div className="flex flex-wrap gap-1">
                                              {activeTpl.roles.map((r, ri) => (
                                                <span key={ri} className="px-1 py-0.5 bg-black border border-slate-900 text-[#e2f9b8] text-[8px] font-bold">
                                                  {r}
                                                </span>
                                              ))}
                                            </div>
                                          </div>

                                          {/* Channel Tree Layout */}
                                          <div>
                                            <span className="text-[7px] text-slate-500 uppercase tracking-widest block mb-1">Deploying Hierarchy:</span>
                                            <div className={`p-2 border rounded-none flex flex-col gap-2 max-h-40 overflow-y-auto ${
                                              isDarkMode ? "bg-black border-slate-900" : "bg-white border-slate-200"
                                            }`}>
                                              {activeTpl.categories.map((cat, ci) => (
                                                <div key={ci} className="flex flex-col gap-0.5">
                                                  <div className="flex items-center gap-1 text-[#ff3b5c] font-black text-[8px] uppercase tracking-wide">
                                                    <FolderOpen className="w-2.5 h-2.5 shrink-0" />
                                                    <span>{cat.name}</span>
                                                  </div>
                                                  
                                                  <div className="pl-2 border-l border-slate-800/80 ml-1 flex flex-col gap-0.5">
                                                    {cat.channels.map((chan, chI) => (
                                                      <div key={chI} className="flex items-center justify-between gap-2 text-slate-400 py-0.5">
                                                        <span className="flex items-center gap-1 font-mono text-[8px]">
                                                          <span className="text-slate-600">├─</span>
                                                          <span className="text-slate-500 font-bold">{chan.type === "text" ? "#" : "🔊"}</span>
                                                          <span className={isDarkMode ? "text-slate-300" : "text-slate-800"}>{chan.name}</span>
                                                        </span>
                                                        
                                                        {chan.roles && (
                                                          <span className="text-[6px] bg-[#ff3b5c]/10 text-[#ff3b5c] px-1 border border-[#ff3b5c]/20 rounded-none font-bold">
                                                            STAFF_ONLY
                                                          </span>
                                                        )}
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>

                      {/* Mock Discord UI chat representation */}
                      <div className="bg-black border border-slate-900 p-3 mt-auto font-sans text-[11px]">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="font-bold text-[#248046]">ServerMiser</span>
                          <span className="bg-[#5865F2] text-white text-[8px] font-mono font-bold px-1 rounded leading-none tracking-wide">
                            BOT
                          </span>
                        </div>
                        <div className="font-mono text-slate-200 whitespace-pre-wrap leading-normal bg-slate-950/50 p-2 border border-slate-900">
                          {cmd.exampleOutput}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

          </div>

        </div>
      </section>
      </>
      )}

      {/* --- CATCHY BRAND MANIFESTO SPOTLIGHT --- */}
      {currentView === "home" && (
        <section className={`py-28 border-b relative transition-all duration-500 ${
          isDarkMode ? "bg-[#050508] border-slate-900" : "bg-white border-slate-200"
        }`}>
          <div className="container mx-auto px-6 max-w-7xl">
            
            <div className="flex flex-col items-center text-center max-w-4xl mx-auto mb-20 gap-4">
              <span className={`font-mono text-xs tracking-widest uppercase ${isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c]"}`}>
                ★ THE POWERHOUSE MANIFESTO ★
              </span>
              <h2 className={`font-display font-black text-4xl sm:text-5xl md:text-6xl uppercase tracking-tighter transition-colors ${
                isDarkMode ? "text-slate-100" : "text-slate-950"
              }`}>
                ONE PREFIX. ABSOLUTE DOMINANCE. <br />
                <span className="text-[#ff3b5c]">ZERO COMPLEXITY.</span>
              </h2>
              <p className={`font-mono text-xs sm:text-sm tracking-wider uppercase mt-4 leading-relaxed max-w-2xl ${
                isDarkMode ? "text-slate-400" : "text-slate-600"
              }`}>
                Running 5 different bots for levels, tickets, roles, and moderation is a security disaster and client drag. ServerMiser compresses your entire administrative stack into a single, high-speed, military-grade engine.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Catchy phrase card 1 */}
              <div className={`p-8 border-2 transition-all duration-300 flex flex-col justify-between ${
                isDarkMode 
                  ? "border-slate-850 bg-[#07070a] hover:border-[#ff3b5c]/50" 
                  : "border-black bg-white shadow-[4px_4px_0px_#ff3b5c] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
              }`}>
                <div>
                  <span className="font-mono text-xs text-slate-500 block mb-2">01 / SETUP ENGINE</span>
                  <h3 className={`font-display font-black text-xl uppercase tracking-tight mb-4 ${
                    isDarkMode ? "text-slate-200" : "text-slate-950"
                  }`}>
                    INSTANT SETUP <br />CORES
                  </h3>
                  <p className={`font-mono text-[10px] uppercase leading-relaxed tracking-wider ${
                    isDarkMode ? "text-slate-400" : "text-slate-600 font-medium"
                  }`}>
                    Forget slow manual server creation. ServerMiser deploys beautiful structured channel categories, text lobbies, voice lounges, and starter server roles in a single five-second execution.
                  </p>
                </div>
                <div className="mt-8 font-mono text-[9px] text-[#ff3b5c] tracking-widest font-bold">
                  ⚡ INSTANT DEPLOYMENT ACTIVE
                </div>
              </div>

              {/* Catchy phrase card 2 */}
              <div className={`p-8 border-2 transition-all duration-300 flex flex-col justify-between ${
                isDarkMode 
                  ? "border-slate-850 bg-[#07070a] hover:border-[#ff3b5c]/50" 
                  : "border-black bg-white shadow-[4px_4px_0px_#ff3b5c] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
              }`}>
                <div>
                  <span className="font-mono text-xs text-slate-500 block mb-2">02 / INTERACTION</span>
                  <h3 className={`font-display font-black text-xl uppercase tracking-tight mb-4 ${
                    isDarkMode ? "text-slate-200" : "text-slate-950"
                  }`}>
                    AUTOMATIC <br />CHAT LEVELS
                  </h3>
                  <p className={`font-mono text-[10px] uppercase leading-relaxed tracking-wider ${
                    isDarkMode ? "text-slate-400" : "text-slate-600 font-medium"
                  }`}>
                    Reward your most dedicated talkers. ServerMiser tracks user message frequencies, updates current rank placements, displays customizable cards, and increments local server milestone metrics.
                  </p>
                </div>
                <div className="mt-8 font-mono text-[9px] text-[#ff3b5c] tracking-widest font-bold">
                  🏆 RETENTION ENGINE ENGAGED
                </div>
              </div>

              {/* Catchy phrase card 3 */}
              <div className={`p-8 border-2 transition-all duration-300 flex flex-col justify-between ${
                isDarkMode 
                  ? "border-slate-850 bg-[#07070a] hover:border-[#2e7b8f]/50" 
                  : "border-black bg-white shadow-[4px_4px_0px_#2e7b8f] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
              }`}>
                <div>
                  <span className="font-mono text-xs text-slate-500 block mb-2">03 / MODULARITY</span>
                  <h3 className={`font-display font-black text-xl uppercase tracking-tight mb-4 ${
                    isDarkMode ? "text-slate-200" : "text-slate-950"
                  }`}>
                    SECURE <br />TICKET SPACES
                  </h3>
                  <p className={`font-mono text-[10px] uppercase leading-relaxed tracking-wider ${
                    isDarkMode ? "text-slate-400" : "text-slate-600 font-medium"
                  }`}>
                    Keep support channels clean. Members can open dedicated support ticket threads instantly to communicate directly with moderators, archiving safe, secure transcripts automatically upon resolution.
                  </p>
                </div>
                <div className="mt-8 font-mono text-[9px] text-[#2e7b8f] tracking-widest font-bold">
                  🛡️ ISOLATED COMPRESSION ACTIVE
                </div>
              </div>

            </div>

            {/* Epic Slogan Banner */}
            <div className={`mt-16 p-8 border-2 text-center relative overflow-hidden transition-all duration-300 ${
              isDarkMode 
                ? "border-slate-800 bg-[#0c0c12]" 
                : "border-black bg-white shadow-[6px_6px_0px_#ff3b5c]"
            }`}>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,59,92,0.06)_0%,transparent_60%)] pointer-events-none" />
              <h3 className={`font-display font-black text-xl sm:text-2xl md:text-3xl uppercase tracking-tighter ${
                isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c]"
              }`}>
                "THE ONLY DISCORD BOT DESIGNED TO OUTPERFORM EVERYTHING IN ITS PATH."
              </h3>
              <p className={`font-mono text-[10px] uppercase tracking-widest mt-2 ${
                isDarkMode ? "text-slate-400" : "text-slate-500"
              }`}>
                ESTABLISHED IN 2026 // SERVING METRIC STACKS WORLDWIDE
              </p>
            </div>

          </div>
        </section>
      )}

      {/* --- SETUP GUIDE (3-STEP PIPELINE) --- */}
      {currentView === "home" && (
      <>
      <section className={`py-28 relative border-b transition-all duration-500 ${isDarkMode ? "bg-[#030305] border-slate-900" : "bg-[#f4f5f8] border-slate-200"}`}>
        <div className="container mx-auto px-6 max-w-5xl">
          
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span className="font-mono text-xs tracking-widest uppercase text-[#e2f9b8]">04 / SECURE DEPLOYMENT</span>
            <h2 className={`font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tighter mt-2 transition-colors duration-500 ${isDarkMode ? "text-slate-100" : "text-slate-950"}`}>
              HOW TO INITIALIZE
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            
            {/* Visual connector lines behind steps */}
            <div className={`hidden md:block absolute top-[44px] left-[10%] right-[10%] h-0.5 bg-dashed border-b border-dashed z-0 ${isDarkMode ? "border-slate-800" : "border-slate-300"}`} />

            {/* Step 1 */}
            <div className={`p-6 border relative z-10 flex flex-col justify-between h-72 transition-all duration-300 ${
              isDarkMode ? "border-slate-800 bg-[#060609]" : "border-slate-200 bg-white shadow-sm hover:shadow-md"
            }`}>
              <div>
                <div className="w-10 h-10 bg-[#e2f9b8] text-black font-mono font-bold text-xs flex items-center justify-center border border-black mb-6">
                  01
                </div>
                <h3 className={`font-display font-extrabold text-sm uppercase tracking-widest mb-2 transition-colors ${isDarkMode ? "text-slate-200" : "text-slate-900"}`}>
                  AUTHORIZE SECURELY
                </h3>
                <p className="font-mono text-[10px] text-slate-500 uppercase leading-relaxed tracking-wider">
                  Invite the bot using the authorization client. Grant default permissions scopes to audit indices.
                </p>
              </div>
              <button
                onClick={triggerAuthFlow}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => setIsHovering(false)}
                className={`font-mono text-[9px] font-bold tracking-widest flex items-center gap-1 hover:underline mt-4 cursor-pointer transition-colors ${
                  isDarkMode ? "text-[#e2f9b8]" : "text-[#ff3b5c]"
                }`}
              >
                <span>INVITE BOT NOW</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>

            {/* Step 2 */}
            <div className={`p-6 border relative z-10 flex flex-col justify-between h-72 transition-all duration-300 ${
              isDarkMode ? "border-slate-800 bg-[#060609]" : "border-slate-200 bg-white shadow-sm hover:shadow-md"
            }`}>
              <div>
                <div className="w-10 h-10 bg-[#ff3b5c] text-white font-mono font-bold text-xs flex items-center justify-center border border-black mb-6">
                  02
                </div>
                <h3 className={`font-display font-extrabold text-sm uppercase tracking-widest mb-2 transition-colors ${isDarkMode ? "text-slate-200" : "text-slate-900"}`}>
                  RUN SETUP WIZARD
                </h3>
                <p className="font-mono text-[10px] text-slate-500 uppercase leading-relaxed tracking-wider">
                  Type |setup &lt;template&gt; in any text channel. The bot configures categories and rolls out ticketing desks.
                </p>
              </div>
              <div className={`font-mono text-[9px] uppercase px-2 py-1.5 border mt-4 select-all transition-colors ${
                isDarkMode ? "text-[#ff3b5c] bg-black border-slate-900" : "text-[#ff3b5c] bg-slate-100 border-slate-200"
              }`}>
                $ |setup &lt;template&gt;
              </div>
            </div>

            {/* Step 3 */}
            <div className={`p-6 border relative z-10 flex flex-col justify-between h-72 transition-all duration-300 ${
              isDarkMode ? "border-[#2e7b8f]" : "border-slate-200 bg-white shadow-sm hover:shadow-md"
            }`}>
              <div>
                <div className="w-10 h-10 bg-[#2e7b8f] text-white font-mono font-bold text-xs flex items-center justify-center border border-black mb-6">
                  03
                </div>
                <h3 className={`font-display font-extrabold text-sm uppercase tracking-widest mb-2 transition-colors ${isDarkMode ? "text-slate-200" : "text-slate-900"}`}>
                  MONITOR METRICS
                </h3>
                <p className="font-mono text-[10px] text-slate-500 uppercase leading-relaxed tracking-wider">
                  Sit back. Watch ServerMiser automatically compress empty rooms, lock secure folders, and maintain high engagement values.
                </p>
              </div>
              <div className="font-mono text-[9px] text-emerald-400 uppercase flex items-center gap-1.5 mt-4">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                <span>STATE: OPTIMIZING</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* --- FAQ ACCORDION SECTION --- */}
      <section id="faq" className={`py-28 relative border-b transition-all duration-500 ${isDarkMode ? "bg-[#040406] border-slate-900" : "bg-white border-slate-200"}`}>
        <div className="container mx-auto px-6 max-w-4xl relative z-10">
          
          <div className="text-center max-w-2xl mx-auto mb-20">
            <span className="font-mono text-xs tracking-widest uppercase text-[#ff3b5c]">05 / SECURITY CONTEXT</span>
            <h2 className={`font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tighter mt-2 transition-colors duration-500 ${isDarkMode ? "text-slate-100" : "text-slate-950"}`}>
              FREQUENTLY ASKED
            </h2>
          </div>

          {/* Collapsible Accordion Lists */}
          <div className="flex flex-col gap-4">
            {FAQS.map((faq, idx) => {
              const isOpen = activeFaqIdx === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-none border transition-all duration-300 ${
                    isDarkMode ? "bg-[#07070a] border-slate-850" : "bg-slate-50 border-slate-200 shadow-sm"
                  }`}
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    className={`w-full p-6 text-left flex items-center justify-between gap-4 font-mono font-bold text-xs sm:text-sm tracking-wider uppercase cursor-pointer transition-colors duration-300 ${
                      isDarkMode ? "text-slate-200 hover:text-white" : "text-slate-800 hover:text-slate-950"
                    }`}
                  >
                    <span>{faq.question}</span>
                    <div className={`p-1 border transition-colors ${
                      isDarkMode ? "border-slate-850 bg-black text-slate-400" : "border-slate-200 bg-white text-slate-500"
                    }`}>
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                      >
                        <div className={`p-6 pt-0 font-sans text-xs sm:text-sm leading-relaxed border-t transition-colors duration-300 ${
                          isDarkMode ? "text-slate-400 border-slate-900" : "text-slate-650 font-medium border-slate-200"
                        }`}>
                          {faq.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

        </div>
      </section>
      </>
      )}

      {/* --- REDESIGNED FOOTER (GIANT INVITE CTA) --- */}
      <footer className={`py-28 relative overflow-hidden transition-all duration-500 border-t ${isDarkMode ? "bg-[#030305] border-slate-900" : "bg-[#f4f5f8] border-slate-200"}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,rgba(226,249,184,0.06)_0%,transparent_60%)] pointer-events-none" />

        <div className="container mx-auto px-6 max-w-4xl relative z-10 text-center flex flex-col items-center gap-8">
          
          {/* Big logo with glow */}
          <Logo size={120} glow={isDarkMode} className="animate-pulse" />

          {/* Large display Call to Action */}
          <div className="flex flex-col gap-4">
            <h2 className={`font-display font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tighter transition-colors ${isDarkMode ? "text-slate-100" : "text-slate-900"}`}>
              OPTIMIZE YOUR ARCHITECTURE TODAY
            </h2>
            <p className={`font-mono text-[10px] sm:text-xs uppercase tracking-widest leading-relaxed max-w-xl mx-auto transition-colors ${isDarkMode ? "text-slate-500" : "text-slate-600"}`}>
              Add ServerMiser to your Discord server in seconds. Compress background bloat, restore channel metrics, and maintain permissions integrity.
            </p>
          </div>

          {/* Massive Action Button */}
          <button
            onClick={triggerAuthFlow}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            className="px-10 py-5 bg-[#e2f9b8] text-black font-mono font-bold text-xs tracking-widest uppercase border-2 border-black shadow-[4px_4px_0px_#ff3b5c] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all cursor-pointer flex items-center gap-3"
          >
            {/* Discord pure SVG white vector */}
            <svg viewBox="0 0 127.14 96.36" className="w-5 h-5 fill-current">
              <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.88-.65,1.72-1.34,2.51-2a75.58,75.58,0,0,0,73,0c.79.71,1.63,1.4,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31-18.83C129.87,49.52,123.6,26.69,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.9,46,53.72,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.14,46,96,53,91,65.69,84.69,65.69Z" />
            </svg>
            <span>AUTHORIZE SERVERMISER</span>
          </button>

          {/* Footnotes block */}
          <div className={`flex flex-col md:flex-row items-center justify-between w-full border-t pt-10 mt-16 font-mono text-[9px] gap-6 transition-colors duration-500 ${isDarkMode ? "border-slate-900 text-slate-600" : "border-slate-200 text-slate-500"}`}>
            <div className="flex items-center gap-2">
              <Logo size={24} glow={false} />
              <span>© {new Date().getFullYear()} SERVERMISER BOT. SYSTEM OPERATING VERIFIED.</span>
            </div>
            <div className="flex items-center gap-6">
              <button
                onClick={() => {
                  setCurrentView("support");
                  setSupportTab("privacy");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="hover:text-slate-400 transition-colors cursor-pointer"
              >
                PRIVACY CODE
              </button>
              <button
                onClick={() => {
                  setCurrentView("support");
                  setSupportTab("terms");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="hover:text-slate-400 transition-colors cursor-pointer"
              >
                TERMS ENGINE
              </button>
              <a
                href="https://discord.gg/H36QXKB6R6"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-400 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>SUPPORT SERVER</span>
                <ExternalLink className="w-2.5 h-2.5 text-slate-700" />
              </a>
            </div>
          </div>

        </div>
      </footer>

      {/* --- DISCORD AUTHORIZATION WINDOW (MOCK) --- */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Backdrop filter */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAuthModalOpen(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />

            {/* Modal Body (Discord Native Aesthetic!) */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="relative w-full max-w-md bg-[#313338] rounded-md shadow-2xl overflow-hidden border border-[#1e1f22]"
            >
              
              {/* Modal close button */}
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-[#3b3e45] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header Discord Identity banner */}
              <div className="bg-[#1e1f22] p-6 text-center flex flex-col items-center relative gap-2">
                <div className="absolute top-0 inset-x-0 h-1 bg-[#5865F2]" />
                
                {/* Visual Connector: User avatar (mock) and Bot Avatar side by side */}
                <div className="flex items-center gap-4 mt-2">
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm ring-2 ring-[#313338] shadow-md relative overflow-hidden">
                    <Users className="w-5 h-5 text-slate-300" />
                    <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#1e1f22]" />
                  </div>
                  
                  <div className="text-[#5865F2] font-mono text-sm tracking-widest animate-pulse font-bold">
                    ⟷
                  </div>

                  <div className="w-12 h-12 rounded-full bg-[#040406] ring-2 ring-[#313338] shadow-md flex items-center justify-center overflow-hidden">
                    <Logo size={40} glow={false} />
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-100 font-sans tracking-tight mt-2">
                  An application is requesting authorization
                </h3>
                <p className="text-xs text-[#b5bac1] font-sans">
                  Connect your account with <span className="font-semibold text-slate-200">ServerMiser</span>
                </p>
              </div>

              {/* Form Content */}
              <div className="p-6">
                {authStep === "form" && (
                  <form onSubmit={handleAuthorize} className="flex flex-col gap-4">
                    
                    {/* Bot scopes request block */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-mono font-bold tracking-wider text-[#949ba4] uppercase">
                        This bot will be authorized to:
                      </span>
                      
                      <div className="bg-[#2b2d31] rounded-md p-3 border border-[#1e1f22]/50 flex flex-col gap-2.5">
                        <div className="flex items-start gap-2.5 text-xs text-[#dbdee1]">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-200">Manage Server Channels</span>
                            <p className="text-[10px] text-[#949ba4] mt-0.5">Allows archiving and reorganizing silent rooms.</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 text-xs text-[#dbdee1]">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-200">Manage Server Roles</span>
                            <p className="text-[10px] text-[#949ba4] mt-0.5">Allows sweeping empty staff tags and auditing permissions.</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-2.5 text-xs text-[#dbdee1]">
                          <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-slate-200">View Server Insights</span>
                            <p className="text-[10px] text-[#949ba4] mt-0.5">Allows computing daily re-engagement health metrics.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Server selector */}
                    <div className="flex flex-col gap-1.5 mt-2">
                      <label htmlFor="server-select" className="text-[10px] font-mono font-bold tracking-wider text-[#949ba4] uppercase">
                        Add to Server:
                      </label>
                      <select
                        id="server-select"
                        required
                        value={selectedServer}
                        onChange={(e) => setSelectedServer(e.target.value)}
                        className="w-full bg-[#1e1f22] border border-[#111214] rounded px-3.5 py-2.5 text-sm text-[#dbdee1] focus:outline-none focus:ring-1 focus:ring-[#5865F2] cursor-pointer"
                      >
                        <option value="" disabled>-- Choose a Server --</option>
                        <option value="gamer_den">🎮 The Gamer Den (842 Members)</option>
                        <option value="dev_hq">💻 Dev Headquarters (45 Members)</option>
                        <option value="meme_empire">🎭 Meme Empire (1,245 Members)</option>
                        <option value="guild_chat">🛡️ Guild Chat (180 Members)</option>
                      </select>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-[#3b3e45]/40">
                      <button
                        type="button"
                        onClick={() => setIsAuthModalOpen(false)}
                        className="px-5 py-2 rounded text-sm text-[#dbdee1] hover:underline cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={!selectedServer}
                        className={`px-6 py-2.5 rounded text-sm font-semibold tracking-wide text-white transition-all cursor-pointer ${
                          selectedServer
                            ? "bg-[#5865F2] hover:bg-[#4752C4] shadow"
                            : "bg-[#5865F2]/40 text-white/50 cursor-not-allowed"
                        }`}
                      >
                        Authorize Bot
                      </button>
                    </div>

                  </form>
                )}

                {/* Loading State */}
                {authStep === "loading" && (
                  <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="w-12 h-12 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin" />
                    <div className="flex flex-col gap-1">
                      <h4 className="font-bold text-slate-100 text-sm">SECURELY PARSING SCOPES</h4>
                      <p className="text-xs text-[#949ba4]">ServerMiser is checking permissions hierarchy...</p>
                    </div>
                  </div>
                )}

                {/* Success State */}
                {authStep === "success" && (
                  <div className="py-8 flex flex-col items-center justify-center gap-5 text-center">
                    
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-400 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/5">
                      <Check className="w-8 h-8" />
                    </div>

                    <div className="flex flex-col gap-2">
                      <h4 className="font-bold text-slate-100 text-lg">ServerMiser Authorized! 🎉</h4>
                      <p className="text-xs text-[#dbdee1] max-w-sm leading-relaxed">
                        The bot was successfully added to your selected guild. Head over to Discord and run your first audit!
                      </p>
                    </div>

                    <div className="mt-4 py-3.5 px-4 bg-[#2b2d31] rounded-md border border-[#1e1f22] text-xs font-mono text-slate-300 flex items-center gap-2 max-w-xs justify-center shadow-inner">
                      <span className="text-[#e2f9b8] font-bold">Tip:</span>
                      <span>Type `/audit` to begin.</span>
                    </div>

                    <button
                      onClick={() => setIsAuthModalOpen(false)}
                      className="mt-6 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold uppercase tracking-wider rounded text-slate-300 transition-colors cursor-pointer"
                    >
                      Close Window
                    </button>
                  </div>
                )}
              </div>

            </motion.div>

          </div>
        )}
      </AnimatePresence>

      {/* --- COMMAND SIMULATION SANDBOX MODAL --- */}
      <AnimatePresence>
        {activeSimulatingCommand && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (simState === "running") return;
                setActiveSimulatingCommand(null);
              }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />

            {/* Modal Dialog container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className={`w-full max-w-2xl border-2 relative overflow-hidden flex flex-col z-10 shadow-2xl ${
                isDarkMode ? "bg-[#09090d] border-[#ff3b5c]" : "bg-white border-black"
              }`}
            >
              {/* Terminal Header Bar */}
              <div className={`flex items-center justify-between px-4 py-3 border-b font-mono text-[10px] tracking-widest uppercase font-bold ${
                isDarkMode ? "bg-slate-900/60 border-slate-850 text-slate-300" : "bg-slate-100 border-black text-black"
              }`}>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  </div>
                  <span className="ml-2">COMMAND SANDBOX // |{activeSimulatingCommand.name}</span>
                </div>
                
                <button
                  onClick={() => {
                    if (simState === "running") return;
                    setActiveSimulatingCommand(null);
                  }}
                  className="text-slate-500 hover:text-[#ff3b5c] transition-colors cursor-pointer"
                  disabled={simState === "running"}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Main Body */}
              <div className="p-5 sm:p-6 flex flex-col gap-5 overflow-y-auto max-h-[80vh]">
                
                {/* Brief info */}
                <div className="font-mono text-[10px] tracking-wider leading-relaxed">
                  <span className="text-slate-500 uppercase block mb-1">COMMAND PURPOSE:</span>
                  <span className={isDarkMode ? "text-slate-300" : "text-slate-700 font-semibold"}>
                    {activeSimulatingCommand.description}
                  </span>
                </div>

                {/* Interactive Arguments Input */}
                <div className="flex flex-col gap-2">
                  <label className="font-mono text-[9px] tracking-widest uppercase text-slate-500 font-bold">
                    SIMULATED INPUT ARGUMENTS (EDIT TO TEST):
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-[#ff3b5c] select-none">|</span>
                    <input
                      type="text"
                      value={simInputArguments}
                      onChange={(e) => {
                        if (simState === "running") return;
                        setSimInputArguments(e.target.value);
                      }}
                      disabled={simState === "running"}
                      className={`flex-1 border rounded-none px-3.5 py-2.5 text-xs font-mono tracking-widest outline-none transition-colors cursor-text ${
                        isDarkMode 
                          ? "bg-black border-slate-800 text-[#e2f9b8] focus:border-[#ff3b5c]" 
                          : "bg-slate-50 border-slate-300 text-slate-900 focus:border-[#ff3b5c] shadow-inner"
                      }`}
                    />
                    
                    <button
                      disabled={simState === "running"}
                      onClick={() => runCommandSimulation(activeSimulatingCommand, simInputArguments)}
                      className={`px-5 py-2.5 font-mono text-[10px] tracking-widest font-bold uppercase transition-all rounded-none cursor-pointer flex items-center gap-1.5 shrink-0 ${
                        simState === "running"
                          ? "opacity-50 cursor-not-allowed border border-slate-800 text-slate-500"
                          : "bg-[#ff3b5c] text-white hover:bg-red-600 border border-[#ff3b5c] shadow-md"
                      }`}
                    >
                      {simState === "running" ? (
                        <>
                          <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                          <span>TESTING...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>RUN TEST</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Simulated Terminal Live Outputs */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] tracking-widest uppercase text-slate-500 font-bold">
                      SIMULATION OUTPUT LOGS:
                    </span>
                    <span className="font-mono text-[8px] tracking-widest uppercase text-slate-600">
                      PROG: {simProgress}%
                    </span>
                  </div>

                  <div className={`border rounded-none p-4 font-mono text-[11px] h-48 overflow-y-auto flex flex-col gap-1.5 select-text transition-all ${
                    isDarkMode ? "bg-black border-slate-900 text-cyan-400" : "bg-slate-950 border-slate-850 text-cyan-400"
                  }`}>
                    {simLogs.length === 0 ? (
                      <div className="text-slate-600 italic uppercase">
                        [SIM_IDLE] Edit input arguments above and click "RUN TEST" to simulate gateway triggers...
                      </div>
                    ) : (
                      simLogs.map((log, i) => (
                        <div key={i} className="leading-relaxed animate-fade-in">
                          {log}
                        </div>
                      ))
                    )}
                    {simState === "running" && (
                      <div className="text-[#ff3b5c] animate-pulse uppercase text-[10px]">
                        ● SECURING TELEMETRY PIPELINES...
                      </div>
                    )}
                  </div>
                </div>

                {/* Simulated Discord Message Output (only when success) */}
                {simState === "success" && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2"
                  >
                    <span className="font-mono text-[9px] tracking-widest uppercase text-slate-500 font-bold">
                      MOCK DISCORD CHANNEL RESPONSE:
                    </span>
                    
                    <div className="bg-[#313338] border border-black/30 p-4 font-sans text-xs flex flex-col gap-2 rounded shadow-md text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#248046] text-sm hover:underline cursor-pointer">ServerMiser</span>
                        <span className="bg-[#5865F2] text-white text-[8px] font-mono font-bold px-1 rounded-sm leading-none tracking-wider select-none">
                          BOT
                        </span>
                        <span className="text-[10px] text-[#949ba4] font-mono">Today at {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                      
                      {/* Simulated Embed output or rich code output */}
                      <div className="pl-4 border-l-4 border-[#ff3b5c] bg-[#2b2d31] p-3 rounded-r-md border border-[#1e1f22]/40">
                        <div className="font-bold text-slate-100 uppercase tracking-tight text-xs mb-1.5 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#ff3b5c]" />
                          <span>SYSTEM EXECUTION RECORD</span>
                        </div>
                        
                        <pre className="font-mono text-[11px] text-[#e2f9b8] whitespace-pre-wrap leading-relaxed select-text bg-[#1e1f22] p-2.5 border border-black/30 rounded-sm">
                          {(() => {
                            const finalInputArgs = simInputArguments || activeSimulatingCommand.usage;
                            let outputText = activeSimulatingCommand.exampleOutput;
                            
                            if (activeSimulatingCommand.name === "ban") {
                              outputText = `✓ Banned member ${finalInputArgs.split(" ")[1] || "@spammer69"} (Reason: ${finalInputArgs.split(" ").slice(2).join(" ") || "No reason specified"})`;
                            } else if (activeSimulatingCommand.name === "kick") {
                              outputText = `✓ Kicked member ${finalInputArgs.split(" ")[1] || "@impatient_user"} (Reason: Moderation Sweep)`;
                            } else if (activeSimulatingCommand.name === "mute") {
                              const words = finalInputArgs.split(" ");
                              outputText = `✓ Timed out ${words[1] || "@noisy_speaker"} for ${words[2] || "10m"}`;
                            } else if (activeSimulatingCommand.name === "unmute") {
                              outputText = `✓ Removed active timeout from ${finalInputArgs.split(" ")[1] || "@noisy_speaker"}`;
                            } else if (activeSimulatingCommand.name === "warn") {
                              const words = finalInputArgs.split(" ");
                              outputText = `⚠ Official warning registered for ${words[1] || "@rebel-user"} (Reason: ${words.slice(2).join(" ") || "General Rule infraction"})`;
                            } else if (activeSimulatingCommand.name === "warnings") {
                              outputText = `Warnings profile for ${finalInputArgs.split(" ")[1] || "@rebel-user"}:\n- 1st Warn: CAPS Spam (Logged by @staff)\n- Total Warnings: 1`;
                            } else if (activeSimulatingCommand.name === "setup") {
                              outputText = `✓ Setup complete! Deployed: 📁 Welcome, 📁 Chats, 📁 Staff categories, 7 channels, and Admin/Mod/Member roles. [Template: ${finalInputArgs.split(" ")[1] || "community"}]`;
                            } else if (activeSimulatingCommand.name === "cute") {
                              outputText = `✨ Cute Mode Configured! Setup layouts will now build using style: ${finalInputArgs.split(" ")[1] || "small-caps"}`;
                            } else if (activeSimulatingCommand.name === "welcome") {
                              outputText = `✓ Welcome system enabled in ${finalInputArgs.split(" ")[1] || "#welcome"} with custom joins & leaves.`;
                            }
                            
                            return outputText;
                          })()}
                        </pre>
                        
                        <div className="flex items-center gap-1.5 mt-2 font-mono text-[8px] text-slate-500 uppercase tracking-widest">
                          <span>ENGINE CLUSTER: SHARD_01</span>
                          <span>•</span>
                          <span className="text-[#e2f9b8]">STATUS: GREEN</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

              </div>

              {/* Modal Action Footer */}
              <div className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${
                isDarkMode ? "bg-slate-900/40 border-slate-850" : "bg-slate-50 border-black"
              }`}>
                <button
                  onClick={() => {
                    if (simState === "running") return;
                    setActiveSimulatingCommand(null);
                  }}
                  disabled={simState === "running"}
                  className="px-4.5 py-2 font-mono text-[10px] tracking-widest font-bold uppercase border border-slate-500 hover:border-[#ff3b5c] transition-colors rounded-none text-slate-400 hover:text-white cursor-pointer"
                >
                  Close Sandbox
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
