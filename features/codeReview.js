// codeReview.js
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require("discord.js");
const { getOpenAIResponse } = require('./openaiService');
const dmManager = require('./dmManager');

module.exports = async function handleCodeReview(message) {
  if (message.content.startsWith('`') && message.content.endsWith('`') && message.guildId !== null) {
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Yes")
        .setStyle(ButtonStyle.Primary)
        .setCustomId("yes"),
      new ButtonBuilder()
        .setLabel("No")
        .setStyle(ButtonStyle.Danger)
        .setCustomId("no")
    );

    const reply = await message.reply({
      content: "Would you like me to review this code?",
      components: [buttonRow],
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
    });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === "yes") {
        await interaction.reply({ content: "Code review is being sent to you via DM.", ephemeral: true });
        const response = await getOpenAIResponse(`Please review the following code: ${message.content}`);

        // Send DM to user and record message ID
        try {
          const dmChannel = await message.author.createDM();
          const botMessage = await dmChannel.send(response);

          // Update last activity and add bot message ID
          dmManager.updateLastActivity(dmChannel.id);
          dmManager.addBotMessage(dmChannel.id, botMessage.id);
        } catch (err) {
          console.error('Error sending DM:', err);
          await interaction.followUp({
            content: "Sorry, I couldn't send you a private message.",
            ephemeral: true,
          });
        }
      } else if (interaction.customId === "no") {
        await interaction.reply({ content: "Code review canceled.", ephemeral: true });
      }
    });
  }
};
