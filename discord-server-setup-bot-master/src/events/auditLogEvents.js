const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AuditLogEvent } = require('discord.js');
const mongoose = require('mongoose');
const { isAuditLogsEnabled, resolveAuditLogChannel } = require('../utils/auditLog');

// ============================================================
// CONSOLIDATED AUDIT LOG EVENT HANDLERS
// All server activity logging lives here in one file.
// Each handler checks modLogsEnabled + resolves the log channel.
// ============================================================

const CHANNEL_TYPE_NAMES = {
  0: 'Text Channel',
  2: 'Voice Channel',
  4: 'Category',
  5: 'Announcement Channel',
  13: 'Stage Channel',
  15: 'Forum Channel',
};

function getUserAvatar(user, size = 128) {
  if (!user) return null;
  if (typeof user.displayAvatarURL === 'function') {
    return user.displayAvatarURL({ dynamic: true, size });
  }
  if (typeof user.avatarURL === 'function') {
    return user.avatarURL({ dynamic: true, size });
  }
  return null;
}

function getGuildIcon(guild, size = 128) {
  if (!guild || typeof guild.iconURL !== 'function') return null;
  return guild.iconURL({ dynamic: true, size }) || null;
}

function buildUserIdRow(userId) {
  if (!userId) return null;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`audit_get_user_id_${userId}`)
      .setLabel('Get User ID')
      .setStyle(ButtonStyle.Secondary)
  );
}

function buildMessageJumpRow(message) {
  if (!message?.guild || !message?.channel || !message?.id) return null;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setURL(`https://discord.com/channels/${message.guild.id}/${message.channel.id}/${message.id}`)
      .setLabel('Go to Message')
      .setStyle(ButtonStyle.Link)
  );
}

async function addActorField(embed, guild, actionType, targetId) {
  if (!embed || !guild || !actionType) return embed;

  try {
    const auditLogs = await guild.fetchAuditLogs({ type: actionType, limit: 10 });
    const target = targetId ? auditLogs.entries.find((entry) => entry.target?.id === String(targetId) || entry.targetId === targetId) : null;
    const entry = target || auditLogs.entries.first();
    if (!entry?.executor) return embed;

    if (!embed.data.author) {
      embed.setAuthor({
        name: entry.executor.tag,
        iconURL: getUserAvatar(entry.executor, 64) || undefined,
      });
    }

    if (!embed.data.thumbnail && getUserAvatar(entry.executor, 256)) {
      embed.setThumbnail(getUserAvatar(entry.executor, 256));
    }

    embed.addFields({ name: 'Actor', value: `${entry.executor.tag} (${entry.executor.id})` });
  } catch (error) {
    // Ignore audit-log lookup failures; this is best-effort actor enrichment.
  }

  return embed;
}

