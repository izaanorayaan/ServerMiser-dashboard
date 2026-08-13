const { 
  SlashCommandBuilder, 
  PermissionFlagsBits, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  StringSelectMenuBuilder, 
  StringSelectMenuOptionBuilder, 
  ChannelType 
} = require('discord.js');
const database = require('../utils/database');
const { logAction } = require('../utils/auditLog');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionroles')
    .setDescription('⚙️ Advanced self-assignable component role panel management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub => sub
      .setName('create')
      .setDescription('Build and deploy a custom role assignment panel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Where to post the role selection menu').addChannelTypes(ChannelType.GuildText).setRequired(true))
      .addStringOption(opt => opt.setName('type').setDescription('The interactive format of the panel layout').setRequired(true)
        .addChoices(
          { name: 'Buttons (Modern Rows)', value: 'button' },
          { name: 'Dropdown Menu (Select Node)', value: 'dropdown' },
          { name: 'Classic Emojis (Reactions)', value: 'reaction' }
        )
      )
      .addStringOption(opt => opt.setName('title').setDescription('The headline title for your embed selection panel card').setRequired(true))
      .addStringOption(opt => opt.setName('roles_map').setDescription('Format: @Role1,emoji,Custom Label | @Role2,,Label2 (Emojis optional)').setRequired(true))
      .addStringOption(opt => opt.setName('description').setDescription('Custom message description block details').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('edit')
      .setDescription('✏️ Update the title or description text fields of an existing deployed panel')
      .addStringOption(opt => opt.setName('message_id').setDescription('The message ID of the deployed role panel').setRequired(true))
      .addStringOption(opt => opt.setName('title').setDescription('The new headline title for the panel card').setRequired(false))
      .addStringOption(opt => opt.setName('description').setDescription('The new description text block details').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('add-role')
      .setDescription('➕ Add a new assignment choice node directly into an existing active panel')
      .addStringOption(opt => opt.setName('message_id').setDescription('The message ID of the deployed role panel').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('The role target to append').setRequired(true))
      .addStringOption(opt => opt.setName('label').setDescription('Custom visual text label name (Required for buttons/dropdowns)').setRequired(false))
      .addStringOption(opt => opt.setName('emoji').setDescription('Optional custom emoji target name or character').setRequired(false))
    )
    .addSubcommand(sub => sub
      .setName('remove-role')
      .setDescription('➖ Remove a specific role assignment node out of an active panel framework')
      .addStringOption(opt => opt.setName('message_id').setDescription('The message ID of the deployed role panel').setRequired(true))
      .addRoleOption(opt => opt.setName('role').setDescription('The role target to strip away from choices').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('delete-panel')
      .setDescription('🗑️ Wipe a role panel entirely out of active channel registries and database nodes')
      .addStringOption(opt => opt.setName('message_id').setDescription('The message ID of the deployed role panel').setRequired(true))
    )
    .addSubcommand(sub => sub
      .setName('test')
      .setDescription('🧪 Diagnostic Simulator: Test component menus safely in a private sandbox view')
      .addStringOption(opt => opt.setName('type').setDescription('Layout component array format to verify').setRequired(true)
        .addChoices(
          { name: 'Buttons Layout Matrix', value: 'button' },
          { name: 'Dropdown Menu Structure', value: 'dropdown' }
        )
      )
      .addStringOption(opt => opt.setName('roles_map').setDescription('Format: @Role1,emoji,Label | @Role2,,Label2').setRequired(true))
    ),

  name: 'reactionroles',

  parseRolesInput(interaction, inputString) {
    const rawEntries = inputString.split('|');
    const processedMap = [];

    for (const rawEntry of rawEntries) {
      const parts = rawEntry.split(',');
      if (parts.length < 1) continue;

      const roleRaw = parts[0]?.trim();
      const emojiRaw = parts[1] ? parts[1].trim() : null;
      const labelRaw = parts[2] ? parts[2].trim() : null;

      const roleId = roleRaw ? roleRaw.replace(/[^0-9]/g, '') : '';
      const verifiedRole = interaction.guild.roles.cache.get(roleId);

      if (!verifiedRole) continue;

      processedMap.push({
        roleId: verifiedRole.id,
        roleName: verifiedRole.name,
        emoji: emojiRaw || null,
        label: labelRaw || verifiedRole.name
      });
    }
    return processedMap;
  },

  buildComponents(type, rolesMap) {
    if (type === 'button') {
      const rows = [];
      let currentRow = new ActionRowBuilder();

      rolesMap.forEach((node, index) => {
        if (index > 0 && index % 5 === 0) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder();
        }

        const button = new ButtonBuilder()
          .setCustomId(`rr_${node.roleId}`)
          .setLabel(node.label.slice(0, 80))
          .setStyle(ButtonStyle.Primary);

        if (node.emoji) button.setEmoji(node.emoji);
        currentRow.addComponents(button);
      });

      if (currentRow.components.length > 0) rows.push(currentRow);
      return rows;
    }

    if (type === 'dropdown') {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('rr_dropdown_select')
        .setPlaceholder('Select a server role to toggle...')
        .setMinValues(0)
        .setMaxValues(1);

      rolesMap.forEach(node => {
        const option = new StringSelectMenuOptionBuilder()
          .setLabel(node.label.slice(0, 100))
          .setValue(node.roleId);

        if (node.emoji) option.setEmoji(node.emoji);
        selectMenu.addOptions(option);
      });

      return [new ActionRowBuilder().addComponents(selectMenu)];
    }

    return [];
  },

  async execute(interaction, client) {
    const isInteraction = interaction.isCommand ? interaction.isCommand() : false;
    const guild = interaction.guild;
    const guildId = interaction.guildId;
    const callerUser = interaction.user;
    const sub = isInteraction ? interaction.options.getSubcommand() : interaction.options.getString('subcommand');

    if (!guild) return;

    if (sub === 'test') {
      const type = interaction.options.getString('type');
      const rawMap = interaction.options.getString('roles_map');
      const parsedMap = this.parseRolesInput(interaction, rawMap);

      if (parsedMap.length === 0) {
        return interaction.reply({ content: '❌ Failed to parse any valid roles! Use formatting: `@Role,emoji,Label`', ephemeral: true });
      }

      const testEmbed = new EmbedBuilder()
        .setColor('#FEE75C')
        .setTitle('🧪 Role Setup Sandbox Simulator')
        .setDescription('This is a safe validation window. Clicking components below outputs trace details without mutating guild roles.');

      const components = this.buildComponents(type, parsedMap);
      return interaction.reply({ embeds: [testEmbed], components, ephemeral: true });
    }

    if (sub === 'create') {
      const channel = interaction.options.getChannel('channel');
      const type = interaction.options.getString('type');
      const title = interaction.options.getString('title');
      const rawMap = interaction.options.getString('roles_map');
      const description = interaction.options.getString('description') || 'Select your roles from the elements below:';

      const parsedMap = this.parseRolesInput(interaction, rawMap);
      if (parsedMap.length === 0) {
        return interaction.reply({ content: '❌ Could not map any valid server roles from your inputs.', ephemeral: true });
      }

      const panelEmbed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(title)
        .setDescription(description);

      const components = this.buildComponents(type, parsedMap);

      const panelMessage = await channel.send({ embeds: [panelEmbed], components }).catch(() => null);
      if (!panelMessage) {
        return interaction.reply({ content: '❌ I failed to send messages inside that channel. Check my permissions!', ephemeral: true });
      }

      if (type === 'reaction') {
        for (const node of parsedMap) {
          if (node.emoji) await panelMessage.react(node.emoji).catch(() => null);
        }
      }

      await database.findOneAndUpdate(
        { guildId: guildId },
        { $push: { reactionRolePanels: { messageId: panelMessage.id, channelId: channel.id, type: type, title: title, description: description, roles: parsedMap } } },
        { upsert: true }
      ).catch(() => null);

      try { await logAction(guild, 'Role Panel Created', callerUser, `Deployed panel ${panelMessage.id} in <#${channel.id}>`); } catch(e){}

      return interaction.reply({ content: `✅ Successfully deployed role layout configuration inside ${channel}! (Message ID: \`${panelMessage.id}\`)`, ephemeral: true });
    }

    if (sub === 'edit') {
      const messageId = interaction.options.getString('message_id').trim();
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');

      const guildConfig = await database.findOne({ guildId: guildId }).catch(() => null) || {};
      const panelIndex = guildConfig.reactionRolePanels?.findIndex(p => p.messageId === messageId);

      if (panelIndex === undefined || panelIndex === -1) {
        return interaction.reply({ content: '❌ Could not find a tracked role panel matching that message ID in the database!', ephemeral: true });
      }

      const panelData = guildConfig.reactionRolePanels[panelIndex];
      const targetChannel = await guild.channels.fetch(panelData.channelId).catch(() => null);
      if (!targetChannel) return interaction.reply({ content: '❌ Could not resolve the host channel layer for this panel.', ephemeral: true });

      const targetMessage = await targetChannel.messages.fetch(messageId).catch(() => null);
      if (!targetMessage) return interaction.reply({ content: '❌ The panel message has been deleted or cannot be found on Discord layers!', ephemeral: true });

      if (title) panelData.title = title;
      if (description) panelData.description = description;

      const updatedEmbed = EmbedBuilder.from(targetMessage.embeds[0])
        .setTitle(panelData.title)
        .setDescription(panelData.description);

      await targetMessage.edit({ embeds: [updatedEmbed] }).catch(() => null);

      await database.findOneAndUpdate(
        { guildId: guildId },
        { $set: { [`reactionRolePanels.${panelIndex}`]: panelData } }
      ).catch(() => null);

      try { await logAction(guild, 'Role Panel Edited', callerUser, `Updated text fields for panel message ${messageId}`); } catch(e){}
      return interaction.reply({ content: '✅ Role panel embedding fields successfully modified!', ephemeral: true });
    }

    if (sub === 'add-role') {
      const messageId = interaction.options.getString('message_id').trim();
      const role = interaction.options.getRole('role');
      const label = interaction.options.getString('label') || role.name;
      const emoji = interaction.options.getString('emoji') || null;

      const guildConfig = await database.findOne({ guildId: guildId }).catch(() => null) || {};
      const panelIndex = guildConfig.reactionRolePanels?.findIndex(p => p.messageId === messageId);

      if (panelIndex === undefined || panelIndex === -1) {
        return interaction.reply({ content: '❌ Could not find a tracked role panel matching that message ID.', ephemeral: true });
      }

      const panelData = guildConfig.reactionRolePanels[panelIndex];
      if (panelData.roles.some(r => r.roleId === role.id)) {
        return interaction.reply({ content: '❌ That role node is already mapped to choices inside this panel!', ephemeral: true });
      }

      const targetChannel = await guild.channels.fetch(panelData.channelId).catch(() => null);
      const targetMessage = targetChannel ? await targetChannel.messages.fetch(messageId).catch(() => null) : null;
      if (!targetMessage) return interaction.reply({ content: '❌ Target interface component frame missing or inaccessible.', ephemeral: true });

      const newNode = { roleId: role.id, roleName: role.name, emoji, label };
      panelData.roles.push(newNode);

      if (panelData.type === 'reaction' && emoji) {
        await targetMessage.react(emoji).catch(() => null);
      } else {
        const structuralRows = this.buildComponents(panelData.type, panelData.roles);
        await targetMessage.edit({ components: structuralRows }).catch(() => null);
      }

      await database.findOneAndUpdate(
        { guildId: guildId },
        { $set: { [`reactionRolePanels.${panelIndex}.roles`]: panelData.roles } }
      ).catch(() => null);

      try { await logAction(guild, 'Role Added to Panel', callerUser, `Added ${role.name} to panel ${messageId}`); } catch(e){}
      return interaction.reply({ content: `✅ Successfully appended **${role.name}** choice node directly into the live dashboard panel!`, ephemeral: true });
    }

    if (sub === 'remove-role') {
      const messageId = interaction.options.getString('message_id').trim();
      const role = interaction.options.getRole('role');

      const guildConfig = await database.findOne({ guildId: guildId }).catch(() => null) || {};
      const panelIndex = guildConfig.reactionRolePanels?.findIndex(p => p.messageId === messageId);

      if (panelIndex === undefined || panelIndex === -1) {
        return interaction.reply({ content: '❌ Could not find a tracked role panel matching that message ID.', ephemeral: true });
      }

      const panelData = guildConfig.reactionRolePanels[panelIndex];
      const nodeIndex = panelData.roles.findIndex(r => r.roleId === role.id);
      if (nodeIndex === -1) return interaction.reply({ content: '❌ That role is not mapped as a choice node inside this panel framework.', ephemeral: true });

      const targetChannel = await guild.channels.fetch(panelData.channelId).catch(() => null);
      const targetMessage = targetChannel ? await targetChannel.messages.fetch(messageId).catch(() => null) : null;
      if (!targetMessage) return interaction.reply({ content: '❌ Active network component cannot be found.', ephemeral: true });

      panelData.roles.splice(nodeIndex, 1);

      const structuralRows = this.buildComponents(panelData.type, panelData.roles);
      await targetMessage.edit({ components: structuralRows }).catch(() => null);

      await database.findOneAndUpdate(
        { guildId: guildId },
        { $set: { [`reactionRolePanels.${panelIndex}.roles`]: panelData.roles } }
      ).catch(() => null);

      try { await logAction(guild, 'Role Removed from Panel', callerUser, `Stripped ${role.name} from panel ${messageId}`); } catch(e){}
      return interaction.reply({ content: `✅ Successfully removed **${role.name}** out of choices!`, ephemeral: true });
    }

    if (sub === 'delete-panel') {
      const messageId = interaction.options.getString('message_id').trim();

      const guildConfig = await database.findOne({ guildId: guildId }).catch(() => null) || {};
      const panelIndex = guildConfig.reactionRolePanels?.findIndex(p => p.messageId === messageId);

      if (panelIndex === undefined || panelIndex === -1) {
        return interaction.reply({ content: '❌ Could not find a tracked role panel matching that message ID.', ephemeral: true });
      }

      const panelData = guildConfig.reactionRolePanels[panelIndex];
      const targetChannel = await guild.channels.fetch(panelData.channelId).catch(() => null);
      if (targetChannel) {
        const targetMessage = await targetChannel.messages.fetch(messageId).catch(() => null);
        if (targetMessage) await targetMessage.delete().catch(() => null);
      }

      await database.findOneAndUpdate(
        { guildId: guildId },
        { $pull: { reactionRolePanels: { messageId: messageId } } }
      ).catch(() => null);

      try { await logAction(guild, 'Role Panel Deleted', callerUser, `Wiped panel ${messageId} entirely`); } catch(e){}
      return interaction.reply({ content: '🗑️ Role panel successfully deleted from channels and database records!', ephemeral: true });
    }
  },

  async handleInteraction(interaction) {
    if (!interaction.guild || (!interaction.isButton() && !interaction.isStringSelectMenu())) return;

    const guildId = interaction.guildId;
    const member = interaction.member;
    const customId = interaction.customId;

    if (customId.startsWith('rr_') && interaction.message.embeds[0]?.title?.includes('Sandbox Simulator')) {
      const traceId = customId.replace('rr_', '');
      return interaction.reply({ content: `🧪 [Trace Simulator Log] Parsed custom action node ID: \`${traceId}\`. Simulation successful!`, ephemeral: true });
    }

    const guildConfig = await database.findOne({ guildId: guildId }).catch(() => null) || {};
    const panel = guildConfig.reactionRolePanels?.find(p => p.messageId === interaction.message.id);
    if (!panel) return;

    let targetRoleIds = [];

    if (interaction.isButton() && customId.startsWith('rr_')) {
      targetRoleIds.push(customId.replace('rr_', ''));
    }

    if (interaction.isStringSelectMenu() && customId === 'rr_dropdown_select') {
      targetRoleIds = interaction.values;
    }

    if (targetRoleIds.length === 0) return;

    await interaction.deferReply({ ephemeral: true });

    const addedRoles = [];
    const removedRoles = [];

    for (const roleId of targetRoleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) continue;

      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId).catch(() => null);
        removedRoles.push(role.name);
      } else {
        await member.roles.add(roleId).catch(() => null);
        addedRoles.push(role.name);
      }
    }

    let replyText = '';
    if (addedRoles.length > 0) replyText += `✅ **Role Granted:** You now have the **${addedRoles.join(', ')}** role!\n`;
    if (removedRoles.length > 0) replyText += `🛑 **Role Revoked:** Removed the **${removedRoles.join(', ')}** role from your account.\n`;
    if (replyText === '') replyText = '❌ Structural update configuration mismatch tracking errors occurred.';

    return interaction.editReply({ content: replyText });
  },

  async executePrefix(message, argsArray, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return message.reply('❌ Permissions required!').catch(() => null);
    }

    const subArg = argsArray && argsArray[0] ? argsArray[0].toLowerCase().trim() : '';
    if (subArg !== 'create' && subArg !== 'test' && subArg !== 'edit' && subArg !== 'delete-panel') {
      return message.reply('❌ Usage: `|reactionroles <create|test|edit|delete-panel> [options]`\n💡 Prefer Slash commands (`/reactionroles`) for complex setups!').catch(() => null);
    }

    const mockInteraction = {
      guild: message.guild,
      guildId: message.guild.id,
      member: message.member,
      user: message.author,
      isCommand: () => false,
      options: {
        getSubcommand: () => subArg,
        getString: (name) => argsArray && argsArray.length > 1 ? argsArray.slice(1).join(' ') : '',
        getChannel: (name) => message.mentions.channels.first() || message.channel,
        getRole: (name) => message.mentions.roles.first()
      },
      reply: async (options) => message.reply(options)
    };

    await this.execute(mockInteraction, client).catch(err => console.error('Error handling interaction reaction role wrapper:', err));
  }
};