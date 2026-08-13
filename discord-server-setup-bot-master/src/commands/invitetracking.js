const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelType } = require('discord.js');
const mongoose = require('mongoose');

const inviteConfigSchema = new mongoose.Schema({
  guildId: { type: String, unique: true, required: true },
  channelId: { type: String, default: null },
  enabled: { type: Boolean, default: true },
  fakeThreshold: { type: Number, default: 7 },
});

const inviteRecordSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  inviterId: { type: String, required: true },
  joins: { type: Number, default: 0 },
  leaves: { type: Number, default: 0 },
  fake: { type: Number, default: 0 },
  bonusInvites: { type: Number, default: 0 },
});
inviteRecordSchema.index({ guildId: 1, inviterId: 1 }, { unique: true });

const inviteJoinSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  inviterId: { type: String, default: null },
  inviteCode: { type: String, default: null },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
  isFake: { type: Boolean, default: false },
});

const InviteConfig = mongoose.models.InviteConfig || mongoose.model('InviteConfig', inviteConfigSchema);
const InviteRecord = mongoose.models.InviteRecord || mongoose.model('InviteRecord', inviteRecordSchema);
const InviteJoin = mongoose.models.InviteJoin || mongoose.model('InviteJoin', inviteJoinSchema);

const inviteCache = new Map();
const inviteWizard = new Map();

function netInvites(record) {
  return (record.joins || 0) - (record.leaves || 0) - (record.fake || 0) + (record.bonusInvites || 0);
}

async function postLogEmbed(guild, channelId, embed) {
  if (!channelId) return;
  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;
  await channel.send({ embeds: [embed] }).catch(() => null);
}

async function safeEditReply(interaction, payload) {
  try {
    if (interaction.deferred || interaction.replied) {
      return await interaction.editReply(payload);
    }
    return await interaction.reply(payload);
  } catch {
    try {
      await interaction.followUp(payload).catch(() => null);
    } catch {}
  }
}

