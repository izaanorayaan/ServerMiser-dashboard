const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');

// ============================================================================
// FULL HELP DIRECTORY
// Every command in the bot is listed here, grouped into browsable categories.
// Navigation uses a select menu so new categories scale cleanly.
// ============================================================================
const PREFIX_NOTE = '💡 All commands work with both `/` and the `|` prefix.';

const PAGES = [
  {
    key: 'general',
    label: 'General',
    emoji: '👤',
    color: '#5865F2',
    title: '👤 General & Info',
    body:
      '`/help` : Open this interactive help directory.\n' +
      '`/capabilities` : Explore everything the bot can do.\n' +
      '`/purpose` : Learn about the bot and view its profile.\n' +
      '`/rank` : Check your level and XP progress.\n' +
      '`/leaderboard` : View the top 10 ranked members.\n' +
      '`/analytics` : View server activity and growth stats.',
  },
  {
    key: 'setup',
    label: 'Server Setup',
    emoji: '🛠️',
    color: '#EB459E',
    title: '🛠️ Server Setup & Configuration',
    body:
      '`/setup <template> [clear]` : Build a full server layout from templates.\n' +
      '`/setup-audit` : Configure the audit log channel.\n' +
      '`/mod-logs-toggle` : Enable or disable moderation logging.\n' +
      '`/welcome` : Configure welcome messages for new members.\n' +
      '`/leveling <on/off>` : Toggle the XP tracking system.\n' +
      '`/fun-module <on/off>` : Toggle the entire fun suite.\n' +
      '`/channels` : Create, edit, customize, and delete channels and categories.\n' +
      '`/cute <style>` : Change the bot\'s text styling.\n' +
      '`/flavour` : Manage custom response variations.',
  },
  {
    key: 'moderation',
    label: 'Moderation',
    emoji: '🛡️',
    color: '#ED4245',
    title: '🛡️ Moderation & AutoMod',
    body:
      '`/warn <user> <reason>` : Formally warn a member.\n' +
      '`/warnings [user]` : View warning history.\n' +
      '`/mute <user>` and `/unmute <user>` : Timeout or restore a member.\n' +
      '`/kick <user> [reason]` : Kick a member.\n' +
      '`/ban <user> [reason>` and `/unban <username>` : Ban or unban.\n' +
      '`/automodrule` : Configure up to 20 automod filters.\n' +
      '`/autodelete` : Auto-delete based on channel rules, blacklist words, and trigger filters.',
  },
  {
    key: 'roles',
    label: 'Roles',
    emoji: '🎭',
    color: '#FEE75C',
    title: '🎭 Role Management',
    body:
      '`/role user` and `/role remove` : Add or remove roles from members.\n' +
      '`/role create` and `/role delete` : Create or delete roles.\n' +
      '`/role everyone`, `bots`, and `humans` : Mass-assign roles.\n' +
      '`/role color`, `rename`, `hoist`, and `mentionable` : Edit role properties.\n' +
      '`/role info` and `/role list` : Inspect the role hierarchy.\n' +
      '`/autorole` : Auto-grant a role when members join.\n' +
      '`/reactionroles` : Build interactive role panels.\n' +
      '`/verification` : Set up a member verification gate.',
  },
  {
    key: 'tickets',
    label: 'Tickets',
    emoji: '🎫',
    color: '#57F287',
    title: '🎫 Ticket Support System',
    body:
      '`/ticket create` : Open a private support room.\n' +
      '`/ticket close` : Close and archive a ticket.\n\n' +
      'Members open tickets for private help, and staff manage and close them.',
  },
  {
    key: 'selfvoice',
    label: 'Self Voice',
    emoji: '🔊',
    color: '#3498DB',
    title: '🔊 Self Voice — Temp Voice Channels',
    body:
      '`/selfvoice create [name] [limit]` : Create your own temp VC when enabled. ' +
      'It auto-deletes in about 10 seconds unless you join, and it removes itself when you leave.\n' +
      '`/selfvoice setup` : Staff wizard for the module.\n' +
      '`/selfvoice set <setting> <value>` : Fine-tune defaults.\n' +
      '`/selfvoice enable` and `disable` : Staff module toggle.\n\n' +
      'Owners get a control panel to rename, lock, hide, limit, adjust bitrate, region, kick, transfer, claim, and delete.',
  },
  {
    key: 'autoresponder',
    label: 'Auto Responder',
    emoji: '💬',
    color: '#9B59B6',
    title: '💬 Auto Responder',
    body:
      '`/autoresponder setup` : Step-by-step wizard with live preview.\n' +
      '`/autoresponder add <trigger> <response>` : Quick create.\n' +
      '`/autoresponder variables` : See all dynamic placeholders.\n' +
      '`/autoresponder list`, `info`, `edit`, `remove`, `toggle`, and `test` : Manage responders.\n' +
      '`/autoresponder enable` and `disable` : Staff module toggle.\n\n' +
      'Supports exact, contains, wildcard, and regex matching, plus cooldowns, chance rolls, reactions, embeds, and role gating.',
  },
  {
    key: 'fun',
    label: 'Fun & Games',
    emoji: '🎉',
    color: '#F1C40F',
    title: '🎉 Fun & Social',
    body:
      '**Games:** `/trivia` `/wouldyourather` `/capital-quiz` `/dice-duel` `/coinflip` `/roll` `/dice` `/8ball`\n' +
      '**Social:** `/hug` `/slap` `/roast` `/rate` `/predict-love`\n' +
      '**Content:** `/joke` `/dadjoke` `/meme` `/fortune` `/spacefact` `/cat` `/dog`\n' +
      '**Menu:** `/fun-menu` to explore the fun suite.',
  },
];

function buildEmbed(page, index) {
  return new EmbedBuilder()
    .setColor(page.color)
    .setTitle(`${page.title}`)
    .setDescription(page.body)
    .setFooter({ text: `${PREFIX_NOTE}  •  Category ${index + 1}/${PAGES.length}` })
    .setTimestamp();
}

function buildMenu(activeKey) {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('help_select')
      .setPlaceholder('📚 Choose a category to browse…')
      .addOptions(PAGES.map(p => ({
        label: p.label,
        value: p.key,
        emoji: p.emoji,
        default: p.key === activeKey,
      }))),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View the full list of available bot commands by category.'),
  name: 'help',

  async execute(interaction, client) {
    const isInteraction = typeof interaction.isChatInputCommand === 'function' ? interaction.isChatInputCommand() : false;

    const first = PAGES[0];
    const payload = { embeds: [buildEmbed(first, 0)], components: [buildMenu(first.key)] };

    const response = await interaction.reply({ ...payload, fetchReply: true }).catch(() => null);
    if (!response) return;

    const authorId = isInteraction ? interaction.user.id : interaction.author.id;

    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 120000,
    });

    collector.on('collect', async (sel) => {
      if (sel.user.id !== authorId) {
        return sel.reply({ content: '❌ Run the command yourself to browse the menu!', ephemeral: true }).catch(() => null);
      }
      const index = PAGES.findIndex(p => p.key === sel.values[0]);
      const page = PAGES[index] || PAGES[0];
      await sel.update({ embeds: [buildEmbed(page, index)], components: [buildMenu(page.key)] }).catch(() => null);
    });

    collector.on('end', () => {
      const disabled = buildMenu('none');
      disabled.components[0].setDisabled(true);
      if (isInteraction) interaction.editReply({ components: [disabled] }).catch(() => null);
      else response.edit({ components: [disabled] }).catch(() => null);
    });
  },
};
