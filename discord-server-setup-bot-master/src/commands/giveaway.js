const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const { Schema, model, models } = require('mongoose');

const ACCENT_COLOR_ACTIVE = 0x5865f2; 
const ACCENT_COLOR_ENDED = 0x2b2d31; 
const runningGiveaways = new Map(); 

const GiveawaySchema = new Schema({
  messageId: { type: String, required: true, unique: true },
  channelId: { type: String, required: true },
  guildId: { type: String, required: true },
  creatorId: { type: String, required: true },
  prize: { type: String, required: true },
  winnerCount: { type: Number, default: 1 },
  endsAt: { type: Date, required: true },
  participants: { type: [String], default: [] },
  ended: { type: Boolean, default: false }
});

const Giveaway = models.Giveaway || model('Giveaway', GiveawaySchema);

const data = new SlashCommandBuilder()
  .setName('giveaway')
  .setDescription('Establish and manage customizable item drops')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((sub) => sub
    .setName('start')
    .setDescription('Launch a fresh background scheduled giveaway pool')
    .addIntegerOption((opt) => opt.setName('minutes').setDescription('Timing block lifespan duration in minutes').setRequired(true).setMinValue(1))
    .addStringOption((opt) => opt.setName('prize').setDescription('The title name of the item or reward pool drop').setRequired(true).setMaxLength(256))
    .addIntegerOption((opt) => opt.setName('winners').setDescription('The target amount of lucky winners to fetch (defaults to 1)').setRequired(false).setMinValue(1).setMaxValue(20))
    .addChannelOption((opt) => opt.setName('channel').setDescription('Output channel destination (defaults to current)').addChannelTypes(ChannelType.GuildText).setRequired(false))
  )
  .addSubcommand((sub) => sub
    .setName('reroll')
    .setDescription('Pick new winners from an existing ended giveaway database profile')
    .addStringOption((opt) => opt.setName('message_id').setDescription('The target message ID of the giveaway announcement embed').setRequired(true))
  )
  .addSubcommand((sub) => sub
    .setName('end')
    .setDescription('Forcefully end an active giveaway pool and draw winners immediately')
    .addStringOption((opt) => opt.setName('message_id').setDescription('The target message ID of the giveaway announcement embed').setRequired(true))
  );

function isPrefixMode(interaction) {
  return typeof interaction.isChatInputCommand === 'function' && interaction.isChatInputCommand() === false;
}

function parsePrefixArgs(interaction) {
  const raw = String(interaction.content || '');
  const tokens = raw.trim().split(/\s+/);
  const sub = tokens ? tokens.toLowerCase() : null;

  let minutes = null;
  if (sub === 'start' && tokens) {
    const val = parseInt(tokens, 10);
    if (!isNaN(val)) minutes = val;
  }

  let messageId = null;
  if ((sub === 'end' || sub === 'reroll') && tokens) {
    messageId = tokens;
  }

  let targetChannel = interaction.channel;
  if (interaction.mentions?.channels?.size > 0) {
    targetChannel = interaction.mentions.channels.first();
  }

  const quotedMatch = raw.match(/"([^"]+)"/);
  const prize = quotedMatch ? quotedMatch : null;

  return { sub, minutes, prize, messageId, targetChannel };
}

function buildGiveawayEmbed(config) {
  const unix = Math.floor(new Date(config.endsAt).getTime() / 1000);
  
  return new EmbedBuilder()
    .setTitle(`🎉 GIVEAWAY: ${config.prize} 🎉`)
    .setDescription(`Click the button below to join the pool array row list!\n\n• **Winners:** \`${config.winnerCount}\`\n• **Ends:** <t:${unix}:F> (<t:${unix}:R>)\n• **Hosted By:** <@${config.creatorId}>`)
    .addFields({ name: 'Entries Total', value: `\`${config.participants.length}\``, inline: true })
    .setColor(ACCENT_COLOR_ACTIVE)
    .setTimestamp(config.createdAt || new Date());
}

function buildGiveawayComponents(messageId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`giveaway_entry:${messageId}`)
        .setLabel('Join Pool')
        .setEmoji('🎟️')
        .setStyle(ButtonStyle.Success)
    )
  ];
}