async function handleMemberJoin(member, client) {
  const { guild } = member;
  const config = await InviteConfig.findOne({ guildId: guild.id }).catch(() => null);
  if (!config || !config.enabled) return;

  const cachedGuild = inviteCache.get(guild.id) ?? new Map();
  const freshInvites = await guild.invites.fetch().catch(() => null);
  if (!freshInvites) return;

  let usedCode = null;
  let inviterId = null;

  for (const [code, freshInvite] of freshInvites) {
    const cached = cachedGuild.get(code);
    if (cached && freshInvite.uses > cached.uses) {
      usedCode = code;
      inviterId = freshInvite.inviter?.id ?? cached.inviterId ?? null;
      break;
    }
    if (!cached) {
      usedCode = code;
      inviterId = freshInvite.inviter?.id ?? null;
      break;
    }
  }

  const newGuildMap = new Map();
  for (const invite of freshInvites.values()) {
    newGuildMap.set(invite.code, {
      uses: invite.uses ?? 0,
      inviterId: invite.inviter?.id ?? null,
      maxUses: invite.maxUses ?? 0,
      expiresAt: invite.expiresAt ?? null,
    });
  }
  inviteCache.set(guild.id, newGuildMap);

  const accountAgeMs = Date.now() - member.user.createdTimestamp;
  const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));
  const isFake = accountAgeDays < (config.fakeThreshold ?? 7);

  // Captures the updated record (upserted if this is the inviter's first
  // credited join) so the log can show their new invite count immediately,
  // not just "a join happened."
  let inviterRecord = null;
  if (inviterId) {
    inviterRecord = await InviteRecord.findOneAndUpdate(
      { guildId: guild.id, inviterId },
      { $inc: { joins: 1, fake: isFake ? 1 : 0 }, $set: { inviteCode: usedCode } },
      { upsert: true, new: true }
    ).catch(() => null);
  }

  await InviteJoin.create({
    guildId: guild.id,
    userId: member.id,
    inviterId,
    inviteCode: usedCode,
    isFake,
  }).catch(() => null);

  const inviterMention = inviterId ? `<@${inviterId}>` : 'Unknown';
  const codeStr = usedCode ?? 'Unknown';
  const usedInvite = usedCode ? newGuildMap.get(usedCode) : null;
  const totalUses = usedInvite ? usedInvite.uses : '?';
  const maxUses = usedInvite?.maxUses;
  const inviterNet = inviterRecord ? netInvites(inviterRecord) : null;

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('👋 Member Joined')
    .setDescription(`${member} joined using ${inviterMention}'s invite (\`${codeStr}\`)`)
    .addFields(
      { name: 'Invite Code', value: `\`${codeStr}\``, inline: true },
      { name: 'Invite Uses', value: `${totalUses}${maxUses ? ` / ${maxUses}` : ''}`, inline: true },
      { name: 'Inviter', value: inviterMention, inline: true },
      { name: "Inviter's Net Invites", value: inviterNet === null ? 'N/A' : String(inviterNet), inline: true },
      { name: 'Account Age', value: `${accountAgeDays} day${accountAgeDays === 1 ? '' : 's'}`, inline: true },
      { name: 'Is Fake', value: isFake ? '⚠️ Yes' : '✅ No', inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  await postLogEmbed(guild, config.channelId, embed);
}

async function handleMemberLeave(member, client) {
  const { guild } = member;
  const config = await InviteConfig.findOne({ guildId: guild.id }).catch(() => null);
  if (!config || !config.enabled) return;

  const joinRecord = await InviteJoin.findOneAndUpdate(
    { guildId: guild.id, userId: member.id, leftAt: null },
    { leftAt: new Date() },
    { sort: { joinedAt: -1 }, new: false }
  ).catch(() => null);

  // Same as the join log: capture the updated record so the log shows the
  // inviter's new (decremented) count right away, not just "they lost one."
  let inviterRecord = null;
  if (joinRecord?.inviterId) {
    inviterRecord = await InviteRecord.findOneAndUpdate(
      { guildId: guild.id, inviterId: joinRecord.inviterId },
      { $inc: { leaves: 1 } },
      { new: true }
    ).catch(() => null);
  }

  const inviterMention = joinRecord?.inviterId ? `<@${joinRecord.inviterId}>` : 'Unknown';
  const codeStr = joinRecord?.inviteCode ?? 'Unknown';
  const inviterNet = inviterRecord ? netInvites(inviterRecord) : null;

  const embed = new EmbedBuilder()
    .setColor(0x99aab5)
    .setTitle('👋 Member Left')
    .setDescription(`**${member.user.tag}** left. They had joined using ${inviterMention}'s invite (\`${codeStr}\`).`)
    .addFields(
      { name: 'Invite Code', value: `\`${codeStr}\``, inline: true },
      { name: 'Inviter', value: inviterMention, inline: true },
      { name: "Inviter's Net Invites", value: inviterNet === null ? 'N/A' : String(inviterNet), inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
    .setTimestamp();

  await postLogEmbed(guild, config.channelId, embed);
}

function handleInviteCreate(invite) {
  const { guild, code, inviter, uses, maxUses, expiresAt } = invite;
  if (!guild) return;
  
  if (!inviteCache.has(guild.id)) inviteCache.set(guild.id, new Map());
  inviteCache.get(guild.id).set(code, {
    uses: uses ?? 0,
    inviterId: inviter?.id ?? null,
    maxUses: maxUses ?? 0,
    expiresAt: expiresAt ?? null,
  });
}

function handleInviteDelete(invite) {
  const { guild, code } = invite;
  if (!guild) return;
  inviteCache.get(guild.id)?.delete(code);
}

const data = new SlashCommandBuilder()
  .setName('invites')
  .setDescription('Advanced invite tracking system')
  .addSubcommand((sub) => sub
    .setName('check')
    .setDescription('Check invite stats for a user')
    .addUserOption((o) => o.setName('user').setDescription('User to check (defaults to yourself)').setRequired(false))
  )
  .addSubcommand((sub) => sub.setName('leaderboard').setDescription('Top 10 inviters by net invites'))
  .addSubcommand((sub) => sub
    .setName('reset')
    .setDescription('Reset invite counts (staff only)')
    .addUserOption((o) => o.setName('user').setDescription('User to reset (omit to reset all)').setRequired(false))
  )
  .addSubcommand((sub) => sub
    .setName('config')
    .setDescription('Set the invite log channel (staff only)')
    .addChannelOption((o) => o.setName('channel').setDescription('Channel for join logs (omit for setup wizard)').addChannelTypes(ChannelType.GuildText).setRequired(false))
  )
  .addSubcommand((sub) => sub
    .setName('add')
    .setDescription('Add bonus invites to a user (staff only)')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption((o) => o.setName('count').setDescription('Number of bonus invites to add').setRequired(true).setMinValue(1))
  )
  .addSubcommand((sub) => sub
    .setName('remove')
    .setDescription('Remove invites from a user (staff only)')
    .addUserOption((o) => o.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption((o) => o.setName('count').setDescription('Number of invites to remove').setRequired(true).setMinValue(1))
  )
  .addSubcommand((sub) => sub.setName('toggle').setDescription('Enable or disable invite tracking (staff only)'))
  .addSubcommand((sub) => sub.setName('stats').setDescription('Server-wide invite statistics (staff only)'))
  .addSubcommand((sub) => sub
    .setName('code')
    .setDescription('Look up a specific invite code (staff only)')
    .addStringOption((o) => o.setName('code').setDescription('The invite code').setRequired(true))
  )
  .addSubcommand((sub) => sub
    .setName('fake-threshold')
    .setDescription('Set the account age (days) for "fake" detection (staff only)')
    .addIntegerOption((o) => o
      .setName('threshold')
      .setDescription('Minimum account age in days (default 7)')
      .setRequired(true)
      .setMinValue(0)
    )
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  const { guild, user, member } = interaction;
  const isStaff = member?.permissions?.has(PermissionFlagsBits.ManageGuild) ?? false;

  const staffOnly = ['reset', 'config', 'add', 'remove', 'toggle', 'stats', 'code', 'fake-threshold'];
  if (staffOnly.includes(sub) && !isStaff) {
    return interaction.reply({ content: '❌ You need the **Manage Server** permission to use this subcommand.', ephemeral: true }).catch(() => null);
  }

  const ephemeralSubs = ['reset', 'config', 'add', 'remove', 'toggle', 'fake-threshold'];
  await interaction.deferReply({ ephemeral: ephemeralSubs.includes(sub) }).catch(() => null);

  try {
    if (sub === 'check') {
      const targetUser = interaction.options.getUser('user') ?? user;
      
      if (targetUser.id !== user.id && !isStaff) {
        return safeEditReply(interaction, { content: '❌ You need **Manage Server** to check another user\'s stats.' });
      }

      const record = await InviteRecord.findOne({ guildId: guild.id, inviterId: targetUser.id }).catch(() => null);
      const net = record ? netInvites(record) : 0;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📬 Invite Stats — ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'Total Joins', value: String(record?.joins ?? 0), inline: true },
          { name: 'Leaves', value: String(record?.leaves ?? 0), inline: true },
          { name: 'Fake', value: String(record?.fake ?? 0), inline: true },
          { name: 'Bonus', value: String(record?.bonusInvites ?? 0), inline: true },
          { name: 'Net Invites', value: String(net), inline: true }
        );

      if (isStaff && record?.inviteCode) {
        embed.addFields({ name: 'Primary Invite Code', value: `\`${record.inviteCode}\``, inline: true });
      }

      return safeEditReply(interaction, { embeds: [embed] });
    }

    if (sub === 'leaderboard') {
      const records = await InviteRecord.find({ guildId: guild.id }).catch(() => null);
      
      if (!records || !records.length) {
        return safeEditReply(interaction, { content: 'No invite data for this server yet.' });
      }

      const sorted = records
        .map((r) => ({ ...r.toObject(), net: netInvites(r) }))
        .sort((a, b) => b.net - a.net)
        .slice(0, 10);

      const lines = sorted.map((r, i) => `**${i + 1}.** <@${r.inviterId}> — **${r.net}** net invite${r.net === 1 ? '' : 's'} (${r.joins} joins, ${r.leaves} left, ${r.fake} fake)`);
      
      const embed = new EmbedBuilder()
        .setColor(0xfaa61a)
        .setTitle('🏆 Invite Leaderboard')
        .setDescription(lines.join('\n'));

      return safeEditReply(interaction, { embeds: [embed] });
    }

    if (sub === 'reset') {
      const targetUser = interaction.options.getUser('user');
      
      if (targetUser) {
        await InviteRecord.findOneAndUpdate(
          { guildId: guild.id, inviterId: targetUser.id },
          { joins: 0, leaves: 0, fake: 0, bonusInvites: 0 }
        ).catch(() => null);
        return safeEditReply(interaction, { content: `✅ Reset invite counts for ${targetUser.username}.` });
      } else {
        await InviteRecord.updateMany({ guildId: guild.id }, { joins: 0, leaves: 0, fake: 0, bonusInvites: 0 }).catch(() => null);
        return safeEditReply(interaction, { content: '✅ Reset all invite counts for this server.' });
      }
    }

    if (sub === 'config') {
      const direct = interaction.options?.getChannel?.('channel');
      if (direct) {
        await InviteConfig.findOneAndUpdate(
          { guildId: guild.id },
          { channelId: direct.id },
          { upsert: true, new: true }
        ).catch(() => null);
        return safeEditReply(interaction, { content: `✅ Invite join logs will be posted in ${direct}.` });
      }

      const channels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).first(24);
      if (!channels.length) return safeEditReply(interaction, { content: '❌ No text channels found.' });

      inviteWizard.set(`${interaction.user.id}_${guild.id}`, {});
      const embed = new EmbedBuilder()
        .setTitle('📨 Invite Tracking Setup — Step 1 / 2')
        .setColor('#3498DB')
        .setDescription('Select the **log channel** where join/leave events will be posted.\n\nTip: `/invites config #channel` to skip this wizard.');
      
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('invites_wizard_ch')
          .setPlaceholder('Choose a log channel...')
          .addOptions(channels.map(c => ({ 
            label: `#${c.name}`.slice(0, 90), 
            value: c.id, 
            description: (c.topic || 'Text channel').slice(0, 90) 
          })))
      );
      return safeEditReply(interaction, { embeds: [embed], components: [row] });
    }

    if (sub === 'add') {
      const targetUser = interaction.options.getUser('user');
      const count = interaction.options.getInteger('count');
      
      const record = await InviteRecord.findOneAndUpdate(
        { guildId: guild.id, inviterId: targetUser.id },
        { $inc: { bonusInvites: count } },
        { upsert: true, new: true }
      ).catch(() => null);

      if (!record) return safeEditReply(interaction, { content: '❌ Failed to update invite counts.' });
      return safeEditReply(interaction, { content: `✅ Added **${count}** bonus invite${count === 1 ? '' : 's'} to ${targetUser.username}. They now have **${netInvites(record)}** net invites.` });
    }

    if (sub === 'remove') {
      const targetUser = interaction.options.getUser('user');
      const count = interaction.options.getInteger('count');
      
      const record = await InviteRecord.findOneAndUpdate(
        { guildId: guild.id, inviterId: targetUser.id },
        { $inc: { bonusInvites: -count } },
        { upsert: true, new: true }
      ).catch(() => null);

      if (!record) return safeEditReply(interaction, { content: '❌ Failed to update invite counts.' });
      return safeEditReply(interaction, { content: `✅ Removed **${count}** invite${count === 1 ? '' : 's'} from ${targetUser.username}. They now have **${netInvites(record)}** net invites.` });
    }

    if (sub === 'toggle') {
      const existing = await InviteConfig.findOne({ guildId: guild.id }).catch(() => null);
      const newState = existing ? !existing.enabled : true;
      
      await InviteConfig.findOneAndUpdate(
        { guildId: guild.id },
        { enabled: newState },
        { upsert: true, new: true }
      ).catch(() => null);

      return safeEditReply(interaction, { content: `✅ Invite tracking is now **${newState ? 'enabled' : 'disabled'}**.` });
    }

    if (sub === 'stats') {
      const records = await InviteRecord.find({ guildId: guild.id }).catch(() => null);
      const safeRecords = records || [];
      const totalJoins = safeRecords.reduce((acc, r) => acc + r.joins, 0);
      const totalLeaves = safeRecords.reduce((acc, r) => acc + r.leaves, 0);
      const totalFake = safeRecords.reduce((acc, r) => acc + r.fake, 0);
      const totalBonus = safeRecords.reduce((acc, r) => acc + r.bonusInvites, 0);
      const uniqueInviters = safeRecords.length;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📊 Server Invite Stats — ${guild.name}`)
        .addFields(
          { name: 'Total Joins Tracked', value: String(totalJoins), inline: true },
          { name: 'Total Leaves', value: String(totalLeaves), inline: true },
          { name: 'Fake Joins', value: String(totalFake), inline: true },
          { name: 'Bonus Invites Given', value: String(totalBonus), inline: true },
          { name: 'Unique Inviters', value: String(uniqueInviters), inline: true }
        );
      return safeEditReply(interaction, { embeds: [embed] });
    }

    if (sub === 'code') {
      const code = interaction.options.getString('code');
      const guildMap = inviteCache.get(guild.id);
      const cached = guildMap?.get(code);
      
      let liveInvite = null;
      try {
        liveInvite = await guild.invites.fetch(code).catch(() => null);
      } catch {}
      
      const inviteData = liveInvite ?? cached;
      if (!inviteData) {
        return safeEditReply(interaction, { content: `❌ No data found for invite code \`${code}\`.` });
      }

      const inviterId = liveInvite?.inviter?.id ?? cached?.inviterId ?? null;
      const uses = liveInvite?.uses ?? cached?.uses ?? '?';
      const maxUses = liveInvite?.maxUses ?? cached?.maxUses ?? '∞';
      const expiresAt = liveInvite?.expiresAt ?? cached?.expiresAt;

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🔗 Invite Code: \`${code}\``)
        .addFields(
          { name: 'Inviter', value: inviterId ? `<@${inviterId}>` : 'Unknown', inline: true },
          { name: 'Uses', value: String(uses), inline: true },
          { name: 'Max Uses', value: String(maxUses || '∞'), inline: true },
          { name: 'Expires', value: expiresAt ? `<t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>` : 'Never', inline: true }
        );
      return safeEditReply(interaction, { embeds: [embed] });
    }

    if (sub === 'fake-threshold') {
      const threshold = interaction.options.getInteger('threshold');
      await InviteConfig.findOneAndUpdate(
        { guildId: guild.id },
        { fakeThreshold: threshold },
        { upsert: true, new: true }
      ).catch(() => null);
      
      return safeEditReply(interaction, { content: `✅ Fake invite threshold set to **${threshold} day${threshold === 1 ? '' : 's'}**. Accounts newer than this are flagged as fake.` });
    }

    return safeEditReply(interaction, { content: '❌ Unknown subcommand.' });
  } catch (err) {
    console.error('[invites] execute error:', err);
    return safeEditReply(interaction, { content: '❌ An error occurred while processing your request.' });
  }
}

