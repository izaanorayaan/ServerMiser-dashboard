const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const { Schema, model, models } = require('mongoose');

const ACCENT_COLOR = 0x5865f2;

const AutoDeleteSchema = new Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  lifespanSeconds: { type: Number, default: 0 },
  phraseBlacklist: { type: [String], default: [] },
  triggerBlacklist: { type: [String], default: [] },
  ignoredChannels: { type: [String], default: [] },
  allowedChannels: { type: [String], default: [] },
  categoryBlacklist: { type: [String], default: [] },
  enabled: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const AutoDelete = models.AutoDelete || model('AutoDelete', AutoDeleteSchema);

const BLACKLIST_CATEGORY_LABELS = {
  phishing_links: 'Phishing links',
  scam_links: 'Scam links',
  malicious_urls: 'Malicious URLs',
  spam: 'Spam',
  invites: 'Server invites',
  nsfw: 'NSFW content',
  extreme_caps: 'Excessive caps',
  mass_mentions: 'Mass mentions',
};

function parsePrefixArgs(interaction) {
  const tokens = String(interaction.content || '').trim().split(/\s+/);
  const args = tokens.slice(1);
  const channel = interaction.mentions?.channels?.first() || interaction.channel;
  const seconds = Number(args[0]) || 0;
  return { seconds, channel, args };
}

function isPrefixMode(interaction) {
  return typeof interaction.isChatInputCommand === 'function' && interaction.isChatInputCommand() === false;
}

