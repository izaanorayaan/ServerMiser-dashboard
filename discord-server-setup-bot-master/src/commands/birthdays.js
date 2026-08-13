const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
} = require('discord.js');
const mongoose = require('mongoose');

const bdayWizard = new Map(); // `${userId}_${guildId}` → wizard session

// ─── Schemas ─────────────────────────────────────────────────────────────────

const BirthdayConfigSchema = new mongoose.Schema({
  guildId: { type: String, unique: true, required: true },
  channelId: { type: String, default: null },
  roleId: { type: String, default: null },
  announcementTemplate: { type: String, default: '{mentions} 🎂 Happy Birthday! 🎉' },
  announcementTime: { type: String, default: '09:00' },
  enabled: { type: Boolean, default: true },
});

const BirthdayEntrySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  day: { type: Number, required: true, min: 1, max: 31 },
  year: { type: Number, default: null },
  timezone: { type: String, default: 'UTC' },
  createdAt: { type: Date, default: Date.now },
});

BirthdayEntrySchema.index({ userId: 1, guildId: 1 }, { unique: true });

const BirthdayConfig =
  mongoose.models.BirthdayConfig || mongoose.model('BirthdayConfig', BirthdayConfigSchema);
const BirthdayEntry =
  mongoose.models.BirthdayEntry || mongoose.model('BirthdayEntry', BirthdayEntrySchema);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isValidBirthday(month, day) {
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  return day <= MONTH_DAYS[month - 1];
}

function daysUntilBirthday(month, day) {
  const now = new Date();
  const year = now.getUTCFullYear();
  let next = new Date(Date.UTC(year, month - 1, day));
  if (next < now) next = new Date(Date.UTC(year + 1, month - 1, day));
  const diff = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
  return diff;
}

function getAge(birthYear, month, day) {
  const now = new Date();
  const year = now.getUTCFullYear();
  let age = year - birthYear;
  const birthdayThisYear = new Date(Date.UTC(year, month - 1, day));
  if (birthdayThisYear > now) age -= 1;
  return age;
}