async function drawWinners(client, messageId, forceEnd = false) {
  const config = await Giveaway.findOne({ messageId });
  if (!config || (config.ended && !forceEnd)) return null;

  try {
    const guild = await client.guilds.fetch(config.guildId).catch(() => null);
    if (!guild) return null;

    const channel = await guild.channels.fetch(config.channelId).catch(() => null);
    if (!channel) return null;

    const message = await channel.messages.fetch(config.messageId).catch(() => null);
    
    // FIX: Filter participants who are still in the guild
    const validPool = config.participants.filter(id => guild.members.cache.has(id) || id);
    const winners = [];

    if (validPool.length > 0) {
      const poolCopy = [...validPool];
      for (let i = 0; i < Math.min(config.winnerCount, poolCopy.length); i++) {
        const randomIndex = Math.floor(Math.random() * poolCopy.length);
        winners.push(`<@${poolCopy.splice(randomIndex, 1)}>`);
      }
    }

    config.ended = true;
    await config.save();

    if (runningGiveaways.has(messageId)) {
      clearTimeout(runningGiveaways.get(messageId));
      runningGiveaways.delete(messageId);
    }

    const endedEmbed = EmbedBuilder.from(message?.embeds || buildGiveawayEmbed(config))
      .setColor(ACCENT_COLOR_ENDED)
      .setDescription(`**Giveaway Concluded!**\n\n• **Hosted By:** <@${config.creatorId}>\n• **Winners Selected:** ${winners.length > 0 ? winners.join(', ') : '`No valid entries discovered.`'}`)
      .setFields({ name: 'Final Entries count', value: `\`${config.participants.length}\``, inline: true });

    if (message) {
      await message.edit({ embeds: [endedEmbed], components: [] }).catch(() => null);
      
      if (winners.length > 0) {
        await channel.send(`🎉 **Congratulations** ${winners.join(', ')}! You won the drop for **${config.prize}**!\n🔗 *Ref: https://discord.com{config.guildId}/${config.channelId}/${config.messageId}*`);
      } else {
        await channel.send(`⚠️ The raffle pool for **${config.prize}** closed with no valid participants remaining.`);
      }
    }

    return winners;
  } catch (err) {
    console.error(`[Giveaway Processing Error]: Failed selection execution for ${messageId}:`, err.message);
    return null;
  }
}

async function handleStart(interaction, minutes, prize, targetChannel, winnersCount = 1) {
  const endsAt = new Date(Date.now() + minutes * 60 * 1000);
  const prefixMode = isPrefixMode(interaction);

  if (!targetChannel.permissionsFor(interaction.guild.members.me).has(PermissionFlagsBits.SendMessages)) {
    return interaction.reply({ content: `❌ I lack the **Send Messages** permission block flag configurations within ${targetChannel}.`, flags: [MessageFlags.Ephemeral] });
  }

  if (!prefixMode) await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const placeholderMessage = prefixMode 
    ? await targetChannel.send({ content: '⏳ Provisioning asset configuration data...' }) 
    : await interaction.followUp({ content: '⏳ Deploying giveaway container...', fetchReply: true });

  const config = await Giveaway.create({
    messageId: placeholderMessage.id,
    channelId: targetChannel.id,
    guildId: interaction.guild.id,
    creatorId: interaction.user.id,
    prize,
    winnerCount: winnersCount,
    endsAt,
    participants: []
  });

  const announcementPayload = {
    content: '🎉 **GIVEAWAY STARTED** 🎉',
    embeds: [buildGiveawayEmbed(config)],
    components: buildGiveawayComponents(config.messageId)
  };

  if (prefixMode) {
    await placeholderMessage.edit(announcementPayload).catch(() => null);
  } else {
    const activeMsg = await targetChannel.send(announcementPayload);
    config.messageId = activeMsg.id;
    await config.save();
    await placeholderMessage.edit({ content: `✅ Giveaway deployed into ${targetChannel}!` }).catch(() => null);
  }

  const remainingDelay = endsAt.getTime() - Date.now();
  if (remainingDelay <= 2147483647) {
    const timer = setTimeout(() => drawWinners(interaction.client, config.messageId), remainingDelay);
    runningGiveaways.set(config.messageId, timer);
  }
}

