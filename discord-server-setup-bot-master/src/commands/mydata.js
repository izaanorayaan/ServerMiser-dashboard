const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const mongoose = require('mongoose');

const OWNER_ID = process.env.OWNER_ID || '889540845269823559';

module.exports = {
  name: 'mydata',
  data: new SlashCommandBuilder()
    .setName('mydata')
    .setDescription('Owner only: export live MongoDB data')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addStringOption(option =>
      option.setName('collection')
        .setDescription('Specific collection to export (optional)')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    const authorId = interaction.user.id;

    if (authorId !== OWNER_ID) {
      return interaction.reply({
        content: '❌ Error: This command can only be used by the Bot Owner!',
        ephemeral: true,
      }).catch(() => null);
    }

    try {
      if (mongoose.connection.readyState !== 1) {
        return interaction.reply({
          content: '❌ Error: The database connection is currently offline!',
          ephemeral: true,
        }).catch(() => null);
      }

      const db = mongoose.connection.db;

      const targetCollection = interaction.options.getString('collection');

      let dataPayload = {};
      let downloadFileName = 'all_database_collections.json';

      if (targetCollection) {
        const documents = await db.collection(targetCollection.toLowerCase()).find().toArray();
        dataPayload[targetCollection.toLowerCase()] = documents;
        downloadFileName = `${targetCollection.toLowerCase()}_backup.json`;
      } else {
        const collections = await db.listCollections().toArray();
        for (const col of collections) {
          dataPayload[col.name] = await db.collection(col.name).find().toArray();
        }
      }

      const jsonString = JSON.stringify(dataPayload, null, 2);
      const buffer = Buffer.from(jsonString, 'utf-8');
      const fileAttachment = new AttachmentBuilder(buffer, { name: downloadFileName });

      const outputMessage = `📊 **Live MongoDB Atlas Export: \`${downloadFileName}\`**\nHere is your real-time database backup file:`;

      return interaction.reply({ content: outputMessage, files: [fileAttachment] });
    } catch (error) {
      console.error('[DATABASE EXPORT CRASH]', error);
      return interaction.reply({
        content: `❌ Error: Failed to build database backup file: ${error.message}`,
        ephemeral: true,
      }).catch(() => null);
    }
  },
};
