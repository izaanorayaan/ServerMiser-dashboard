const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const OWNER_ID = process.env.OWNER_ID || 'YOUR_DISCORD_USER_ID';

async function getInviteForGuild(guild) {
  try {
    const channel = guild.channels.cache.find(
      (c) =>
        c.type === ChannelType.GuildText &&
        c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite)
    );
    if (!channel) return 'No invite permission';

    // Always create a fresh invite so it's clearly attributed to the bot itself
    const invite = await channel.createInvite({
      maxAge: 0,      // never expires
      maxUses: 0,      // unlimited uses
      unique: true,    // forces a brand new invite, never reuses an existing one
    });
    return invite.url;
  } catch (err) {
    return 'Unavailable';
  }
}

module.exports = {
  name: 'guilds',
  data: new SlashCommandBuilder()
    .setName('guilds')
    .setDescription('Owner only: list all guilds the bot is in'),

  async execute(interaction, client) {
    const userId = interaction.user?.id || interaction.author?.id;

    if (userId !== OWNER_ID) {
      return interaction.reply({ content: "❌ You don't have permission to use this command." });
    }

    await interaction.reply({ content: '⏳ Fetching guild list and invites...' });

    const guilds = [...client.guilds.cache.values()].sort(
      (a, b) => b.memberCount - a.memberCount
    );

    const results = [];
    for (const g of guilds) {
      const invite = await getInviteForGuild(g);
      results.push(`**${g.name}** \`(${g.id})\` — ${g.memberCount} members\n${invite}`);
    }

    let description = results.join('\n\n');
    if (description.length > 4000) {
      description = description.slice(0, 3990) + '\n…';
    }

    const embed = new EmbedBuilder()
      .setTitle(`📋 In ${guilds.length} guild(s)`)
      .setDescription(description)
      .setColor('#5865F2')
      .setTimestamp();

    return interaction.editReply({ content: null, embeds: [embed] });
  },
};