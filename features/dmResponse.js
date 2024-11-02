const { getOpenAIResponse } = require('./openaiService');
const dmManager = require('./dmManager');

module.exports = async function handleDMResponse(message) {
  if (message.guildId === null) {  // Ensure it's a DM
    // Track the user's message
    dmManager.addUserMessage(message.channel.id, message.id);

    // Update last activity
    dmManager.updateLastActivity(message.channel.id);

    // Respond with OpenAI-generated message
    await message.channel.sendTyping();
    const response = await getOpenAIResponse(`In less than 200 words respond to: ${message.content}`, 300);
    const botMessage = await message.channel.send(response);

    // Track the bot's message
    dmManager.addBotMessage(message.channel.id, botMessage.id);
  }
};
