const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Buttons for students
const studentButtons = new ActionRowBuilder()
    .addComponents(
        new ButtonBuilder()
            .setCustomId('join-student')
            .setLabel('Join Queue')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('leave-student')
            .setLabel('Leave Queue')
            .setStyle(ButtonStyle.Secondary),
        // new ButtonBuilder()
        //     .setCustomId('show')
        //     .setLabel('Show Queue')
        //     .setStyle(ButtonStyle.Success),
        // new ButtonBuilder()
        //     .setCustomId('position')
        //     .setLabel('View Position')
        //     .setStyle(ButtonStyle.Secondary),
    );

// Buttons for staff
const staffButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
        .setCustomId('queue-admins')
        .setLabel('Manage Admins')
        .setStyle(ButtonStyle.Secondary), 
    new ButtonBuilder()
        .setCustomId('queue-blacklist')
        .setLabel('Blacklist Users')
        .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
        .setCustomId('queue-whitelist')
        .setLabel('Whitelist Users')
        .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
        .setCustomId('queue-clear')
        .setLabel('Clear Queues')
        .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
        .setCustomId('queue-shuffle')
        .setLabel('Shuffle Queues')
        .setStyle(ButtonStyle.Primary)
);

module.exports = { studentButtons, staffButtons };