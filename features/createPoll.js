// features/createPoll.js
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require("discord.js");
const { getOpenAIResponse } = require('./openaiService');

module.exports = async function handlePoll(message) {
  if (message.content.startsWith('!poll')) {
    // Get the poll question and options from the command
    const args = message.content.slice(5).trim().split(';');
    const question = args[0];
    const options = args.slice(1);

    // Check if at least two options are provided
    if (options.length < 2) {
      return message.reply('Please provide at least two options for the poll.');
    }

    // Create buttons for each option
    const buttons = options.map((option, index) =>
      new ButtonBuilder()
        .setCustomId(`poll_option_${index}`)
        .setLabel(option)
        .setStyle(ButtonStyle.Primary)
    );

    // Send the poll message with buttons
    const buttonRow = new ActionRowBuilder().addComponents(buttons);
    const pollMessage = await message.channel.send({
      content: `**${question}**\nSelect your answer to the question!`,
      components: [buttonRow],
    });

    // Collect button interactions
    const collector = pollMessage.createMessageComponentCollector({ time: 60000 }); // 1 minute
    const voters = new Set(); // Set to track voters
    const userNameVotes = new Map(); // Map to track user that vote for which option
    const votes = Array(options.length).fill(0); // Initialize votes for each option

    collector.on('collect', async (interaction) => {
      if (interaction.customId.startsWith('poll_option_')) {
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Check if the user has already voted
        if (voters.has(userId)) {
          await interaction.reply({
            content: "You have already voted!",
            ephemeral: true, // Only the user sees this message
          });
          return;
        }

        // Mark the user as having voted
        voters.add(userId);

        // Record the vote
        const optionIndex = parseInt(interaction.customId.split('_')[2]);
        votes[optionIndex]++;
        userNameVotes.set(username, options[optionIndex]);

        // Confirm the user's vote back to them
        await interaction.reply({
          content: `You voted for: **${options[optionIndex]}**`,
          ephermal: true,
        });
      }
    });

    collector.on('end', () => {
      const results = options
        .map((option, index) => `${option}: ${votes[index]} votes`)
        .join('\n');

      const userVoteList = Array.from(userNameVotes.entries())
        .map(([username, vote]) => `<@${username}> voted for: **${vote}**`)
        .join('\n');

      // Edit the poll message to display results and user votes
      pollMessage.edit({
        content: `**${question}**\n\nPoll closed! Results:\n${results}\n\n**Votes:**\n${userVoteList}`,
        components: [],
      });
    });

  }
}