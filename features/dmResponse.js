// features/dmResponse.js
const { getOpenAIResponse } = require('./openaiService');

module.exports = async function handleDMResponse(message) {
  if (message.guildId === null) {
    await message.channel.sendTyping();
    const response = await getOpenAIResponse(`In less than 200 words respond to: ${message.content}`, 300);
    await message.channel.send(response);
  }
};
