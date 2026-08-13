const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType, 
    MessageFlags 
  } = require('discord.js');
  const db = require('../utils/database');
  
  const SCENARIOS = [
    { a: "Have the ability to fly but only at a walking speed pace.", b: "Have the ability to teleport but only to places you've already been." },
    { a: "Always be 10 minutes late to everything.", b: "Always be 20 minutes early to everything." },
    { a: "Find true love but live in poverty.", b: "Become a multi-billionaire but never find true love." },
    { a: "Have all your shirts be 2 sizes too big.", b: "Have all your shirts be 1 size too small." },
    { a: "Be able to speak every human language fluently.", b: "Be able to speak to all animals." },
    { a: "Only be able to whisper everything.", b: "Only be able to shout everything." },
    { a: "Live without music for the rest of your life.", b: "Live without television/movies for the rest of your life." },
    { a: "Know the exact date of your death.", b: "Know the exact cause of your death." },
    { a: "Be the absolute best player on a team that always loses.", b: "Be the worst player on a team that always wins championships." },
    { a: "Control fire but get hurt by water.", b: "Control water but get hurt by fire." },
    { a: "Be forced to say everything that comes to your mind out loud.", b: "Never be able to speak out loud again for the rest of your life." },
    { a: "Lose all your digital memories (photos, accounts, data).", b: "Lose all your physical possessions right now." },
    { a: "Have an extra eye directly in the back of your head.", b: "Have an extra set of ears on the palms of your hands." },
    { a: "Explore the deepest depths of the ocean floor live.", b: "Travel to an unexplored habitable planet in deep space." },
    { a: "Have un-skippable 30-second advertisements appear in your dreams.", b: "Have a banner advertisement permanently attached to your real-life vision." }
  ];
  
  module.exports = {
    data: new SlashCommandBuilder().setName('wouldyourather').setDescription('Presents an impossible split decision with interactive voting buttons.'),
    name: 'wouldyourather',
  
    async execute(interaction) {
      const settings = db.readData('settings.json') || {};
      const currentGuildSettings = settings[interaction.guildId] || {};
  
      // 1. Core Framework Switch Verification
      if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
        return interaction.reply({ 
          content: '❌ The Fun Module is currently disabled on this server!', 
          flags: [MessageFlags.Ephemeral] 
        }).catch(() => null);
      }
      
      const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
      
      let cuteStyle = 'off';
      try { const cuteData = db.readData('cute.json') || {}; cuteStyle = cuteData[interaction.guildId] || 'off'; } catch (e) {}
      const isCuteActive = cuteStyle !== 'off';
  
      // 2. Track Votes using unique sets to prevent user duplicate votes
      const votesA = new Set();
      const votesB = new Set();
  
      // Helper function to draw a clean, synchronized real-time embed panel
      const buildEmbed = (isClosed = false) => {
        const totalVotes = votesA.size + votesB.size;
        const percentA = totalVotes > 0 ? Math.round((votesA.size / totalVotes) * 100) : 0;
        const percentB = totalVotes > 0 ? Math.round((votesB.size / totalVotes) * 100) : 0;
  
        return new EmbedBuilder()
          .setColor(isClosed ? '#7F8C8D' : (isCuteActive ? '#FF69B4' : '#3498DB'))
          .setTitle(isCuteActive ? '✨ 🤔 WOULD YOU RATHER... ✨' : '🤔 Would You Rather...')
          .setDescription(
            `🔵 **Choice A:** ${scenario.a}\n*Current Tally:* \`${votesA.size}\` votes (${percentA}%)\n\n` +
            `🔴 **Choice B:** ${scenario.b}\n*Current Tally:* \`${votesB.size}\` votes (${percentB}%)\n\n` +
            (isClosed ? `🔒 **Voting is now closed! Total responses: ${totalVotes}**` : `⏱️ *Click a button below to log your vote. Poll closes in 60 seconds.*`)
          )
          .setFooter({ text: isClosed ? 'Final Community Census' : 'Community Poll Active' });
      };
  
      // 3. Build Interactive Buttons
      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`wyr-a-${interaction.id}`)
          .setLabel('Vote A')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('🔵'),
        new ButtonBuilder()
          .setCustomId(`wyr-b-${interaction.id}`)
          .setLabel('Vote B')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('🔴')
      );
  
      const initialResponse = await interaction.reply({
        embeds: [buildEmbed(false)],
        components: [buttons]
      });
  
      // 4. Construct Live Message Component Collector
      const collector = initialResponse.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 60000 // Poll duration: 60 seconds
      });
  
      collector.on('collect', async (btnInteraction) => {
        const voterId = btnInteraction.user.id;
  
        // Handle vote toggles and clean duplicates across sets
        if (btnInteraction.customId === `wyr-a-${interaction.id}`) {
          if (votesA.has(voterId)) {
            votesA.delete(voterId); // Toggle vote off if clicked again
          } else {
            votesA.add(voterId);
            votesB.delete(voterId); // Swap vote if choice B was selected previously
          }
        } else if (btnInteraction.customId === `wyr-b-${interaction.id}`) {
          if (votesB.has(voterId)) {
            votesB.delete(voterId);
          } else {
            votesB.add(voterId);
            votesA.delete(voterId);
          }
        }
  
        // Defer modification internally to update layout without causing flashing lag effects
        await btnInteraction.deferUpdate().catch(() => null);
        
        // Push live tally update smoothly into the original layout
        await interaction.editReply({ embeds: [buildEmbed(false)] }).catch(() => null);
      });
  
      collector.on('end', async () => {
        // 5. Clean up component states smoothly to avoid residual memory leaks
        await interaction.editReply({
          embeds: [buildEmbed(true)],
          components: [] // Erases active buttons completely upon time expiration intervals
        }).catch(() => null);
      });
    },
  
    async executePrefix(message, args, client) {
      const settings = db.readData('settings.json') || {};
      const currentGuildSettings = settings[message.guild?.id] || {};
  
      if (currentGuildSettings.funModule === 'disabled' || currentGuildSettings.funModule === false) {
        return message.reply('❌ The complete **Fun Command Suite** has been globally disabled by a server administrator.').catch(() => null);
      }
  
      // Emulate proper architecture to feed properties straight down to the master router block
      const mockContextInteraction = {
        id: message.id,
        guildId: message.guild.id,
        guild: message.guild,
        user: message.author,
        member: message.member,
        reply: async (options) => message.reply(options),
        editReply: async (options) => {
          if (mockContextInteraction.sentBotMessage) {
            return mockContextInteraction.sentBotMessage.edit(options);
          }
          return message.reply(options);
        }
      };
  
      const targetCommand = client.commands.get('wouldyourather');
      if (targetCommand) {
        const originalReply = mockContextInteraction.reply;
        mockContextInteraction.reply = async (options) => {
          const responseRef = await originalReply(options);
          mockContextInteraction.sentBotMessage = responseRef;
          return responseRef;
        };
  
        await targetCommand.execute(mockContextInteraction).catch(err => console.error('Interactive wouldyourather runtime routing error:', err));
      }
    }
  };
  