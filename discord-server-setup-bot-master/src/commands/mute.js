const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { logAction } = require('../utils/auditLog');
const db = require('../utils/database'); // Restored your internal adapter mapping

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user for a custom duration (1m to 28d)')
    .addUserOption(option => option.setName('user').setDescription('User to mute').setRequired(true))
    .addStringOption(option =>
      option.setName('duration')
        .setDescription('Mute duration (e.g., 30m, 2h, 7d, 3w)')
        .setRequired(true)
    )
    .addStringOption(option => option.setName('reason').setDescription('Reason for mute').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  name: 'mute',

  async execute(interaction, client) {
    // Correct checking layer to see if it is a real interaction or text mock
    const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : (interaction.options && !interaction.isMock ? true : false);

    if (isInteraction) {
      await interaction.deferReply().catch(() => null);
    } else {
      // Keep track of the initial processing status message for text commands
      interaction.processingMessage = await interaction.reply('⏳ Processing mute transaction...').catch(() => null);
    }

    const guild = interaction.guild;
    const author = isInteraction ? interaction.user : interaction.author; 
    const memberExecutor = interaction.member;
    const guildId = interaction.guildId;

    if (!memberExecutor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      const msg = '❌ You need Moderate Members permission!';
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }

    try {
      const user = interaction.options.getUser('user');
      const durationInput = interaction.options.getString('duration');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      if (!user) {
        const msg = '❌ Please mention a valid user or provide a valid user ID.';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      const member = await guild.members.fetch({ user: user.id, force: true }).catch(() => null);
      if (!member) {
        const msg = '❌ This user is not in the server! You cannot mute someone who is not here.';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      if (!durationInput) {
        const msg = '❌ Please specify a duration. Example: `30m`, `4h`, `5d`, `2w`';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      const durationRegex = /^(\d+)([mhdw])$/i;
      const match = durationInput.match(durationRegex);

      if (!match) {
        const msg = '❌ Invalid format! Use numbers followed by unit: `m` (minutes), `h` (hours), `d` (days), `w` (weeks).';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      let durationMs = 0;
      if (unit === 'm') durationMs = amount * 60 * 1000;
      if (unit === 'h') durationMs = amount * 60 * 60 * 1000;
      if (unit === 'd') durationMs = amount * 24 * 60 * 60 * 1000;
      if (unit === 'w') durationMs = amount * 7 * 24 * 60 * 60 * 1000;

      const MIN_MS = 60 * 1000;
      const MAX_MS = 28 * 24 * 60 * 60 * 1000;

      if (durationMs < MIN_MS || durationMs > MAX_MS) {
        const msg = '❌ Duration must be between **1 minute (1m)** and **28 days (28d)**!';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      if (!member.moderatable) {
        const msg = '❌ I cannot mute this user! Their roles might be higher than mine or yours.';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      await member.timeout(durationMs, reason);

      const mutes = (await db.readData('mutes.json')) || {};
      if (!mutes[guildId]) mutes[guildId] = {};
      mutes[guildId][user.id] = { muteEnd: Date.now() + durationMs, reason };
      await db.writeData('mutes.json', mutes);

      const settings = (await db.readData('settings.json')) || {};
      const currentGuildSettings = settings[guildId] || {};
      
      if (currentGuildSettings.modLogsEnabled && currentGuildSettings.unifiedLogChannelId) {
        const modLogsChannel = guild.channels.cache.get(currentGuildSettings.unifiedLogChannelId) || await guild.channels.fetch(currentGuildSettings.unifiedLogChannelId).catch(() => null);
        
        if (modLogsChannel) {
          const embedLog = new EmbedBuilder()
            .setColor('#FFFF00')
            .setTitle('🛡️ Unified Moderation: User Muted')
            .addFields(
              { name: 'Target User', value: `${user.username} (${user.id})`, inline: true },
              { name: 'Responsible Staff', value: `${author.username}`, inline: true },
              { name: 'Mute Duration', value: durationInput.toLowerCase(), inline: true },
              { name: 'Reason Given', value: reason }
            )
            .setTimestamp();
          await modLogsChannel.send({ embeds: [embedLog] }).catch(() => null);
        }
      }

      await logAction(guild, 'User Muted', author, `User: ${user.username}, Duration: ${durationInput}, Reason: ${reason}`);

      const embed = new EmbedBuilder()
        .setColor('#FFFF00')
        .setTitle('✅ User Muted')
        .setDescription(`${user.username} has been muted for ${durationInput.toLowerCase()}.\nReason: ${reason}`);

      return isInteraction ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Mute error:', error);
      const msg = `❌ Error muting user: ${error.message}`;
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }
  },

  // 🌟 FIXED: Added correct input selectors and state tracking redirects
  async executePrefix(message, argsArray, client) {
    let targetUser = message.mentions.users.first();
    
    // Correct index selection mapping implemented
    if (!targetUser && argsArray && argsArray.length > 0) {
      const pureId = argsArray[0].replace(/[^0-9]/g, '');
      if (pureId.length >= 17 && pureId.length <= 20) {
        targetUser = await client.users.fetch(pureId).catch(() => null);
      }
    }
    const durationText = argsArray && argsArray[1] ? argsArray[1] : '';
    const reasonText = argsArray && argsArray.length > 2 ? argsArray.slice(2).join(' ') : 'No reason provided';

    const mockInteraction = {
      isMock: true,
      guild: message.guild,
      guildId: message.guild?.id,
      member: message.member,
      author: message.author,
      processingMessage: null,
      options: {
        getUser: (name) => targetUser,
        getString: (name) => name === 'duration' ? durationText : reasonText
      },
      reply: async (options) => {
        return message.reply(options);
      },
      // Redirect status message updates cleanly onto the text message instance
      editReply: async (options) => {
        if (mockInteraction.processingMessage) {
          return mockInteraction.processingMessage.edit(options);
        }
        return message.reply(options);
      }
    };
    await this.execute(mockInteraction, client).catch(() => null);
  }
};
