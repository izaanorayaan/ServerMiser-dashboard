const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  Events,
} = require('discord.js');

// ============================================================================
// PREMIUM INFO & SALES COMMAND  +  ACTIVITY-TRIGGERED PROMO
// ServerMiser Premium is a companion bot that joins alongside this one once
// a server is authorized via Whop. It unlocks AI persona chat, cross-server
// phone calls, and the full Hoard economy/casino system, on top of
// everything the free bot already offers.
//
// This file does two things:
//   1. /premium about|info — the existing sales command members can run.
//   2. A promo drop that only ever fires as a side effect of someone
//      actually running a command (slash or prefix) in a server — NOT a
//      blind timer sweeping every guild regardless of whether anyone's
//      around. init(client) attaches its own InteractionCreate/MessageCreate
//      listeners directly to the client — Node's EventEmitter happily
//      supports multiple listeners on the same event, so this needs no
//      changes to index.js, interactionCreate.js, or messageCreate.js.
//      Still NOT a command itself — nothing to enable/disable/configure.
// ============================================================================

const WHOP_URL = 'https://whop.com/servermiser/servermiser-premium';
const ACCENT_COLOR = '#F47FFF';

function buyButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('✨ Buy Premium')
      .setStyle(ButtonStyle.Link)
      .setURL(WHOP_URL)
  );
}

// Exported so any other command can attach a consistent "Buy Premium"
// button to its own reply — e.g. a future premium-gated command that
// wants to tell a member they don't have access.
function noPremiumEmbed(description = 'This feature requires **ServerMiser Premium**, which isn\'t active in this server yet.') {
  return new EmbedBuilder()
    .setColor('#ED4245')
    .setTitle('🔒 Premium Required')
    .setDescription(description)
    .setFooter({ text: 'Unlock it below, or run /premium to learn more.' });
}

function buildAboutEmbed() {
  return new EmbedBuilder()
    .setColor(ACCENT_COLOR)
    .setTitle('✨ ServerMiser Premium')
    .setDescription(
      'Premium is a companion bot that joins alongside ServerMiser and unlocks a set of ' +
      'deeper, more powerful features on top of everything the free bot already does.\n\n' +
      'Once your server is authorized, Premium runs side-by-side with the free bot — ' +
      'no need to remove anything, no migration, just new capabilities added on.'
    )
    .addFields(
      { name: '🤖 AI Persona Chat', value: 'Give your server a fully customizable AI character — personality, backstory, tone, even its own name and avatar — that chats naturally in any channel you choose.' },
      { name: '📞 Cross-Server Phone', value: 'Call other Discord servers running Premium directly from a channel, like a phone line between communities — accept, decline, or hang up in real time.' },
      { name: '💰 The Hoard Economy', value: 'A full in-server economy: daily rewards, jobs, a shop, a leaderboard, and casino games like slots, blackjack, dice, and a weekly lottery — all shadowed by a nightly gremlin who taxes the richest members in the server.' },
    )
    .setFooter({ text: 'Run /premium info to see exactly what changes between Free and Premium.' });
}

function buildComparisonEmbed() {
  return new EmbedBuilder()
    .setColor(ACCENT_COLOR)
    .setTitle('⚖️ Free vs Premium')
    .setDescription('Premium includes everything in the Free tier, plus the additions below.')
    .addFields(
      {
        name: '🆓 Free — included for every server',
        value:
          '• Templated server setup & configuration\n' +
          '• Full moderation suite & automated protection\n' +
          '• Role management & self-service role panels\n' +
          '• Verification gate\n' +
          '• Ticket support system\n' +
          '• Suggestions, giveaways & starboard\n' +
          '• Birthdays & invite tracking\n' +
          '• Embed builder & scheduled announcements\n' +
          '• Leveling, ranks, leaderboard & live analytics\n' +
          '• Self Voice temporary channels\n' +
          '• Auto Responder\n' +
          '• Fun & social commands',
        inline: false,
      },
      {
        name: '✨ Premium — everything in Free, plus:',
        value:
          '• **AI Persona Chat** — a fully customizable AI character for your server\n' +
          '• **Cross-Server Phone** — call and connect with other Premium servers\n' +
          '• **The Hoard Economy** — jobs, a shop, a leaderboard, and casino games\n' +
          '• **The Miser** — a nightly tax event that adds a unique risk/reward twist',
        inline: false,
      },
    )
    .setFooter({ text: 'Nothing is removed or replaced — Premium runs as a companion bot alongside the free one.' });
}

/* ==========================================================================
 *  ACTIVITY-TRIGGERED PROMO
 *  Purely automatic — no command, no per-server opt-out or config. Instead
 *  of a timer sweeping every guild on a schedule, this piggybacks on real
 *  command usage: every time someone in a guild runs a slash or prefix
 *  command, there's a small chance it also drops a promo embed (pricing
 *  starts at $1.99, with the Buy Premium button above) into a channel it
 *  picks for itself — so it only ever fires in servers that are actually
 *  active, never in a dead one. A per-guild in-memory cooldown, set much
 *  longer than before, keeps any one server from getting hit more than
 *  rarely even if it's extremely active.
 * ========================================================================== */
const POST_CHANCE_PER_TRIGGER = 0.015;      // ~1.5% chance per command run in a guild, once eligible
const MIN_GAP_MS = 30 * 60 * 60 * 1000;     // hard floor: never post in the same server more than once per 30h

