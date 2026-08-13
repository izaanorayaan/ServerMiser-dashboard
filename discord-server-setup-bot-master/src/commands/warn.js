const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { logAction } = require('../utils/auditLog');
const db = require('../utils/database'); // Restored your internal adapter mapping

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a server member')
    .addUserOption(option => option.setName('user').setDescription('User to warn').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('Reason for warning').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  name: 'warn',

  async execute(interaction, client) {
    // Standardize checking layer to see if it is a real interaction or text mock
    const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : (interaction.options && !interaction.isMock ? true : false);

    if (isInteraction) {
      await interaction.deferReply().catch(() => null);
    } else {
      // Safely monitor prefix status updates to prevent multiple text outputs
      interaction.processingMessage = await interaction.reply('⏳ Writing infraction to cluster logs...').catch(() => null);
    }

    const guild = interaction.guild;
    const author = isInteraction ? interaction.user : interaction.author; 
    const memberExecutor = interaction.member;
    const guildId = interaction.guildId;

    if (!memberExecutor.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      const msg = '❌ You need Moderate Members permission to issue warnings!';
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }

    try {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');

      if (!user) {
        const msg = '❌ Please mention a valid user or provide a valid user ID.';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      const member = await guild.members.fetch({ user: user.id, force: true }).catch(() => null);
      if (!member) {
        const msg = '❌ This user is not in the server! You cannot warn someone who is not here.';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      if (!reason) {
        const msg = '❌ Please provide a reason for the warning. Use: `|warn @user <reason>`';
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
      }

      // 🌟 ADAPTER OPERATION: Safely updating through your custom json/mongodb schema wrapper
      const warnings = (await db.readData('warnings.json')) || {};
      if (!warnings[guildId]) warnings[guildId] = {};
      if (!warnings[guildId][user.id]) warnings[guildId][user.id] = [];

      warnings[guildId][user.id].push({
        moderatorId: author.id,
        reason: reason,
        timestamp: new Date().toISOString()
      });
      await db.writeData('warnings.json', warnings);

      const totalWarnings = warnings[guildId][user.id].length;

      // DM the user safely
      await user.send(`⚠️ You have been warned in **${guild.name}**.\n**Reason:** ${reason}`).catch(() => null);

      const settings = (await db.readData('settings.json')) || {};
      const currentGuildSettings = settings[guildId] || {};
      
      if (currentGuildSettings.modLogsEnabled && currentGuildSettings.unifiedLogChannelId) {
        const modLogsChannel = guild.channels.cache.get(currentGuildSettings.unifiedLogChannelId) || await guild.channels.fetch(currentGuildSettings.unifiedLogChannelId).catch(() => null);
        
        if (modLogsChannel) {
          const embedLog = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle('🛡️ Unified Moderation: User Warned')
            .addFields(
              { name: 'Target User', value: `${user.username} (${user.id})`, inline: true },
              { name: 'Responsible Staff', value: `${author.username}`, inline: true },
              { name: 'Total Infractions', value: totalWarnings.toString(), inline: true },
              { name: 'Reason Given', value: reason }
            )
            .setTimestamp();
          await modLogsChannel.send({ embeds: [embedLog] }).catch(() => null);
        }
      }

      await logAction(guild, 'User Warned', author, `User: ${user.username}, Reason: ${reason}`);

      const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('⚠️ User Warned')
        .setDescription(`${user.username} has been warned.\nReason: ${reason}\nTotal warnings: **${totalWarnings}**`);

      return isInteraction ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Warn error:', error);
      const msg = `❌ Error running warning system: ${error.message}`;
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }
  },

  // 🌟 FIXED: Implemented clean argument text parsing index and status update redirects
  async executePrefix(message, argsArray, client) {
    let targetUser = message.mentions.users.first();
    
    // Correct index check targeting index 0 directly to prevent crashes
    if (!targetUser && argsArray && argsArray.length > 0) {
      const pureId = argsArray[0].replace(/[^0-9]/g, '');
      if (pureId.length >= 17 && pureId.length <= 20) {
        targetUser = await client.users.fetch(pureId).catch(() => null);
      }
    }
    const reasonText = argsArray && argsArray.length > 1 ? argsArray.slice(1).join(' ') : '';

    const mockInteraction = {
      isMock: true,
      guild: message.guild,
      guildId: message.guild?.id,
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
      // Redirect state updates back to the temporary message reference seamlessly
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
