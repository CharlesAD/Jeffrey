const { REST, Routes } = require('discord.js');
require('dotenv').config();

const { ACCESS_TOKEN_DISCORD, CLIENT_ID } = process.env;

const commands = [
    {
        name: 'createevent',
        description: 'Open a modal to create an event',
    },
    {
        name: 'viewevents',
        description: 'See upcoming events organized by staff',
    }
    // Add other commands as needed
];

const rest = new REST({ version: '10' }).setToken(ACCESS_TOKEN_DISCORD);

(async () => {
    try {
        console.log('Started refreshing application (/) commands globally.');

        await rest.put(
            Routes.applicationCommands(CLIENT_ID), // Global command registration
            { body: commands }
        );

        console.log('Successfully registered application (/) commands globally.');
    } catch (error) {
        console.error(error);
    }
})();