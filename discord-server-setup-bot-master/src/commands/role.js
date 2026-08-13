const { PermissionFlagsBits, EmbedBuilder, SlashCommandBuilder } = require("discord.js");

const PREFIX = "|";

const SUBCOMMANDS = {
  user:        "Add a role to a specific user",
  remove:      "Remove a role from a specific user",
  create:      "Create a new role",
  delete:      "Delete an existing role",
  everyone:    "Add a role to every member",
  bots:        "Add a role to all bots",
  humans:      "Add a role to all non-bot members",
  info:        "Display info about a role",
  list:        "List all roles in the server",
  color:       "Change a role's color",
  rename:      "Rename an existing role",
  hoist:       "Toggle whether a role is hoisted",
  mentionable: "Toggle whether a role is mentionable",
};

// 1. SLASH COMMAND BUILDER
const data = new SlashCommandBuilder()
  .setName("role")
  .setDescription("Role management system")
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .setDMPermission(false)
  .addSubcommand(sub => sub
    .setName("user")
    .setDescription(SUBCOMMANDS.user)
    .addUserOption(opt => opt.setName("member").setDescription("The target member").setRequired(true))
    .addRoleOption(opt => opt.setName("role").setDescription("The role to add").setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName("remove")
    .setDescription(SUBCOMMANDS.remove)
    .addUserOption(opt => opt.setName("member").setDescription("The target member").setRequired(true))
    .addRoleOption(opt => opt.setName("role").setDescription("The role to remove").setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName("create")
    .setDescription(SUBCOMMANDS.create)
    .addStringOption(opt => opt.setName("name").setDescription("The name of the new role").setRequired(true))
    .addStringOption(opt => opt.setName("color").setDescription("The hex color code").setRequired(false))
    .addBooleanOption(opt => opt.setName("hoist").setDescription("Display separately?").setRequired(false))
    .addBooleanOption(opt => opt.setName("mentionable").setDescription("Can anyone mention?").setRequired(false))
  )
  .addSubcommand(sub => sub
    .setName("delete")
    .setDescription(SUBCOMMANDS.delete)
    .addRoleOption(opt => opt.setName("role").setDescription("The role to delete").setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName("everyone")
    .setDescription(SUBCOMMANDS.everyone)
    .addRoleOption(opt => opt.setName("role").setDescription("The role to give to everyone").setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName("bots")
    .setDescription(SUBCOMMANDS.bots)
    .addRoleOption(opt => opt.setName("role").setDescription("The role to give to all bots").setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName("humans")
    .setDescription(SUBCOMMANDS.humans)
    .addRoleOption(opt => opt.setName("role").setDescription("The role to give to all humans").setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName("info")
    .setDescription(SUBCOMMANDS.info)
    .addRoleOption(opt => opt.setName("role").setDescription("The target role").setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName("list")
    .setDescription(SUBCOMMANDS.list)
  )
  .addSubcommand(sub => sub
    .setName("color")
    .setDescription(SUBCOMMANDS.color)
    .addRoleOption(opt => opt.setName("role").setDescription("The role to modify").setRequired(true))
    .addStringOption(opt => opt.setName("hex").setDescription("New hex color code").setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName("rename")
    .setDescription(SUBCOMMANDS.rename)
    .addRoleOption(opt => opt.setName("role").setDescription("The role to rename").setRequired(true))
    .addStringOption(opt => opt.setName("new_name").setDescription("The new name").setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName("hoist")
    .setDescription(SUBCOMMANDS.hoist)
    .addRoleOption(opt => opt.setName("role").setDescription("The role to toggle hoist status").setRequired(true))
  )
  .addSubcommand(sub => sub
    .setName("mentionable")
    .setDescription(SUBCOMMANDS.mentionable)
    .addRoleOption(opt => opt.setName("role").setDescription("The role to toggle mention status").setRequired(true))
  );

function embed(color = "#5865F2") {
  return new EmbedBuilder().setColor(color).setTimestamp();
}

function checkPermissions(context) {
  const member = context.member;
  const me = context.guild.members.me;

  if (!member.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { valid: false, error: "You need the **Manage Roles** permission to use this command." };
  }
  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { valid: false, error: "I need the **Manage Roles** permission to run this action." };
  }
  return { valid: true };
}

function canManageRole(guild, role) {
  return guild.members.me.roles.highest.comparePositionTo(role) > 0;
}

function resolveRole(guild, input) {
  if (!input || typeof input !== "string") return null;
  const id = input.replace(/[<@&>]/g, "");
  return guild.roles.cache.get(id) || guild.roles.cache.find((r) => r.name.toLowerCase() === input.toLowerCase()) || null;
}

async function resolveMember(guild, input) {
  if (!input || typeof input !== "string") return null;
  const id = input.replace(/[<@!>]/g, "");
  return guild.members.cache.get(id) || await guild.members.fetch(id).catch(() => null);
}

function usage(msg, sub, syntax) {
  return msg.reply({ embeds: [embed("#FEE75C").setTitle(`Usage — ${PREFIX}role ${sub}`).setDescription(`\`\`\`${syntax}\`\`\``)] });
}
// 2. SLASH COMMAND EXECUTION ROUTER
async function execute(interaction) {
  if (!interaction.guild) return;
  
  const permCheck = checkPermissions(interaction);
  if (!permCheck.valid) {
    return interaction.reply({ content: `❌ ${permCheck.error}`, ephemeral: true });
  }

  const { logAction } = require('../utils/auditLog');

  const sub = interaction.options.getSubcommand();
  const callerUser = interaction.user;

  if (sub === "user") {
    const member = interaction.options.getMember("member");
    const role = interaction.options.getRole("role");

    if (!member) return interaction.reply({ content: "Could not find that member.", ephemeral: true });
    if (!canManageRole(interaction.guild, role)) return interaction.reply({ content: "That role hierarchy is high up.", ephemeral: true });
    if (member.roles.cache.has(role.id)) return interaction.reply({ content: "Member already has role.", ephemeral: true });

    await member.roles.add(role);
    try { await logAction(interaction.guild, 'Role Given', callerUser, `Added ${role.name} to ${member.user.username}`); } catch(e){}
    return interaction.reply({ embeds: [embed("#57F287").setTitle("Role Added").setDescription(`Added ${role} to ${member}.`)] });
  }

  if (sub === "remove") {
    const member = interaction.options.getMember("member");
    const role = interaction.options.getRole("role");

    if (!member) return interaction.reply({ content: "Could not find that member.", ephemeral: true });
    if (!canManageRole(interaction.guild, role)) return interaction.reply({ content: "That role hierarchy is high up.", ephemeral: true });
    if (!member.roles.cache.has(role.id)) return interaction.reply({ content: "Member doesn't have role.", ephemeral: true });

    await member.roles.remove(role);
    try { await logAction(interaction.guild, 'Role Removed', callerUser, `Removed ${role.name} from ${member.user.username}`); } catch(e){}
    return interaction.reply({ embeds: [embed("#57F287").setTitle("Role Removed").setDescription(`Removed ${role} from ${member}.`)] });
  }

  if (sub === "create") {
    const name = interaction.options.getString("name");
    const color = interaction.options.getString("color") || null;
    const hoist = interaction.options.getBoolean("hoist") || false;
    const mentionable = interaction.options.getBoolean("mentionable") || false;

    try {
      const role = await interaction.guild.roles.create({ name, color, hoist, mentionable });
      try { await logAction(interaction.guild, 'Role Created', callerUser, `Created role: ${name} (Color: ${color || 'Default'})`); } catch(e){}
      return interaction.reply({ embeds: [embed("#57F287").setTitle("Role Created").setDescription(`Created role ${role}.`)] });
    } catch {
      return interaction.reply({ content: "Failed to create. Check hex structure.", ephemeral: true });
    }
  }

  if (sub === "delete") {
    const role = interaction.options.getRole("role");
    if (!canManageRole(interaction.guild, role)) return interaction.reply({ content: "Role hierarchy issue.", ephemeral: true });
    if (role.managed) return interaction.reply({ content: "Managed integration role.", ephemeral: true });

    const roleName = role.name;
    await role.delete();
    try { await logAction(interaction.guild, 'Role Deleted', callerUser, `Deleted role: ${roleName}`); } catch(e){}
    return interaction.reply({ embeds: [embed("#57F287").setTitle("Role Deleted")] });
  }

  if (sub === "everyone") {
    const role = interaction.options.getRole("role");
    if (!canManageRole(interaction.guild, role)) return interaction.reply({ content: "Role hierarchy issue.", ephemeral: true });

    await interaction.deferReply();
    await interaction.guild.members.fetch();
    const targets = interaction.guild.members.cache.filter((m) => !m.roles.cache.has(role.id));

    let success = 0;
    for (const [, m] of targets) { try { await m.roles.add(role); success++; } catch {} }
    try { await logAction(interaction.guild, 'Mass Role Added', callerUser, `Added ${role.name} to ${success} members`); } catch(e){}

    return interaction.editReply({ embeds: [embed("#57F287").setTitle("Mass Role Added").setDescription(`Added to ${success} members.`)] });
  }

  if (sub === "bots") {
    const role = interaction.options.getRole("role");
    if (!canManageRole(interaction.guild, role)) return interaction.reply({ content: "Role hierarchy issue.", ephemeral: true });

    await interaction.deferReply();
    await interaction.guild.members.fetch();
    const targets = interaction.guild.members.cache.filter((m) => m.user.bot && !m.roles.cache.has(role.id));

    let success = 0;
    for (const [, m] of targets) { try { await m.roles.add(role); success++; } catch {} }
    try { await logAction(interaction.guild, 'Mass Role Added (Bots)', callerUser, `Added ${role.name} to ${success} bot accounts`); } catch(e){}

    return interaction.editReply({ embeds: [embed("#57F287").setTitle("Bots Role Completed").setDescription(`Added to ${success} bot accounts.`)] });
  }

  if (sub === "humans") {
    const role = interaction.options.getRole("role");
    if (!canManageRole(interaction.guild, role)) return interaction.reply({ content: "Role hierarchy issue.", ephemeral: true });

    await interaction.deferReply();
    await interaction.guild.members.fetch();
    const targets = interaction.guild.members.cache.filter((m) => !m.user.bot && !m.roles.cache.has(role.id));

    let success = 0;
    for (const [, m] of targets) { try { await m.roles.add(role); success++; } catch {} }
    try { await logAction(interaction.guild, 'Mass Role Added (Humans)', callerUser, `Added ${role.name} to ${success} human accounts`); } catch(e){}

    return interaction.editReply({ embeds: [embed("#57F287").setTitle("Humans Role Completed").setDescription(`Added to ${success} human accounts.`)] });
  }

  if (sub === "info") {
    const role = interaction.options.getRole("role");
    await interaction.guild.members.fetch();

    const infoEmbed = embed(role.hexColor)
      .setTitle(`ℹ️ Role Info: ${role.name}`)
      .addFields(
        { name: "ID", value: `\`${role.id}\``, inline: true },
        { name: "Color Hex", value: `\`${role.hexColor}\``, inline: true },
        { name: "Total Members", value: `\`${role.members.size}\` users`, inline: true },
        { name: "Hoisted Separately", value: role.hoist ? "🟢 Yes" : "🔴 No", inline: true },
        { name: "Mentionable By Anyone", value: role.mentionable ? "🟢 Yes" : "🔴 No", inline: true }
      );
    return interaction.reply({ embeds: [infoEmbed] });
  }

  if (sub === "list") {
    await interaction.guild.roles.fetch();
    const roles = interaction.guild.roles.cache
      .filter(r => r.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `${r} — \`${r.members.size}\` members`).join("\n");

    return interaction.reply({ embeds: [embed().setTitle("Server Roles").setDescription(roles.slice(0, 4000) || "No roles found.")] });
  }

  if (sub === "color") {
    const role = interaction.options.getRole("role");
    const hex = interaction.options.getString("hex");
    if (!canManageRole(interaction.guild, role)) return interaction.reply({ content: "Role hierarchy issue.", ephemeral: true });

    try {
      await role.setColor(hex);
      try { await logAction(interaction.guild, 'Role Updated (Color)', callerUser, `Changed color of ${role.name} to ${hex}`); } catch(e){}
      return interaction.reply({ embeds: [embed(hex).setTitle("Color Updated")] });
    } catch {
      return interaction.reply({ content: "Invalid hex value structure.", ephemeral: true });
    }
  }

  if (sub === "rename") {
    const role = interaction.options.getRole("role");
    const newName = interaction.options.getString("new_name");
    if (!canManageRole(interaction.guild, role)) return interaction.reply({ content: "Role hierarchy issue.", ephemeral: true });

    const oldName = role.name;
    await role.setName(newName);
    try { await logAction(interaction.guild, 'Role Updated (Rename)', callerUser, `Renamed role from ${oldName} to ${newName}`); } catch(e){}
    return interaction.reply({ embeds: [embed("#57F287").setTitle("Role Renamed")] });
  }

  if (sub === "hoist") {
    const role = interaction.options.getRole("role");
    if (!canManageRole(interaction.guild, role)) return interaction.reply({ content: "Role hierarchy issue.", ephemeral: true });

    await role.setHoist(!role.hoist);
    try { await logAction(interaction.guild, 'Role Updated (Hoist)', callerUser, `Toggled hoist status for ${role.name} to ${!role.hoist}`); } catch(e){}
    return interaction.reply({ embeds: [embed("#57F287").setTitle("📌 Hoist Toggled").setDescription(`${role} is now ${role.hoist ? "hoisted (visible separately in sidebar)" : "unhoisted"}.`)] });
  }

  if (sub === "mentionable") {
    const role = interaction.options.getRole("role");
    if (!canManageRole(interaction.guild, role)) return interaction.reply({ content: "Role hierarchy issue.", ephemeral: true });

    await role.setMentionable(!role.mentionable);
    try { await logAction(interaction.guild, 'Role Updated (Mentionable)', callerUser, `Toggled mentionable status for ${role.name} to ${!role.mentionable}`); } catch(e){}
    return interaction.reply({ embeds: [embed("#57F287").setTitle("💬 Mentionable Toggled").setDescription(`${role} is now ${role.mentionable ? "mentionable" : "not mentionable"}.`)] });
  }
}
// 3. PREFIX COMMAND EXECUTION GATEWAY
async function runPrefix(msg, args, client) {
  if (!msg.guild) return;

  const { logAction } = require('../utils/auditLog');
  const callerUser = msg.author;

  const subArg = Array.isArray(args) ? args[0] : args;
  const sub = (subArg || "").toLowerCase().trim();

  if (!sub || !SUBCOMMANDS[sub]) {
    const list = Object.entries(SUBCOMMANDS).map(([k, v]) => `\`${PREFIX}role ${k}\` — ${v}`).join("\n");
    return msg.reply({ 
      embeds: [embed().setTitle("🛡️ Role Management System").setDescription(list).setFooter({ text: "Angle brackets < > = required  |  Square brackets [ ] = optional" })] 
    });
  }

  const permCheck = checkPermissions(msg);
  if (!permCheck.valid) {
    return msg.reply(`❌ ${permCheck.error}`);
  }

  if (sub === "user") {
    if (!Array.isArray(args) || args.length < 3) return usage(msg, "user", `${PREFIX}role user <@member> <@role>`);
    const member = await resolveMember(msg.guild, args[1]);
    const role   = resolveRole(msg.guild, args[2]);

    if (!member || !role) return msg.reply("❌ Could not find that member or role.");
    if (!canManageRole(msg.guild, role)) return msg.reply("❌ That role is at or above my highest role.");
    if (member.roles.cache.has(role.id)) return msg.reply("❌ That member already has that role.");
    
    await member.roles.add(role);
    try { await logAction(msg.guild, 'Role Given', callerUser, `Added ${role.name} to ${member.user.username}`); } catch(e){}
    return msg.reply({ embeds: [embed("#57F287").setTitle("Role Added").setDescription(`Added ${role} to ${member}.`)] });
  }

  if (sub === "remove") {
    if (!Array.isArray(args) || args.length < 3) return usage(msg, "remove", `${PREFIX}role remove <@member> <@role>`);
    const member = await resolveMember(msg.guild, args[1]);
    const role   = resolveRole(msg.guild, args[2]);

    if (!member || !role) return msg.reply("❌ Could not find that member or role.");
    if (!canManageRole(msg.guild, role)) return msg.reply("❌ That role is at or above my highest role.");
    if (!member.roles.cache.has(role.id)) return msg.reply("❌ That member does not have that role.");
    
    await member.roles.remove(role);
    try { await logAction(msg.guild, 'Role Removed', callerUser, `Removed ${role.name} from ${member.user.username}`); } catch(e){}
    return msg.reply({ embeds: [embed("#57F287").setTitle("Role Removed").setDescription(`Removed ${role} from ${member}.`)] });
  }
  if (sub === "create") {
    if (!Array.isArray(args) || args.length < 2) return usage(msg, "create", `${PREFIX}role create <name> [hex color]`);
    const name = args.slice(1).join(" ");
    const color = args[2] || null;
    try {
      const role = await msg.guild.roles.create({ name, color });
      try { await logAction(msg.guild, 'Role Created', callerUser, `Created role: ${name} (Color: ${color || 'Default'})`); } catch(e){}
      return msg.reply({ embeds: [embed("#57F287").setTitle("Role Created").setDescription(`Successfully created role ${role}.`)] });
    } catch { return msg.reply("❌ Failed to create role. Ensure color layout matches hex coding parameters."); }
  }

  if (sub === "delete") {
    if (!Array.isArray(args) || args.length < 2) return usage(msg, "delete", `${PREFIX}role delete <@role>`);
    const role = resolveRole(msg.guild, args[1]);
    if (!role) return msg.reply("❌ Could not find that role.");
    if (!canManageRole(msg.guild, role)) return msg.reply("❌ That role is at or above my highest role.");
    if (role.managed) return msg.reply("❌ That role is managed by an integration and cannot be deleted.");
    
    const oldName = role.name;
    await role.delete();
    try { await logAction(msg.guild, 'Role Deleted', callerUser, `Deleted role: ${oldName}`); } catch(e){}
    return msg.reply({ embeds: [embed("#57F287").setTitle("Role Deleted").setDescription(`The role **${oldName}** has been deleted.`)] });
  }

  if (sub === "everyone") {
    if (!Array.isArray(args) || args.length < 2) return usage(msg, "everyone", `${PREFIX}role everyone <@role>`);
    const role = resolveRole(msg.guild, args[1]);
    if (!role) return msg.reply("❌ Could not find that role.");
    if (!canManageRole(msg.guild, role)) return msg.reply("❌ That role is at or above my highest role.");

    const loading = await msg.reply("🔄 Looping through server members... this may take a while.");
    await msg.guild.members.fetch();
    const targets = msg.guild.members.cache.filter(m => !m.roles.cache.has(role.id));
    
    let ok = 0;
    for (const [, m] of targets) { try { await m.roles.add(role); ok++; } catch {} }
    try { await logAction(msg.guild, 'Mass Role Added', callerUser, `Added ${role.name} to ${ok} members via prefix`); } catch(e){}
    return loading.edit({ content: null, embeds: [embed("#57F287").setTitle("Mass Role Added").setDescription(`Successfully added ${role} to **${ok}** members.`)] });
  }

  if (sub === "bots") {
    if (!Array.isArray(args) || args.length < 2) return usage(msg, "bots", `${PREFIX}role bots <@role>`);
    const role = resolveRole(msg.guild, args[1]);
    if (!role) return msg.reply("❌ Could not find that role.");
    if (!canManageRole(msg.guild, role)) return msg.reply("❌ That role is at or above my highest role.");
    
    const loading = await msg.reply("🔄 Filtering bot accounts...");
    await msg.guild.members.fetch();
    const targets = msg.guild.members.cache.filter(m => m.user.bot && !m.roles.cache.has(role.id));
    
    let ok = 0;
    for (const [, m] of targets) { try { await m.roles.add(role); ok++; } catch {} }
    try { await logAction(msg.guild, 'Mass Role Added (Bots)', callerUser, `Added ${role.name} to ${ok} bots via prefix`); } catch(e){}
    return loading.edit({ content: null, embeds: [embed("#57F287").setTitle("Bots Assignment Complete").setDescription(`Successfully added ${role} to **${ok}** bots.`)] });
  }

  if (sub === "humans") {
    if (!Array.isArray(args) || args.length < 2) return usage(msg, "humans", `${PREFIX}role humans <@role>`);
    const role = resolveRole(msg.guild, args[1]);
    if (!role) return msg.reply("❌ Could not find that role.");
    if (!canManageRole(msg.guild, role)) return msg.reply("❌ That role is at or above my highest role.");
    
    const loading = await msg.reply("🔄 Filtering human accounts...");
    await msg.guild.members.fetch();
    const targets = msg.guild.members.cache.filter(m => !m.user.bot && !m.roles.cache.has(role.id));
    
    let ok = 0;
    for (const [, m] of targets) { try { await m.roles.add(role); ok++; } catch {} }
    try { await logAction(msg.guild, 'Mass Role Added (Humans)', callerUser, `Added ${role.name} to ${ok} humans via prefix`); } catch(e){}
    return loading.edit({ content: null, embeds: [embed("#57F287").setTitle("Humans Assignment Complete").setDescription(`Successfully added ${role} to **${ok}** human members.`)] });
  }

  if (sub === "info") {
    if (!Array.isArray(args) || args.length < 2) return usage(msg, "info", `${PREFIX}role info <@role>`);
    const role = resolveRole(msg.guild, args[1]);
    if (!role) return msg.reply("❌ Could not find that role.");
    
    await msg.guild.members.fetch();

    const infoEmbed = embed(role.hexColor)
      .setTitle(`ℹ️ Role Info: ${role.name}`)
      .addFields(
        { name: "ID", value: `\`${role.id}\``, inline: true },
        { name: "Color Hex", value: `\`${role.hexColor}\``, inline: true },
        { name: "Total Members", value: `\`${role.members.size}\` users`, inline: true },
        { name: "Hoisted Separately", value: role.hoist ? "🟢 Yes" : "🔴 No", inline: true },
        { name: "Mentionable By Anyone", value: role.mentionable ? "🟢 Yes" : "🔴 No", inline: true }
      );
    return msg.reply({ embeds: [infoEmbed] });
  }

  if (sub === "list") {
    await msg.guild.roles.fetch();
    const lines = msg.guild.roles.cache
      .filter(r => r.id !== msg.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `${r} — \`${r.members.size}\` members`)
      .join("\n");
      
    return msg.reply({ embeds: [embed().setTitle("📋 Server Roles List").setDescription(lines.slice(0, 2000) || "No custom roles found.")] });
  }

  if (sub === "color") {
    if (!Array.isArray(args) || args.length < 3) return usage(msg, "color", `${PREFIX}role color <@role> <hex code>`);
    const role = resolveRole(msg.guild, args[1]);
    const hex = args[2];
    
    if (!role) return msg.reply("❌ Could not find that role.");
    if (!canManageRole(msg.guild, role)) return msg.reply("❌ That role is at or above my highest role.");
    try { 
      await role.setColor(hex); 
      try { await logAction(msg.guild, 'Role Updated (Color)', callerUser, `Changed color of ${role.name} to ${hex} via prefix`); } catch(e){}
      return msg.reply({ embeds: [embed(hex).setTitle("🎨 Color Updated").setDescription(`Changed color of ${role} to \`${hex}\`.`)] }); 
    } catch { return msg.reply("❌ Invalid hex color code. Use formatting values like `#FF0000`."); }
  }

  if (sub === "rename") {
    if (!Array.isArray(args) || args.length < 3) return usage(msg, "rename", `${PREFIX}role rename <@role> <new name>`);
    const role = resolveRole(msg.guild, args[1]);
    const newName = args.slice(2).join(" ");
    
    if (!role) return msg.reply("❌ Could not find that role.");
    if (!canManageRole(msg.guild, role)) return msg.reply("❌ That role is at or above my highest role.");
    if (!newName) return msg.reply("❌ Please provide a valid new name.");
    
    const oldName = role.name;
    await role.setName(newName);
    try { await logAction(msg.guild, 'Role Updated (Rename)', callerUser, `Renamed role from ${oldName} to ${newName} via prefix`); } catch(e){}
    return msg.reply({ embeds: [embed("#57F287").setTitle("✏️ Role Renamed").setDescription(`Renamed **${oldName}** to **${newName}**`)] });
  }

  if (sub === "hoist") {
    if (!Array.isArray(args) || args.length < 2) return usage(msg, "hoist", `${PREFIX}role hoist <@role>`);
    const role = resolveRole(msg.guild, args[1]);
    
    if (!role) return msg.reply("❌ Could not find that role.");
    if (!canManageRole(msg.guild, role)) return msg.reply("❌ That role is at or above my highest role.");
    
    await role.setHoist(!role.hoist);
    try { await logAction(msg.guild, 'Role Updated (Hoist)', callerUser, `Toggled hoist status for ${role.name} to ${!role.hoist} via prefix`); } catch(e){}
    return msg.reply({ embeds: [embed("#57F287").setTitle("📌 Hoist Toggled").setDescription(`${role} is now ${role.hoist ? "hoisted (visible separately in sidebar)" : "unhoisted"}.`)] });
  }

  if (sub === "mentionable") {
    if (!Array.isArray(args) || args.length < 2) return usage(msg, "mentionable", `${PREFIX}role mentionable <@role>`);
    const role = resolveRole(msg.guild, args[1]);
    
    if (!role) return msg.reply("❌ Could not find that role.");
    if (!canManageRole(msg.guild, role)) return msg.reply("❌ That role is at or above my highest role.");
    
    await role.setMentionable(!role.mentionable);
    try { await logAction(msg.guild, 'Role Updated (Mentionable)', callerUser, `Toggled mentionable status for ${role.name} to ${!role.mentionable} via prefix`); } catch(e){}
    return msg.reply({ embeds: [embed("#57F287").setTitle("💬 Mentionable Toggled").setDescription(`${role} is now ${role.mentionable ? "mentionable" : "not mentionable"}.`)] });
  }
}

// COMPLETE MASTER ROUTER EXPORTS MAP OUT
module.exports = { data, execute, runPrefix };
