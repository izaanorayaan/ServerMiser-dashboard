const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { logAction } = require('../utils/auditLog');
const db = require('../utils/database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a user')
    .addUserOption(option => option.setName('user').setDescription('User to unmute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  name: 'unmute',

  async execute(interaction, client) {
    // Correct checking layer to see if it is a real interaction or text mock
    const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : (interaction.options && !interaction.isMock ? true : false);

    if (isInteraction) {
      await interaction.deferReply().catch(() => null);
    } else {
      // Keep track of the initial processing status message for text commands
      interaction.processingMessage = await interaction.reply('⏳ Processing unmute transaction...').catch(() => null);
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

      if (!user) {
        const msg = '❌ Please mention a valid user or provide a valid user ID.';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        const msg = '❌ This user is not in the server.';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      await member.timeout(null);

      const mutes = (await db.readData('mutes.json')) || {};
      if (mutes[guildId] && mutes[guildId][user.id]) {
        delete mutes[guildId][user.id];
        await db.writeData('mutes.json', mutes);
      }

      const settings = (await db.readData('settings.json')) || {};
      const currentGuildSettings = settings[guildId] || {};

      if (currentGuildSettings.modLogsEnabled && currentGuildSettings.unifiedLogChannelId) {
        const modLogsChannel = guild.channels.cache.get(currentGuildSettings.unifiedLogChannelId) || await guild.channels.fetch(currentGuildSettings.unifiedLogChannelId).catch(() => null);
        if (modLogsChannel) {
          const embedLog = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🛡️ Unified Moderation: User Unmuted')
            .addFields(
              { name: 'Target User', value: `${user.username} (${user.id})`, inline: true },
              { name: 'Responsible Staff', value: `${author.username}`, inline: true }
            )
            .setTimestamp();
          await modLogsChannel.send({ embeds: [embedLog] }).catch(() => null);
        }
      }

      await logAction(guild, 'User Unmuted', author, `User: ${user.username}`);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ User Unmuted')
        .setDescription(`${user.username} has been unmuted.`);

      return isInteraction ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Unmute error:', error);
      const msg = `❌ Error unmuting user: ${error.message}`;
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }
  },

  // 🌟 FIXED: Safe argument string conversion and modular state tracking placeholders
  async executePrefix(message, argsArray, client) {
    let targetUser = message.mentions.users.first();
    
    // Correct index selection mapping implemented to avoid crashes
    if (!targetUser && argsArray && argsArray.length > 0) {
      const pureId = argsArray[0].replace(/[^0-9]/g, '');
      if (pureId.length >= 17 && pureId.length <= 20) {
        targetUser = await client.users.fetch(pureId).catch(() => null);
      }
    }

    const mockInteraction = {
      isMock: true,
      guild: message.guild,
      guildId: message.guild?.id,
      member: message.member,
      author: message.author,
      processingMessage: null,
      options: {
        getUser: (name) => targetUser
      },
      reply: async (options) => {
        return message.reply(options);
      },
      // Safely redirects edit status calls directly back to the active channel thread
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
