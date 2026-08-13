const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    EmbedBuilder,
    ChannelType
  } = require('discord.js');
  const { Schema, model, models } = require('mongoose');
  
  // ─────────────────────────────────────────────────────────────
  // Database Config & Schema Definitions
  // ─────────────────────────────────────────────────────────────
  
  const ACCENT_COLOR = 0x5865f2;
  const activeIntervals = new Map(); // Tracks live system timeouts in memory
  
  const AutoMessageSchema = new Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    roleId: { type: String, default: null }, 
    intervalMinutes: { type: Number, required: true },
    messageTemplate: { type: String, required: true },
    uniqueId: { type: String, required: true, unique: true } 
  });
  
  const AutoMessage = models.AutoMessage || model('AutoMessage', AutoMessageSchema);
  
  // ─────────────────────────────────────────────────────────────
  // Slash Command Definition (Restricted to Administrators)
  // ─────────────────────────────────────────────────────────────
  
  const data = new SlashCommandBuilder()
    .setName('automessage')
    .setDescription('Manage recurring scheduled message pings')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Establish a fresh scheduled repeating message loop')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('A unique name key to identify this task (e.g. chatrevive)').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt.setName('minutes').setDescription('Post interval timing block in minutes').setRequired(true).setMinValue(1)
        )
        .addStringOption((opt) =>
          opt.setName('text').setDescription('The message template string. Variables: {role}, {server}, {membercount}').setRequired(true)
        )
        .addChannelOption((opt) =>
          opt.setName('channel').setDescription('The target posting channel (defaults to current)').addChannelTypes(ChannelType.GuildText).setRequired(false)
        )
        .addRoleOption((opt) =>
          opt.setName('ping_role').setDescription('Optional role to bind to the {role} variable token').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Cancel an active scheduled loop and take it offline')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('The identification name key of the task to delete').setRequired(true)
        )
    );
  
  // ─────────────────────────────────────────────────────────────
  // Formatting & Core Variable Injection Engines
  // ─────────────────────────────────────────────────────────────
  
  function isPrefixMode(interaction) {
    return typeof interaction.isChatInputCommand === 'function' && interaction.isChatInputCommand() === false;
  }
  
  function parsePrefixArgs(interaction) {
    const raw = String(interaction.content || '');
    const tokens = raw.trim().split(/\s+/);
    const sub = tokens[1] ? tokens[1].toLowerCase() : null;
    const uniqueId = tokens[2] ? tokens[2].toLowerCase() : null;
  
    let minutes = null;
    if (sub === 'create' && tokens[3]) {
      const val = parseInt(tokens[3], 10);
      if (!isNaN(val)) minutes = val;
    }
  
    let targetChannel = interaction.channel;
    if (interaction.mentions?.channels?.size > 0) {
      targetChannel = interaction.mentions.channels.first();
    }
  
    let pingRole = null;
    if (interaction.mentions?.roles?.size > 0) {
      pingRole = interaction.mentions.roles.first();
    }
  
    const quotedMatch = raw.match(/"([^"]+)"/);
    const textString = quotedMatch ? quotedMatch[1] : null;
  
    return { sub, uniqueId, minutes, textString, targetChannel, pingRole };
  }
  
  function formatTemplate(template, guild, role) {
    const roleMention = role ? `<@&${role.id}>` : '@everyone';
    return template
      .replace(/{role}/g, roleMention)
      .replace(/{server}/g, guild.name)
      .replace(/{membercount}/g, guild.memberCount);
  }
// ─────────────────────────────────────────────────────────────
// Live Background Thread Timer Handling Systems
// ─────────────────────────────────────────────────────────────