async function onGuildAuditLogEntryCreate(guildAuditLogEntry, user) {
  try {
    if (!guildAuditLogEntry?.guild) return;
    const guild = guildAuditLogEntry.guild;
    
    // Skip events that have dedicated handlers (to avoid duplication)
    const dedicatedHandlerActions = [
      AuditLogEvent.ChannelCreate,
      AuditLogEvent.ChannelUpdate,
      AuditLogEvent.ChannelDelete,
      AuditLogEvent.RoleCreate,
      AuditLogEvent.RoleUpdate,
      AuditLogEvent.RoleDelete,
      AuditLogEvent.MessageDelete,
    ];
    if (dedicatedHandlerActions.includes(guildAuditLogEntry.action)) return;
    
    if (!(await isModLogsEnabled(guild))) return;
    const logChannel = await resolveModLogChannel(guild);
    if (!logChannel) return;

    const actionName = guildAuditLogEntry.action ?? 'Audit Log Entry';
    const targetName = guildAuditLogEntry.target ? (
      guildAuditLogEntry.target.tag ||
      guildAuditLogEntry.target.name ||
      guildAuditLogEntry.target.id ||
      'Unknown target'
    ) : 'Unknown target';

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📘 Audit Log Entry')
      .setAuthor({
        name: user ? `${user.tag}` : 'Unknown Executor',
        iconURL: getUserAvatar(user, 64) || undefined,
      })
      .setThumbnail(getGuildIcon(guild, 128) || undefined)
      .setDescription(`**Action:** ${actionName}\n**Target:** ${targetName}`)
      .setTimestamp();

    const components = [];
    if (user?.id) components.push(buildUserIdRow(user.id));

    if (user?.tag) {
      embed.addFields({ name: 'Actor', value: `${user.tag} (${user.id})` });
    }

    if (guildAuditLogEntry.reason) {
      embed.addFields({ name: 'Reason', value: guildAuditLogEntry.reason.slice(0, 1024) || 'No reason provided' });
    }

    if (guildAuditLogEntry.changes && guildAuditLogEntry.changes.length > 0) {
      const changeSummary = guildAuditLogEntry.changes.slice(0, 5).map(change => {
        const key = change.key || 'unknown';
        const oldValue = change.old ? String(change.old).slice(0, 180) : 'None';
        const newValue = change.new ? String(change.new).slice(0, 180) : 'None';
        return `**${key}:** \`${oldValue}\` → \`${newValue}\``;
      }).join('\n');

      embed.addFields({ name: 'Changes', value: changeSummary || 'No explicit changes recorded.' });
    }

    await logChannel.send({
      embeds: [embed],
      components: components.filter(Boolean),
    }).catch(() => null);
  } catch (error) {
    console.error('[Audit:GuildAuditLogEntryCreate]', error.message);
  }
}

// ─── Message Edited ─────────────────────────────────────────
async function onMessageUpdate(oldMessage, newMessage) {
  try {
    if (!newMessage.guild || !newMessage.author || newMessage.author.bot) return;
    if (!oldMessage.content || !newMessage.content) return;
    if (oldMessage.content === newMessage.content) return;

    const guild = newMessage.guild;
    if (!(await isAuditLogsEnabled(guild))) return;
    const channel = await resolveAuditLogChannel(guild);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor('#FAA61A')
      .setTitle('✏️ Message Edited')
      .setAuthor({
        name: newMessage.author.tag,
        iconURL: getUserAvatar(newMessage.author, 64) || undefined,
      })
      .setThumbnail(getUserAvatar(newMessage.author, 256) || undefined)
      .setDescription(`**Channel:** ${newMessage.channel}`)
      .addFields(
        { name: 'Before', value: oldMessage.content.slice(0, 1024) || '*Empty*' },
        { name: 'After', value: newMessage.content.slice(0, 1024) || '*Empty*' }
      )
      .setTimestamp();

    const components = [buildMessageJumpRow(newMessage)].filter(Boolean);
    if (newMessage.author?.id) components.push(buildUserIdRow(newMessage.author.id));

    await channel.send({
      embeds: [embed],
      components: components.filter(Boolean),
    }).catch(() => null);
  } catch (error) {
    console.error('[Audit:MessageUpdate]', error.message);
  }
}

// ─── Message Deleted ────────────────────────────────────────
async function onMessageDelete(message) {
  try {
    if (!message.guild || !message.author || message.author.bot) return;
    if (!message.content) return;

    const guild = message.guild;
    if (!(await isAuditLogsEnabled(guild))) return;
    const channel = await resolveAuditLogChannel(guild);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🗑️ Message Deleted')
      .setAuthor({
        name: message.author.tag,
        iconURL: getUserAvatar(message.author, 64) || undefined,
      })
      .setThumbnail(getUserAvatar(message.author, 256) || undefined)
      .setDescription(`**Channel:** ${message.channel}`)
      .addFields({ name: 'Content', value: message.content.slice(0, 1024) || '*Empty*' })
      .setTimestamp();

    const components = [buildMessageJumpRow(message)].filter(Boolean);
    if (message.author?.id) components.push(buildUserIdRow(message.author.id));

    await channel.send({
      embeds: [embed],
      components: components.filter(Boolean),
    }).catch(() => null);
  } catch (error) {
    console.error('[Audit:MessageDelete]', error.message);
  }
}

