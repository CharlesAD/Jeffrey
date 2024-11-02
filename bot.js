// bot.js
const { Client, GatewayIntentBits, Partials } = require("discord.js");
require('dotenv').config();
const { ACCESS_TOKEN_DISCORD } = process.env;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// Import features
const handleCodeReview = require('./features/codeReview');
const handleDMResponse = require('./features/dmResponse');
const handleGeneralQuestion = require('./features/generalQuestion');
const dmManager = require('./features/dmManager'); // Import dmManager

client.on("ready", () => {
  console.log("The AI bot is online");

  // Set up periodic task to clean up old DMs
  setInterval(async () => {
    console.log("Running DM cleanup task...");
    const dmChannels = dmManager.getDMChannels();
    const now = Date.now();
    const twentyFourHours = 30 * 1000; // 30 seconds for testing; change to 24 * 60 * 60 * 1000 for 24 hours

    for (const channelId of dmChannels) {
      const dmData = dmManager.getDMData(channelId);

      if (now - dmData.lastActivity >= twentyFourHours) {
        try {
          const channel = await client.channels.fetch(channelId);
          if (channel) {
            const messages = await channel.messages.fetch({ limit: 100 });
            const oldMessages = messages.filter(
              (msg) => now - msg.createdTimestamp >= twentyFourHours
            );

            for (const message of oldMessages.values()) {
              try {
                if (message.author.id === client.user.id) {
                  await message.delete();
                  console.log(
                    `Deleted bot message ${message.id} in DM channel ${channelId}`
                  );
                } else {
                  // Prepare the content to include attachments and embeds
                  let content = message.content;

                  // Include attachment URLs if there are any
                  if (message.attachments.size > 0) {
                    const attachmentUrls = message.attachments
                      .map((a) => a.url)
                      .join(", ");
                    content += ` Attachments: ${attachmentUrls}`;
                  }

                  // Include embed descriptions if there are any
                  if (message.embeds.length > 0) {
                    const embedDescriptions = message.embeds
                      .map((e) => e.description || "[No Description]")
                      .join(", ");
                    content += ` Embeds: ${embedDescriptions}`;
                  }

                  console.log(
                    `Cannot delete user message ${message.id} from ${message.author.username} in DM channel ${channelId}. Message content: "${content}"`
                  );
                }
              } catch (err) {
                console.error(
                  `Error processing message ${message.id} in DM channel ${channelId}:`,
                  err
                );
              }
            }
          }
        } catch (err) {
          console.error(`Error fetching DM channel ${channelId}:`, err);
        }
        // Remove the channel from dmData after cleanup
        dmManager.deleteDMData(channelId);
      }
    }
  }, 60 * 1000); // Run every minute
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Update last activity time for DMs
  if (message.guildId === null) {
    dmManager.updateLastActivity(message.channel.id);
  }

  // Handle different features
  await handleCodeReview(message);
  await handleDMResponse(message);
  await handleGeneralQuestion(message);
});

client.login(ACCESS_TOKEN_DISCORD);