async function handleForceEnd(interaction, messageId) {
  const config = await Giveaway.findOne({ messageId });
  if (!config) return interaction.reply({ content: '❌ No active giveaway profile row located matching that Message ID value.', flags: [MessageFlags.Ephemeral] });
  if (config.ended) return interaction.reply({ content: '⚠️ This item drop channel pool has already concluded tracking workflows.', flags: [MessageFlags.Ephemeral] });

  await interaction.reply({ content: '🔒 Forcing immediate termination sweeps...', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  await drawWinners(interaction.client, messageId, true);
}

async function handleReroll(interaction, messageId) {
  const config = await Giveaway.findOne({ messageId });
  if (!config) return interaction.reply({ content: '❌ No recorded dataset historical logs match that Message ID token target.', flags: [MessageFlags.Ephemeral] });
  if (!config.ended) return interaction.reply({ content: '⚠️ You cannot re-roll winners inside an active sweep loop. Run `end` instead.', flags: [MessageFlags.Ephemeral] });

  await interaction.reply({ content: '🎲 Re-evaluating lucky lottery entry points...', flags: [MessageFlags.Ephemeral] }).catch(() => null);
  await drawWinners(interaction.client, messageId, true);
}

module.exports = {
  data,
  async execute(interaction) {
    if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
      const denyText = '❌ Access Denied: This utility requires **Administrator** security clearance.';
      return isPrefixMode(interaction) ? interaction.reply({ content: denyText }) : interaction.reply({ content: denyText, flags: [MessageFlags.Ephemeral] });
    }

    if (isPrefixMode(interaction)) {
      const parsed = parsePrefixArgs(interaction);
      if (parsed.sub === 'start') {
        if (!parsed.minutes || !parsed.prize) return interaction.reply({ content: '❌ Invalid args.\n**Usage:** `|giveaway start [mins] "[prize]" [#channel]`' });
        return handleStart(interaction, parsed.minutes, parsed.prize, parsed.targetChannel);
      }
      if (parsed.sub === 'end') {
        if (!parsed.messageId) return interaction.reply({ content: '❌ Specify the exact announcement message ID signature: `|giveaway end [id]`' });
        return handleForceEnd(interaction, parsed.messageId);
      }
      if (parsed.sub === 'reroll') {
        if (!parsed.messageId) return interaction.reply({ content: '❌ Specify the historical announcement message ID signature: `|giveaway reroll [id]`' });
        return handleReroll(interaction, parsed.messageId);
      }
      return interaction.reply({ content: '❌ Unknown flag mapping subcommand token slot selected. Options: `start`, `end`, `reroll`.' });
    }

    const sub = interaction.options.getSubcommand();
    if (sub === 'start') {
      const mins = interaction.options.getInteger('minutes');
      const prize = interaction.options.getString('prize');
      const winners = interaction.options.getInteger('winners') || 1;
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      return handleStart(interaction, mins, prize, channel, winners);
    }

    const msgId = interaction.options.getString('message_id');
    if (sub === 'end') return handleForceEnd(interaction, msgId);
    if (sub === 'reroll') return handleReroll(interaction, msgId);
  },

  async handleButtonClicks(interaction) {
    if (!interaction.customId.startsWith('giveaway_entry:')) return;
    const messageId = interaction.customId.split(':')[1];

    const config = await Giveaway.findOne({ messageId });
    if (!config || config.ended) {
      return interaction.reply({ content: '❌ This entry window pool profile has already closed or expired.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }

    const userId = interaction.user.id;
    const arrayIndex = config.participants.indexOf(userId);

    if (arrayIndex > -1) {
      config.participants.splice(arrayIndex, 1);
      await config.save();
      
      await interaction.update({ embeds: [buildGiveawayEmbed(config)] }).catch(() => null);
      return interaction.followUp({ content: '🎟️ You withdrew your entry token from this item pool raffle line.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    } else {
      config.participants.push(userId);
      await config.save();

      await interaction.update({ embeds: [buildGiveawayEmbed(config)] }).catch(() => null);
      return interaction.followUp({ content: '🎟️ Entry locked! Your user token was added to the active picker registry maps.', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }
  },

  async init(client) {
    client.once('ready', async () => {
      try {
        const liveProfiles = await Giveaway.find({ ended: false });
        console.log(`[Giveaway Engine] Synchronizing countdown sequences: Restored ${liveProfiles.length} active countdown instances.`);

        for (const config of liveProfiles) {
          const delay = new Date(config.endsAt).getTime() - Date.now();
          if (delay <= 0) {
            drawWinners(client, config.messageId).catch(() => null);
          } else if (delay <= 2147483647) {
            const timer = setTimeout(() => drawWinners(client, config.messageId), delay);
            runningGiveaways.set(config.messageId, timer);
          }
        }
      } catch (err) {
        console.error('[Giveaway Engine Boot Recovery Crash]: Error matching tracking arrays:', err);
      }
    });
  }
};