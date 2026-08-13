const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

const CHANNEL_TYPES = [
  { name: 'Text', value: 'text', type: ChannelType.GuildText },
  { name: 'Voice', value: 'voice', type: ChannelType.GuildVoice },
  { name: 'Announcement', value: 'announcement', type: ChannelType.GuildAnnouncement },
  { name: 'Forum', value: 'forum', type: ChannelType.GuildForum },
  { name: 'Stage', value: 'stage', type: ChannelType.GuildStageVoice },
  { name: 'News', value: 'news', type: ChannelType.GuildAnnouncement },
];

function buildEmbed(title, description, color = '#5865F2') {
  return new EmbedBuilder().setColor(color).setTitle(title).setDescription(description);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channels')
    .setDescription('Create, edit, customize, and delete channels and categories.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new channel or category.')
        .addStringOption((opt) =>
          opt
            .setName('type')
            .setDescription('The type of channel to create')
            .setRequired(true)
            .addChoices(
              { name: 'Text', value: 'text' },
              { name: 'Voice', value: 'voice' },
              { name: 'Announcement', value: 'announcement' },
              { name: 'Forum', value: 'forum' },
              { name: 'Stage', value: 'stage' },
              { name: 'Category', value: 'category' }
            )
        )
        .addStringOption((opt) => opt.setName('name').setDescription('The name of the channel or category').setRequired(true))
        .addChannelOption((opt) => opt.setName('parent').setDescription('Optional parent category').setRequired(false))
        .addIntegerOption((opt) => opt.setName('bitrate').setDescription('Voice bitrate in kbps').setMinValue(8).setMaxValue(384).setRequired(false))
        .addIntegerOption((opt) => opt.setName('userlimit').setDescription('Voice user limit').setMinValue(0).setMaxValue(99).setRequired(false))
        .addBooleanOption((opt) => opt.setName('nsfw').setDescription('Mark the channel as NSFW').setRequired(false))
        .addBooleanOption((opt) => opt.setName('slowmode').setDescription('Enable slowmode for text channels').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete an existing channel or category.')
        .addChannelOption((opt) =>
          opt.setName('target').setDescription('Channel or category to delete').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Edit a channel name, topic, slowmode, and NSFW status.')
        .addChannelOption((opt) => opt.setName('target').setDescription('Channel to edit').setRequired(true))
        .addStringOption((opt) => opt.setName('name').setDescription('New channel name').setRequired(false))
        .addStringOption((opt) => opt.setName('topic').setDescription('Channel topic or description').setRequired(false))
        .addIntegerOption((opt) => opt.setName('slowmode').setDescription('Slowmode in seconds').setMinValue(0).setMaxValue(21600).setRequired(false))
        .addBooleanOption((opt) => opt.setName('nsfw').setDescription('Toggle channel NSFW').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('customize')
        .setDescription('Customize permissions, locks, and access for a channel.')
        .addChannelOption((opt) => opt.setName('target').setDescription('Channel to customize').setRequired(true))
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to adjust').setRequired(false))
        .addBooleanOption((opt) => opt.setName('view').setDescription('Allow/deny viewing the channel').setRequired(false))
        .addBooleanOption((opt) => opt.setName('send').setDescription('Allow/deny sending messages').setRequired(false))
        .addBooleanOption((opt) => opt.setName('connect').setDescription('Allow/deny joining voice chat').setRequired(false))
        .addBooleanOption((opt) => opt.setName('speak').setDescription('Allow/deny speaking in voice').setRequired(false))
    )
    .addSubcommand((sub) =>
      sub
        .setName('category')
        .setDescription('Create, delete, or customize a category.')
        .addStringOption((opt) =>
          opt
            .setName('action')
            .setDescription('Action to perform on the category')
            .setRequired(true)
            .addChoices(
              { name: 'Create', value: 'create' },
              { name: 'Delete', value: 'delete' },
              { name: 'Customize', value: 'customize' }
            )
        )
        .addStringOption((opt) => opt.setName('name').setDescription('Category name to create or rename').setRequired(false))
        .addChannelOption((opt) => opt.setName('target').setDescription('Category to operate on').setRequired(false))
        .addRoleOption((opt) => opt.setName('role').setDescription('Role to manage within the category').setRequired(false))
        .addBooleanOption((opt) => opt.setName('view').setDescription('Allow/deny category view access').setRequired(false))
    ),

  async execute(interaction) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ You need Manage Channels permission to use the channel manager.',
        flags: [MessageFlags.Ephemeral],
      }).catch(() => null);
    }

    const subcommand = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (subcommand === 'create') {
      const type = interaction.options.getString('type');
      const name = interaction.options.getString('name')?.trim();
      const parent = interaction.options.getChannel('parent');
      const bitrate = interaction.options.getInteger('bitrate');
      const userLimit = interaction.options.getInteger('userlimit');
      const nsfw = interaction.options.getBoolean('nsfw') || false;
      const slowmode = interaction.options.getBoolean('slowmode') || false;

      if (!name) {
        return interaction.reply({ content: '❌ Channel name is required.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }

      if (type === 'category') {
        const category = await guild.channels.create({
          name,
          type: ChannelType.GuildCategory,
          permissionOverwrites: []
        }).catch(() => null);

        if (!category) {
          return interaction.reply({ content: '❌ I could not create that category.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
        }

        return interaction.reply({ content: `✅ Created category ${category}.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }

      const selectedType = CHANNEL_TYPES.find((entry) => entry.value === type)?.type || ChannelType.GuildText;
      const channel = await guild.channels.create({
        name,
        type: selectedType,
        parent: parent?.id || null,
        nsfw,
        bitrate: selectedType === ChannelType.GuildVoice || selectedType === ChannelType.GuildStageVoice ? (bitrate ? bitrate * 1000 : undefined) : undefined,
        userLimit: selectedType === ChannelType.GuildVoice || selectedType === ChannelType.GuildStageVoice ? userLimit ?? 0 : undefined,
        rateLimitPerUser: (selectedType === ChannelType.GuildText || selectedType === ChannelType.GuildAnnouncement) && slowmode ? 5 : undefined,
      }).catch(() => null);

      if (!channel) {
        return interaction.reply({ content: '❌ I could not create that channel.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }

      return interaction.reply({ content: `✅ Created ${channel}.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    if (subcommand === 'delete') {
      const target = interaction.options.getChannel('target');
      if (!target) {
        return interaction.reply({ content: '❌ Please choose a valid channel or category.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }

      await target.delete().catch(() => null);
      return interaction.reply({ content: `✅ Deleted ${target}.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    if (subcommand === 'edit') {
      const target = interaction.options.getChannel('target');
      const name = interaction.options.getString('name');
      const topic = interaction.options.getString('topic');
      const slowmode = interaction.options.getInteger('slowmode');
      const nsfw = interaction.options.getBoolean('nsfw');

      if (!target || !target.isTextBased && !target.isVoiceBased && !target.type !== ChannelType.GuildCategory) {
        return interaction.reply({ content: '❌ Please select a valid channel or category.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }

      const updates = {};
      if (name) updates.name = name;
      if (topic !== null) updates.topic = topic;
      if (slowmode !== null) updates.rateLimitPerUser = slowmode;
      if (nsfw !== null) updates.nsfw = nsfw;

      if (Object.keys(updates).length === 0) {
        return interaction.reply({ content: '❌ Please choose at least one property to change.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }

      const edited = await target.edit(updates).catch(() => null);
      if (!edited) {
        return interaction.reply({ content: '❌ I could not edit that channel.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }

      return interaction.reply({ content: `✅ Updated ${edited}.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    if (subcommand === 'customize') {
      const target = interaction.options.getChannel('target');
      if (!target) {
        return interaction.reply({ content: '❌ Please select a channel.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }

      const role = interaction.options.getRole('role') || interaction.guild.roles.everyone;
      const view = interaction.options.getBoolean('view');
      const send = interaction.options.getBoolean('send');
      const connect = interaction.options.getBoolean('connect');
      const speak = interaction.options.getBoolean('speak');
      const allow = [];
      const deny = [];

      if (view !== null) {
        if (view) allow.push('ViewChannel'); else deny.push('ViewChannel');
      }
      if (send !== null) {
        if (send) allow.push('SendMessages'); else deny.push('SendMessages');
      }
      if (connect !== null) {
        if (connect) allow.push('Connect'); else deny.push('Connect');
      }
      if (speak !== null) {
        if (speak) allow.push('Speak'); else deny.push('Speak');
      }

      if (!allow.length && !deny.length) {
        return interaction.reply({ content: '❌ Please choose at least one permission to update.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }

      const permissionOverwrites = target.permissionOverwrites.cache.get(role.id) || { id: role.id, allow: [], deny: [] };
      const nextAllow = new Set(permissionOverwrites.allow.toArray ? permissionOverwrites.allow.toArray() : permissionOverwrites.allow || []);
      const nextDeny = new Set(permissionOverwrites.deny.toArray ? permissionOverwrites.deny.toArray() : permissionOverwrites.deny || []);

      for (const flag of allow) nextAllow.add(flag);
      for (const flag of deny) nextDeny.add(flag);

      for (const flag of allow) nextDeny.delete(flag);
      for (const flag of deny) nextAllow.delete(flag);

      await target.permissionOverwrites.edit(role, {
        ViewChannel: nextAllow.has('ViewChannel') ? true : nextDeny.has('ViewChannel') ? false : undefined,
        SendMessages: nextAllow.has('SendMessages') ? true : nextDeny.has('SendMessages') ? false : undefined,
        Connect: nextAllow.has('Connect') ? true : nextDeny.has('Connect') ? false : undefined,
        Speak: nextAllow.has('Speak') ? true : nextDeny.has('Speak') ? false : undefined,
      }).catch(() => null);

      return interaction.reply({ content: `✅ Updated permissions for ${role} in ${target}.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    if (subcommand === 'category') {
      const action = interaction.options.getString('action');
      const name = interaction.options.getString('name');
      const target = interaction.options.getChannel('target');
      const role = interaction.options.getRole('role');
      const view = interaction.options.getBoolean('view');

      if (action === 'create') {
        if (!name) {
          return interaction.reply({ content: '❌ Please provide a category name.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
        }

        const category = await guild.channels.create({ name, type: ChannelType.GuildCategory }).catch(() => null);
        if (!category) {
          return interaction.reply({ content: '❌ I could not create the category.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
        }

        return interaction.reply({ content: `✅ Created category ${category}.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }

      if (action === 'delete') {
        if (!target || target.type !== ChannelType.GuildCategory) {
          return interaction.reply({ content: '❌ Please select a valid category.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
        }

        await target.delete().catch(() => null);
        return interaction.reply({ content: `✅ Deleted category ${target}.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }

      if (action === 'customize') {
        if (!target || target.type !== ChannelType.GuildCategory) {
          return interaction.reply({ content: '❌ Please select a valid category.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
        }

        if (name) {
          await target.edit({ name }).catch(() => null);
        }

        if (role && view !== null) {
          await target.permissionOverwrites.edit(role, {
            ViewChannel: view,
          }).catch(() => null);
        }

        return interaction.reply({ content: `✅ Updated category ${target}.`, flags: [MessageFlags.Ephemeral] }).catch(() => null);
      }
    }

    return interaction.reply({ content: '❌ Unknown channel action.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  },
};