async function processConfiguration(interaction, channel, seconds, settings = {}) {
  if (!channel || !channel.isTextBased?.()) {
    return interaction.reply({
      content: '❌ Please select a valid text channel for the auto-delete rule.',
      flags: [MessageFlags.Ephemeral],
    }).catch(() => null);
  }

  const config = await AutoDelete.findOneAndUpdate(
    { guildId: interaction.guild.id, channelId: channel.id },
    {
      $set: {
        guildId: interaction.guild.id,
        channelId: channel.id,
        enabled: settings.enabled ?? true,
        lifespanSeconds: Number(settings.lifespanSeconds ?? seconds ?? 0),
        phraseBlacklist: Array.isArray(settings.phraseBlacklist) ? settings.phraseBlacklist : [],
        triggerBlacklist: Array.isArray(settings.triggerBlacklist) ? settings.triggerBlacklist : [],
        ignoredChannels: Array.isArray(settings.ignoredChannels) ? settings.ignoredChannels : [],
        allowedChannels: Array.isArray(settings.allowedChannels) ? settings.allowedChannels : [],
        categoryBlacklist: Array.isArray(settings.categoryBlacklist) ? settings.categoryBlacklist : [],
      }
    },
    { upsert: true, new: true }
  );

  const embed = new EmbedBuilder()
    .setTitle('🧹 Auto-Delete Rule Saved')
    .setColor(ACCENT_COLOR)
    .setDescription(`The auto-delete profile for ${channel} is now active.`)
    .addFields(
      { name: 'Time to delete', value: config.lifespanSeconds > 0 ? `\`${config.lifespanSeconds}s\`` : '`Disabled`', inline: true },
      { name: 'Blacklisted words', value: config.phraseBlacklist.length ? config.phraseBlacklist.map((word) => `\`${word}\``).join(', ') : 'None', inline: true },
      { name: 'Trigger filters', value: config.triggerBlacklist.length ? config.triggerBlacklist.map((word) => `\`${word}\``).join(', ') : 'None', inline: true },
      { name: 'Blocked content categories', value: config.categoryBlacklist.length ? config.categoryBlacklist.map((cat) => `\`${BLACKLIST_CATEGORY_LABELS[cat] || cat}\``).join(', ') : 'None', inline: true },
    )
    .setTimestamp();

  return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] }).catch(() => null);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autodelete')
    .setDescription('Set an automated delete rule with blacklist words, triggers, and blocked content categories.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addChannelOption((opt) =>
      opt.setName('channel').setDescription('Channel to monitor').addChannelTypes(ChannelType.GuildText).setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt.setName('seconds').setDescription('Delete after this many seconds (0 disables the rule)').setRequired(false).setMinValue(0)
    )
    .addStringOption((opt) =>
      opt.setName('blacklist_words').setDescription('Comma-separated words to auto-delete when found').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('trigger_words').setDescription('Comma-separated trigger phrases to auto-delete').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('category_blacklist').setDescription('Comma-separated categories: phishing_links, scam_links, malicious_urls, spam, invites, nsfw, extreme_caps, mass_mentions').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('allowed_channels').setDescription('Comma-separated channel IDs that are allowed to trigger this filter').setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('ignored_channels').setDescription('Comma-separated channel IDs to ignore for this filter').setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt.setName('enabled').setDescription('Enable or disable this auto-delete filter').setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ You need Administrator permission to configure auto-delete rules.',
        flags: [MessageFlags.Ephemeral],
      }).catch(() => null);
    }

    if (isPrefixMode(interaction)) {
      const parsed = parsePrefixArgs(interaction);
      const channel = parsed.channel || interaction.channel;
      return processConfiguration(interaction, channel, parsed.seconds, {
        enabled: true,
        lifespanSeconds: parsed.seconds,
      });
    }

    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const seconds = interaction.options.getInteger('seconds') ?? 0;
    const blacklistWords = (interaction.options.getString('blacklist_words') || '')
      .split(',').map((item) => item.trim()).filter(Boolean);
    const triggerWords = (interaction.options.getString('trigger_words') || '')
      .split(',').map((item) => item.trim()).filter(Boolean);
    const categoryBlacklist = (interaction.options.getString('category_blacklist') || '')
      .split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    const allowedChannels = (interaction.options.getString('allowed_channels') || '')
      .split(',').map((item) => item.trim()).filter(Boolean);
    const ignoredChannels = (interaction.options.getString('ignored_channels') || '')
      .split(',').map((item) => item.trim()).filter(Boolean);
    const enabled = interaction.options.getBoolean('enabled') ?? true;

    return processConfiguration(interaction, channel, seconds, {
      enabled,
      lifespanSeconds: seconds,
      phraseBlacklist: blacklistWords,
      triggerBlacklist: triggerWords,
      categoryBlacklist,
      allowedChannels,
      ignoredChannels,
    });
  },

  async trackAndQueueDeletion(message) {
    if (!message.guild || message.author.bot || !message.content) return;

    const channelProfile = await AutoDelete.findOne({ guildId: message.guild.id, channelId: message.channel.id });
    if (!channelProfile || !channelProfile.enabled) return;

    const content = message.content.toLowerCase();
    const phraseBlocked = (channelProfile.phraseBlacklist || []).some((word) => {
      const value = String(word).toLowerCase();
      return value && content.includes(value);
    });

    const triggerBlocked = (channelProfile.triggerBlacklist || []).some((word) => {
      const value = String(word).toLowerCase();
      return value && content.includes(value);
    });

    const allowedIds = channelProfile.allowedChannels || [];
    const ignoredIds = channelProfile.ignoredChannels || [];
    if (allowedIds.length && !allowedIds.includes(message.channel.id)) return;
    if (ignoredIds.includes(message.channel.id)) return;

    const categoryBlocked = (channelProfile.categoryBlacklist || []).some((category) => {
      if (category === 'phishing_links' && /(discord\.(gg|com\/invite)|https?:\/\/[^\s]+(?:phish|scam|nitro|gift|claim))/i.test(message.content)) return true;
      if (category === 'spam' && /(https?:\/\/|\b(?:free|claim|winner|click|boost|nitro)\b)/i.test(message.content)) return true;
      if (category === 'extreme_caps' && (message.content.replace(/[^A-Z]/g, '').length > message.content.length * 0.6)) return true;
      if (category === 'mass_mentions' && (message.mentions.users.size + message.mentions.roles.size) >= 3) return true;
      if (category === 'invites' && /discord\.(gg|com\/invite)\//i.test(message.content)) return true;
      if (category === 'nsfw' && /\b(sex|porn|xxx|nsfw)\b/i.test(message.content)) return true;
      if (category === 'scam_links' && /(?:steam|discord|nitro|gift|claim|giveaway|free).*https?:\/\//i.test(message.content)) return true;
      if (category === 'malicious_urls' && /(?:bit\.ly|tinyurl|t\.co|goo\.gl|shorturl|discordapp\.com\/gift|discord\.gift)/i.test(message.content)) return true;
      return false;
    });

    if (!(phraseBlocked || triggerBlocked || categoryBlocked)) return;

    try {
      if (message.deletable) await message.delete();
      if (channelProfile.lifespanSeconds > 0) {
        setTimeout(async () => {
          try {
            if (message.deletable) await message.delete();
          } catch (error) {
            // ignore cleanup failures
          }
        }, channelProfile.lifespanSeconds * 1000);
      }
    } catch (error) {
      console.error('[autodelete] Failed to delete flagged message:', error.message);
    }
  }
};
  