// ─── Channel Created ────────────────────────────────────────
async function onChannelCreate(channel) {
  try {
    if (!channel.guild) return;
    const guild = channel.guild;
    if (!(await isAuditLogsEnabled(guild))) return;
    const logChannel = await resolveAuditLogChannel(guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('📝 Channel Created')
      .setThumbnail(getGuildIcon(channel.guild, 128) || undefined)
      .setDescription(`**Channel:** ${channel.name}\n**Type:** ${CHANNEL_TYPE_NAMES[channel.type] || 'Unknown'}`)
      .setTimestamp();

    await addActorField(embed, guild, AuditLogEvent.ChannelCreate, channel.id);
    await logChannel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('[Audit:ChannelCreate]', error.message);
  }
}

// ─── Channel Updated ────────────────────────────────────────
async function onChannelUpdate(oldChannel, newChannel) {
  try {
    if (!newChannel.guild) return;
    const guild = newChannel.guild;
    if (!(await isAuditLogsEnabled(guild))) return;
    const logChannel = await resolveAuditLogChannel(guild);
    if (!logChannel) return;

    const changes = [];
    if (oldChannel.name !== newChannel.name) {
      changes.push({ name: 'Name', value: `\`${oldChannel.name}\` → \`${newChannel.name}\`` });
    }
    if (oldChannel.topic !== newChannel.topic) {
      changes.push({ name: 'Description', value: `\`${oldChannel.topic || 'None'}\` → \`${newChannel.topic || 'None'}\`` });
    }
    if (oldChannel.parentId !== newChannel.parentId) {
      changes.push({ name: 'Category', value: `\`${oldChannel.parent?.name || 'None'}\` → \`${newChannel.parent?.name || 'None'}\`` });
    }
    if (oldChannel.nsfw !== newChannel.nsfw) {
      changes.push({ name: 'NSFW', value: `\`${oldChannel.nsfw}\` → \`${newChannel.nsfw}\`` });
    }
    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
      changes.push({ name: 'Slowmode', value: `\`${oldChannel.rateLimitPerUser || 0}s\` → \`${newChannel.rateLimitPerUser || 0}s\`` });
    }
    if (oldChannel.userLimit !== newChannel.userLimit) {
      changes.push({ name: 'User Limit', value: `\`${oldChannel.userLimit || 0}\` → \`${newChannel.userLimit || 0}\`` });
    }
    if (oldChannel.bitrate !== newChannel.bitrate) {
      changes.push({ name: 'Bitrate', value: `\`${Math.round((oldChannel.bitrate || 0) / 1000)}kbps\` → \`${Math.round((newChannel.bitrate || 0) / 1000)}kbps\`` });
    }

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setColor('#FAA61A')
      .setTitle('✏️ Channel Updated')
      .setThumbnail(getGuildIcon(newChannel.guild, 128) || undefined)
      .setDescription(`**Channel:** ${newChannel.name}`)
      .addFields(changes)
      .setTimestamp();

    await addActorField(embed, guild, AuditLogEvent.ChannelUpdate, newChannel.id);
    await logChannel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('[Audit:ChannelUpdate]', error.message);
  }
}

