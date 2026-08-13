const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
  } = require('discord.js');
  const { logAction } = require('../utils/auditLog');
  const db = require('../utils/database');
  
  // Builds the select menu listing every current warning for a user, so a mod
  // can pick exactly which one to remove without needing to know its index.
  function buildWizardRow(userId, userWarnings) {
    const options = userWarnings.slice(0, 25).map((warning, index) => {
      const dateLabel = warning.timestamp ? new Date(warning.timestamp).toLocaleDateString() : 'Unknown date';
      return {
        label: `#${index + 1} — ${dateLabel}`.slice(0, 100),
        description: (warning.reason || 'No reason provided').slice(0, 100),
        value: `${userId}:${index}`,
      };
    });
  
    return new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('unwarn_select')
        .setPlaceholder('Choose a warning to remove...')
        .addOptions(options)
    );
  }
  
  function buildCancelRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('unwarn_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );
  }
  
  // Shared removal logic used by the direct-index path, the wizard, and the
  // prefix path — keeps the warnings.json mutation + mod-logs + auditLog
  // wiring in exactly one place.
  async function removeWarning(guild, moderator, targetUser, index) {
    const warnings = (await db.readData('warnings.json')) || {};
    const guildId = guild.id;
    const userWarnings = warnings[guildId]?.[targetUser.id] || [];
  
    if (index < 0 || index >= userWarnings.length) {
      return { ok: false, reason: 'That warning number no longer exists.' };
    }
  
    const [removed] = userWarnings.splice(index, 1);
    warnings[guildId][targetUser.id] = userWarnings;
    await db.writeData('warnings.json', warnings);
  
    const remaining = userWarnings.length;
  
    // Unified mod-logs channel (same settings.json pattern as warn.js)
    const settings = (await db.readData('settings.json')) || {};
    const currentGuildSettings = settings[guildId] || {};
    if (currentGuildSettings.modLogsEnabled && currentGuildSettings.unifiedLogChannelId) {
      const modLogsChannel =
        guild.channels.cache.get(currentGuildSettings.unifiedLogChannelId) ||
        (await guild.channels.fetch(currentGuildSettings.unifiedLogChannelId).catch(() => null));
  
      if (modLogsChannel) {
        const embedLog = new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🛡️ Unified Moderation: Warning Removed')
          .addFields(
            { name: 'Target User', value: `${targetUser.username} (${targetUser.id})`, inline: true },
            { name: 'Responsible Staff', value: `${moderator.username}`, inline: true },
            { name: 'Remaining Infractions', value: remaining.toString(), inline: true },
            { name: 'Removed Reason', value: removed?.reason || 'No reason on record' }
          )
          .setTimestamp();
        await modLogsChannel.send({ embeds: [embedLog] }).catch(() => null);
      }
    }
  
    await logAction(
      guild,
      'Warning Removed',
      moderator,
      `User: ${targetUser.username}, Removed Reason: ${removed?.reason || 'N/A'}, Remaining: ${remaining}`
    );
  
    return { ok: true, remaining, removed };
  }
  
  module.exports = {
    // Exported so warnings.js can reuse the same select-menu/removal logic
    // for its "Delete a Warning" button without duplicating this code.
    buildWizardRow,
    buildCancelRow,
    removeWarning,
  
    data: new SlashCommandBuilder()
      .setName('unwarn')
      .setDescription('Remove a warning from a server member')
      .addUserOption(option => option.setName('user').setDescription('User to remove a warning from').setRequired(true))
      .addIntegerOption(option =>
        option.setName('index')
          .setDescription('Warning number to remove (see /warnings). Omit to pick from a list.')
          .setMinValue(1)
          .setRequired(false)
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    name: 'unwarn',
  
    async execute(interaction, client) {
      const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : (interaction.options && !interaction.isMock ? true : false);
  
      if (isInteraction) {
        await interaction.deferReply().catch(() => null);
      } else {
        interaction.processingMessage = await interaction.reply('⏳ Looking up infraction history...').catch(() => null);
      }
  
      const guild = interaction.guild;
      const author = isInteraction ? interaction.user : interaction.author;
      const memberExecutor = interaction.member;
      const guildId = interaction.guildId;
  
      if (!memberExecutor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        const msg = '❌ You need Moderate Members permission to remove warnings!';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }
  
      try {
        const user = interaction.options.getUser('user');
        const rawIndex = typeof interaction.options.getInteger === 'function' ? interaction.options.getInteger('index') : null;
  
        if (!user) {
          const msg = '❌ Please mention a valid user or provide a valid user ID.';
          return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
        }
  
        const warnings = (await db.readData('warnings.json')) || {};
        const userWarnings = warnings[guildId]?.[user.id] || [];
  
        if (userWarnings.length === 0) {
          const msg = `✅ **${user.username}** has no warnings to remove on this server.`;
          return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply({ content: msg });
        }
  
        // --------------------------------------------------------
        // Direct removal: an explicit index (1-based) was given
        // --------------------------------------------------------
        if (rawIndex !== null && rawIndex !== undefined) {
          const zeroBasedIndex = rawIndex - 1;
          const result = await removeWarning(guild, author, user, zeroBasedIndex);
  
          if (!result.ok) {
            const msg = `❌ ${result.reason} **${user.username}** currently has ${userWarnings.length} warning(s).`;
            return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
          }
  
          const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('✅ Warning Removed')
            .setDescription(
              `Removed warning **#${rawIndex}** from **${user.username}**.\n` +
              `**Reason was:** ${result.removed?.reason || 'N/A'}\n` +
              `Remaining warnings: **${result.remaining}**`
            );
  
          return isInteraction ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
        }
  
        // --------------------------------------------------------
        // No index given: launch the interactive select-menu wizard
        // --------------------------------------------------------
        const embed = new EmbedBuilder()
          .setColor('#FF6600')
          .setTitle(`🗑️ Remove a Warning — ${user.username}`)
          .setDescription(
            `**${user.username}** has **${userWarnings.length}** warning(s). ` +
            `Pick one from the dropdown below to remove it.`
          );
  
        const row = buildWizardRow(user.id, userWarnings);
        const cancelRow = buildCancelRow();
  
        const payload = { embeds: [embed], components: [row, cancelRow] };
        const response = isInteraction
          ? await interaction.editReply(payload).catch(() => null)
          : await interaction.reply(payload).catch(() => null);
  
        if (!response || typeof response.createMessageComponentCollector !== 'function') return;
  
        const collector = response.createMessageComponentCollector({ time: 60000 });
  
        collector.on('collect', async (comp) => {
          if (comp.user.id !== author.id) {
            return comp.reply({ content: '❌ Only the person who ran this command can use it!', ephemeral: true }).catch(() => null);
          }
  
          if (comp.customId === 'unwarn_cancel') {
            collector.stop('cancelled');
            return comp.update({ content: '❌ Cancelled — no warning was removed.', embeds: [], components: [] }).catch(() => null);
          }
  
          if (comp.customId === 'unwarn_select') {
            await comp.deferUpdate().catch(() => null);
            const [selUserId, selIndexStr] = comp.values[0].split(':');
            const selIndex = parseInt(selIndexStr, 10);
  
            const result = await removeWarning(guild, author, user, selIndex);
            collector.stop('done');
  
            if (!result.ok) {
              return comp.editReply({ content: `❌ ${result.reason}`, embeds: [], components: [] }).catch(() => null);
            }
  
            const doneEmbed = new EmbedBuilder()
              .setColor('#00FF00')
              .setTitle('✅ Warning Removed')
              .setDescription(
                `Removed **1** warning from **${user.username}**.\n` +
                `**Reason was:** ${result.removed?.reason || 'N/A'}\n` +
                `Remaining warnings: **${result.remaining}**`
              );
  
            return comp.editReply({ embeds: [doneEmbed], components: [] }).catch(() => null);
          }
        });
  
        collector.on('end', (_collected, reason) => {
          if (reason === 'time') {
            const timeoutPayload = { content: '⌛ Warning removal wizard timed out.', embeds: [], components: [] };
            if (isInteraction) interaction.editReply(timeoutPayload).catch(() => null);
            else response.edit(timeoutPayload).catch(() => null);
          }
        });
      } catch (error) {
        console.error('Unwarn error:', error);
        const msg = `❌ Error removing warning: ${error.message}`;
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }
    },
  
    // Component router for the wizard buttons/select above, and for the
    // "Delete a Warning" button added to /warnings (see warnings.js).
    async handleInteraction(interaction, client) {
      // Only unwarn_* custom IDs not already caught by a live collector land
      // here (e.g. if the bot restarted between showing the menu and the
      // user picking an option). Handle gracefully rather than erroring.
      if (interaction.customId === 'unwarn_cancel') {
        return interaction.update({ content: '❌ Cancelled — no warning was removed.', embeds: [], components: [] }).catch(() => null);
      }
      if (interaction.customId === 'unwarn_select') {
        return interaction.reply({ content: '⌛ This warning removal menu expired. Please run the command again.', ephemeral: true }).catch(() => null);
      }
      if (interaction.customId.startsWith('warnings_delete_')) {
        return interaction.reply({ content: '⌛ This button expired. Please run `/warnings` again.', ephemeral: true }).catch(() => null);
      }
    },
  
    async executePrefix(message, argsArray, client) {
      let targetUser = message.mentions.users.first();
      let indexArg = null;
  
      if (!targetUser && argsArray && argsArray.length > 0) {
        const pureId = argsArray[0].replace(/[^0-9]/g, '');
        if (pureId.length >= 17 && pureId.length <= 20) {
          targetUser = await client.users.fetch(pureId).catch(() => null);
        }
      }
  
      // Whatever token comes after the mention/ID (if numeric) is the index
      const remainingArgs = message.mentions.users.first()
        ? argsArray.slice(1)
        : argsArray.slice(1); // first token was either a mention or an ID either way
      if (remainingArgs.length > 0) {
        const parsed = parseInt(remainingArgs[0], 10);
        if (!isNaN(parsed)) indexArg = parsed;
      }
  
      const mockInteraction = {
        isMock: true,
        guild: message.guild,
        guildId: message.guild?.id,
        channel: message.channel,
        member: message.member,
        author: message.author,
        processingMessage: null,
        options: {
          getUser: (name) => targetUser,
          getInteger: (name) => indexArg,
        },
        reply: async (options) => {
          return message.reply(options);
        },
        editReply: async (options) => {
          if (mockInteraction.processingMessage) {
            return mockInteraction.processingMessage.edit(options);
          }
          return message.reply(options);
        },
      };
      await this.execute(mockInteraction, client).catch(() => null);
    },
  };