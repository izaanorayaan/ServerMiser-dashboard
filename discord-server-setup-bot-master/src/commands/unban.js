const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { logAction } = require('../utils/auditLog');
const db = require('../utils/database'); // Restored your internal adapter mapping

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user from the server using their username')
    .addStringOption(option => 
      option.setName('username')
        .setDescription('The exact username of the user to unban')
        .setRequired(true)
    )
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('Reason for the unban')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  name: 'unban',

  async execute(interaction, client) {
    // Standardize checking layer to see if it is a real interaction or text mock
    const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : (interaction.options && !interaction.isMock ? true : false);
    
    if (isInteraction) {
      await interaction.deferReply().catch(() => null);
    } else {
      // Safely monitor prefix status updates to prevent multiple text outputs
      interaction.processingMessage = await interaction.reply('⏳ Querying ban list registries...').catch(() => null);
    }

    const guild = interaction.guild;
    const author = isInteraction ? interaction.user : interaction.author; 
    const memberExecutor = interaction.member;
    const guildId = interaction.guildId;

    if (!memberExecutor.permissions.has(PermissionFlagsBits.BanMembers)) {
      const msg = '❌ You need Ban Members permission to revoke bans!';
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }

    try {
      const targetName = interaction.options.getString('username')?.trim();
      const reason = interaction.options.getString('reason') || 'No reason provided';

      if (!targetName) {
        const msg = '❌ Please specify a username to unban! Example: `|unban john_doe`';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      const banList = await guild.bans.fetch({ cache: false }).catch(() => null);
      if (!banList || banList.size === 0) {
        const msg = '❌ There are no banned users registered on this server!';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      const targetNameLower = targetName.toLowerCase();
      const banEntry = banList.find(b => 
        b.user.username.toLowerCase() === targetNameLower || 
        b.user.tag.toLowerCase() === targetNameLower ||
        b.user.id === targetNameLower
      );

      if (!banEntry) {
        const msg = `❌ Could not find a banned user named **${targetName}**! Ensure spelling matches exactly.`;
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      const user = banEntry.user;
      await guild.members.unban(user.id, reason);

      const settings = (await db.readData('settings.json')) || {};
      const currentGuildSettings = settings[guildId] || {};
      
      if (currentGuildSettings.modLogsEnabled && currentGuildSettings.unifiedLogChannelId) {
        const modLogsChannel = guild.channels.cache.get(currentGuildSettings.unifiedLogChannelId) || await guild.channels.fetch(currentGuildSettings.unifiedLogChannelId).catch(() => null);
        
        if (modLogsChannel) {
          const embedLog = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('🛡️ Unified Moderation: User Unbanned')
            .addFields(
              { name: 'Target User', value: `${user.username} (${user.id})`, inline: true },
              { name: 'Responsible Staff', value: `${author.username}`, inline: true },
              { name: 'Reason Given', value: reason }
            )
            .setTimestamp();
          await modLogsChannel.send({ embeds: [embedLog] }).catch(() => null);
        }
      }

      await logAction(guild, 'User Unbanned', author, `User: ${user.username}, Reason: ${reason}`);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('✅ User Unbanned')
        .setDescription(`**${user.username}** has been successfully unbanned.\nReason: ${reason}`);

      return isInteraction ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Unban error:', error);
      const msg = `❌ Error unbanning user: ${error.message}`;
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }
  },

  // 🌟 FIXED: Unified properties alignment, safe text selection indices, and redirect handlers
  async executePrefix(message, argsArray, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('❌ Permissions required!').catch(() => null);
    }

    const usernameArg = argsArray && argsArray[0] ? argsArray[0].trim() : null;
    const reasonArg = argsArray && argsArray.length > 1 ? argsArray.slice(1).join(' ') : 'No reason provided';

    const mockInteraction = {
      isMock: true,
      guild: message.guild,
      guildId: message.guild.id,
      member: message.member,
      author: message.author, // Aligns beautifully with text sender scopes
      processingMessage: null,
      options: {
        getString: (name) => name === 'username' ? usernameArg : reasonArg
      },
      reply: async (options) => {
        return message.reply(options);
      },
      // Redirect state corrections directly onto processing message instances
      editReply: async (options) => {
        if (mockInteraction.processingMessage) {
          return mockInteraction.processingMessage.edit(options);
        }
        return message.reply(options);
      }
    };

    await this.execute(mockInteraction, client).catch(err => console.error('Error handling unban prefix wrapper:', err));
  }
};