function clearTaskTimer(uniqueId) {
    if (activeIntervals.has(uniqueId)) {
      clearInterval(activeIntervals.get(uniqueId));
      activeIntervals.delete(uniqueId);
    }
  }
  
  function startTaskTimer(client, config) {
    clearTaskTimer(config.uniqueId);
  
    const delayMs = config.intervalMinutes * 60 * 1000;
  
    const intervalId = setInterval(async () => {
      try {
        const guild = await client.guilds.fetch(config.guildId).catch(() => null);
        if (!guild) return;
  
        const channel = await guild.channels.fetch(config.channelId).catch(() => null);
        if (!channel) return;
  
        const role = config.roleId ? await guild.roles.fetch(config.roleId).catch(() => null) : null;
  
        const completedContent = formatTemplate(config.messageTemplate, guild, role);
        await channel.send(completedContent);
      } catch (err) {
        console.error(`Scheduled task execution loop ${config.uniqueId} hit a delivery failure:`, err.message);
      }
    }, delayMs);
  
    activeIntervals.set(config.uniqueId, intervalId);
  }
  
  // ─────────────────────────────────────────────────────────────
  // Startup Recovery Function
  // ─────────────────────────────────────────────────────────────
  
  async function recoverActiveTimers(client) {
    try {
      const savedTasks = await AutoMessage.find({});
      console.log(`[AutoMessage] Re-registering background interval processing threads: Found ${savedTasks.length} profiles.`);
      
      for (const config of savedTasks) {
        startTaskTimer(client, config);
      }
      console.log('✅ Background automation interval processing threads restored successfully.');
    } catch (err) {
      console.error('[AutoMessage Error] Failed running startup thread recovery maps loops:', err);
    }
  }
  
  // ─────────────────────────────────────────────────────────────
  // Subcommand Execution Routing Targets
  // ─────────────────────────────────────────────────────────────
  
  async function handleCreate(interaction, uniqueId, minutes, textString, targetChannel, pingRole) {
    const finalId = `${interaction.guild.id}_${uniqueId}`;
  
    const config = await AutoMessage.findOneAndUpdate(
      { uniqueId: finalId },
      {
        guildId: interaction.guild.id,
        channelId: targetChannel.id,
        roleId: pingRole ? pingRole.id : null,
        intervalMinutes: minutes,
        messageTemplate: textString,
        uniqueId: finalId
      },
      { upsert: true, new: true }
    );
  
    startTaskTimer(interaction.client, config);
  
    const embed = new EmbedBuilder()
      .setTitle('⏰ Recurring Task Initiated')
      .setDescription(`Successfully spun up background runtime automated posting loops.`)
      .addFields(
        { name: 'Task Handle Key', value: `\`${uniqueId}\``, inline: true },
        { name: 'Interval Rate', value: `\`Every ${minutes} minute${minutes === 1 ? '' : 's'}\``, inline: true },
        { name: 'Output Terminal', value: `${targetChannel}`, inline: true },
        { name: 'Assigned Ping Role', value: pingRole ? `${pingRole}` : '`@everyone (Default)`', inline: true },
        { name: 'Message Template Layout', value: `\`\`\`text\n${textString}\n\`\`\``, inline: false }
      )
      .setColor(ACCENT_COLOR)
      .setTimestamp();
  
    return interaction.reply({ embeds: [embed] });
  }
  
  async function handleRemove(interaction, uniqueId) {
    const finalId = `${interaction.guild.id}_${uniqueId}`;
    
    const result = await AutoMessage.deleteOne({ uniqueId: finalId });
    if (result.deletedCount === 0) {
      return interaction.reply({ content: `❌ No active repeating message loop discovered under handle key: \`${uniqueId}\`.` });
    }
  
    clearTaskTimer(finalId);
    return interaction.reply({ content: `✅ Task loop \`${uniqueId}\` has been turned off and deleted.` });
  }
  
  // ─────────────────────────────────────────────────────────────
  // Main Command Interface Entry Router Exports
  // ─────────────────────────────────────────────────────────────
  
  module.exports = {
    data,
    async execute(interaction) {
      if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
        const denyText = '❌ Access Denied: This utility requires **Administrator** security clearance.';
        return isPrefixMode(interaction) ? interaction.reply({ content: denyText }) : interaction.reply({ content: denyText, flags: [MessageFlags.Ephemeral] });
      }
  
      if (isPrefixMode(interaction)) {
        const parsed = parsePrefixArgs(interaction);
        if (parsed.sub === 'create') {
          if (!parsed.uniqueId || !parsed.minutes || !parsed.textString) {
            return interaction.reply({ content: '❌ Invalid arguments.\n**Usage:** `|automessage create [id_key] [minutes] "[message content text]" [@role_optional] [#channel_optional]`' });
          }
          return handleCreate(interaction, parsed.uniqueId, parsed.minutes, parsed.textString, parsed.targetChannel, parsed.pingRole);
        }
        if (parsed.sub === 'remove') {
          if (!parsed.uniqueId) return interaction.reply({ content: '❌ Please specify the task identifier.\n**Usage:** `|automessage remove [id_key]`' });
          return handleRemove(interaction, parsed.uniqueId);
        }
        return interaction.reply({ content: '❌ Unknown subcommand flag option layout. Options: `create` or `remove`.' });
      }
  
      const sub = interaction.options.getSubcommand();
      if (sub === 'create') {
        const uniqueId = interaction.options.getString('id').toLowerCase().replace(/[^a-z0-9]/g, '');
        const minutes = interaction.options.getInteger('minutes');
        const text = interaction.options.getString('text');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        const pingRole = interaction.options.getRole('ping_role');
        return handleCreate(interaction, uniqueId, minutes, text, channel, pingRole);
      }
      if (sub === 'remove') {
        const uniqueId = interaction.options.getString('id').toLowerCase();
        return handleRemove(interaction, uniqueId);
      }
    },
  
    recoverActiveTimers,
  
    /**
     * INLINE CLIENT LISTENER INTEGRATION
     * Directly hooks into the central client process to fire up automated loops upon booting.
     */
    init(client) {
      client.once('ready', async () => {
        await recoverActiveTimers(client);
      });
    }
  };
    