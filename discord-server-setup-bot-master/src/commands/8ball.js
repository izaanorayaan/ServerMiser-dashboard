const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  name: '8ball',
  description: '🎱 Ask the magic 8-ball a question and receive a mystical fortune.',
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('🎱 Ask the magic 8-ball a question and receive a mystical fortune.')
    .addStringOption(option =>
      option.setName('question')
        .setDescription('The question you want to ask the cosmic 8-ball')
        .setRequired(true)
    ),

  /**
   * Centralized Execution Core.
   * Handles native app interactions and your custom text message create adapter parameters.
   */
  async execute(interaction, client) {
    const isSlash = interaction.isCommand ? interaction.isCommand() : true;
    const author = interaction.user;

    // Use a safe runtime defer framework to prevent sudden client payload drop timeouts
    if (typeof interaction.deferReply === 'function') {
      await interaction.deferReply().catch(() => null);
    }

    // Extract the raw text question across mock frameworks and slash arrays
    let question = null;
    if (interaction.options && typeof interaction.options.getSubcommand !== 'function') {
      // Fetched via prefix message create adapter mapping configurations
      question = interaction.options.getString('question');
    } else if (interaction.options) {
      // Fetched via native application interaction options UI row
      question = interaction.options.getString('question');
    }

    // Fallback: If no query string was parsed, deliver syntax usage context menu
    if (!question || question.trim().length === 0) {
      const usageNotice = '❌ **Invalid Syntax:** Please provide a question! Example: `|8ball will I win this game?`';
      return isSlash && interaction.deferred
        ? interaction.editReply({ content: usageNotice })
        : interaction.reply({ content: usageNotice, ephemeral: true });
    }

    // Array pool containing 20 classical mystical cosmic response fortunes
    const fortunes = [
      // 🟢 Affirmative Choices
      'It is certain. 🪐',
      'It is decidedly so. ✨',
      'Without a doubt. 🔮',
      'Yes, definitely.💎',
      'You may rely on it. 👍',
      'As I see it, yes. 🌅',
      'Most likely. 📈',
      'Outlook good. ☀️',
      'Yes. ✅',
      'Signs point to yes. 🌟',
      
      // 🟡 Non-committal Choices
      'Reply hazy, try again. 🌫️',
      'Ask again later. ⏳',
      'Better not tell you now. 🔒',
      'Cannot predict now. 🌀',
      'Concentrate and ask again. 🧠',
      
      // 🔴 Negative Choices
      "Don't count on it. 📉",
      'My reply is no. ❌',
      'My sources say no. 🛑',
      'Outlook not so good. ⛈️',
      'Very doubtful. 🛸'
    ];

    // Mathematically random element array indexing pointer
    const structuralRandomSelectionIndex = Math.floor(Math.random() * fortunes.length);
    const cosmicAnswerText = fortunes[structuralRandomSelectionIndex];

    // Build responsive interactive fortune board data view model mapping
    const crystalBallEmbed = new EmbedBuilder()
      .setTitle('🎱 The Magic 8-Ball Proves An Answer')
      .setColor('#2F3136') // Dark aesthetic to match typical Discord UI
      .setThumbnail('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNXV3bzdiaHU4Nmdza2l5OG9kYXh2dGdxb2l1djVsYWtpOTEzN3ViOCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/26xBJp4dcSdGxv2Zq/giphy.gif') // Dynamically maps ServerMiser branding or default icon strings
      .addFields(
        { name: '🔮 Asked Question', value: `\`\`\`text\n${question.slice(0, 250)}\n\`\`\``, inline: false },
        { name: '🌌 Cosmic Decree', value: `> **${cosmicAnswerText}**`, inline: false }
      )
      .setFooter({ text: `Consulted by ${author.username}`, iconURL: author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    // Deploy data packet payload structure safely back to the chat room channel thread
    if (isSlash && (interaction.deferred || interaction.replied)) {
      return await interaction.editReply({ embeds: [crystalBallEmbed] });
    } else if (isSlash) {
      return await interaction.reply({ embeds: [crystalBallEmbed] });
    } else {
      // Fail-safe catch block for nested manual function calls
      return await interaction.channel.send({ embeds: [crystalBallEmbed] });
    }
  }
};
