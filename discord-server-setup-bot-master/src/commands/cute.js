const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const database = require('../utils/database');
const { formatCute } = require('../utils/textFormatter.js'); // 🌟 Imported here

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cute')
    .setDescription('Configure cute text layouts for server setup templates')
    .addStringOption(option =>
      option.setName('style')
        .setDescription('Select an aesthetic font layout style')
        .setRequired(true)
        .addChoices(
          { name: 'Wide (ａｅｓｔｈｅｔｉｃ)', value: 'wide' },
          { name: 'Small Caps (sᴍᴀʟʟ ᴄᴀᴘs)', value: 'small-caps' },
          { name: 'Bubbles (ⓑⓤⓑⓑⓛⓔⓢ)', value: 'bubbles' },
          { name: 'Bold (𝐛𝐨𝐥𝐝)', value: 'bold' },
          { name: 'Italic (𝑖𝑡𝑎𝑙𝑖𝑐)', value: 'italic' },
          { name: 'Bold Italic (𝒃𝒐𝒍𝒅)', value: 'bolditalic' },
          { name: 'Script (𝓼𝓬𝓻𝓲𝓹𝓽)', value: 'script' },
          { name: 'Fraktur (𝔤𝔬𝔱𝔥𝔦𝔠)', value: 'fraktur' },
          { name: 'Double-Struck (𝕕𝕠𝕦𝕓𝕝𝕖)', value: 'doublestruck' },
          { name: 'Monospace (𝚖𝚘𝚗𝚘)', value: 'monospace' },
          { name: 'Upside Down (uʍop)', value: 'upsidedown' },
          { name: 'Strikethrough (s̶t̶r̶i̶k̶e̶)', value: 'strikethrough' },
          { name: 'Underline (u̲n̲d̲e̲r̲)', value: 'underline' },
          { name: 'Turn Off (Normal Text)', value: 'off' }
        )
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  name: 'cute',

  async execute(interaction) {
    const isInteraction = interaction.isCommand ? interaction.isCommand() : false;

    // 🌟 FIX: Instantly extend the Discord token lifetime to 15 minutes
    if (isInteraction) {
      await interaction.deferReply({ ephemeral: true }).catch(() => null);
    }

    const memberExecutor = interaction.member;
    const guildId = interaction.guildId;

    if (!memberExecutor.permissions.has(PermissionFlagsBits.Administrator) && 
        !memberExecutor.permissions.has(PermissionFlagsBits.ManageGuild)) {
      const msg = '❌ You need **Administrator** or **Manage Server** permissions to use this configuration!';
      return isInteraction ? interaction.editReply({ content: msg }) : interaction.reply(msg);
    }

    try {
      const style = typeof interaction.options.getString === 'function' 
        ? interaction.options.getString('style') 
        : interaction.options.getString;

      if (!style) return;

      // Save structural choice settings straight to MongoDB
      await database.findOneAndUpdate(
        { guildId: guildId },
        { $set: { cuteStyle: style } },
        { upsert: true }
      ).catch(() => null);

      const isOff = style === 'off';
      
      const styleNames = {
        'wide': 'Wide Text Layout (ａｅｓｔｈｅｔｉｃ)',
        'small-caps': 'Small Caps Layout (sᴍᴀʟʟ ᴄᴀᴘs)',
        'smallcaps': 'Small Caps Layout (sᴍᴀʟʟ ᴄᴀᴘs)',
        'bubbles': 'Bubble Text Layout (ⓑⓤⓑⓑⓛⓔⓢ)',
        'bold': 'Bold Layout (𝐛𝐨𝐥𝐝)',
        'italic': 'Italic Layout (𝑖𝑡𝑎𝑙𝑖𝑐)',
        'bolditalic': 'Bold Italic Layout (𝒃𝒐𝒍𝒅 𝒊𝒕𝒂𝒍𝒊𝒄)',
        'script': 'Script Layout (𝓼𝓬𝓻𝓲𝓹𝓽)',
        'fraktur': 'Fraktur Layout (𝔤𝔬𝔱𝔥𝔦𝔠)',
        'doublestruck': 'Double-Struck Layout (𝕕𝕠𝕦𝕓𝕝𝕖)',
        'monospace': 'Monospace Layout (𝚖𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎)',
        'upsidedown': 'Upside Down Layout (uʍop ǝpᴉsdn)',
        'strikethrough': 'Strikethrough Layout (s̶t̶r̶i̶k̶e̶)',
        'underline': 'Underline Layout (u̲n̲d̲e̲r̲l̲i̲n̲e̲)'
      };

      // 🌟 TEST UTILITY: Demonstrates formatCute parsing data dynamically inside your confirmation panel
      const testPreview = isOff ? 'standard text' : formatCute('preview sample', style);

      const embed = new EmbedBuilder()
        .setColor(isOff ? '#808080' : '#FF69B4')
        .setTitle(isOff ? '😢 Cute Mode Disabled' : '✨ Cute Mode Configured! ✨')
        .setDescription(isOff 
          ? 'Cute templates have been turned off. Setup layouts are back to standard Discord styles.' 
          : `Templates will now build using the **${styleNames[style] || style.toUpperCase()}** configuration! (´｀)\n\n**Visual Preview:** \`${testPreview}\``
        );

      // 🌟 FIX: Complete deferred token cycle with editReply
      return isInteraction ? interaction.editReply({ embeds: [embed] }) : interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Cute command configuration error:', error);
      return isInteraction 
        ? interaction.editReply({ content: `❌ Config Error: ${error.message}` }).catch(() => null)
        : interaction.reply({ content: `❌ Config Error: ${error.message}` }).catch(() => null);
    }
  },

  async executePrefix(message, argsArray, client) {
    const guild = message.guild;
    if (!guild) return;

    const member = message.member;
    if (!member.permissions.has(PermissionFlagsBits.Administrator) && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return message.reply('❌ You require Manager or Administrator permissions to change font profiles.').catch(() => null);
    }

    let inputArg = (argsArray && argsArray) ? argsArray.toLowerCase().trim() : null;
    if (inputArg === 'smallcaps') inputArg = 'small-caps';

    const validInputs = ['wide', 'small-caps', 'bubbles', 'off'];
    if (!inputArg || !validInputs.includes(inputArg)) {
      return message.reply('❌ Usage: `|cute <wide|small-caps|bubbles|off>`').catch(() => null);
    }

    const mockInteraction = {
      guild: message.guild,
      guildId: message.guild.id,
      member: message.member,
      user: message.author,
      options: { getString: inputArg }, 
      reply: async (options) => message.reply(options)
    };

    await this.execute(mockInteraction).catch(err => console.error('Error handling inline cute font wrapper:', err));
  }
};
