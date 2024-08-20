// features/codeReview.js
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require("discord.js");
const { getOpenAIResponse } = require('./openaiService');

module.exports = async function handleCodeReview(message) {
  if (message.content.startsWith('`') && message.content.endsWith('`') && message.guildId !== null) {
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Yes").setStyle(ButtonStyle.Primary).setCustomId("yes"),
      new ButtonBuilder().setLabel("No").setStyle(ButtonStyle.Danger).setCustomId("no")
    );

    const reply = await message.reply({
      content: "Would you like me to review this code?",
      components: [buttonRow],
    });

    const collector = reply.createMessageComponentCollector({ ComponentType: ComponentType.Button });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === "yes") {
        await interaction.reply("Code review is being sent to you via DM.");
        await message.channel.sendTyping();
        const response = await getOpenAIResponse(`Please review the following code: ${message.content}`);
        await message.author.send(response);
      } else if (interaction.customId === "no") {
        await interaction.reply({ content: "Code review canceled.", ephemeral: true });
      }
    });
  }
};
