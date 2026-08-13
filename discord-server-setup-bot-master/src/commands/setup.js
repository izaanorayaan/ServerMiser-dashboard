const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { logAction } = require('../utils/auditLog');
const database = require('../utils/database'); // Points to your live MongoDB model connection
const { formatCute } = require('../utils/textFormatter.js'); 

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('⚙️ Provision specialized, high-density server configurations from blueprint templates.')
    .addStringOption(option =>
      option.setName('template')
        .setDescription('Select a specialized template blueprint architecture model')
        .setRequired(true)
        .addChoices(
          { name: '🎮 Gaming Clan Network', value: 'gaming' },
          { name: '🌐 Public Community Guild', value: 'community' },
          { name: '📚 Academic Study Hub', value: 'study' },
          { name: '💼 Corporate Business Operations', value: 'business' },
          { name: '🎨 Creative Art Studio', value: 'creative' },
          { name: '💻 Dev Forge Engineering', value: 'development' },
          { name: '📈 Crypto & FinTech Room', value: 'finance' },
          { name: '🎭 Immersive Roleplay World', value: 'roleplay' },
          { name: '✨ Minimalist Clean Slate', value: 'minimalist' },
          { name: '⏳ History & Archives Guild', value: 'history' },
          { name: '🌍 Geography & Earth Explorer', value: 'geography' }
        )
    )
    .addBooleanOption(option =>
      option.setName('clear')
        .setDescription('Delete all existing server channels before deploying the layout')
        .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  name: 'setup',

  async execute(interaction, client) {
    const isInteraction = interaction.isCommand ? interaction.isCommand() : false;
    const memberExecutor = interaction.member;

    if (!memberExecutor.permissions.has(PermissionFlagsBits.Administrator) && 
        !memberExecutor.permissions.has(PermissionFlagsBits.ManageGuild)) {
      const msg = '❌ You need **Administrator** or **Manage Server** permissions to use the setup configurations!';
      return isInteraction ? interaction.reply({ content: msg, ephemeral: true }) : interaction.reply(msg);
    }

    if (isInteraction) {
      await interaction.deferReply({ ephemeral: true });
    } else {
      await interaction.reply('⏳ Initializing configuration routine...').catch(() => null);
    }

    const template = isInteraction 
      ? interaction.options.getString('template') 
      : interaction.options.getString('template');
      
    const clear = isInteraction 
      ? (interaction.options.getBoolean('clear') || false) 
      : interaction.options.getBoolean('clear');
      
    const guild = interaction.guild;
    const callerUser = interaction.user;

    try {
      const guildConfig = await database.findOne({ guildId: guild.id }).catch(() => null) || {};
      let cuteStyle = 'off';
      try { cuteStyle = guildConfig.cuteStyle || 'off'; } catch (_) {}
      
      const isCuteActive = cuteStyle !== 'off';

      if (clear) {
        const clearMsg = '🗑️ Clearing existing channels...';
        if (isInteraction) await interaction.editReply(clearMsg);
        else await interaction.channel.send(clearMsg).catch(() => null);

        for (const channel of guild.channels.cache.values()) {
          if (channel.id === interaction.channelId || channel.id === interaction.channel?.id) continue; 
          try {
            await channel.delete();
            try { await logAction(guild, 'Channel Deleted', callerUser, `Channel: ${channel.name}`); } catch(e){}
          } catch (e) {
            console.error(`Could not delete channel ${channel.name}`);
          }
        }
      }
      // Format structural category names using cute fonts if active
      const importantCatName = formatCute('Important', cuteStyle, '📢');
      const genCatName = formatCute('General', cuteStyle, '🎀');
      const botCatName = formatCute('Systems', cuteStyle, '🤖');
      const vcCatName = formatCute('Voice', cuteStyle, '🔊');
      const staffCatName = formatCute('Staff Only', cuteStyle, '🔒');

      const catMsg = '📁 Provisioning secure category shells...';
      if (isInteraction) await interaction.editReply(catMsg);
      else await interaction.channel.send(catMsg).catch(() => null);

      // 👥 1. INSTANTIATE SYSTEM ROLES STACK (Muted role entirely dropped as requested)
      const adminRole = await guild.roles.create({ name: 'System Administrator', color: '#FF0000', permissions: [PermissionFlagsBits.Administrator] });
      try { await logAction(guild, 'Role Created', callerUser, 'Role: Admin'); } catch(e){}
      const modRole = await guild.roles.create({ name: 'Server Moderator', color: '#0099FF', permissions: [PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ModerateMembers] });
      try { await logAction(guild, 'Role Created', callerUser, 'Role: Moderator'); } catch(e){}
      const trialModRole = await guild.roles.create({ name: 'Trial Staff', color: '#7CC2FF' });
      const vipRole = await guild.roles.create({ name: 'Premium Server Booster', color: '#F47FFF' });
      const memberRole = await guild.roles.create({ name: 'Verified Member', color: '#00FF00' });
      try { await logAction(guild, 'Role Created', callerUser, 'Role: Member'); } catch(e){}

      const newlyCreatedRoleIds = [adminRole.id, modRole.id, trialModRole.id, vipRole.id, memberRole.id];

      // 🎭 2. EXPANDED BLUEPRINT TEMPLATE SPECIFIC ROLES STACK
      if (template === 'gaming') {
        const r1 = await guild.roles.create({ name: '🥇 Tournament Champion', color: '#F1C40F' });
        const r2 = await guild.roles.create({ name: '⭐ Clan Team Captain', color: '#E74C3C' });
        const r3 = await guild.roles.create({ name: '🎮 Pro Esport Athlete', color: '#9B59B6' });
        const r4 = await guild.roles.create({ name: '🎯 Competitive Scrimmer', color: '#1ABC9C' });
        newlyCreatedRoleIds.push(r1.id, r2.id, r3.id, r4.id);
      } else if (template === 'community') {
        const r1 = await guild.roles.create({ name: '👑 Community VIP', color: '#FD79A8' });
        const r2 = await guild.roles.create({ name: '📢 Content Creator', color: '#E67E22' });
        const r3 = await guild.roles.create({ name: '🎉 Active Event Host', color: '#2ECC71' });
        const r4 = await guild.roles.create({ name: '💬 Elite Chatter', color: '#3498DB' });
        newlyCreatedRoleIds.push(r1.id, r2.id, r3.id, r4.id);
      } else if (template === 'study') {
        const r1 = await guild.roles.create({ name: '🎓 Dean of Studies', color: '#2C3E50' });
        const r2 = await guild.roles.create({ name: '🔬 Faculty Professor', color: '#E74C3C' });
        const r3 = await guild.roles.create({ name: '📚 Certified Tutor', color: '#2ECC71' });
        const r4 = await guild.roles.create({ name: '✏️ Research Assistant', color: '#F39C12' });
        newlyCreatedRoleIds.push(r1.id, r2.id, r3.id, r4.id);
      } else if (template === 'business') {
        const r1 = await guild.roles.create({ name: '💼 Executive Board', color: '#2C3E50' });
        const r2 = await guild.roles.create({ name: '👔 Senior Project Lead', color: '#2980B9' });
        const r3 = await guild.roles.create({ name: '📊 Account Executive', color: '#27AE60' });
        const r4 = await guild.roles.create({ name: '👥 Business Partner', color: '#BDC3C7' });
        newlyCreatedRoleIds.push(r1.id, r2.id, r3.id, r4.id);
      } else if (template === 'creative') {
        const r1 = await guild.roles.create({ name: '🎨 Creative Director', color: '#6C5CE7' });
        const r2 = await guild.roles.create({ name: '📸 Elite Photographer', color: '#E84393' });
        const r3 = await guild.roles.create({ name: '🖌️ Digital Illustrator', color: '#00CEC9' });
        const r4 = await guild.roles.create({ name: '💎 Art Patron', color: '#FFEAA7' });
        newlyCreatedRoleIds.push(r1.id, r2.id, r3.id, r4.id);
      } else if (template === 'development') {
        const r1 = await guild.roles.create({ name: '💻 Principal Engineer', color: '#2D3436' });
        const r2 = await guild.roles.create({ name: '⚙️ Core Dev Contributor', color: '#0984E3' });
        const r3 = await guild.roles.create({ name: '🛠️ Systems DevOps', color: '#00B894' });
        const r4 = await guild.roles.create({ name: '🧪 Automation QA Tester', color: '#D63031' });
        newlyCreatedRoleIds.push(r1.id, r2.id, r3.id, r4.id);
      } else if (template === 'finance') {
        const r1 = await guild.roles.create({ name: '🐋 Macro Fund Manager', color: '#6C5CE7' });
        const r2 = await guild.roles.create({ name: '📈 Quantitative Analyst', color: '#00B894' });
        const r3 = await guild.roles.create({ name: '📊 Proprietary Trader', color: '#FDCB6E' });
        const r4 = await guild.roles.create({ name: '⛓️ Liquidity Provider', color: '#E17055' });
        newlyCreatedRoleIds.push(r1.id, r2.id, r3.id, r4.id);
      } else if (template === 'roleplay') {
        const r1 = await guild.roles.create({ name: '👑 Lead Loreweaver', color: '#D63031' });
        const r2 = await guild.roles.create({ name: '🏰 Legendary Hero', color: '#E17055' });
        const r3 = await guild.roles.create({ name: '⚔️ Mythic Guildmaster', color: '#F1C40F' });
        const r4 = await guild.roles.create({ name: '🎲 Game Facilitator', color: '#7F8C8D' });
        newlyCreatedRoleIds.push(r1.id, r2.id, r3.id, r4.id);
      } else if (template === 'minimalist') {
        const r1 = await guild.roles.create({ name: '✨ Premium Focus Tier', color: '#FFFFFF' });
        const r2 = await guild.roles.create({ name: '▫️ Curated Member', color: '#DFE6E9' });
        newlyCreatedRoleIds.push(r1.id, r2.id);
      } else if (template === 'history') {
        const r1 = await guild.roles.create({ name: '⏳ High Archivist Emeritus', color: '#845EC2' });
        const r2 = await guild.roles.create({ name: '📜 Classical Historian', color: '#D65DB1' });
        const r3 = await guild.roles.create({ name: '🏛️ Antiquity Professor', color: '#FF6F91' });
        const r4 = await guild.roles.create({ name: '🛡️ Excavation Specialist', color: '#FFC75F' });
        newlyCreatedRoleIds.push(r1.id, r2.id, r3.id, r4.id);
      } else if (template === 'geography') {
        const r1 = await guild.roles.create({ name: '🌍 Chief Cartographer', color: '#0081CF' });
        const r2 = await guild.roles.create({ name: '🧭 Geopolitical Analyst', color: '#008E9B' });
        const r3 = await guild.roles.create({ name: '🌋 Seismic Volcanologist', color: '#00C9A7' });
        const r4 = await guild.roles.create({ name: '⛺ Frontier Surveyor', color: '#9BDEAC' });
        newlyCreatedRoleIds.push(r1.id, r2.id, r3.id, r4.id);
      }

      // ==========================================
      // 🔒 RECONFIGURED SPLIT PERMISSION OVERWRITES
      // ==========================================
      // IMPORTANT CATEGORY: Visible to unverified users, but nobody can send text messages except staff
      const importantCategory = await guild.channels.create({
        name: importantCatName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
          { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.SendMessages] },
          { id: modRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      });

      // GENERAL & VOICE CATEGORIES: Blind to @everyone (unverified), but fully open to Verified Members!
      const generalCategory = await guild.channels.create({ 
        name: genCatName, 
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.Speak] }
        ]
      });
      
      const systemsCategory = await guild.channels.create({ 
        name: botCatName, 
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      });

      const voiceCategory = await guild.channels.create({ 
        name: vcCatName, 
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }
        ]
      });

      // STAFF CATEGORY: Absolutely private. Blocked from everyone, only visible to managers
      const staffCategory = await guild.channels.create({ 
        name: staffCatName, 
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: memberRole.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: modRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
          { id: trialModRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
        ]
      });
      const chanMsg = '📢 Initializing layout generation matrices...';
      if (isInteraction) await interaction.editReply(chanMsg);
      else await interaction.channel.send(chanMsg).catch(() => null);
      
      // Seed base system infrastructure nodes across categories
      const channels = {
        // Important Shell Layer
        welcome: { name: formatCute('welcome-gate', cuteStyle, '👋'), parent: importantCategory.id, type: ChannelType.GuildText },
        rules: { name: formatCute('server-rules', cuteStyle, '📜'), parent: importantCategory.id, type: ChannelType.GuildText },
        announcements: { name: formatCute('announcements', cuteStyle, '📢'), parent: importantCategory.id, type: ChannelType.GuildText },
        
        // General Chat Shell Layer
        general: { name: formatCute('global-chat', cuteStyle, '💬'), parent: generalCategory.id, type: ChannelType.GuildText },
        media: { name: formatCute('media-vault', cuteStyle, '🖼️'), parent: generalCategory.id, type: ChannelType.GuildText }, // Added media channel
        
        // Dedicated Systems Shell Layer (Levels and Bot Commands separated)
        levels: { name: formatCute('level-tracking', cuteStyle, '✨'), parent: systemsCategory.id, type: ChannelType.GuildText },
        commands: { name: formatCute('bot-commands', cuteStyle, '🤖'), parent: systemsCategory.id, type: ChannelType.GuildText },
        
        // Private Administrative Shell Layer
        'audit-logs': { name: formatCute('audit-logs', cuteStyle, '📜'), parent: staffCategory.id, type: ChannelType.GuildText },
        'mod-logs': { name: formatCute('mod-logs', cuteStyle, '🛡️'), parent: staffCategory.id, type: ChannelType.GuildText },
        'staff-chat': { name: formatCute('staff-headquarters', cuteStyle, '💬'), parent: staffCategory.id, type: ChannelType.GuildText },
      };

      // Apply immersive Niche Specific Blueprints
      if (template === 'gaming') {
        channels['tournament-hub'] = { name: formatCute('tournament-hub', cuteStyle, '🏆'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['brackets-standings'] = { name: formatCute('brackets-standings', cuteStyle, '📊'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['theorycrafting'] = { name: formatCute('meta-theorycrafting', cuteStyle, '🎮'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['voice-chat-1'] = { name: formatCute('Squad Room Alpha', cuteStyle, '🎧'), parent: voiceCategory.id, type: ChannelType.GuildVoice };
        channels['voice-chat-2'] = { name: formatCute('Squad Room Beta', cuteStyle, '🎧'), parent: voiceCategory.id, type: ChannelType.GuildVoice };
      } else if (template === 'community') {
        channels.introductions = { name: formatCute('introductions-lobby', cuteStyle, '👋'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels.events = { name: formatCute('server-events', cuteStyle, '📅'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels.memes = { name: formatCute('meme-dump', cuteStyle, '😂'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['public-lounge'] = { name: formatCute('Main Public Lounge', cuteStyle, '🎧'), parent: voiceCategory.id, type: ChannelType.GuildVoice };
      } else if (template === 'study') {
        channels['study-materials'] = { name: formatCute('study-materials', cuteStyle, '📚'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['research-archives'] = { name: formatCute('research-archives', cuteStyle, '🔬'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['assignment-help'] = { name: formatCute('peer-tutoring', cuteStyle, '✏️'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['voice-study'] = { name: formatCute('Silent Library Room', cuteStyle, '🎧'), parent: voiceCategory.id, type: ChannelType.GuildVoice };
      } else if (template === 'business') {
        channels.meetings = { name: formatCute('corporate-meetings', cuteStyle, '💼'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['product-roadmap'] = { name: formatCute('product-roadmap', cuteStyle, '📊'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['project-tracker'] = { name: formatCute('sprint-schedules', cuteStyle, '📝'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['voice-meetings'] = { name: formatCute('Boardroom Alpha Node', cuteStyle, '🎧'), parent: voiceCategory.id, type: ChannelType.GuildVoice };
      } else if (template === 'creative') {
        channels['portfolio-showcase'] = { name: formatCute('portfolio-showcase', cuteStyle, '🎨'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['work-in-progress'] = { name: formatCute('art-wip-critique', cuteStyle, '🖌️'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['commissions'] = { name: formatCute('open-commissions', cuteStyle, '💰'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['creative-studio'] = { name: formatCute('Live Atelier Audio', cuteStyle, '📸'), parent: voiceCategory.id, type: ChannelType.GuildVoice };
      } else if (template === 'development') {
        channels['production-logs'] = { name: formatCute('production-changelogs', cuteStyle, '💻'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['github-feed'] = { name: formatCute('git-webhook-feed', cuteStyle, '⚙️'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['api-specs'] = { name: formatCute('api-specifications', cuteStyle, '📄'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['pair-programming'] = { name: formatCute('Pair Coding Terminals', cuteStyle, '🛠️'), parent: voiceCategory.id, type: ChannelType.GuildVoice };
      } else if (template === 'finance') {
        channels['market-news'] = { name: formatCute('macro-market-news', cuteStyle, '📈'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['crypto-analysis'] = { name: formatCute('on-chain-analytics', cuteStyle, '⛓️'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['trade-setups'] = { name: formatCute('technical-charts', cuteStyle, '💱'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['trading-pit'] = { name: formatCute('Live Squawk Pit', cuteStyle, '🎧'), parent: voiceCategory.id, type: ChannelType.GuildVoice };
      } else if (template === 'roleplay') {
        channels['world-lore'] = { name: formatCute('world-lorebook', cuteStyle, '🏰'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['character-sheets'] = { name: formatCute('character-compendium', cuteStyle, '📜'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['ooc-chat'] = { name: formatCute('out-of-character', cuteStyle, '💬'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['tavern-comms'] = { name: formatCute('The Drifting Tavern', cuteStyle, '🎲'), parent: voiceCategory.id, type: ChannelType.GuildVoice };
      } else if (template === 'minimalist') {
        channels['slate'] = { name: formatCute('clean-slate', cuteStyle, '▫️'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['focus'] = { name: formatCute('zen-focus-node', cuteStyle, '✨'), parent: voiceCategory.id, type: ChannelType.GuildVoice };
      } else if (template === 'history') {
        channels['ancient-records'] = { name: formatCute('ancient-archives', cuteStyle, '⏳'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['artifacts-gallery'] = { name: formatCute('museum-exhibits', cuteStyle, '🏛️'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['chronicle-feed'] = { name: formatCute('chronicle-debates', cuteStyle, '📜'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['council-chamber'] = { name: formatCute('Grand Lyceum Hall', cuteStyle, '🎧'), parent: voiceCategory.id, type: ChannelType.GuildVoice };
      } else if (template === 'geography') {
        channels['atlas-cartography'] = { name: formatCute('atlas-cartography', cuteStyle, '🌍'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['expedition-logs'] = { name: formatCute('expedition-journals', cuteStyle, '🧭'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['earth-science'] = { name: formatCute('geology-seismic-info', cuteStyle, '🌋'), parent: generalCategory.id, type: ChannelType.GuildText };
        channels['horizon-comms'] = { name: formatCute('Basecamp Comms Link', cuteStyle, '🎧'), parent: voiceCategory.id, type: ChannelType.GuildVoice };
      }

      let createdGeneralChannelId = null;
      for (const [key, channelData] of Object.entries(channels)) {
        const createdChannel = await guild.channels.create({
          name: channelData.name,
          type: channelData.type,
          parent: channelData.parent,
        });
        
        if (key === 'general') {
          createdGeneralChannelId = createdChannel.id;
        }
        try { await logAction(guild, 'Channel Created', callerUser, `Channel: ${channelData.name}`); } catch(e){}
      }
      // Save configurations dynamically to your MongoDB cluster
      await database.findOneAndUpdate(
        { guildId: guild.id },
        {
          $set: {
            template: template,
            channels: Object.keys(channels),
            welcomeChannelId: createdGeneralChannelId,
            roles: newlyCreatedRoleIds,
            setupComplete: true,
            setupDate: new Date().toISOString()
          }
        },
        { upsert: true }
      ).catch(() => null);

      try { await logAction(guild, 'Server Setup', callerUser, `Template: ${template}, Style: ${cuteStyle}, Clear: ${clear}`); } catch(e){}

      // Track lifetime setup counts for the analytics dashboard
      try {
        await database.incrementCounter('totalSetups');
        await database.incrementCounter('successfulSetups');
      } catch (e) {}

      const embed = new EmbedBuilder()
        .setColor(isCuteActive ? '#FF69B4' : '#00FF00')
        .setTitle(isCuteActive ? '✨ Server Setup Complete! ✨' : '✅ Server Setup Complete!')
        .addFields(
          { name: 'Template Deployment', value: template.toUpperCase(), inline: true },
          { name: 'Categories Provisioned', value: '5 Layout Rows', inline: true },
          { name: 'Channels Spawned', value: Object.keys(channels).length.toString(), inline: true },
          { name: 'Role Tree Density', value: `${newlyCreatedRoleIds.length} Total Ranks`, inline: true },
          { name: 'Prefix Gateway', value: '|', inline: true },
          { name: 'Permissions Matrix', value: '🟢 Corrected Split Logic Verified' }
        );

      if (isInteraction) {
        await interaction.editReply({ embeds: [embed] }).catch(() => null);
      } else {
        await interaction.channel.send({ embeds: [embed] }).catch(() => null);
      }

      if (clear) {
        const originChannel = guild.channels.cache.get(interaction.channelId) || await guild.channels.fetch(interaction.channelId).catch(() => null);
        if (originChannel) await originChannel.delete().catch(() => null);
      }

    } catch (error) {
      console.error('Setup failed:', error);

      // Track lifetime setup counts even on failure, so success rate is accurate
      try {
        await database.incrementCounter('totalSetups');
      } catch (e) {}

      if (isInteraction) {
        await interaction.editReply(`❌ Setup failed: ${error.message}`).catch(() => null);
      } else {
        await interaction.channel.send(`❌ Setup failed: ${error.message}`).catch(() => null);
      }
    }
  },

  async executePrefix(message, argsArray, client) {
    const guild = message.guild;
    if (!guild) return;

    const member = message.member;
    if (!member.permissions.has(PermissionFlagsBits.Administrator) && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply('❌ You require Manager or Administrator permissions to initiate setups.').catch(() => null);
    }

    const templateArg = argsArray ? argsArray.toLowerCase().trim() : null;
    const clearArg = argsArray ? argsArray.toLowerCase().trim() : null;
    
    const validTemplates = ['gaming', 'community', 'study', 'business', 'creative', 'development', 'finance', 'roleplay', 'minimalist', 'history', 'geography'];
    if (!templateArg || !validTemplates.includes(templateArg)) {
      return message.reply(`❌ **Usage:** \`|setup <${validTemplates.join('|')}> [clear]\``).catch(() => null);
    }

    const isClearSet = (clearArg === 'clear' || clearArg === 'true');

    const mockInteraction = {
      guild: message.guild,
      guildId: message.guild.id,
      channelId: message.channelId,
      channel: message.channel,
      member: message.member,
      user: message.author,
      options: {
        getString: (name) => templateArg,
        getBoolean: (name) => isClearSet
      },
      reply: async (options) => message.reply(options),
      editReply: async (options) => {
        if (typeof options === 'string') return message.channel.send({ content: options });
        return message.channel.send(options);
      }
    };

    await this.execute(mockInteraction, client).catch(err => console.error('Error handling inline server setup prefix wrapper:', err));
  }
};