// generalQuestion.js
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require("discord.js");
const { getOpenAIResponse } = require('./openaiService');
const dmManager = require('./dmManager');

module.exports = async function handleGeneralQuestion(message) {
  if (message.content.endsWith('?') && message.guildId !== null) {
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Yes")
        .setStyle(ButtonStyle.Primary)
        .setCustomId("yes_private_help"),
      new ButtonBuilder()
        .setLabel("No")
        .setStyle(ButtonStyle.Danger)
        .setCustomId("no_private_help")
    );

    const reply = await message.reply({
      content: "Would you like me to help you with this question privately?",
      components: [buttonRow],
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === "yes_private_help") {
        await interaction.deferReply({ ephemeral: true });
        const response = await getOpenAIResponse(message.content, 300);

        // Send DM to user and record message ID
        try {
          const dmChannel = await message.author.createDM();
          const botMessage = await dmChannel.send(response);

          // Update last activity and add bot message ID
          dmManager.updateLastActivity(dmChannel.id);
          dmManager.addBotMessage(dmChannel.id, botMessage.id);

          await interaction.editReply({ content: "I've sent you a private response." });
        } catch (err) {
          console.error('Error sending DM:', err);
          await interaction.editReply({ content: "Sorry, I couldn't send you a private message." });
        }
      } else if (interaction.customId === "no_private_help") {
        await interaction.reply({
          content: "Okay, no private help will be provided.",
          ephemeral: true,
        });
      }
    });
  }
};