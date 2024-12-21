// features/createPoll.js
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require("discord.js");
const { getOpenAIResponse } = require('./openaiService');

module.exports = async function handlePoll(message) {
  if (message.content.startsWith('!poll')) {
    // Get the poll question and options from the command
    const args = message.content.slice(5).trim().split(';');
    const question = args[0];
    console.log(`args[0]: ${args[0]}\nargs[1]: ${args[1]}\nargs[2]: ${args[2]}\nargs[3]: ${args[3]}`);
    console.log(args);
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
    const row = new ActionRowBuilder().addComponents(buttons);
    const pollMessage = await message.channel.send({
      content: `**${question}**\nSelect your answer to the question!`,
      components: [row],
    });
  }
}