// features/codeReview.js
const { ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require("discord.js");
const { getOpenAIResponse } = require('./openaiService');

module.exports = async function handleCodeReview(message) {
  // If we’re already in a thread, only respond when the bot is mentioned
  if (message.channel.isThread()) {
    if (!message.mentions.has(message.client.user)) return;
  }
  if (message.content.startsWith('`') && message.content.endsWith('`') && message.guildId !== null) {
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel("Yes").setStyle(ButtonStyle.Primary).setCustomId("code_review_yes"),
      new ButtonBuilder().setLabel("No").setStyle(ButtonStyle.Danger).setCustomId("code_review_no")
    );

    const reply = await message.reply({
      content: "Would you like me to review this code?",
      components: [buttonRow],
    });

    const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button });

    collector.on('collect', async (interaction) => {
      if (interaction.customId === "code_review_yes") {
        await interaction.reply("Code review is being sent to you via DM.");
        await message.channel.sendTyping();
        const response = await getOpenAIResponse(`Please review the following code: ${message.content}`);
        await message.author.send(response);
      } else if (interaction.customId === "code_review_no") {

        // ── 1. If this message is ALREADY inside a thread ──────────────
        if (message.channel.isThread()) {
          await interaction.reply({
            content: 'I’ll post the review below.',
            ephemeral: true
          });

          try {
            await message.channel.sendTyping();
            const response = await getOpenAIResponse(
              `Please review the following code: ${message.content}`
            );
            await message.channel.send(response);
          } catch (err) {
            console.error('Failed to send code review in thread:', err);
            await message.channel.send(
              'Sorry – something went wrong while generating the review.'
            );
          }
          return; // done – no nested thread needed
        }

        // ── 2. Otherwise create a fresh thread off the message ──────────
        await interaction.reply({
          content: 'Creating a thread for the review…',
          ephemeral: true
        });

        let thread;
        try {
          thread = await message.startThread({
            name: `Code review – ${message.author.username}`,
            autoArchiveDuration: 1440 // 24 hours
          });
        } catch (err) {
          console.error('Failed to create thread for code review:', err);
          return interaction.editReply(
            '⛔ I don’t have permission to create a thread here.'
          );
        }

        await interaction.editReply(
          `Okay – I’ll carry out the review in <#${thread.id}>.`
        );

        try {
          await thread.sendTyping();
          const response = await getOpenAIResponse(
            `Please review the following code: ${message.content}`
          );
          await thread.send(response);
        } catch (err) {
          console.error('Failed to send code review:', err);
          await thread.send(
            'Sorry – something went wrong while generating the review.'
          );
        }
      }
    });
  }
};