// ─── Channel Deleted ────────────────────────────────────────
async function onChannelDelete(channel) {
  try {
    if (!channel.guild) return;
    const guild = channel.guild;
    if (!(await isAuditLogsEnabled(guild))) return;
    const logChannel = await resolveAuditLogChannel(guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🗑️ Channel Deleted')
      .setThumbnail(getGuildIcon(channel.guild, 128) || undefined)
      .setDescription(`**Channel:** ${channel.name}\n**Type:** ${CHANNEL_TYPE_NAMES[channel.type] || 'Unknown'}`)
      .setTimestamp();

    await addActorField(embed, guild, AuditLogEvent.ChannelDelete, channel.id);
    await logChannel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('[Audit:ChannelDelete]', error.message);
  }
}

// ─── Role Created ───────────────────────────────────────────
async function onRoleCreate(role) {
  try {
    if (!role.guild) return;
    const guild = role.guild;
    if (!(await isAuditLogsEnabled(guild))) return;
    const logChannel = await resolveAuditLogChannel(guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('🎭 Role Created')
      .setThumbnail(getGuildIcon(role.guild, 128) || undefined)
      .setDescription(`**Role:** ${role.name}\n**Color:** ${role.hexColor}\n**Hoisted:** ${role.hoist ? 'Yes' : 'No'}\n**Mentionable:** ${role.mentionable ? 'Yes' : 'No'}`)
      .setTimestamp();

    await addActorField(embed, guild, AuditLogEvent.RoleCreate, role.id);
    await logChannel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('[Audit:RoleCreate]', error.message);
  }
}

// ─── Role Updated ───────────────────────────────────────────
async function onRoleUpdate(oldRole, newRole) {
  try {
    if (!newRole.guild) return;
    const guild = newRole.guild;
    if (!(await isAuditLogsEnabled(guild))) return;
    const logChannel = await resolveAuditLogChannel(guild);
    if (!logChannel) return;

    const changes = [];
    if (oldRole.name !== newRole.name) {
      changes.push({ name: 'Name', value: `\`${oldRole.name}\` → \`${newRole.name}\`` });
    }
    if (oldRole.hexColor !== newRole.hexColor) {
      changes.push({ name: 'Color', value: `\`${oldRole.hexColor}\` → \`${newRole.hexColor}\`` });
    }
    if (oldRole.hoist !== newRole.hoist) {
      changes.push({ name: 'Hoisted', value: `\`${oldRole.hoist}\` → \`${newRole.hoist}\`` });
    }
    if (oldRole.mentionable !== newRole.mentionable) {
      changes.push({ name: 'Mentionable', value: `\`${oldRole.mentionable}\` → \`${newRole.mentionable}\`` });
    }
    if (oldRole.permissions.bitfield !== newRole.permissions.bitfield) {
      changes.push({ name: 'Permissions', value: 'Permissions were modified' });
    }

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setColor('#FAA61A')
      .setTitle('✏️ Role Updated')
      .setThumbnail(getGuildIcon(newRole.guild, 128) || undefined)
      .setDescription(`**Role:** ${newRole.name}`)
      .addFields(changes)
      .setTimestamp();

    await addActorField(embed, guild, AuditLogEvent.RoleUpdate, newRole.id);
    await logChannel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('[Audit:RoleUpdate]', error.message);
  }
}

// ─── Role Deleted ───────────────────────────────────────────
async function onRoleDelete(role) {
  try {
    if (!role.guild) return;
    const guild = role.guild;
    if (!(await isAuditLogsEnabled(guild))) return;
    const logChannel = await resolveAuditLogChannel(guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🗑️ Role Deleted')
      .setThumbnail(getGuildIcon(role.guild, 128) || undefined)
      .setDescription(`**Role:** ${role.name}`)
      .setTimestamp();

    await addActorField(embed, guild, AuditLogEvent.RoleDelete, role.id);
    await logChannel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('[Audit:RoleDelete]', error.message);
  }
}

// ─── Member Banned ──────────────────────────────────────────
async function onGuildBanAdd(ban) {
  try {
    const guild = ban.guild;
    if (!guild) return;
    if (!(await isAuditLogsEnabled(guild))) return;
    const logChannel = await resolveAuditLogChannel(guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('🔨 Member Banned')
      .setAuthor({
        name: ban.user.tag,
        iconURL: getUserAvatar(ban.user, 64) || undefined,
      })
      .setThumbnail(getUserAvatar(ban.user, 256) || undefined)
      .setDescription(`**Reason:** ${ban.reason || 'No reason provided'}`)
      .setTimestamp();

    const components = [buildUserIdRow(ban.user?.id)].filter(Boolean);
    await logChannel.send({
      embeds: [embed],
      components: components.filter(Boolean),
    }).catch(() => null);
  } catch (error) {
    console.error('[Audit:GuildBanAdd]', error.message);
  }
}

// ─── Member Unbanned ────────────────────────────────────────
async function onGuildBanRemove(ban) {
  try {
    const guild = ban.guild;
    if (!guild) return;
    if (!(await isAuditLogsEnabled(guild))) return;
    const logChannel = await resolveAuditLogChannel(guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('🔓 Member Unbanned')
      .setAuthor({
        name: ban.user.tag,
        iconURL: getUserAvatar(ban.user, 64) || undefined,
      })
      .setThumbnail(getUserAvatar(ban.user, 256) || undefined)
      .setTimestamp();

    const components = [buildUserIdRow(ban.user?.id)].filter(Boolean);
    await logChannel.send({
      embeds: [embed],
      components: components.filter(Boolean),
    }).catch(() => null);
  } catch (error) {
    console.error('[Audit:GuildBanRemove]', error.message);
  }
}

// ─── Member Updated (nickname / roles) ──────────────────────
async function onGuildMemberUpdate(oldMember, newMember) {
  try {
    const guild = newMember.guild;
    if (!guild) return;
    if (newMember.user.bot) return;
    if (!(await isAuditLogsEnabled(guild))) return;
    const logChannel = await resolveAuditLogChannel(guild);
    if (!logChannel) return;

    const changes = [];

    if (oldMember.nickname !== newMember.nickname) {
      changes.push({ name: 'Nickname', value: `\`${oldMember.nickname || 'None'}\` → \`${newMember.nickname || 'None'}\`` });
    }

    const oldRoles = oldMember.roles.cache.map(r => r.id).sort().join(',');
    const newRoles = newMember.roles.cache.map(r => r.id).sort().join(',');
    if (oldRoles !== newRoles) {
      const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
      const removed = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
      const parts = [];
      if (added.size > 0) parts.push(`**Added:** ${added.map(r => r.name).join(', ')}`);
      if (removed.size > 0) parts.push(`**Removed:** ${removed.map(r => r.name).join(', ')}`);
      if (parts.length > 0) changes.push({ name: 'Roles', value: parts.join('\n') });
    }

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setColor('#FAA61A')
      .setTitle('👤 Member Updated')
      .setAuthor({
        name: newMember.user.tag,
        iconURL: getUserAvatar(newMember.user, 64) || undefined,
      })
      .setThumbnail(getUserAvatar(newMember.user, 256) || undefined)
      .addFields(changes)
      .setTimestamp();

    const components = [buildUserIdRow(newMember.user?.id)].filter(Boolean);
    await logChannel.send({
      embeds: [embed],
      components: components.filter(Boolean),
    }).catch(() => null);
  } catch (error) {
    console.error('[Audit:GuildMemberUpdate]', error.message);
  }
}

// ─── Guild Updated (name / icon / boost level) ──────────────
async function onGuildUpdate(oldGuild, newGuild) {
  try {
    if (!(await isAuditLogsEnabled(newGuild))) return;
    const logChannel = await resolveAuditLogChannel(newGuild);
    if (!logChannel) return;

    const changes = [];
    if (oldGuild.name !== newGuild.name) {
      changes.push({ name: 'Server Name', value: `\`${oldGuild.name}\` → \`${newGuild.name}\`` });
    }
    if (oldGuild.icon !== newGuild.icon) {
      changes.push({ name: 'Server Icon', value: 'Server icon was changed' });
    }
    if (oldGuild.premiumTier !== newGuild.premiumTier) {
      changes.push({ name: 'Boost Tier', value: `Tier ${oldGuild.premiumTier} → Tier ${newGuild.premiumTier}` });
    }
    if (oldGuild.premiumSubscriptionCount !== newGuild.premiumSubscriptionCount) {
      changes.push({ name: 'Boost Count', value: `${oldGuild.premiumSubscriptionCount || 0} → ${newGuild.premiumSubscriptionCount || 0}` });
    }

    if (changes.length === 0) return;

    const embed = new EmbedBuilder()
      .setColor('#FAA61A')
      .setTitle('🖥️ Server Updated')
      .setThumbnail(getGuildIcon(newGuild, 128) || undefined)
      .setDescription('Server configuration was changed.')
      .addFields(changes)
      .setTimestamp();

    await addActorField(embed, newGuild, AuditLogEvent.GuildUpdate);
    await logChannel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('[Audit:GuildUpdate]', error.message);
  }
}

async function getInviteContext(guild, memberId) {
  try {
    const InviteJoin = mongoose.models.InviteJoin;
    const InviteRecord = mongoose.models.InviteRecord;
    if (!InviteJoin || !guild?.id) return null;

    const joinRecord = await InviteJoin.findOne({ guildId: guild.id, userId: memberId }).sort({ joinedAt: -1 }).lean().catch(() => null);
    if (!joinRecord) return null;

    const inviterId = joinRecord.inviterId || null;
    let inviterName = 'Unknown';
    let inviterMention = 'Unknown';
    let netInvites = 'N/A';

    if (inviterId) {
      const guildMember = guild.members.cache.get(inviterId) || await guild.members.fetch(inviterId).catch(() => null);
      inviterName = guildMember?.user?.tag || inviterId;
      inviterMention = guildMember ? `<@${inviterId}>` : `<@${inviterId}>`;

      if (InviteRecord) {
        const record = await InviteRecord.findOne({ guildId: guild.id, inviterId }).lean().catch(() => null);
        if (record) {
          netInvites = String((record.joins || 0) - (record.leaves || 0) - (record.fake || 0) + (record.bonusInvites || 0));
        }
      }
    }

    return {
      inviterId,
      inviterName,
      inviterMention,
      inviteCode: joinRecord.inviteCode || 'Unknown',
      netInvites,
    };
  } catch (error) {
    return null;
  }
}

async function onGuildMemberAdd(member) {
  try {
    if (!member?.guild) return;
    if (!(await isAuditLogsEnabled(member.guild))) return;
    const logChannel = await resolveAuditLogChannel(member.guild);
    if (!logChannel) return;

    const accountAgeDays = Math.max(0, Math.floor((Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24)));
    const inviteContext = await getInviteContext(member.guild, member.user.id);
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle('👋 Member Joined')
      .setAuthor({
        name: member.user.tag,
        iconURL: getUserAvatar(member.user, 64) || undefined,
      })
      .setThumbnail(getUserAvatar(member.user, 256) || undefined)
      .setDescription(`${member.user} joined the server.`)
      .addFields(
        { name: 'User ID', value: member.user.id, inline: true },
        { name: 'Account Age', value: `${accountAgeDays} day${accountAgeDays === 1 ? '' : 's'}`, inline: true },
        { name: 'Bot Account', value: member.user.bot ? 'Yes' : 'No', inline: true }
      )
      .setTimestamp();

    if (inviteContext) {
      embed.addFields(
        { name: 'Invited By', value: `${inviteContext.inviterMention} (${inviteContext.inviterName})`, inline: false },
        { name: 'Invite Code', value: `\`${inviteContext.inviteCode}\``, inline: true },
        { name: 'Net Invites', value: inviteContext.netInvites, inline: true }
      );
    }

    await logChannel.send({ embeds: [embed], components: [buildUserIdRow(member.user.id)].filter(Boolean) }).catch(() => null);
  } catch (error) {
    console.error('[Audit:GuildMemberAdd]', error.message);
  }
}

async function onGuildMemberRemove(member) {
  try {
    if (!member?.guild) return;
    if (!(await isAuditLogsEnabled(member.guild))) return;
    const logChannel = await resolveAuditLogChannel(member.guild);
    if (!logChannel) return;

    const inviteContext = await getInviteContext(member.guild, member.user.id);
    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('👋 Member Left')
      .setAuthor({
        name: member.user.tag,
        iconURL: getUserAvatar(member.user, 64) || undefined,
      })
      .setThumbnail(getUserAvatar(member.user, 256) || undefined)
      .setDescription(`${member.user} left the server.`)
      .addFields(
        { name: 'User ID', value: member.user.id, inline: true },
        { name: 'Bot Account', value: member.user.bot ? 'Yes' : 'No', inline: true }
      )
      .setTimestamp();

    if (inviteContext) {
      embed.addFields(
        { name: 'Invited By', value: `${inviteContext.inviterMention} (${inviteContext.inviterName})`, inline: false },
        { name: 'Invite Code', value: `\`${inviteContext.inviteCode}\``, inline: true },
        { name: 'Net Invites', value: inviteContext.netInvites, inline: true }
      );
    }

    await logChannel.send({ embeds: [embed], components: [buildUserIdRow(member.user.id)].filter(Boolean) }).catch(() => null);
  } catch (error) {
    console.error('[Audit:GuildMemberRemove]', error.message);
  }
}

async function onInviteCreate(invite) {
  try {
    if (!invite?.guild) return;
    if (!(await isAuditLogsEnabled(invite.guild))) return;
    const logChannel = await resolveAuditLogChannel(invite.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📨 Invite Created')
      .setDescription(`A new invite was created for ${invite.guild.name}.`)
      .addFields(
        { name: 'Code', value: `\`${invite.code}\``, inline: true },
        { name: 'Inviter', value: invite.inviter ? `${invite.inviter.tag} (${invite.inviter.id})` : 'Unknown', inline: true },
        { name: 'Uses', value: String(invite.uses ?? 0), inline: true },
        { name: 'Max Uses', value: invite.maxUses && invite.maxUses > 0 ? String(invite.maxUses) : 'Unlimited', inline: true },
        { name: 'Expires', value: invite.expiresAt ? `<t:${Math.floor(invite.expiresAt.getTime() / 1000)}:F>` : 'Never', inline: true }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('[Audit:InviteCreate]', error.message);
  }
}

async function onInviteDelete(invite) {
  try {
    if (!invite?.guild) return;
    if (!(await isAuditLogsEnabled(invite.guild))) return;
    const logChannel = await resolveAuditLogChannel(invite.guild);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setTitle('📨 Invite Removed')
      .setDescription(`An invite was deleted for ${invite.guild.name}.`)
      .addFields(
        { name: 'Code', value: `\`${invite.code}\``, inline: true },
        { name: 'Inviter', value: invite.inviter ? `${invite.inviter.tag} (${invite.inviter.id})` : 'Unknown', inline: true },
        { name: 'Uses', value: String(invite.uses ?? 0), inline: true }
      )
      .setTimestamp();

    await logChannel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('[Audit:InviteDelete]', error.message);
  }
}

// ─── Export as an array of event handlers ───────────────────
module.exports = [
  { name: 'messageUpdate', once: false, execute: onMessageUpdate },
  { name: 'messageDelete', once: false, execute: onMessageDelete },
  { name: 'channelCreate', once: false, execute: onChannelCreate },
  { name: 'channelUpdate', once: false, execute: onChannelUpdate },
  { name: 'channelDelete', once: false, execute: onChannelDelete },
  { name: 'roleCreate', once: false, execute: onRoleCreate },
  { name: 'roleUpdate', once: false, execute: onRoleUpdate },
  { name: 'roleDelete', once: false, execute: onRoleDelete },
  { name: 'guildBanAdd', once: false, execute: onGuildBanAdd },
  { name: 'guildBanRemove', once: false, execute: onGuildBanRemove },
  { name: 'guildMemberAdd', once: false, execute: onGuildMemberAdd },
  { name: 'guildMemberRemove', once: false, execute: onGuildMemberRemove },
  { name: 'guildMemberUpdate', once: false, execute: onGuildMemberUpdate },
  { name: 'guildUpdate', once: false, execute: onGuildUpdate },
  { name: 'inviteCreate', once: false, execute: onInviteCreate },
  { name: 'inviteDelete', once: false, execute: onInviteDelete },
];