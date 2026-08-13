const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { logAction = () => {} } = require('../utils/auditLog');
const db = require('../utils/database'); // Restored your internal adapter mapping

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user from the server')
    .addUserOption(option => option.setName('user').setDescription('User to kick').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for kick').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  name: 'kick',

  async execute(interaction, client) {
    // Correct checking layer to see if it is a real interaction or text mock
    const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : (interaction.options && !interaction.isMock ? true : false);
    
    if (isInteraction) {
      await interaction.deferReply().catch(() => null);
    } else {
      // Keep track of the initial processing status message for text commands
      interaction.processingMessage = await interaction.reply('⏳ Processing kick command...').catch(() => null);
    }

    const guild = interaction.guild;
    const author = isInteraction ? interaction.user : interaction.author; 
    const memberExecutor = interaction.member;
    const guildId = interaction.guildId;

    if (!memberExecutor.permissions.has(PermissionFlagsBits.KickMembers)) {
      const msg = '❌ You need Kick Members permission!';
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }

    try {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      if (!user) {
        const msg = '❌ Please mention a valid user or provide a valid user ID.';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      const member = await guild.members.fetch({ user: user.id, force: true }).catch(() => null);
      if (!member) {
        const msg = '❌ This user is not in the server! You cannot kick someone who has already left.';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      if (!member.kickable) {
        const msg = '❌ I cannot kick this user! Their roles are higher than mine or yours.';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      await member.kick(reason);

      // 🌟 ADAPTER RESOLUTION: Reverted back to your functional collection mapping structures
      const settings = (await db.readData('settings.json')) || {};
      const currentGuildSettings = settings[guildId] || {};
      
      if (currentGuildSettings.modLogsEnabled && currentGuildSettings.unifiedLogChannelId) {
        const modLogsChannel = guild.channels.cache.get(currentGuildSettings.unifiedLogChannelId) || await guild.channels.fetch(currentGuildSettings.unifiedLogChannelId).catch(() => null);
        
        if (modLogsChannel) {
          const embedLog = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('🛡️ Unified Moderation: User Kicked')
            .addFields(
              { name: 'Target User', value: `${user.username} (${user.id})` },
              { name: 'Responsible Staff', value: `${author.username}` },
              { name: 'Reason Given', value: reason }
            )
            .setTimestamp();
          await modLogsChannel.send({ embeds: [embedLog] }).catch(() => null);
        }
      }

      await logAction(guild, 'User Kicked', author, `User: ${user.username}, Reason: ${reason}`);

      const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('✅ User Kicked')
        .setDescription(`${user.username} has been kicked.\nReason: ${reason}`);

      return isInteraction ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Kick error:', error);
      const msg = `❌ Error kicking user: ${error.message}`;
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }
  },

  // 🌟 FIXED: Safe argument array targeting and clean execution wrappers
  async executePrefix(message, argsArray, client) {
    let targetUser = message.mentions.users.first();
    
    // Correct index selection mapping implemented
    if (!targetUser && argsArray && argsArray.length > 0) {
      const pureId = argsArray[0].replace(/[^0-9]/g, '');
      if (pureId.length >= 17 && pureId.length <= 20) {
        targetUser = await client.users.fetch(pureId).catch(() => null);
      }
    }
    const reasonText = argsArray && argsArray.length > 1 ? argsArray.slice(1).join(' ') : 'No reason provided';

    const mockInteraction = {
      isMock: true,
      guild: message.guild,
      guildId: message.guild.id,
      member: message.member,
      author: message.author,
      processingMessage: null,
      options: {
        getUser: (name) => targetUser,
        getString: (name) => reasonText
      },
      reply: async (options) => {
        return message.reply(options);
      },
      // Safely redirects status overrides directly back onto the parsing container
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
