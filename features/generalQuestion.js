// features/generalQuestion.js
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require("discord.js");
const { getOpenAIResponse } = require('./openaiService');

module.exports = async function handleGeneralQuestion(message) {
  if (message.content.endsWith('?') && message.guildId !== null) {
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Yes").setStyle(ButtonStyle.Primary).setCustomId("yes_private_help"),
      new ButtonBuilder().setLabel("No").setStyle(ButtonStyle.Danger).setCustomId("no_private_help")
    );

    const reply = await message.reply({
      content: "Would you like me to help you with this question privately?",
      components: [buttonRow],
    });

    const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === "yes_private_help") {
          // Acknowledge the button immediately to avoid timing out
          await interaction.deferUpdate();
          // Generate the private help message
          const response = await getOpenAIResponse(message.content, 300);
          // Send the response via DM
          await interaction.user.send(response);
          // Send an ephemeral follow-up confirmation
          await interaction.followUp({
            content: "I've sent you a private response.",
            ephemeral: true
          });
      }
      else if (interaction.customId === "no_private_help") {
        await interaction.reply({ content: "Okay, no private help will be provided.", ephemeral: true });
      }
    });
  }
};
