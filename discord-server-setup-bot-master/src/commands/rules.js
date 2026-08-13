const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

const customizationSessions = new Map();
const CUSTOMIZATION_TTL = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of customizationSessions.entries()) {
    if (now - session.createdAt > CUSTOMIZATION_TTL) customizationSessions.delete(key);
  }
}, 30 * 1000).unref?.();

function extractHeading(rule) {
  const match = rule.match(/\*\*🔹\s+([^\n*]+)\*\*/);
  return match ? match[1].trim() : null;
}

const RULE_TEMPLATES = {
  lenient: {
    title: 'Server Rules',
    description: 'Keep things easygoing, respectful, and friendly for everyone.',
    rules: [
      '**🔹 NO HARASSMENT**\nTreat everyone with respect. Absolutely no harassment, witch hunting, racism or hate speech will be tolerated.',
      '**🔹 NO SPAM**\nNo spam or huge text walls. These will get muted so act wisely.',
      '**🔹 NO SENSITIVE TOPICS**\nNo sensitive topics. Keep it nice and encourage others to talk more and keep everything safe.',
      '**🔹 REPORT TO STAFF**\nIf you see something against the rules or something that makes you feel unsafe, let staff know. We want this server to be a welcoming space!',
      '**🔹 NO NSFW**\nNo NSFW, no age-restricted or obscene content. This includes text, images, or links featuring hard violence or other disturbing graphic content.'
    ]
  },
  medium: {
    title: 'Community Rules',
    description: 'A clear standard for a safe, respectful, and productive community.',
    rules: [
      '**🔹 NO HARASSMENT**\nTreat everyone with respect. Absolutely no harassment, witch hunting, racism or hate speech will be tolerated.',
      '**🔹 NO SPAM**\nNo spam or huge text walls. These will get muted so act wisely.',
      '**🔹 NO SENSITIVE TOPICS**\nNo sensitive topics. Keep it nice and encourage others to talk more and keep everything safe.',
      '**🔹 REPORT TO STAFF**\nIf you see something against the rules or something that makes you feel unsafe, let staff know. We want this server to be a welcoming space!',
      '**🔹 NO NSFW**\nNo NSFW, no age-restricted or obscene content. This includes text, images, or links featuring hard violence or other disturbing graphic content.',
      '**🔹 SPEAK IN RELEVANT CHATS**\nPlease speak in relevant chats.',
      '**🔹 NO RELATIONSHIPS**\nNo relationships or anything. If you are bothered, please leave the server.',
      '**🔹 NO MINIMODDING**\nNo minimodding or telling everyone what to do if you are not a moderator.'
    ]
  },
  strict: {
    title: 'Strict Community Standards',
    description: 'This server is run under clear moderation standards to keep the environment safe, professional, and welcoming.',
    rules: [
      '**🔹 NO HARASSMENT**\nTreat everyone with respect. Absolutely no harassment, witch hunting, racism or hate speech will be tolerated.',
      '**🔹 NO SPAM**\nNo spam or huge text walls. These will get muted so act wisely.',
      '**🔹 NO SENSITIVE TOPICS**\nNo sensitive topics. Keep it nice and encourage others to talk more and keep everything safe.',
      '**🔹 REPORT TO STAFF**\nIf you see something against the rules or something that makes you feel unsafe, let staff know. We want this server to be a welcoming space!',
      '**🔹 NO NSFW**\nNo NSFW, no age-restricted or obscene content. This includes text, images, or links featuring hard violence or other disturbing graphic content.',
      '**🔹 SPEAK IN RELEVANT CHATS**\nPlease speak in relevant chats.',
      '**🔹 NO RELATIONSHIPS**\nNo relationships or anything. If you are bothered, please leave the server.',
      '**🔹 NO MINIMODDING**\nNo minimodding or telling everyone what to do if you are not a moderator.',
      '**🔹 ACT CAREFULLY**\nIf you have second thoughts about posting something, you probably should not. Think before you act. We should not always tell you what you should and should not do. Do not disturb chat. Examples include spamming by posting repeated text or large blocks of text or emoji spam. Moderators may take action if they feel you are violating the server rules.',
      '**🔹 NO ADVERTISEMENT**\nAdvertising is not allowed. If you advertise, you will get muted. If you get caught DM advertising, you will get banned. You can send links to share a video with someone, such as YouTube or TikTok, but not for self-promotion. Videos you share must follow the server rules as well.',
      '**🔹 NO IMPERSONATION**\nNo impersonation or stealing the identity of other members. Otherwise, it will result in moderation action.',
      '**🔹 NO PERSONAL INFO**\nPlease do not share personal information such as address, family problems, personal problems, phone number, name, face, or other sensitive details. It is not safe for us to work with.',
      '**🔹 ONLY ENGLISH**\nNo other languages besides English. If you do speak in other languages, you will be given a warning or muted. We made this rule because it makes it harder for us to work with, so please cooperate.',
      '**🔹 NO PINGING WITHOUT CONTEXT**\nIf you find a way to ping everyone or ping members without context, it is considered disruptive and may result in moderation action.',
      '**🔹 KEEP ARGUMENTS CIVIL**\nIf you are arguing with someone, keep it civil. No calling each other names or swearing at them consecutively. This may result in a ban, so take it to DMs.',
      '**🔹 NO POLITICAL ARGUMENTS**\nPolitical arguments or discussing previous incidents between countries or regions will not be tolerated.',
      '**🔹 NO SUSPICIOUS MALWARE**\nSending mysterious links with no context will be treated as malware and may result in a ban for the member’s safety.',
      '**🔹 NO PROMOTING BRAGGING EXTERIOR GENDERS**\nDoing this will result in immediate ban or kick as it makes others feel weird and hatred grows between members.',
      '**🔹 NO MISINFORMATION**\nSpreading misinformation will not be tolerated. Conspiring between members, mods, or the owner will earn you a ban.',
      '**🔹 FOLLOW DISCORD TOS AND GUIDELINES**\nPlease follow Discord TOS and community guidelines. Being underage is strictly against the Discord TOS. If you are under 13, you will be banned and reported to Discord.\nhttps://discordapp.com/terms\nhttps://discordapp.com/guidelines'
    ]
  }
};

