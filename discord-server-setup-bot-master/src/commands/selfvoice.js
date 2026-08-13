const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const mongoose = require('mongoose');

// ============================================================
// 1. MONGOOSE SCHEMAS (Guild config + live temporary channels)
// ============================================================
const SelfVoiceConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  enabled: { type: Boolean, default: false },
  categoryId: { type: String, default: null },
  nameTemplate: { type: String, default: "{user}'s Lounge" },
  defaultLimit: { type: Number, default: 0 },        // 0 = unlimited
  defaultBitrate: { type: Number, default: 64 },     // stored in kbps
  graceSeconds: { type: Number, default: 10 },       // delete window if owner never joins
  defaultPrivacy: { type: String, default: 'open' }, // open | locked | hidden
  maxPerUser: { type: Number, default: 1 },
  logChannelId: { type: String, default: null },

  // Persistent wizard state (survives volatile memory / restarts)
  wizardActive: { type: Boolean, default: false },
  wizardStep: { type: Number, default: 0 },
  wizardUserId: { type: String, default: null },
  tempCategoryId: { type: String, default: null },
  tempLimit: { type: Number, default: 0 },
  tempGrace: { type: Number, default: 10 },
  tempPrivacy: { type: String, default: 'open' },
});
const SelfVoiceConfig =
  mongoose.models.SelfVoiceConfig || mongoose.model('SelfVoiceConfig', SelfVoiceConfigSchema);

const SelfVoiceActiveSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  ownerId: { type: String, required: true },
  joined: { type: Boolean, default: false },
  locked: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});
const SelfVoiceActive =
  mongoose.models.SelfVoiceActive || mongoose.model('SelfVoiceActive', SelfVoiceActiveSchema);

// ============================================================
// 2. SMALL HELPERS
// ============================================================
const RTC_REGIONS = [
  { label: 'Automatic (Best Ping)', value: 'auto', emoji: '🛰️' },
  { label: 'US East', value: 'us-east', emoji: '🇺🇸' },
  { label: 'US West', value: 'us-west', emoji: '🇺🇸' },
  { label: 'US Central', value: 'us-central', emoji: '🇺🇸' },
  { label: 'Rotterdam (EU)', value: 'rotterdam', emoji: '🇪🇺' },
  { label: 'Singapore', value: 'singapore', emoji: '🇸🇬' },
  { label: 'Japan', value: 'japan', emoji: '🇯🇵' },
  { label: 'India', value: 'india', emoji: '🇮🇳' },
  { label: 'Sydney', value: 'sydney', emoji: '🇦🇺' },
  { label: 'Brazil', value: 'brazil', emoji: '🇧🇷' },
  { label: 'South Africa', value: 'southafrica', emoji: '🇿🇦' },
];

