const { Client, GatewayIntentBits, Partials } = require("discord.js");
require('dotenv').config();
const { ACCESS_TOKEN_DISCORD } = process.env;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// Import handlers
const handleCodeReview = require('./features/codeReview');
const handleDMResponse = require('./features/dmResponse');
const handleGeneralQuestion = require('./features/generalQuestion');
const ensureRolesForGuild = require('./ensureRoles.js');
const assignRolesToMember = require('./assignRoles.js');

// Event: Bot is ready
client.on("ready", async () => {
  console.log("The AI bot is online");
  // Ensure roles for all guilds
  for (const [_, guild] of client.guilds.cache) {
    await ensureRolesForGuild(guild);
  }
});

// Event: Message created
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  await handleCodeReview(message);
  await handleDMResponse(message);
  await handleGeneralQuestion(message);
});

// Event: New member joins
client.on("guildMemberAdd", async (member) => {
  console.log(`New member joined: ${member.user.tag}`);
  await assignRolesToMember(member);
});

client.login(ACCESS_TOKEN_DISCORD);