async function handleInteraction(interaction, client) {
  const id = interaction.customId;
  const key = `${interaction.user.id}_${interaction.guildId}`;

  try {
    if (id === 'invites_wizard_ch') {
      const channelId = interaction.values[0];
      inviteWizard.set(key, { channelId });

      const embed = new EmbedBuilder()
        .setTitle('📨 Invite Tracking Setup — Step 2 / 2')
        .setColor('#3498DB')
        .setDescription(`Log channel: <#${channelId}>\n\nChoose the **fake invite threshold** — accounts younger than this many days are flagged as fake joins.`);
      
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('invites_wizard_threshold')
          .setPlaceholder('Choose a fake-detection threshold...')
          .addOptions([
            { label: 'Disabled (no fake detection)', value: '0' },
            { label: '3 days', value: '3' },
            { label: '7 days (recommended)', value: '7' },
            { label: '14 days', value: '14' },
            { label: '30 days', value: '30' },
          ])
      );
      return interaction.update({ embeds: [embed], components: [row] }).catch(() => null);
    }

    if (id === 'invites_wizard_threshold') {
      const session = inviteWizard.get(key) || {};
      const threshold = parseInt(interaction.values[0], 10) || 0;
      inviteWizard.delete(key);

      await InviteConfig.findOneAndUpdate(
        { guildId: interaction.guildId },
        { channelId: session.channelId, fakeThreshold: threshold, enabled: true },
        { upsert: true, new: true }
      ).catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle('✅ Invite Tracking Active!')
        .setColor('#3498DB')
        .setDescription('Invite tracking is now enabled. Every join and leave will be logged.')
        .addFields(
          { name: 'Log Channel', value: `<#${session.channelId}>`, inline: true },
          { name: 'Fake Threshold', value: threshold ? `${threshold} days` : 'Disabled', inline: true },
          { name: 'Next Steps', value: '• `/invites leaderboard` — top inviters\n• `/invites check @user` — detailed stats\n• `/invites add @user 5` — bonus invites\n• `/invites toggle` — pause/resume' }
        );
      return interaction.update({ embeds: [embed], components: [] }).catch(() => null);
    }
  } catch (err) {
    console.error('[invites] handleInteraction error:', err);
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({ content: '❌ An error occurred during setup.', ephemeral: true }).catch(() => null);
    }
  }
}

module.exports = {
  data,
  name: 'invites',
  execute,
  handleInteraction,
  handleMemberJoin,
  handleMemberLeave,
  handleInviteCreate,
  handleInviteDelete,
  inviteCache,
};