function isAdminLike(member) {
  if (!member) return false;
  return (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

async function getConfig(guildId) {
  return (
    (await SelfVoiceConfig.findOne({ guildId }).catch(() => null)) ||
    new SelfVoiceConfig({ guildId })
  );
}

// Build the interactive owner control panel for a live temporary channel.
function buildPanelMessage(record, channel) {
  const limitText = channel.userLimit && channel.userLimit > 0 ? `${channel.userLimit} users` : 'Unlimited';
  const region = channel.rtcRegion ? channel.rtcRegion : 'Automatic';
  const bitrate = Math.round((channel.bitrate || 64000) / 1000);

  const embed = new EmbedBuilder()
    .setTitle('🎙️ Self Voice Control Panel')
    .setColor(record.locked || record.hidden ? '#E67E22' : '#5865F2')
    .setDescription(
      `You own **${channel.name}**. Use the buttons below to fully customize your room.\n` +
        `Everything is live — changes apply instantly.`
    )
    .addFields(
      { name: '👑 Owner', value: `<@${record.ownerId}>`, inline: true },
      { name: '👥 User Limit', value: limitText, inline: true },
      { name: '🎚️ Bitrate', value: `${bitrate} kbps`, inline: true },
      { name: '🔒 Locked', value: record.locked ? 'Yes' : 'No', inline: true },
      { name: '🙈 Hidden', value: record.hidden ? 'Yes' : 'No', inline: true },
      { name: '🌍 Region', value: region, inline: true }
    )
    .setFooter({ text: 'This channel self-destructs when you leave it.' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('selfvoice_panel_rename').setLabel('Rename').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('selfvoice_panel_limit').setLabel('User Limit').setEmoji('👥').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('selfvoice_panel_lock').setLabel(record.locked ? 'Unlock' : 'Lock').setEmoji(record.locked ? '🔓' : '🔒').setStyle(record.locked ? ButtonStyle.Success : ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('selfvoice_panel_hide').setLabel(record.hidden ? 'Reveal' : 'Hide').setEmoji(record.hidden ? '👁️' : '🙈').setStyle(record.hidden ? ButtonStyle.Success : ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('selfvoice_panel_bitrate').setLabel('Bitrate').setEmoji('🎚️').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('selfvoice_panel_region').setLabel('Region').setEmoji('🌍').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('selfvoice_panel_kick').setLabel('Kick User').setEmoji('👢').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('selfvoice_panel_transfer').setLabel('Transfer').setEmoji('🤝').setStyle(ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('selfvoice_panel_claim').setLabel('Claim').setEmoji('🙋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('selfvoice_panel_delete').setLabel('Delete Room').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row1, row2, row3] };
}

// Apply privacy overwrites to the live channel from the record state.
async function applyPrivacy(channel, record) {
  const everyone = channel.guild.roles.everyone;
  await channel.permissionOverwrites
    .edit(everyone, {
      Connect: record.locked ? false : null,
      ViewChannel: record.hidden ? false : null,
    })
    .catch(() => null);
}

// ============================================================
// 3. COMMAND DEFINITION
// ============================================================
module.exports = {
  // Expose models + helpers for the voiceStateUpdate event + janitor
  SelfVoiceConfig,
  SelfVoiceActive,
  buildPanelMessage,

  data: new SlashCommandBuilder()
    .setName('selfvoice')
    .setDescription('🎙️ Create self-managed temporary voice channels that clean themselves up.')
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Create your own temporary voice channel (must be enabled by staff).')
        .addStringOption((o) => o.setName('name').setDescription('Custom name for your channel').setRequired(false))
        .addIntegerOption((o) => o.setName('limit').setDescription('User limit (0 = unlimited)').setMinValue(0).setMaxValue(99).setRequired(false))
    )
    .addSubcommand((s) => s.setName('setup').setDescription('[Staff] Launch the guided Self Voice setup wizard.'))
    .addSubcommand((s) => s.setName('enable').setDescription('[Staff] Enable the Self Voice module for this server.'))
    .addSubcommand((s) => s.setName('disable').setDescription('[Staff] Disable the Self Voice module for this server.'))
    .addSubcommand((s) => s.setName('config').setDescription('View the current Self Voice configuration.'))
    .addSubcommand((s) => s.setName('panel').setDescription('Resend the control panel for your active room.'))
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('[Staff] Tweak a single Self Voice setting.')
        .addStringOption((o) =>
          o
            .setName('setting')
            .setDescription('Which setting to change')
            .setRequired(true)
            .addChoices(
              { name: 'name (template, use {user})', value: 'name' },
              { name: 'limit (default user limit)', value: 'limit' },
              { name: 'bitrate (kbps)', value: 'bitrate' },
              { name: 'grace (seconds)', value: 'grace' },
              { name: 'maxperuser', value: 'maxperuser' },
              { name: 'privacy (open/locked/hidden)', value: 'privacy' },
              { name: 'category (category id)', value: 'category' },
              { name: 'log (channel id)', value: 'log' }
            )
        )
        .addStringOption((o) => o.setName('value').setDescription('The new value').setRequired(true))
    ),
  name: 'selfvoice',

  async execute(interaction, client) {
    const isInteraction =
      typeof interaction.isChatInputCommand === 'function'
        ? interaction.isChatInputCommand()
        : false;
    const guild = interaction.guild;
    if (!guild) return;
    const guildId = guild.id;
    const member = interaction.member;

    // --------------------------------------------------------
    // Parse subcommand + arguments for BOTH slash and prefix
    // --------------------------------------------------------
    let sub;
    let argName = null;
    let argLimit = null;
    let setKey = null;
    let setVal = null;

    if (isInteraction) {
      sub = interaction.options.getSubcommand();
      argName = interaction.options.getString('name');
      argLimit = interaction.options.getInteger('limit');
      if (sub === 'set') {
        setKey = interaction.options.getString('setting');
        setVal = interaction.options.getString('value');
      }
    } else {
      // Prefix path: mockInteraction.getString('subcommand') returns the full arg string
      const raw = (interaction.options.getString('subcommand') || '').trim();
      const parts = raw.split(/ +/).filter(Boolean);
      sub = (parts[0] || 'create').toLowerCase();
      if (sub === 'create') {
        argName = parts.slice(1).join(' ') || null;
      } else if (sub === 'set') {
        setKey = (parts[1] || '').toLowerCase();
        setVal = parts.slice(2).join(' ') || null;
      } else if (sub === 'toggle') {
        sub = parts[1] === 'off' || parts[1] === 'disable' ? 'disable' : 'enable';
      }
    }

    const reply = (payload) => {
      if (typeof payload === 'string') payload = { content: payload };
      return interaction.reply({ ...payload }).catch(() => null);
    };

    // ========================================================
    // SUBCOMMAND: enable / disable  (Manage Server or Admin)
    // ========================================================
    if (sub === 'enable' || sub === 'disable') {
      if (!isAdminLike(member)) {
        return reply({
          content: '❌ **Access Denied:** You need `Manage Server` or `Administrator` to toggle the Self Voice module.',
          ephemeral: true,
        });
      }
      const config = await getConfig(guildId);
      config.enabled = sub === 'enable';
      await config.save();

      const embed = new EmbedBuilder()
        .setTitle(config.enabled ? '✅ Self Voice Enabled' : '🔴 Self Voice Disabled')
        .setColor(config.enabled ? '#2ECC71' : '#ED4245')
        .setDescription(
          config.enabled
            ? `Anyone in **${guild.name}** can now run \`/selfvoice create\` to spawn their own temporary voice room.\n\n${config.categoryId ? '' : '💡 Tip: run `/selfvoice setup` to pick a category and defaults.'}`
            : 'The module is now off. Members will get a "not enabled" error if they try to create a room.'
        );
      return reply({ embeds: [embed], ephemeral: true });
    }

    // ========================================================
    // SUBCOMMAND: setup (interactive wizard — Manage Server/Admin)
    // ========================================================
    if (sub === 'setup') {
      if (!isAdminLike(member)) {
        return reply({
          content: '❌ **Access Denied:** You need `Manage Server` or `Administrator` to run the setup wizard.',
          ephemeral: true,
        });
      }
      const config = await getConfig(guildId);
      config.wizardActive = true;
      config.wizardStep = 1;
      config.wizardUserId = interaction.user.id;
      config.tempCategoryId = config.categoryId;
      config.tempLimit = config.defaultLimit;
      config.tempGrace = config.graceSeconds;
      config.tempPrivacy = config.defaultPrivacy;
      await config.save();

      const categories = guild.channels.cache
        .filter((c) => c.type === ChannelType.GuildCategory)
        .first(23);

      const options = [{ label: 'No category (create at top level)', value: 'none', emoji: '📂' }];
      for (const cat of categories) {
        options.push({ label: cat.name.slice(0, 90), value: cat.id, emoji: '🗂️' });
      }

      const embed = new EmbedBuilder()
        .setTitle('🎙️ Self Voice Setup Wizard — Step 1 / 4')
        .setColor('#5865F2')
        .setDescription(
          'Welcome to the guided setup. This takes 4 quick steps.\n\n' +
            '**Step 1:** Pick the category where temporary voice channels should be created.'
        )
        .setFooter({ text: 'Only the admin who started this wizard can use it.' });

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('selfvoice_wizard_category')
          .setPlaceholder('Choose a category for new rooms...')
          .addOptions(options)
      );

      return reply({ embeds: [embed], components: [row], ephemeral: true });
    }

    // ========================================================
    // SUBCOMMAND: set (granular tweaks — Manage Server/Admin)
    // ========================================================
    if (sub === 'set') {
      if (!isAdminLike(member)) {
        return reply({
          content: '❌ **Access Denied:** You need `Manage Server` or `Administrator` to change settings.',
          ephemeral: true,
        });
      }
      if (!setKey) {
        return reply({
          content:
            '❌ **Usage:** `set <name|limit|bitrate|grace|maxperuser|privacy|category|log> <value>`\n' +
            'Examples: `set limit 5`, `set grace 15`, `set privacy locked`, `set name {user}\'s Room`',
          ephemeral: true,
        });
      }
      const config = await getConfig(guildId);
      let confirmation = '';

      switch (setKey) {
        case 'name': {
          if (!setVal) return reply({ content: '❌ Provide a template. Use `{user}` for the owner name.', ephemeral: true });
          config.nameTemplate = setVal.slice(0, 90);
          confirmation = `Name template set to \`${config.nameTemplate}\``;
          break;
        }
        case 'limit': {
          const n = parseInt(setVal, 10);
          if (isNaN(n) || n < 0 || n > 99) return reply({ content: '❌ Limit must be a number between 0 and 99 (0 = unlimited).', ephemeral: true });
          config.defaultLimit = n;
          confirmation = `Default user limit set to \`${n === 0 ? 'Unlimited' : n}\``;
          break;
        }
        case 'bitrate': {
          const n = parseInt(setVal, 10);
          if (isNaN(n) || n < 8 || n > 384) return reply({ content: '❌ Bitrate must be between 8 and 384 (kbps).', ephemeral: true });
          config.defaultBitrate = n;
          confirmation = `Default bitrate set to \`${n} kbps\``;
          break;
        }
        case 'grace': {
          const n = parseInt(setVal, 10);
          if (isNaN(n) || n < 5 || n > 300) return reply({ content: '❌ Grace period must be between 5 and 300 seconds.', ephemeral: true });
          config.graceSeconds = n;
          confirmation = `Grace period set to \`${n}s\` (delete window if the owner never joins)`;
          break;
        }
        case 'maxperuser': {
          const n = parseInt(setVal, 10);
          if (isNaN(n) || n < 1 || n > 10) return reply({ content: '❌ Max per user must be between 1 and 10.', ephemeral: true });
          config.maxPerUser = n;
          confirmation = `Max simultaneous rooms per user set to \`${n}\``;
          break;
        }
        case 'privacy': {
          const v = (setVal || '').toLowerCase();
          if (!['open', 'locked', 'hidden'].includes(v)) return reply({ content: '❌ Privacy must be `open`, `locked`, or `hidden`.', ephemeral: true });
          config.defaultPrivacy = v;
          confirmation = `Default privacy set to \`${v}\``;
          break;
        }
        case 'category': {
          const id = (setVal || '').replace(/[^0-9]/g, '');
          const cat = guild.channels.cache.get(id);
          if (!cat || cat.type !== ChannelType.GuildCategory) return reply({ content: '❌ Provide a valid category ID.', ephemeral: true });
          config.categoryId = id;
          confirmation = `Rooms will now be created under **${cat.name}**`;
          break;
        }
        case 'log': {
          const id = (setVal || '').replace(/[^0-9]/g, '');
          const ch = guild.channels.cache.get(id);
          if (!ch) return reply({ content: '❌ Provide a valid text channel ID.', ephemeral: true });
          config.logChannelId = id;
          confirmation = `Log channel set to <#${id}>`;
          break;
        }
        default:
          return reply({ content: `❌ Unknown setting \`${setKey}\`.`, ephemeral: true });
      }

      await config.save();
      return reply({
        embeds: [new EmbedBuilder().setTitle('⚙️ Setting Updated').setColor('#2ECC71').setDescription(`✅ ${confirmation}`)],
        ephemeral: true,
      });
    }

    // ========================================================
    // SUBCOMMAND: config (view current settings — anyone)
    // ========================================================
    if (sub === 'config' || sub === 'settings' || sub === 'info') {
      const config = await getConfig(guildId);
      const activeCount = await SelfVoiceActive.countDocuments({ guildId }).catch(() => 0);

      const embed = new EmbedBuilder()
        .setTitle('🎙️ Self Voice — Server Configuration')
        .setColor(config.enabled ? '#2ECC71' : '#ED4245')
        .addFields(
          { name: 'Module Status', value: config.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
          { name: 'Category', value: config.categoryId ? `<#${config.categoryId}>` : 'Top level', inline: true },
          { name: 'Active Rooms', value: `${activeCount}`, inline: true },
          { name: 'Name Template', value: `\`${config.nameTemplate}\``, inline: true },
          { name: 'Default Limit', value: config.defaultLimit === 0 ? 'Unlimited' : `${config.defaultLimit}`, inline: true },
          { name: 'Default Bitrate', value: `${config.defaultBitrate} kbps`, inline: true },
          { name: 'Grace Period', value: `${config.graceSeconds}s`, inline: true },
          { name: 'Default Privacy', value: `\`${config.defaultPrivacy}\``, inline: true },
          { name: 'Max Per User', value: `${config.maxPerUser}`, inline: true }
        )
        .setFooter({ text: 'Admins: use /selfvoice setup or /selfvoice set to change these.' });
      return reply({ embeds: [embed], ephemeral: true });
    }

    // ========================================================
    // SUBCOMMAND: panel (re-send your control panel — owners)
    // ========================================================
    if (sub === 'panel') {
      const record = await SelfVoiceActive.findOne({ guildId, ownerId: interaction.user.id }).catch(() => null);
      if (!record) {
        return reply({ content: '❌ You do not own an active Self Voice room right now.', ephemeral: true });
      }
      const channel = guild.channels.cache.get(record.channelId);
      if (!channel) {
        await SelfVoiceActive.deleteOne({ channelId: record.channelId }).catch(() => null);
        return reply({ content: '❌ Your room no longer exists.', ephemeral: true });
      }
      return reply({ ...buildPanelMessage(record, channel), ephemeral: true });
    }

    // ========================================================
    // SUBCOMMAND: create (anyone, when the module is enabled)
    // ========================================================
    if (sub === 'create') {
      const config = await getConfig(guildId);

      // 🔒 Enabled gate — the requested "no perms" error when disabled
      if (!config.enabled) {
        return reply({
          content:
            '❌ **No permission:** The **Self Voice** module is not enabled on this server. ' +
            'Ask a staff member with `Manage Server` to run `/selfvoice enable`.',
          ephemeral: true,
        });
      }

      // Bot capability check
      const me = guild.members.me;
      if (!me || !me.permissions.has(PermissionFlagsBits.ManageChannels) || !me.permissions.has(PermissionFlagsBits.MoveMembers)) {
        return reply({
          content: '❌ I need the **Manage Channels** and **Move Members** permissions to run Self Voice.',
          ephemeral: true,
        });
      }

      // Enforce max rooms per user
      const owned = await SelfVoiceActive.countDocuments({ guildId, ownerId: interaction.user.id }).catch(() => 0);
      if (owned >= config.maxPerUser) {
        return reply({
          content: `❌ You already own the maximum of **${config.maxPerUser}** Self Voice room(s). Delete one first.`,
          ephemeral: true,
        });
      }

      const displayName = member?.displayName || interaction.user.username;
      const channelName = (argName || config.nameTemplate)
        .replace(/\{user\}/gi, displayName)
        .slice(0, 90);

      const wantLimit = argLimit != null ? Math.max(0, Math.min(99, argLimit)) : config.defaultLimit;
      const maxBitrate = guild.maximumBitrate || 96000;
      const wantBitrate = Math.min(config.defaultBitrate * 1000, maxBitrate);

      const locked = config.defaultPrivacy === 'locked';
      const hidden = config.defaultPrivacy === 'hidden';

      const everyoneDeny = [];
      if (locked) everyoneDeny.push(PermissionFlagsBits.Connect);
      if (hidden) everyoneDeny.push(PermissionFlagsBits.ViewChannel);

      let channel;
      try {
        channel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildVoice,
          parent: config.categoryId || null,
          userLimit: wantLimit,
          bitrate: wantBitrate,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: everyoneDeny,
            },
            {
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.Connect,
                PermissionFlagsBits.Speak,
                PermissionFlagsBits.Stream,
                PermissionFlagsBits.PrioritySpeaker,
              ],
            },
          ],
        });
      } catch (err) {
        console.error('[SelfVoice] Channel creation failed:', err.message);
        return reply({ content: '❌ I could not create the channel. Check my role position and permissions.', ephemeral: true });
      }

      await new SelfVoiceActive({
        channelId: channel.id,
        guildId,
        ownerId: interaction.user.id,
        joined: false,
        locked,
        hidden,
        createdAt: new Date(),
      }).save().catch(() => null);

      // Schedule the grace deletion — cancelled only if the OWNER joins.
      const grace = config.graceSeconds;
      setTimeout(async () => {
        try {
          const rec = await SelfVoiceActive.findOne({ channelId: channel.id }).catch(() => null);
          if (!rec || rec.joined) return; // owner joined -> safe
          const live = client.channels.cache.get(channel.id) || (await client.channels.fetch(channel.id).catch(() => null));
          if (live) await live.delete('SelfVoice: owner did not join within the grace period').catch(() => null);
          await SelfVoiceActive.deleteOne({ channelId: channel.id }).catch(() => null);
        } catch (_) {}
      }, grace * 1000);

      const embed = new EmbedBuilder()
        .setTitle('🎙️ Your Voice Room Is Ready!')
        .setColor('#2ECC71')
        .setDescription(
          `Head into <#${channel.id}> within **${grace} seconds** or it will be automatically deleted.\n\n` +
            `Once you join, a **control panel** appears in the room's chat so you can rename it, lock it, set a limit, and more. ` +
            `The room self-destructs the moment you leave.`
        )
        .addFields(
          { name: 'Channel', value: `<#${channel.id}>`, inline: true },
          { name: 'Limit', value: wantLimit === 0 ? 'Unlimited' : `${wantLimit}`, inline: true },
          { name: 'Privacy', value: config.defaultPrivacy, inline: true }
        );

      return reply({ embeds: [embed], ephemeral: true });
    }

    // Fallback
    return reply({
      content:
        '🎙️ **Self Voice** commands:\n' +
        '`create [name]` — make your own temporary voice room\n' +
        '`config` — view server settings\n' +
        '`panel` — resend your room control panel\n' +
        '`setup` / `set` / `enable` / `disable` — staff only',
      ephemeral: true,
    });
  },

  // ============================================================
  // 4. COMPONENT / MODAL ROUTER (all `selfvoice_` custom IDs)
  // ============================================================
  async handleInteraction(interaction, client) {
    const guild = interaction.guild;
    if (!guild) return;
    const guildId = guild.id;
    const id = interaction.customId;

    // ---------- WIZARD (admin only) ----------
    if (id.startsWith('selfvoice_wizard_')) {
      const config = await getConfig(guildId);
      if (config.wizardUserId !== interaction.user.id) {
        return interaction.reply({ content: '❌ Only the admin who started this wizard can use it.', ephemeral: true }).catch(() => null);
      }
      if (!isAdminLike(interaction.member)) {
        return interaction.reply({ content: '❌ You no longer have permission to configure this.', ephemeral: true }).catch(() => null);
      }
      await interaction.deferUpdate().catch(() => null);

      if (id === 'selfvoice_wizard_category') {
        config.tempCategoryId = interaction.values[0] === 'none' ? null : interaction.values[0];
        config.wizardStep = 2;
        await config.save();

        const embed = new EmbedBuilder()
          .setTitle('🎙️ Self Voice Setup Wizard — Step 2 / 4')
          .setColor('#5865F2')
          .setDescription('**Step 2:** Choose the default user limit for new rooms.');
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('selfvoice_wizard_limit')
            .setPlaceholder('Default user limit...')
            .addOptions([
              { label: 'Unlimited', value: '0', emoji: '♾️' },
              { label: '2 users', value: '2', emoji: '👥' },
              { label: '5 users', value: '5', emoji: '👥' },
              { label: '10 users', value: '10', emoji: '👥' },
              { label: '25 users', value: '25', emoji: '👥' },
            ])
        );
        return interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
      }

      if (id === 'selfvoice_wizard_limit') {
        config.tempLimit = parseInt(interaction.values[0], 10) || 0;
        config.wizardStep = 3;
        await config.save();

        const embed = new EmbedBuilder()
          .setTitle('🎙️ Self Voice Setup Wizard — Step 3 / 4')
          .setColor('#5865F2')
          .setDescription('**Step 3:** How long should an empty new room wait for its owner before being deleted?');
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('selfvoice_wizard_grace')
            .setPlaceholder('Grace period...')
            .addOptions([
              { label: '10 seconds (recommended)', value: '10', emoji: '⏱️' },
              { label: '15 seconds', value: '15', emoji: '⏱️' },
              { label: '30 seconds', value: '30', emoji: '⏱️' },
              { label: '60 seconds', value: '60', emoji: '⏱️' },
            ])
        );
        return interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
      }

      if (id === 'selfvoice_wizard_grace') {
        config.tempGrace = parseInt(interaction.values[0], 10) || 10;
        config.wizardStep = 4;
        await config.save();

        const embed = new EmbedBuilder()
          .setTitle('🎙️ Self Voice Setup Wizard — Step 4 / 4')
          .setColor('#5865F2')
          .setDescription(
            '**Step 4:** Choose the default privacy for new rooms.\n\n' +
              '🟢 **Open** — anyone can see and join\n' +
              '🔒 **Locked** — visible, but only invited users can connect\n' +
              '🙈 **Hidden** — invisible to everyone except invited users'
          );
        const row = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('selfvoice_wizard_privacy')
            .setPlaceholder('Default privacy...')
            .addOptions([
              { label: 'Open', value: 'open', emoji: '🟢' },
              { label: 'Locked', value: 'locked', emoji: '🔒' },
              { label: 'Hidden', value: 'hidden', emoji: '🙈' },
            ])
        );
        return interaction.editReply({ embeds: [embed], components: [row] }).catch(() => null);
      }

      if (id === 'selfvoice_wizard_privacy') {
        config.tempPrivacy = interaction.values[0];
        // Commit everything
        config.categoryId = config.tempCategoryId;
        config.defaultLimit = config.tempLimit;
        config.graceSeconds = config.tempGrace;
        config.defaultPrivacy = config.tempPrivacy;
        config.enabled = true;
        config.wizardActive = false;
        config.wizardStep = 0;
        await config.save();

        const embed = new EmbedBuilder()
          .setTitle('✅ Self Voice Is Live!')
          .setColor('#2ECC71')
          .setDescription('Setup complete — the module is now **enabled**. Members can run `/selfvoice create`.')
          .addFields(
            { name: 'Category', value: config.categoryId ? `<#${config.categoryId}>` : 'Top level', inline: true },
            { name: 'Default Limit', value: config.defaultLimit === 0 ? 'Unlimited' : `${config.defaultLimit}`, inline: true },
            { name: 'Grace Period', value: `${config.graceSeconds}s`, inline: true },
            { name: 'Default Privacy', value: `\`${config.defaultPrivacy}\``, inline: true }
          );
        return interaction.editReply({ embeds: [embed], components: [] }).catch(() => null);
      }
      return;
    }

    // ---------- OWNER CONTROL PANEL + MODALS + SELECTS ----------
    // Everything is keyed off the temp channel the interaction lives in.
    const record = await SelfVoiceActive.findOne({ channelId: interaction.channelId }).catch(() => null);
    const channel = guild.channels.cache.get(interaction.channelId);

    if (!record || !channel) {
      return interaction.reply({ content: '❌ This control panel is no longer linked to an active room.', ephemeral: true }).catch(() => null);
    }

    const isOwner = interaction.user.id === record.ownerId;

    // ----- CLAIM (available to any member in the room if owner has left) -----
    if (id === 'selfvoice_panel_claim') {
      const ownerInChannel = channel.members.has(record.ownerId);
      if (ownerInChannel) {
        return interaction.reply({ content: '❌ You can only claim this room when the current owner has left it.', ephemeral: true }).catch(() => null);
      }
      if (!channel.members.has(interaction.user.id)) {
        return interaction.reply({ content: '❌ You must be inside the room to claim it.', ephemeral: true }).catch(() => null);
      }
      record.ownerId = interaction.user.id;
      await record.save();
      await channel.permissionOverwrites
        .edit(interaction.user.id, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          Stream: true,
          PrioritySpeaker: true,
        })
        .catch(() => null);
      await interaction.reply({ content: '🙋 You are now the owner of this room!', ephemeral: true }).catch(() => null);
      return channel.send(buildPanelMessage(record, channel)).catch(() => null);
    }

    // From here on, owner-only
    if (!isOwner) {
      return interaction.reply({ content: '❌ Only the room owner can use these controls.', ephemeral: true }).catch(() => null);
    }

    // ----- BUTTONS THAT OPEN MODALS -----
    if (id === 'selfvoice_panel_rename') {
      const modal = new ModalBuilder().setCustomId('selfvoice_modal_rename').setTitle('Rename Your Room');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('value')
            .setLabel('New channel name')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(90)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal).catch(() => null);
    }

    if (id === 'selfvoice_panel_limit') {
      const modal = new ModalBuilder().setCustomId('selfvoice_modal_limit').setTitle('Set User Limit');
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('value')
            .setLabel('User limit (0 = unlimited, max 99)')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(2)
            .setRequired(true)
        )
      );
      return interaction.showModal(modal).catch(() => null);
    }

    if (id === 'selfvoice_panel_bitrate') {
      const rows = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('selfvoice_select_bitrate')
          .setPlaceholder('Choose a bitrate...')
          .addOptions([
            { label: '8 kbps (lowest)', value: '8', emoji: '🎚️' },
            { label: '32 kbps', value: '32', emoji: '🎚️' },
            { label: '64 kbps (default)', value: '64', emoji: '🎚️' },
            { label: '96 kbps', value: '96', emoji: '🎚️' },
            { label: '128 kbps (boost)', value: '128', emoji: '🎚️' },
            { label: '256 kbps (boost)', value: '256', emoji: '🎚️' },
            { label: '384 kbps (max boost)', value: '384', emoji: '🎚️' },
          ])
      );
      return interaction.reply({ content: '🎚️ Select a new bitrate (higher tiers need server boosts):', components: [rows], ephemeral: true }).catch(() => null);
    }

    if (id === 'selfvoice_panel_region') {
      const rows = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('selfvoice_select_region')
          .setPlaceholder('Choose a voice region...')
          .addOptions(RTC_REGIONS)
      );
      return interaction.reply({ content: '🌍 Select a voice region:', components: [rows], ephemeral: true }).catch(() => null);
    }

    if (id === 'selfvoice_panel_kick' || id === 'selfvoice_panel_transfer') {
      const targets = channel.members.filter((m) => m.id !== record.ownerId).first(24);
      if (!targets.length) {
        return interaction.reply({ content: 'ℹ️ There is nobody else in the room right now.', ephemeral: true }).catch(() => null);
      }
      const isKick = id === 'selfvoice_panel_kick';
      const rows = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(isKick ? 'selfvoice_select_kick' : 'selfvoice_select_transfer')
          .setPlaceholder(isKick ? 'Choose a member to disconnect...' : 'Choose the new owner...')
          .addOptions(targets.map((m) => ({ label: m.displayName.slice(0, 90), description: m.user.username.slice(0, 90), value: m.id })))
      );
      return interaction.reply({
        content: isKick ? '👢 Select a member to remove from your room:' : '🤝 Select who should become the new owner:',
        components: [rows],
        ephemeral: true,
      }).catch(() => null);
    }

    // ----- TOGGLE BUTTONS (edit the panel in place) -----
    if (id === 'selfvoice_panel_lock') {
      await interaction.deferUpdate().catch(() => null);
      record.locked = !record.locked;
      await record.save();
      await applyPrivacy(channel, record);
      return interaction.editReply(buildPanelMessage(record, channel)).catch(() => null);
    }

    if (id === 'selfvoice_panel_hide') {
      await interaction.deferUpdate().catch(() => null);
      record.hidden = !record.hidden;
      await record.save();
      await applyPrivacy(channel, record);
      return interaction.editReply(buildPanelMessage(record, channel)).catch(() => null);
    }

    if (id === 'selfvoice_panel_delete') {
      await interaction.reply({ content: '🗑️ Deleting your room...', ephemeral: true }).catch(() => null);
      await SelfVoiceActive.deleteOne({ channelId: channel.id }).catch(() => null);
      return channel.delete('SelfVoice: owner deleted the room via panel').catch(() => null);
    }

    // ----- SELECT MENU RESPONSES -----
    if (id === 'selfvoice_select_bitrate') {
      await interaction.deferUpdate().catch(() => null);
      const kbps = parseInt(interaction.values[0], 10);
      const maxBitrate = guild.maximumBitrate || 96000;
      const target = Math.min(kbps * 1000, maxBitrate);
      await channel.setBitrate(target).catch(() => null);
      return interaction.editReply({ content: `✅ Bitrate set to **${Math.round((channel.bitrate || target) / 1000)} kbps**.`, components: [] }).catch(() => null);
    }

    if (id === 'selfvoice_select_region') {
      await interaction.deferUpdate().catch(() => null);
      const region = interaction.values[0] === 'auto' ? null : interaction.values[0];
      await channel.setRTCRegion(region).catch(() => null);
      return interaction.editReply({ content: `✅ Voice region set to **${region || 'Automatic'}**.`, components: [] }).catch(() => null);
    }

    if (id === 'selfvoice_select_kick') {
      await interaction.deferUpdate().catch(() => null);
      const targetId = interaction.values[0];
      const target = channel.members.get(targetId);
      if (target) {
        await channel.permissionOverwrites.edit(targetId, { Connect: false }).catch(() => null);
        await target.voice.disconnect('SelfVoice: kicked by room owner').catch(() => null);
      }
      return interaction.editReply({ content: `✅ Removed <@${targetId}> from your room.`, components: [] }).catch(() => null);
    }

    if (id === 'selfvoice_select_transfer') {
      await interaction.deferUpdate().catch(() => null);
      const newOwnerId = interaction.values[0];
      record.ownerId = newOwnerId;
      await record.save();
      await channel.permissionOverwrites
        .edit(newOwnerId, {
          ViewChannel: true,
          Connect: true,
          Speak: true,
          Stream: true,
          PrioritySpeaker: true,
        })
        .catch(() => null);
      await interaction.editReply({ content: `✅ Ownership transferred to <@${newOwnerId}>.`, components: [] }).catch(() => null);
      return channel.send(buildPanelMessage(record, channel)).catch(() => null);
    }

    // ----- MODAL SUBMISSIONS -----
    if (id === 'selfvoice_modal_rename') {
      await interaction.deferReply({ ephemeral: true }).catch(() => null);
      const value = interaction.fields.getTextInputValue('value').slice(0, 90);
      await channel.setName(value).catch(() => null);
      return interaction.editReply({ content: `✅ Room renamed to **${value}**.` }).catch(() => null);
    }

    if (id === 'selfvoice_modal_limit') {
      await interaction.deferReply({ ephemeral: true }).catch(() => null);
      const n = parseInt(interaction.fields.getTextInputValue('value'), 10);
      if (isNaN(n) || n < 0 || n > 99) {
        return interaction.editReply({ content: '❌ Please enter a number between 0 and 99.' }).catch(() => null);
      }
      await channel.setUserLimit(n).catch(() => null);
      return interaction.editReply({ content: `✅ User limit set to **${n === 0 ? 'Unlimited' : n}**.` }).catch(() => null);
    }
  },

  // ============================================================
  // 5. JANITOR — cleans up orphaned rooms (e.g. after a restart)
  // ============================================================
  startJanitor(client) {
    if (global.__selfVoiceJanitor) return;
    global.__selfVoiceJanitor = setInterval(async () => {
      try {
        const records = await SelfVoiceActive.find({}).catch(() => []);
        const now = Date.now();
        for (const rec of records) {
          const ch =
            client.channels.cache.get(rec.channelId) ||
            (await client.channels.fetch(rec.channelId).catch(() => null));
          if (!ch) {
            await SelfVoiceActive.deleteOne({ channelId: rec.channelId }).catch(() => null);
            continue;
          }
          const members = ch.members ? ch.members.size : 0;
          const age = now - new Date(rec.createdAt).getTime();
          // Empty + (owner already used it OR it's clearly stale) => remove
          if (members === 0 && (rec.joined || age > 60000)) {
            await ch.delete('SelfVoice janitor: empty temporary room').catch(() => null);
            await SelfVoiceActive.deleteOne({ channelId: rec.channelId }).catch(() => null);
          }
        }
      } catch (_) {}
    }, 60000);
    console.log('🧹 [SelfVoice] Janitor sweep engaged (60s interval).');
  },
};