function utcHHMM() {
  const now = new Date();
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function todayUTCMonthDay() {
  const now = new Date();
  return { month: now.getUTCMonth() + 1, day: now.getUTCDate() };
}

function buildAnnouncementEmbed(entries, members, config) {
  const mentionList = entries
    .map((e) => `<@${e.userId}>`)
    .join(', ');

  const description = config.announcementTemplate.replace('{mentions}', mentionList);

  const celebratingField = entries
    .map((e) => {
      const member = members.find((m) => m.id === e.userId);
      const name = member ? member.displayName : `<@${e.userId}>`;
      const agePart = e.year ? ` (turning ${getAge(e.year, e.month, e.day)})` : '';
      return `• ${name}${agePart}`;
    })
    .join('\n');

  const firstMember = members.find((m) => m.id === entries[0]?.userId);
  const thumbnailURL = firstMember?.displayAvatarURL({ dynamic: true }) ?? null;

  const embed = new EmbedBuilder()
    .setColor('#FF69B4')
    .setTitle('🎂 Birthday Alert!')
    .setDescription(description)
    .addFields({ name: 'Celebrating Today', value: celebratingField || 'No one' })
    .setTimestamp();

  if (thumbnailURL) embed.setThumbnail(thumbnailURL);
  return embed;
}

async function runBirthdayAnnouncement(guild, config, client) {
  if (!config.enabled || !config.channelId) return;

  const channel = guild.channels.cache.get(config.channelId);
  if (!channel) return;

  const { month, day } = todayUTCMonthDay();
  const entries = await BirthdayEntry.find({ guildId: guild.id, month, day });
  if (!entries.length) return;

  const members = (
    await Promise.all(
      entries.map((e) => guild.members.fetch(e.userId).catch(() => null))
    )
  ).filter(Boolean);

  if (!members.length) return;

  const embed = buildAnnouncementEmbed(entries, members, config);
  await channel.send({ embeds: [embed] }).catch(() => null);

  if (config.roleId) {
    for (const member of members) {
      await member.roles.add(config.roleId).catch(() => null);
      setTimeout(async () => {
        const freshMember = await guild.members.fetch(member.id).catch(() => null);
        if (freshMember) await freshMember.roles.remove(config.roleId).catch(() => null);
      }, 24 * 60 * 60 * 1000);
    }
  }
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

function startScheduler(client) {
  if (global.__birthdayScheduler) return;
  global.__birthdayScheduler = true;
  global.__birthdayAnnounced = global.__birthdayAnnounced || new Set();

  let lastMidnightDate = new Date().toISOString().slice(0, 10);

  setInterval(async () => {
    const nowDate = new Date().toISOString().slice(0, 10);
    if (nowDate !== lastMidnightDate) {
      global.__birthdayAnnounced.clear();
      lastMidnightDate = nowDate;
    }

    const currentTime = utcHHMM();
    const { month, day } = todayUTCMonthDay();
    const year = new Date().getUTCFullYear();

    let configs;
    try {
      configs = await BirthdayConfig.find({ enabled: true });
    } catch {
      return;
    }

    for (const config of configs) {
      if (config.announcementTime !== currentTime) continue;
      const key = `${config.guildId}_${year}_${month}_${day}`;
      if (global.__birthdayAnnounced.has(key)) continue;

      const guild = client.guilds.cache.get(config.guildId);
      if (!guild) continue;

      global.__birthdayAnnounced.add(key);
      await runBirthdayAnnouncement(guild, config, client).catch(() => null);
    }
  }, 60 * 1000);
}

// ─── Command Definition ───────────────────────────────────────────────────────

const data = new SlashCommandBuilder()
  .setName('birthdays')
  .setDescription('Birthday management')
  // set
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set your birthday')
      .addIntegerOption((o) =>
        o.setName('month').setDescription('Month (1–12)').setRequired(true).setMinValue(1).setMaxValue(12)
      )
      .addIntegerOption((o) =>
        o.setName('day').setDescription('Day (1–31)').setRequired(true).setMinValue(1).setMaxValue(31)
      )
      .addIntegerOption((o) =>
        o.setName('year').setDescription('Year (optional, for age display)').setRequired(false)
      )
      .addStringOption((o) =>
        o.setName('timezone').setDescription('Timezone e.g. UTC+5 or UTC-8').setRequired(false)
      )
  )
  // remove
  .addSubcommand((sub) =>
    sub.setName('remove').setDescription('Remove your birthday')
  )
  // check
  .addSubcommand((sub) =>
    sub
      .setName('check')
      .setDescription('Check a birthday')
      .addUserOption((o) =>
        o.setName('user').setDescription('User to check (defaults to yourself)').setRequired(false)
      )
  )
  // today
  .addSubcommand((sub) =>
    sub.setName('today').setDescription("Show all birthdays today in this server")
  )
  // upcoming
  .addSubcommand((sub) =>
    sub
      .setName('upcoming')
      .setDescription('Show upcoming birthdays')
      .addIntegerOption((o) =>
        o
          .setName('days')
          .setDescription('Number of days ahead (1–365, default 30)')
          .setRequired(false)
          .setMinValue(1)
          .setMaxValue(365)
      )
  )
  // list
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all members with a birthday set')
  )
  // config
  .addSubcommand((sub) =>
    sub
      .setName('config')
      .setDescription('Show current birthday module configuration (staff only)')
  )
  // set-channel
  .addSubcommand((sub) =>
    sub
      .setName('set-channel')
      .setDescription('Set the birthday announcement channel (staff only)')
      .addChannelOption((o) =>
        o
          .setName('channel')
          .setDescription('Channel for announcements')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  // set-role
  .addSubcommand((sub) =>
    sub
      .setName('set-role')
      .setDescription('Set the birthday role (staff only)')
      .addRoleOption((o) =>
        o.setName('role').setDescription('Role to grant on birthday').setRequired(true)
      )
  )
  // set-time
  .addSubcommand((sub) =>
    sub
      .setName('set-time')
      .setDescription('Set the UTC announcement time, e.g. "09:00" (staff only)')
      .addStringOption((o) =>
        o.setName('time').setDescription('Time in HH:MM UTC format').setRequired(true)
      )
  )
  // toggle
  .addSubcommand((sub) =>
    sub.setName('toggle').setDescription('Enable or disable the birthday module (staff only)')
  )
  // test
  .addSubcommand((sub) =>
    sub.setName('test').setDescription('Test the birthday announcement for yourself right now (staff only)')
  );

// ─── Execute ─────────────────────────────────────────────────────────────────

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const { guild, user, member } = interaction;
  const isStaff = member.permissions.has(PermissionFlagsBits.ManageGuild);

  // ── staff-only guard ──────────────────────────────────────────────────────
  const staffOnly = ['config', 'set-channel', 'set-role', 'set-time', 'toggle', 'test'];
  if (staffOnly.includes(sub) && !isStaff) {
    return interaction.reply({
      content: '❌ You need the **Manage Server** permission to use this subcommand.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: ['set', 'remove', 'config', 'set-channel', 'set-role', 'set-time', 'toggle', 'test'].includes(sub) });

  // ── set ───────────────────────────────────────────────────────────────────
  if (sub === 'set') {
    const month = interaction.options.getInteger('month');
    const day = interaction.options.getInteger('day');
    const year = interaction.options.getInteger('year') ?? null;
    const timezone = interaction.options.getString('timezone') ?? 'UTC';

    if (!isValidBirthday(month, day)) {
      return interaction.editReply('❌ That date is invalid (e.g. February 30 doesn\'t exist).');
    }

    if (year !== null) {
      const minYear = new Date().getUTCFullYear() - 120;
      const maxYear = new Date().getUTCFullYear() - 1;
      if (year < minYear || year > maxYear) {
        return interaction.editReply(`❌ Year must be between ${minYear} and ${maxYear}.`);
      }
    }

    await BirthdayEntry.findOneAndUpdate(
      { userId: user.id, guildId: guild.id },
      { userId: user.id, guildId: guild.id, month, day, year, timezone, createdAt: new Date() },
      { upsert: true, new: true }
    );

    return interaction.editReply(
      `✅ Birthday set to **${MONTH_NAMES[month - 1]} ${day}${year ? `, ${year}` : ''}** (${timezone}).`
    );
  }

  // ── remove ────────────────────────────────────────────────────────────────
  if (sub === 'remove') {
    const deleted = await BirthdayEntry.findOneAndDelete({ userId: user.id, guildId: guild.id });
    if (!deleted) return interaction.editReply('❌ You don\'t have a birthday set.');
    return interaction.editReply('✅ Your birthday has been removed.');
  }

  // ── check ─────────────────────────────────────────────────────────────────
  if (sub === 'check') {
    const target = interaction.options.getUser('user') ?? user;
    const entry = await BirthdayEntry.findOne({ userId: target.id, guildId: guild.id });

    if (!entry) {
      return interaction.editReply(
        target.id === user.id
          ? '❌ You haven\'t set a birthday.'
          : `❌ ${target.username} hasn\'t set a birthday.`
      );
    }

    const monthName = MONTH_NAMES[entry.month - 1];
    const untilDays = daysUntilBirthday(entry.month, entry.day);
    const ageLine = entry.year
      ? `\n**Current age:** ${getAge(entry.year, entry.month, entry.day)}`
      : '';

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setTitle(`🎂 ${target.username}'s Birthday`)
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `**Date:** ${monthName} ${entry.day}${entry.year ? `, ${entry.year}` : ''}${ageLine}\n**Timezone:** ${entry.timezone}\n**Days until next birthday:** ${untilDays === 0 ? '🎉 Today!' : `${untilDays} day(s)`}`
      );

    return interaction.editReply({ embeds: [embed] });
  }

  // ── today ─────────────────────────────────────────────────────────────────
  if (sub === 'today') {
    const { month, day } = todayUTCMonthDay();
    const entries = await BirthdayEntry.find({ guildId: guild.id, month, day });

    if (!entries.length) {
      return interaction.editReply('No birthdays today! 😔');
    }

    const lines = await Promise.all(
      entries.map(async (e) => {
        const m = await guild.members.fetch(e.userId).catch(() => null);
        const name = m ? m.displayName : `<@${e.userId}>`;
        const agePart = e.year ? ` (turning ${getAge(e.year, e.month, e.day)})` : '';
        return `• ${name}${agePart}`;
      })
    );

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setTitle(`🎂 Birthdays Today — ${MONTH_NAMES[month - 1]} ${day}`)
      .setDescription(lines.join('\n'));

    return interaction.editReply({ embeds: [embed] });
  }

  // ── upcoming ──────────────────────────────────────────────────────────────
  if (sub === 'upcoming') {
    const days = interaction.options.getInteger('days') ?? 30;
    const allEntries = await BirthdayEntry.find({ guildId: guild.id });

    const now = new Date();
    const withDays = allEntries
      .map((e) => {
        const d = daysUntilBirthday(e.month, e.day);
        return { entry: e, daysUntil: d };
      })
      .filter(({ daysUntil }) => daysUntil > 0 && daysUntil <= days)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    if (!withDays.length) {
      return interaction.editReply(`No upcoming birthdays in the next ${days} day(s).`);
    }

    const lines = await Promise.all(
      withDays.map(async ({ entry, daysUntil }) => {
        const m = await guild.members.fetch(entry.userId).catch(() => null);
        const name = m ? m.displayName : `<@${entry.userId}>`;
        const date = `${MONTH_NAMES[entry.month - 1]} ${entry.day}`;
        return `• **${name}** — ${date} (in ${daysUntil} day${daysUntil === 1 ? '' : 's'})`;
      })
    );

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setTitle(`🎂 Upcoming Birthdays (next ${days} days)`)
      .setDescription(lines.join('\n'));

    return interaction.editReply({ embeds: [embed] });
  }

  // ── list ──────────────────────────────────────────────────────────────────
  if (sub === 'list') {
    const allEntries = await BirthdayEntry.find({ guildId: guild.id });

    if (!allEntries.length) {
      return interaction.editReply('No members have set a birthday yet.');
    }

    const sorted = allEntries.sort((a, b) =>
      a.month !== b.month ? a.month - b.month : a.day - b.day
    );

    const lines = await Promise.all(
      sorted.map(async (e) => {
        const m = await guild.members.fetch(e.userId).catch(() => null);
        const name = m ? m.displayName : `<@${e.userId}>`;
        return `• **${name}** — ${MONTH_NAMES[e.month - 1]} ${e.day}`;
      })
    );

    // Embed descriptions cap at 4096 chars — chunk conservatively and show
    // everyone across multiple embeds rather than silently dropping names.
    const chunks = [];
    let current = [];
    let currentLen = 0;
    for (const line of lines) {
      if (currentLen + line.length + 1 > 3800 || current.length >= 40) {
        chunks.push(current.join('\n'));
        current = [];
        currentLen = 0;
      }
      current.push(line);
      currentLen += line.length + 1;
    }
    if (current.length) chunks.push(current.join('\n'));

    const embeds = chunks.map((desc, i) =>
      new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle(
          chunks.length > 1
            ? `🎂 Birthday List — ${guild.name} (${i + 1}/${chunks.length})`
            : `🎂 Birthday List — ${guild.name}`
        )
        .setDescription(desc)
    );

    // Discord allows up to 10 embeds per message.
    return interaction.editReply({ embeds: embeds.slice(0, 10) });
  }

  // ── config ────────────────────────────────────────────────────────────────
  if (sub === 'config') {
    // Wizard: step 1 — pick announcement channel
    bdayWizard.set(`${interaction.user.id}_${guild.id}`, {});

    const embed = new EmbedBuilder()
      .setTitle('🎂 Birthday Setup — Step 1 / 3')
      .setColor('#FF69B4')
      .setDescription('Select the **announcement channel** where birthday messages will be posted.\n\nTip: use `/birthdays set-channel #channel` to set the channel directly.');

    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId('birthday_wizard_ch')
        .setPlaceholder('Choose an announcement channel...')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    );
    return interaction.editReply({ embeds: [embed], components: [row] });
  }

  // ── set-channel ───────────────────────────────────────────────────────────
  if (sub === 'set-channel') {
    const channel = interaction.options.getChannel('channel');

    await BirthdayConfig.findOneAndUpdate(
      { guildId: guild.id },
      { channelId: channel.id },
      { upsert: true, new: true }
    );

    return interaction.editReply(`✅ Birthday announcements will be posted in ${channel}.`);
  }

  // ── set-role ──────────────────────────────────────────────────────────────
  if (sub === 'set-role') {
    const role = interaction.options.getRole('role');

    await BirthdayConfig.findOneAndUpdate(
      { guildId: guild.id },
      { roleId: role.id },
      { upsert: true, new: true }
    );

    return interaction.editReply(`✅ Birthday role set to **${role.name}**.`);
  }

  // ── set-time ──────────────────────────────────────────────────────────────
  if (sub === 'set-time') {
    const time = interaction.options.getString('time');
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (!timeRegex.test(time)) {
      return interaction.editReply('❌ Invalid time format. Use HH:MM (e.g. `09:00`).');
    }

    await BirthdayConfig.findOneAndUpdate(
      { guildId: guild.id },
      { announcementTime: time },
      { upsert: true, new: true }
    );

    return interaction.editReply(`✅ Birthday announcements will fire at **${time} UTC** daily.`);
  }

  // ── toggle ────────────────────────────────────────────────────────────────
  if (sub === 'toggle') {
    const existing = await BirthdayConfig.findOne({ guildId: guild.id });
    const newState = existing ? !existing.enabled : false;

    await BirthdayConfig.findOneAndUpdate(
      { guildId: guild.id },
      { enabled: newState },
      { upsert: true, new: true }
    );

    return interaction.editReply(`✅ Birthday module is now **${newState ? 'enabled' : 'disabled'}**.`);
  }

  // ── test ──────────────────────────────────────────────────────────────────
  if (sub === 'test') {
    const config = await BirthdayConfig.findOne({ guildId: guild.id });
    if (!config || !config.channelId) {
      return interaction.editReply('❌ No announcement channel configured. Use `/birthdays set-channel` first.');
    }

    const channel = guild.channels.cache.get(config.channelId);
    if (!channel) {
      return interaction.editReply('❌ Configured channel not found.');
    }

    const fakeEntry = {
      userId: user.id,
      month: new Date().getUTCMonth() + 1,
      day: new Date().getUTCDate(),
      year: null,
    };

    const fakeConfig = { ...config.toObject(), enabled: true };
    const embed = buildAnnouncementEmbed([fakeEntry], [member], fakeConfig);

    await channel.send({ embeds: [embed] }).catch(() => null);
    return interaction.editReply(`✅ Test announcement sent to <#${config.channelId}>.`);
  }
}

// ─── Wizard Interaction Handler ───────────────────────────────────────────────

async function handleInteraction(interaction, client) {
  const id  = interaction.customId;
  const key = `${interaction.user.id}_${interaction.guildId}`;

  if (id === 'birthday_wizard_ch') {
    const channelId = interaction.values[0];
    bdayWizard.set(key, { channelId });

    const roles = interaction.guild.roles.cache
      .filter(r => !r.managed && r.id !== interaction.guild.id)
      .first(23);

    const options = [{ label: '⏩ Skip (no birthday role)', value: 'skip' }];
    for (const r of roles) options.push({ label: `@${r.name}`.slice(0, 90), value: r.id });

    const embed = new EmbedBuilder()
      .setTitle('🎂 Birthday Setup — Step 2 / 3')
      .setColor('#FF69B4')
      .setDescription(`Channel: <#${channelId}>\n\nOptionally pick a **birthday role** — granted on the member's birthday, removed the next day.`);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('birthday_wizard_role')
        .setPlaceholder('Choose a role or skip...')
        .addOptions(options)
    );
    return interaction.update({ embeds: [embed], components: [row] }).catch(() => null);
  }

  if (id === 'birthday_wizard_role') {
    const session = bdayWizard.get(key) || {};
    session.roleId = interaction.values[0] === 'skip' ? null : interaction.values[0];
    bdayWizard.set(key, session);

    const embed = new EmbedBuilder()
      .setTitle('🎂 Birthday Setup — Step 3 / 3')
      .setColor('#FF69B4')
      .setDescription(`Channel: <#${session.channelId}> · Role: ${session.roleId ? `<@&${session.roleId}>` : 'None'}\n\nWhat **time (UTC)** should birthday announcements be sent each day?`);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('birthday_wizard_time')
        .setPlaceholder('Choose announcement time (UTC)...')
        .addOptions([
          { label: '00:00 midnight',      value: '00:00' },
          { label: '06:00 early morning', value: '06:00' },
          { label: '08:00 morning',       value: '08:00' },
          { label: '09:00 morning',       value: '09:00' },
          { label: '12:00 noon',          value: '12:00' },
          { label: '17:00 afternoon',     value: '17:00' },
          { label: '18:00 evening',       value: '18:00' },
          { label: '20:00 night',         value: '20:00' },
        ])
    );
    return interaction.update({ embeds: [embed], components: [row] }).catch(() => null);
  }

  if (id === 'birthday_wizard_time') {
    const session = bdayWizard.get(key) || {};
    session.announcementTime = interaction.values[0];
    bdayWizard.delete(key);

    await BirthdayConfig.findOneAndUpdate(
      { guildId: interaction.guildId },
      { channelId: session.channelId, roleId: session.roleId, announcementTime: session.announcementTime, enabled: true },
      { upsert: true, new: true }
    ).catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle('✅ Birthday Module Active!')
      .setColor('#FF69B4')
      .setDescription('Setup complete! The bot will now announce birthdays daily.')
      .addFields(
        { name: 'Channel',    value: `<#${session.channelId}>`,                              inline: true },
        { name: 'Role',       value: session.roleId ? `<@&${session.roleId}>` : 'None',      inline: true },
        { name: 'Time (UTC)', value: session.announcementTime,                               inline: true },
        { name: 'Next Steps', value: '• Members: `/birthdays set` or `|birthdays set`\n• View upcoming: `/birthdays upcoming`\n• `/birthdays set-time` to adjust time\n• `/birthdays toggle` to pause/resume' }
      );
    return interaction.update({ embeds: [embed], components: [] }).catch(() => null);
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = { data, name: 'birthdays', execute, startScheduler, handleInteraction };