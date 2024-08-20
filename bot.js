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

client.on("ready", () => {
  console.log("The AI bot is online");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Handle different features
  await handleCodeReview(message);
  await handleDMResponse(message);
  await handleGeneralQuestion(message);
});

client.login(ACCESS_TOKEN_DISCORD);
