const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const db = require('../utils/database'); // Points to your old-shape mapping framework

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View warnings for a user')
    .addUserOption(option => option.setName('user').setDescription('User to check').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  name: 'warnings',

  async execute(interaction, client) {
    // Standardize checking layer to see if it is a real interaction or text mock
    const isInteraction = interaction.isChatInputCommand ? interaction.isChatInputCommand() : (interaction.options && !interaction.isMock ? true : false);

    if (isInteraction) {
      await interaction.deferReply().catch(() => null);
    } else {
      // Safely monitor prefix status updates to prevent multiple text outputs
      interaction.processingMessage = await interaction.reply('⏳ Querying collection histories...').catch(() => null);
    }

    const guild = interaction.guild;
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

      // 🌟 ADAPTER RECONSTRUCTION: Safely parsing historical records out of your setup array maps
      const warnings = (await db.readData('warnings.json')) || {};
      const userWarnings = warnings[guildId]?.[user.id] || [];

      if (userWarnings.length === 0) {
        const msg = `✅ **${user.username}** has no active warnings on this server!`;
        return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply({ content: msg });
      }
      
      const embed = new EmbedBuilder()
        .setColor('#FF6600')
        .setTitle(`📜 Warnings History: ${user.username}`)
        .setDescription('Total Tracked Server Infractions: **' + userWarnings.length + '**');

      userWarnings.slice(0, 25).forEach((warning, index) => {
        const timestampMs = warning.timestamp ? Math.floor(new Date(warning.timestamp).getTime() / 1000) : null;
        const timeDisplay = timestampMs ? '<t:' + timestampMs + ':R>' : '`Unknown Date`';

        embed.addFields({
          name: '⚠️ Infraction Entry #' + (index + 1),
          value: '**Reason:** ' + warning.reason + '\n**Staff ID:** <@' + warning.moderatorId + '>\n**Issued:** ' + timeDisplay,
        });
      });

      return isInteraction ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Warnings error:', error);
      const msg = `❌ Error fetching warnings: ${error.message}`;
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }
  },

  // 🌟 FIXED: Target index 0 of the string array and map tracking status overrides cleanly
  async executePrefix(message, argsArray, client) {
    let targetUser = message.mentions.users.first();
    
    // Correct index selection mapping implemented to handle text searches safely
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
        getUser: (name) => targetUser || message.author
      },
      reply: async (options) => {
        return message.reply(options);
      },
      // Redirect state updates back onto the processing message instance
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