// In-memory only — a missed post after a restart just means the next
// hourly tick rolls again; there's nothing here worth persisting to Mongo.
const lastPromoAt = new Map();

const PROMO_LINES = [
  {
    title: '✨ Psst — Premium is here',
    body: 'ServerMiser Premium unlocks AI persona chat, cross-server phone calls, and the full Hoard economy — casino games, jobs, a shop, and a nightly gremlin who taxes the rich.\n\nPlans start at just **$1.99**.',
  },
  {
    title: '👹 The Miser is waiting',
    body: 'In Premium servers, a nightly tax event skims the richest wallets — on top of jobs, gambling, a shop, and a full leaderboard.\n\nGet started for as little as **$1.99**.',
  },
  {
    title: '🤖 Give this server a voice',
    body: 'Premium\'s AI Persona Chat gives your server a fully customizable AI character — personality, backstory, even its own name and avatar.\n\nStarting at just **$1.99**.',
  },
  {
    title: '📞 Call another server',
    body: 'Premium\'s cross-server phone lets you ring another Discord server running Premium, live, like a phone line between communities.\n\nUnlocks starting at **$1.99**.',
  },
];

function buildPromoEmbed() {
  const pick = PROMO_LINES[Math.floor(Math.random() * PROMO_LINES.length)];
  return new EmbedBuilder()
    .setColor(ACCENT_COLOR)
    .setTitle(pick.title)
    .setDescription(pick.body)
    .setFooter({ text: 'Run /premium info to compare Free and Premium side by side.' });
}

function canSend(guild, channel) {
  const me = guild.members.me;
  if (!me) return false;
  const perms = channel.permissionsFor(me);
  return !!perms && perms.has(PermissionFlagsBits.SendMessages) && perms.has(PermissionFlagsBits.EmbedLinks);
}

// Picks a text channel whose name suggests it's a general-purpose room,
// falling back to the first text channel the bot can actually speak in.
function pickPromoChannel(guild) {
  const named = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText &&
      /general|chat|lounge|main/i.test(c.name) &&
      canSend(guild, c)
  );
  if (named) return named;

  return guild.channels.cache.find((c) => c.type === ChannelType.GuildText && canSend(guild, c)) || null;
}

// Called from the command-activity listeners below — `guild` is wherever
// the command that just ran came from.
async function maybePromoteGuild(guild) {
  if (!guild) return;
  try {
    const last = lastPromoAt.get(guild.id) || 0;
    if (Date.now() - last < MIN_GAP_MS) return;
    if (Math.random() > POST_CHANCE_PER_TRIGGER) return;

    const channel = pickPromoChannel(guild);
    if (!channel) return;

    // Set the cooldown before the send resolves, not after — otherwise a
    // burst of commands firing in the same moment could all pass the gap
    // check before any of them finishes sending, and double-post.
    lastPromoAt.set(guild.id, Date.now());
    await channel.send({ embeds: [buildPromoEmbed()], components: [buyButtonRow()] }).catch(() => null);
  } catch (err) {
    console.error(`[Premium] Promo trigger failed in guild ${guild.id}:`, err.message);
  }
}

module.exports = {
  noPremiumEmbed,
  buyButtonRow,

  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Learn what ServerMiser Premium unlocks')
    .addSubcommand((sub) =>
      sub.setName('about').setDescription('See what ServerMiser Premium is and how to get it')
    )
    .addSubcommand((sub) =>
      sub.setName('info').setDescription('Compare Free and Premium side by side')
    ),

  name: 'premium',

  // Called once at startup by index.js's command loader
  // (`if (command.init) command.init(client)`). Attaches its own listeners
  // straight to the client instead of an independent timer — every slash
  // command dispatch and every prefix command message becomes a (rare)
  // chance to promote, so it's activity-gated rather than schedule-gated.
  init(client) {
    console.log(`[Premium] Promo trigger armed — ~${(POST_CHANCE_PER_TRIGGER * 100).toFixed(1)}% chance per command run, min ${Math.round(MIN_GAP_MS / 3600000)}h between posts per server.`);

    client.on(Events.InteractionCreate, (interaction) => {
      if (!interaction.isChatInputCommand() || !interaction.guild) return;
      maybePromoteGuild(interaction.guild).catch(() => null);
    });

    client.on(Events.MessageCreate, (message) => {
      if (message.author.bot || !message.guild || !message.content) return;
      const prefix = client.prefix || '|';
      if (!message.content.startsWith(prefix)) return;
      maybePromoteGuild(message.guild).catch(() => null);
    });
  },

  async execute(interaction) {
    const isInteraction = typeof interaction.isChatInputCommand === 'function' ? interaction.isChatInputCommand() : false;

    // Prefix mode has no structural requirement to specify a subcommand,
    // so default to "about" if the member just runs |premium with nothing else.
    const subcommand = isInteraction ? interaction.options.getSubcommand() : (interaction.options.getSubcommand() || 'about');

    if (subcommand === 'info') {
      return interaction.reply({ embeds: [buildComparisonEmbed()], components: [buyButtonRow()] }).catch(() => null);
    }

    return interaction.reply({ embeds: [buildAboutEmbed()], components: [buyButtonRow()] }).catch(() => null);
  },
};