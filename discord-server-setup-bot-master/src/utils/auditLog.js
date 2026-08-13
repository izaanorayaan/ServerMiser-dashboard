const { EmbedBuilder } = require('discord.js');
const database = require('./database.js');

async function resolveModLogChannel(guild) {
  if (!guild) return null;

  try {
    const config = await database.findOne({ guildId: guild.id }).catch(() => null) || {};
    const channelId = config.unifiedLogChannelId || config.modLogChannelId || config.auditChannelId || config.audit_channel || config.mod_logs_channel;
    if (channelId) {
      const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
      if (channel && channel.isTextBased && channel.viewable) return channel;
    }
  } catch (error) {
    console.warn('[auditLog] resolveModLogChannel config lookup failed:', error.message);
  }

  const settings = await database.readData('settings.json').catch(() => ({}));
  const guildSettings = settings[guild.id] || {};
  const fallbackId = guildSettings.unifiedLogChannelId || guildSettings.modLogChannelId || guildSettings.auditChannelId || guildSettings.audit_channel;
  if (fallbackId) {
    const channel = guild.channels.cache.get(fallbackId) || await guild.channels.fetch(fallbackId).catch(() => null);
    if (channel && channel.isTextBased && channel.viewable) return channel;
  }

  const channelNames = ['mod-logs', 'moderation-logs', 'audit-logs', 'server-logs', 'staff-logs', 'logs'];
  for (const name of channelNames) {
    const found = guild.channels.cache.find(ch => ch && ch.isTextBased && ch.name.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }

  const textChannel = guild.channels.cache.find(ch => ch && ch.isTextBased && /mod|audit|staff|logs/i.test(ch.name));
  return textChannel || null;
}

async function logAction(guild, action, user, details) {
  try {
    if (!guild) return;

    const channel = await resolveModLogChannel(guild);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
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

module.exports = { logAction, resolveModLogChannel };
