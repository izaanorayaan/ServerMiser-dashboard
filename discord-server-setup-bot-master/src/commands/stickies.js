const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const database = require('../utils/database');

const stickyTemplates = {
  rules: '📜 Server Rules\n\n1. Be respectful to everyone in the server.\n2. Keep chat on-topic and use the correct channels.\n3. No spam, harassment, or disruptive behavior.\n4. Follow all staff instructions and moderation decisions.\n5. Use the ticket or report system for issues.',
  welcome: '👋 Welcome to the server!\n\nPlease introduce yourself, read the rules, and enjoy your stay.',
  faq: '❓ Community FAQ\n\n• Where do I ask for help? Use #support or open a ticket.\n• How do I get roles? Follow the onboarding instructions.\n• Where do I find updates? Watch the announcements channel.',
  announcements: '📣 Important Announcement\n\nCheck here for updates, events, news, and server-wide notices.',
  event: '🎉 Event Notice\n\nJoin us for upcoming events, giveaways, and community activities. Keep an eye on announcements for details.',
  custom: '📌 Sticky Message\n\nThis is a custom sticky. Update it any time from the admin control panel.'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stickies')
    .setDescription('Deploy and manage a single sticky message per channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('deploy')
        .setDescription('Deploy a sticky in the selected channel and delete the previous sticky')
        .addStringOption((option) =>
          option
            .setName('type')
            .setDescription('Choose the sticky type to deploy')
            .setRequired(true)
            .addChoices(
              { name: 'Rules', value: 'rules' },
              { name: 'Welcome', value: 'welcome' },
              { name: 'FAQ', value: 'faq' },
              { name: 'Announcements', value: 'announcements' },
              { name: 'Event', value: 'event' },
              { name: 'Custom', value: 'custom' }
            )
        )
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel to post the sticky in')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
        .addStringOption((option) =>
          option
            .setName('text')
            .setDescription('Optional custom text for a custom sticky (used only when type is Custom)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Remove the active sticky in the selected channel')
        .addChannelOption((option) =>
          option
            .setName('channel')
            .setDescription('Channel containing the sticky to remove')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ You need Administrator permissions to manage sticky messages.',
        flags: [MessageFlags.Ephemeral],
      }).catch(() => null);
    }

    const guildId = interaction.guildId;
    const subcommand = interaction.options.getSubcommand();
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    if (!guildId || !targetChannel || !targetChannel.isTextBased?.()) {
      return interaction.reply({
        content: '❌ I can only post stickies in text channels.',
        flags: [MessageFlags.Ephemeral],
      }).catch(() => null);
    }

    if (subcommand === 'clear') {
      const guildConfig = (await database.findOne({ guildId }).catch(() => null)) || {};
      const sticky = guildConfig.sticky || {};

      if (sticky.channelId && sticky.messageId) {
        const previousChannel = interaction.guild.channels.cache.get(sticky.channelId) || await interaction.guild.channels.fetch(sticky.channelId).catch(() => null);
        if (previousChannel && previousChannel.isTextBased?.()) {
          const previousSticky = await previousChannel.messages.fetch(sticky.messageId).catch(() => null);
          if (previousSticky) {
            await previousSticky.delete().catch(() => null);
          }
        }
      }

      await database.findOneAndUpdate(
        { guildId },
        { $unset: { 'sticky.channelId': '', 'sticky.messageId': '', 'sticky.type': '', 'sticky.text': '', 'sticky.createdAt': '' } },
        { upsert: true }
      ).catch(() => null);

      return interaction.reply({
        content: `✅ The active sticky in ${targetChannel} has been removed.`,
        flags: [MessageFlags.Ephemeral],
      }).catch(() => null);
    }

    const stickyType = interaction.options.getString('type');
    const customText = interaction.options.getString('text')?.trim();

    let finalText = stickyTemplates[stickyType] || stickyTemplates.custom;
    if (stickyType === 'custom') {
      finalText = customText ? `📌 Sticky Message\n\n${customText}` : stickyTemplates.custom;
    } else if (customText) {
      finalText = `${stickyTemplates[stickyType]}\n\n${customText}`;
    }

    const guildConfig = (await database.findOne({ guildId }).catch(() => null)) || {};
    const activeSticky = guildConfig.sticky || {};

    if (activeSticky.channelId && activeSticky.messageId) {
      const previousChannel = interaction.guild.channels.cache.get(activeSticky.channelId) || await interaction.guild.channels.fetch(activeSticky.channelId).catch(() => null);
      if (previousChannel && previousChannel.isTextBased?.()) {
        const previousSticky = await previousChannel.messages.fetch(activeSticky.messageId).catch(() => null);
        if (previousSticky) {
          await previousSticky.delete().catch(() => null);
        }
      }
    }

    const stickyMessage = await targetChannel.send({
      content: finalText,
      allowedMentions: { parse: [] },
    }).catch(() => null);

    if (!stickyMessage) {
      return interaction.reply({
        content: '❌ I could not post the sticky message in that channel.',
        flags: [MessageFlags.Ephemeral],
      }).catch(() => null);
    }

    try {
      await stickyMessage.pin();
    } catch (error) {
      console.warn('[stickies] Could not pin sticky message:', error.message);
    }

    await database.findOneAndUpdate(
      { guildId },
      {
        $set: {
          'sticky.channelId': targetChannel.id,
          'sticky.messageId': stickyMessage.id,
          'sticky.type': stickyType,
          'sticky.text': finalText,
          'sticky.createdAt': new Date().toISOString(),
        }
      },
      { upsert: true }
    ).catch(() => null);

    return interaction.reply({
      content: `✅ Sticky deployed to ${targetChannel}. The previous sticky was deleted automatically.`,
      flags: [MessageFlags.Ephemeral],
    }).catch(() => null);
  },
};
