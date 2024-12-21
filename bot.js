const { Client, GatewayIntentBits, Partials, ChannelType, REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { ACCESS_TOKEN_DISCORD, CLIENT_ID } = process.env;

const ensureRolesForGuild = require('./ensureRoles.js');
const assignRolesToMember = require('./assignRoles.js');
const handleCodeReview = require('./features/codeReview');
const handleDMResponse = require('./features/dmResponse');
const handleGeneralQuestion = require('./features/generalQuestion');

// Documentation channel messages
const STAFF_MESSAGE =
"**Welcome to the Staff Documentation Channel!**\n\n" +
"As a staff member, here’s what you can do with the Jeffrey Bot:\n\n" +
"**1️⃣ /createevent** - Create new events.\n" +
"**2️⃣ /manageusers** - Manage roles and permissions.\n" +
"**3️⃣ /staffstats** - View staff-specific statistics.\n\n" +
"Update this list as needed! If you need assistance, contact the server admin.";

const STUDENT_MESSAGE =
"**Welcome to the Student Documentation Channel!**\n\n" +
"Here’s what you can do with the Jeffrey Bot:\n\n" +
"**1️⃣ /viewevents** - See upcoming events.\n" +
"**2️⃣ /askquestion** - Ask staff or mentors a question.\n" +
"**3️⃣ /resources** - Access helpful resources.\n\n" +
"Ask if you need help!";

// Initialize the bot client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel],
});

// Load all commands
const commands = [];
const commandsPath = path.join(__dirname, 'features');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (command.data && command.data.name) {
        commands.push(command.data.toJSON());
    }
}

// Deploy commands and set up existing guilds on bot startup
client.once('ready', async () => {
    console.log(`The AI bot is online as ${client.user.tag}`);

    // Register commands globally (can take up to an hour to appear)
    const rest = new REST({ version: '10' }).setToken(ACCESS_TOKEN_DISCORD);
    try {
        console.log('Registering application (/) commands globally...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Successfully registered application (/) commands globally.');
    } catch (error) {
        console.error('Error registering commands:', error);
    }

    // Ensure roles and docs for all existing guilds
    for (const [_, guild] of client.guilds.cache) {
        await ensureRolesForGuild(guild);
        await setupDocumentationChannels(guild);
    }
});

client.on('guildCreate', async (guild) => {
    console.log(`Bot added to a new server: ${guild.name}`);
    await ensureRolesForGuild(guild);
    await setupDocumentationChannels(guild);
});

client.on('guildMemberAdd', async (member) => {
    console.log(`New member joined: ${member.user.tag}`);
    await assignRolesToMember(member);
});

// Handle slash commands & modal submissions
client.on('interactionCreate', async (interaction) => {
    if (interaction.isCommand()) {
        const commandName = interaction.commandName;
        const commandFile = commandFiles.find(file => file.replace('.js', '') === commandName);
        if (!commandFile) return;
        
        const cmd = require(path.join(commandsPath, commandFile));
        try {
            await cmd.execute(interaction);
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: 'Error executing that command!', ephemeral: true });
        }
    } else if (interaction.isModalSubmit() && interaction.customId === 'createEventModal') {
        const createEvent = require('./features/createEvents');
        await createEvent.handleModalSubmit(interaction);
    }
});

// Handle message-based features
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    await handleCodeReview(message);
    await handleDMResponse(message);
    await handleGeneralQuestion(message);
});

// Setup documentation channels and update messages
async function setupDocumentationChannels(guild) {
    try {
        console.log(`Setting up documentation channels for ${guild.name}...`);
        const channels = guild.channels.cache;
        let category = channels.find(ch => ch.type === ChannelType.GuildCategory && ch.name === 'Jeffrey Documentation');

        if (!category) {
            console.log('Creating "Jeffrey Documentation" category...');
            category = await guild.channels.create({
                name: 'Jeffrey Documentation',
                type: ChannelType.GuildCategory,
            });
        }

        let staffChannel = channels.find(ch => ch.name === 'staff-docs' && ch.parentId === category.id);
        if (!staffChannel) {
            console.log('Creating staff-docs channel...');
            const staffRole = guild.roles.cache.find(role => role.name === 'Staff');
            staffChannel = await guild.channels.create({
                name: 'staff-docs',
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.id, deny: ['ViewChannel'] },
                    ...(staffRole ? [{ id: staffRole.id, allow: ['ViewChannel', 'SendMessages'] }] : []),
                ],
            });
        }

        let studentChannel = channels.find(ch => ch.name === 'student-docs' && ch.parentId === category.id);
        if (!studentChannel) {
            console.log('Creating student-docs channel...');
            const studentRole = guild.roles.cache.find(role => role.name === 'Students');
            studentChannel = await guild.channels.create({
                name: 'student-docs',
                type: ChannelType.GuildText,
                parent: category.id,
                permissionOverwrites: [
                    { id: guild.id, deny: ['ViewChannel'] },
                    ...(studentRole ? [{ id: studentRole.id, allow: ['ViewChannel', 'SendMessages'] }] : []),
                ],
            });
        }

        // Update documentation messages
        await updateDocumentationMessage(guild, 'staff-docs', STAFF_MESSAGE);
        await updateDocumentationMessage(guild, 'student-docs', STUDENT_MESSAGE);

        console.log(`Documentation channels setup complete for ${guild.name}.`);
    } catch (error) {
        console.error(`Error setting up documentation channels for ${guild.name}:`, error);
    }
}

async function updateDocumentationMessage(guild, channelName, content) {
    const channel = guild.channels.cache.find(ch => ch.name === channelName);
    if (!channel || channel.type !== ChannelType.GuildText) return;

    try {
        const fetchedMessages = await channel.messages.fetch({ limit: 100 });
        if (fetchedMessages.size > 0) {
            console.log(`Clearing old messages from ${channelName} in ${guild.name}...`);
            await channel.bulkDelete(fetchedMessages, true);
        }

        console.log(`Sending updated documentation to ${channelName} in ${guild.name}...`);
        await channel.send(content);
    } catch (err) {
        console.error(`Failed to update messages in ${channelName} of ${guild.name}:`, err);
    }
}

client.login(ACCESS_TOKEN_DISCORD);
