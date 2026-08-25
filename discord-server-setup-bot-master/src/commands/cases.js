'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { ModerationCase } = require('../utils/moderationCases');

module.exports = {
  name: 'cases',
  data: new SlashCommandBuilder()
    .setName('cases')
    .setDescription('Search and manage staff moderation cases')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub => sub
      .setName('search')
      .setDescription('Search cases by user ID or case number')
      .addStringOption(opt => opt.setName('query').setDescription('User ID, case number, or username').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('note')
      .setDescription('Add notes or evidence to a case')
      .addIntegerOption(opt => opt.setName('case').setDescription('Case number').setRequired(true))
      .addStringOption(opt => opt.setName('note').setDescription('Internal staff note').setRequired(false))
      .addStringOption(opt => opt.setName('evidence').setDescription('Evidence URL or reference').setRequired(false)))
    .addSubcommand(sub => sub
      .setName('export')
      .setDescription('Export moderation history as a JSON file')
      .addUserOption(opt => opt.setName('user').setDescription('Only export this user\'s history').setRequired(false))),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'search') {
      const query = interaction.options.getString('query').trim();
      const numeric = Number(query.replace(/^#/, ''));
      const filter = Number.isInteger(numeric) && numeric > 0
        ? { guildId: interaction.guildId, caseNumber: numeric }
        : { guildId: interaction.guildId, $or: [{ targetId: query }, { targetTag: new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }] };
      const records = await ModerationCase.find(filter).sort({ createdAt: -1 }).limit(25).lean();
      if (!records.length) return interaction.reply({ content: 'No matching moderation cases found.', ephemeral: true });
      const embed = new EmbedBuilder().setTitle('Moderation Case Search').setColor('#5865F2');
      embed.setDescription(records.map(record => `**Case #${record.caseNumber}** | ${record.action.toUpperCase()} | <@${record.targetId}>\n${record.reason}\n<t:${Math.floor(new Date(record.createdAt).getTime() / 1000)}:R>`).join('\n\n'));
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (subcommand === 'note') {
      const caseNumber = interaction.options.getInteger('case');
      const note = interaction.options.getString('note');
      const evidence = interaction.options.getString('evidence');
      if (!note && !evidence) return interaction.reply({ content: 'Provide a note or evidence reference.', ephemeral: true });
      const record = await ModerationCase.findOne({ guildId: interaction.guildId, caseNumber });
      if (!record) return interaction.reply({ content: `Case #${caseNumber} was not found.`, ephemeral: true });
      if (note) record.notes = record.notes ? `${record.notes}\n${note}` : note;
      if (evidence) record.evidence.push(evidence);
      await record.save();
      return interaction.reply({ content: `Updated Case #${caseNumber}.`, ephemeral: true });
    }

    const user = interaction.options.getUser('user');
    const records = await ModerationCase.find({ guildId: interaction.guildId, ...(user ? { targetId: user.id } : {}) }).sort({ caseNumber: 1 }).lean();
    const payload = Buffer.from(JSON.stringify(records, null, 2));
    return interaction.reply({ content: `Exported ${records.length} moderation case${records.length === 1 ? '' : 's'}.`, files: [new AttachmentBuilder(payload, { name: 'moderation-history.json' })], ephemeral: true });
  },
};
