const { EmbedBuilder } = require('discord.js');
const database = require('./database.js');

/**
 * Resolve the configured mod-log / audit-log channel for a guild.
 * Checks the unified guild_config store first, then settings.json,
 * then falls back to channel-name heuristics.
 */
async function resolveModLogChannel(guild) {
  if (!guild) return null;

  try {
    const config = await database.findOne({ guildId: guild.id }).catch(() => null) || {};
    const channelId = config.unifiedLogChannelId || config.modLogChannelId || config.mod_logs_channel;
    if (channelId) {
      const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
      if (channel && channel.isTextBased && channel.viewable) return channel;
    }
  } catch (error) {
    console.warn('[auditLog] resolveModLogChannel config lookup failed:', error.message);
  }

  const settings = await database.readData('settings.json').catch(() => ({}));
  const guildSettings = settings[guild.id] || {};
  const fallbackId = guildSettings.unifiedLogChannelId || guildSettings.modLogChannelId || guildSettings.mod_logs_channel;
  if (fallbackId) {
    const channel = guild.channels.cache.get(fallbackId) || await guild.channels.fetch(fallbackId).catch(() => null);
    if (channel && channel.isTextBased && channel.viewable) return channel;
  }

  const channelNames = ['mod-logs', 'moderation-logs', 'server-logs', 'staff-logs', 'logs'];
  for (const name of channelNames) {
    const found = guild.channels.cache.find(ch => ch && ch.isTextBased && ch.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }

  const textChannel = guild.channels.cache.find(ch => ch && ch.isTextBased && /mod|moderation|staff|logs/i.test(ch.name));
  return textChannel || null;
}

async function resolveAuditLogChannel(guild) {
  if (!guild) return null;

  try {
    const config = await database.findOne({ guildId: guild.id }).catch(() => null) || {};
    const channelId = config.auditChannelId || config.audit_channel || config.auditLogChannelId || config.auditLogChannel || config.unifiedLogChannelId || config.modLogChannelId || config.mod_logs_channel;
    if (channelId) {
      const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
      if (channel && channel.isTextBased && channel.viewable) return channel;
    }
  } catch (error) {
    console.warn('[auditLog] resolveAuditLogChannel config lookup failed:', error.message);
  }

  const settings = await database.readData('settings.json').catch(() => ({}));
  const guildSettings = settings[guild.id] || {};
  const fallbackId = guildSettings.auditChannelId || guildSettings.audit_channel || guildSettings.auditLogChannelId || guildSettings.auditLogChannel || guildSettings.unifiedLogChannelId || guildSettings.modLogChannelId || guildSettings.mod_logs_channel;
  if (fallbackId) {
    const channel = guild.channels.cache.get(fallbackId) || await guild.channels.fetch(fallbackId).catch(() => null);
    if (channel && channel.isTextBased && channel.viewable) return channel;
  }

  const channelNames = ['audit-logs', 'server-logs', 'staff-logs', 'mod-logs', 'moderation-logs', 'logs'];
  for (const name of channelNames) {
    const found = guild.channels.cache.find(ch => ch && ch.isTextBased && ch.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }

  const textChannel = guild.channels.cache.find(ch => ch && ch.isTextBased && /audit|server|staff|logs/i.test(ch.name));
  return textChannel || null;
}

/**
 * Check whether mod logging is enabled for a guild.
 * Defaults to true if not explicitly disabled.
 */
async function isModLogsEnabled(guild) {
  if (!guild) return false;
  try {
    const config = await database.findOne({ guildId: guild.id }).catch(() => null) || {};
    if (config.modLogsEnabled === false || config.modLogsEnabled === 'off' || config.modLogsEnabled === 'disabled') return false;
    return true;
  } catch {
    return false;
  }
}

async function isAuditLogsEnabled(guild) {
  if (!guild) return false;
  try {
    const config = await database.findOne({ guildId: guild.id }).catch(() => null) || {};
    if (config.auditLogsEnabled === false || config.auditLogsEnabled === 'off' || config.auditLogsEnabled === 'disabled') return false;
    return Boolean(config.auditChannelId || config.audit_channel || config.auditLogChannelId || config.auditLogChannel || config.unifiedLogChannelId || config.modLogChannelId || config.mod_logs_channel);
  } catch {
    return false;
  }
}

/**
 * Send a generic audit log embed to the guild's configured mod-log channel.
 * Respects the modLogsEnabled toggle.
 */
async function logAction(guild, action, user, details, color = '#FF0000') {
  try {
    if (!guild) return;
    const enabled = await isModLogsEnabled(guild);
    if (!enabled) return;

    const channel = await resolveModLogChannel(guild);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`📜 Audit Log: ${action}`)
      .addFields(
        { name: 'User', value: user ? `${user.username} (${user.id})` : 'System/Unknown', inline: true },
        { name: 'Timestamp', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
        { name: 'Details', value: details || 'No additional details provided.' }
      )
      .setFooter({ text: 'Server activity audit and moderation log' });

    await channel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('Error logging action in auditLog.js:', error);
  }
}

/**
 * Send a rich audit log embed with custom fields.
 * Respects the modLogsEnabled toggle.
 */
async function logRich(guild, { title, color = '#FF0000', fields = [], description = null, footer = null }) {
  try {
    if (!guild) return;
    const enabled = await isModLogsEnabled(guild);
    if (!enabled) return;

    const channel = await resolveModLogChannel(guild);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setTimestamp();

    if (description) embed.setDescription(description);
    if (fields && fields.length > 0) embed.addFields(fields);
    if (footer) embed.setFooter({ text: footer });

    await channel.send({ embeds: [embed] }).catch(() => null);
  } catch (error) {
    console.error('Error logging rich action in auditLog.js:', error);
  }
}

module.exports = { logAction, logRich, resolveModLogChannel, resolveAuditLogChannel, isModLogsEnabled, isAuditLogsEnabled };