function buildRulesEmbed(template, blacklist = []) {
  const filtered = template.rules.filter((_, idx) => !blacklist.includes(idx));
  const color = template === RULE_TEMPLATES.strict ? '#ED4245' : template === RULE_TEMPLATES.lenient ? '#57F287' : '#5865F2';
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`📜 ${template.title}`)
    .setDescription(template.description);
  
  if (filtered.length === 0) {
    embed.addFields({ name: '⚠️ No Rules', value: 'All rules have been removed.' });
  } else {
    embed.addFields(
      ...filtered.map((rule, index) => ({
        name: `Rule ${index + 1}`,
        value: rule,
        inline: false,
      }))
    );
  }
  
  embed.setFooter({ text: 'Please read these rules carefully and follow them to keep the community safe and respectful.' });
  return embed;
}

function buildBlacklistSelectMenu(template, blacklist) {
  const options = template.rules.map((rule, idx) => {
    const heading = extractHeading(rule) || `Rule ${idx + 1}`;
    return {
      label: heading.slice(0, 100),
      value: `rule_${idx}`,
      emoji: blacklist.includes(idx) ? '❌' : '✅',
      default: blacklist.includes(idx),
    };
  });

  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('rules_blacklist')
      .setPlaceholder('Click to toggle rule removal')
      .setMinValues(0)
      .setMaxValues(options.length)
      .addOptions(options)
  );
}

function buildControlButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rules_preview').setLabel('Preview').setStyle(ButtonStyle.Primary).setEmoji('👁️'),
    new ButtonBuilder().setCustomId('rules_send').setLabel('Send Rules').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('rules_reset').setLabel('Reset').setStyle(ButtonStyle.Secondary).setEmoji('🔄'),
    new ButtonBuilder().setCustomId('rules_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('✖️')
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Generate and customize server rules.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((option) =>
      option
        .setName('template')
        .setDescription('Choose how strict the rules should be')
        .setRequired(true)
        .addChoices(
          { name: 'Lenient', value: 'lenient' },
          { name: 'Medium', value: 'medium' },
          { name: 'Strict', value: 'strict' }
        )
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel to send the rules in')
        .setRequired(false)
    )
    .addBooleanOption((option) =>
      option
        .setName('pin')
        .setDescription('Pin the rule message after sending it')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: '❌ You need administrator permission to post the rules embed.',
        flags: [MessageFlags.Ephemeral],
      }).catch(() => null);
    }

    const templateName = interaction.options.getString('template') || 'medium';
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const shouldPin = interaction.options.getBoolean('pin') || false;
    const template = RULE_TEMPLATES[templateName] || RULE_TEMPLATES.medium;

    const sessionKey = `${interaction.guildId}-${interaction.user.id}`;
    customizationSessions.set(sessionKey, {
      templateName,
      template,
      targetChannel,
      shouldPin,
      blacklist: [],
      createdAt: Date.now(),
    });

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎨 Customize Your Rules')
      .setDescription(`Template: **${template.title}**\n\nDeselect any rules you want to remove. Click **Preview** to see the final result before sending.`)
      .addFields({ name: '📋 Rules to Remove', value: 'None selected', inline: false })
      .setFooter({ text: `${template.rules.length} total rules available` });

    const selectMenu = buildBlacklistSelectMenu(template, []);
    const buttons = buildControlButtons();

    await interaction.reply({
      embeds: [embed],
      components: [selectMenu, buttons],
      ephemeral: true,
    }).catch(() => null);
  },
  async handleInteraction(interaction, client) {
    const sessionKey = `${interaction.guildId}-${interaction.user.id}`;
    const session = customizationSessions.get(sessionKey);
    if (!session) return interaction.reply({ content: '⌛ Session expired. Run `/rules` again.', flags: [MessageFlags.Ephemeral] }).catch(() => null);

    if (interaction.customId === 'rules_blacklist' && typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu()) {
      const selectedValues = interaction.values.map(v => parseInt(v.replace('rule_', '')));
      const allIndices = Array.from({ length: session.template.rules.length }, (_, i) => i);
      session.blacklist = allIndices.filter(idx => !selectedValues.includes(idx));
      session.createdAt = Date.now();
      const rulesRemoved = session.blacklist.length;
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎨 Customize Your Rules')
        .setDescription(`Template: **${session.template.title}**\n\nDeselect rules to remove. Click **Preview** for the final result.`)
        .addFields({
          name: '📋 Rules to Remove',
          value: rulesRemoved === 0 ? 'None selected' : `${rulesRemoved} rule(s) will be removed`,
          inline: false,
        })
        .setFooter({ text: `${session.template.rules.length} total | ${session.template.rules.length - rulesRemoved} will show` });
      await interaction.update({ embeds: [embed], components: [buildBlacklistSelectMenu(session.template, session.blacklist), buildControlButtons()] }).catch(() => null);
    }
    if (interaction.customId === 'rules_preview') {
      await interaction.reply({ embeds: [buildRulesEmbed(session.template, session.blacklist)], flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }
    if (interaction.customId === 'rules_reset') {
      session.blacklist = [];
      session.createdAt = Date.now();
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎨 Customize Your Rules')
        .setDescription(`Template: **${session.template.title}**\n\nDeselect rules to remove. Click **Preview** for the final result.`)
        .addFields({ name: '📋 Rules to Remove', value: 'None selected', inline: false })
        .setFooter({ text: `${session.template.rules.length} total rules available` });
      await interaction.update({ embeds: [embed], components: [buildBlacklistSelectMenu(session.template, []), buildControlButtons()] }).catch(() => null);
    }
    if (interaction.customId === 'rules_cancel') {
      customizationSessions.delete(sessionKey);
      await interaction.update({ embeds: [], components: [], content: '✖️ Cancelled.' }).catch(() => null);
    }
    if (interaction.customId === 'rules_send') {
      const finalEmbed = buildRulesEmbed(session.template, session.blacklist);
      const message = await session.targetChannel.send({ embeds: [finalEmbed] }).catch(() => null);
      if (!message) return interaction.reply({ content: '❌ Could not send rules.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
      if (session.shouldPin) await message.pin().catch(() => null);
      customizationSessions.delete(sessionKey);
      await interaction.update({
        embeds: [],
        components: [],
        content: `✅ Rules sent to ${session.targetChannel}${session.shouldPin ? ' and pinned.' : '.'}`,
      }).catch(() => null);
    }
  },
};
