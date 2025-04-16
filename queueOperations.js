const { getQueue, addStudent, removeStudent } = require('./queueManager');
const { EmbedBuilder } = require('discord.js');

//const queues = new Map(); // Store queues in memory

/**
 * Adds a user to a queue.
 */
async function handleJoinQueue(interaction, user, guild) {
    console.log(`handleJoinQueue called for user ${user.id} in guild ${guild.id}`);
    const queueName = 'studentQueue';
    try {
        // Call the database function to add the student to the queue.
        await addStudent(guild.id, user.id);
        // Retrieve the updated queue from the database.
        const studentQueue = await getQueue(queueName, guild.id);
        console.log(`User ${user.id} added to queue '${queueName}'. Position: ${studentQueue.length}`);
        const replyText = `You have joined the queue. Your position is ${studentQueue.length}.`;
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: replyText, ephemeral: true });
        } else {
            await interaction.followUp({ content: replyText, ephemeral: true });
        }
        // Refresh the pinned queue display.
        await updateQueueDisplay(guild);
    } catch (error) {
        console.error("Error handling join queue:", error);
        await interaction.reply({ content: "There was an error joining the queue.", ephemeral: true });
    }
}

/**
 * Removes a user from a queue.
 */
async function handleLeaveQueue(interaction, user, guild) {
    const queueName = 'studentQueue';
    try {
        // Call the database function to remove the student from the queue.
        await removeStudent(guild.id, user.id);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'You have left the queue.', ephemeral: true });
        } else {
            await interaction.followUp({ content: 'You have left the queue.', ephemeral: true });
        }
        // Refresh the pinned queue display.
        await updateQueueDisplay(guild);
    } catch (error) {
        console.error("Error handling leave queue:", error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "There was an error leaving the queue.", ephemeral: true });
        } else {
            await interaction.followUp({ content: "There was an error leaving the queue.", ephemeral: true });
        }
    }
}

/**
 * Displays the user's position in all queues.
 */
/**
 * Displays the user's position in queues by querying the database.
 */
// async function handleViewPositions(interaction, user, guild) {
//     try {
//         // Retrieve the student queue from the database.
//         const studentQueue = await getQueue('studentQueue', guild.id);
//         let response = 'Your positions in queues:\n';

//         if (studentQueue && studentQueue.length > 0) {
//             const studentPosition = studentQueue.indexOf(user.id);
//             if (studentPosition !== -1) {
//                 response += `- Student Queue: Position ${studentPosition + 1}\n`;
//             } else {
//                 response += `- Student Queue: You are not in the queue.\n`;
//             }
//         } else {
//             response += '- Student Queue is currently empty.\n';
//         }

//         // Future enhancements: add additional queues here if needed.

//         await interaction.reply({ content: response, ephemeral: true });
//     } catch (error) {
//         console.error("Error in handleViewPositions:", error);
//         await interaction.reply({ content: "There was an error retrieving your positions.", ephemeral: true });
//     }
// }

/**
 * Displays the current state of all queues.
 */
// async function handleShowQueues(interaction, guild) {
//     try {
//         // Find the channel where the pinned queue message should be updated.
//         const studentChannel = guild.channels.cache.find(channel => channel.name === 'student-queues');
//         if (!studentChannel) {
//             throw new Error('Student queue channel not found.');
//         }

//         // Retrieve the updated student queue from your database.
//         const studentQueue = await getQueue('studentQueue', guild.id);
//         let queueDescription = 'Queue is currently empty.';
//         if (studentQueue && studentQueue.length > 0) {
//             queueDescription = studentQueue
//                 .map((userId, index) => `${index + 1}. <@${userId}>`)
//                 .join('\n');
//         }

//         // Create the updated embed that shows the current queue.
//         const updatedEmbed = new EmbedBuilder()
//             .setTitle('Queue Options for Students')
//             .setDescription(`Use these buttons to interact with the queues.\n\n**Current Queue:**\n${queueDescription}`)
//             .setColor('#0000FF'); // Example blue color

//         // Fetch the pinned messages in the student channel.
//         const pinnedMessages = await studentChannel.messages.fetchPinned();
//         // Find the pinned message with the title "Queue Options for Students".
//         const existingMessage = pinnedMessages.find(
//             msg => msg.embeds.length && msg.embeds[0].title === 'Queue Options for Students'
//         );

//         if (existingMessage) {
//             // Update the pinned message with the new embed.
//             await existingMessage.edit({ embeds: [updatedEmbed] });
//         } else {
//             // If the pinned message is not found, send a new message and pin it.
//             const newMessage = await studentChannel.send({ embeds: [updatedEmbed] });
//             await newMessage.pin();
//         }
        
//         // Acknowledge the interaction without sending any extra message.
//         await interaction.deferUpdate();
//     } catch (error) {
//         console.error('Error updating queue display:', error);
//         // Optionally, handle the error as needed:
//         if (!interaction.replied && !interaction.deferred) {
//             await interaction.reply({ content: 'Error updating queue display.', ephemeral: true });
//         } else {
//             await interaction.followUp({ content: 'Error updating queue display.', ephemeral: true });
//         }
//     }
// }

/**
 * Clears all queues.
 */
async function handleClearQueues(interaction, guild) {
    queues.clear();
    await interaction.reply({ content: 'All queues have been cleared.', ephemeral: true });
}

/**
 * Shuffles all queues.
 */
async function handleShuffleQueues(interaction, guild) {
    for (const [queueName, members] of queues.entries()) {
        queues.set(queueName, members.sort(() => Math.random() - 0.5));
    }
    await interaction.reply({ content: 'All queues have been shuffled.', ephemeral: true });
}

/**
 * Updates the pinned message in the student-queues channel with the current queue.
 */
async function updateQueueDisplay(guild) {
    try {
        // Locate the student queue channel by its name.
        const studentChannel = guild.channels.cache.find(channel => channel.name === 'student-queues');
        if (!studentChannel) {
            throw new Error('Student queue channel not found.');
        }

        // Define a buffering embed to simulate a loading animation.
        const bufferingEmbed = new EmbedBuilder()
            .setTitle('Queue Options for Students')
            .setDescription('Updating queue display... :arrows_counterclockwise:')
            .setColor('#0000FF'); // Example blue color

        // Fetch pinned messages in the channel.
        let pinnedMessages = await studentChannel.messages.fetchPinned();
        // Find the pinned message with the title "Queue Options for Students".
        let existingMessage = pinnedMessages.find(
            msg => msg.embeds.length && msg.embeds[0].title === 'Queue Options for Students'
        );

        // If there is an existing message, update it to show the buffering embed.
        if (existingMessage) {
            await existingMessage.edit({ embeds: [bufferingEmbed] });
        } else {
            // Otherwise, send and pin a new message with the buffering embed.
            const newMessage = await studentChannel.send({ embeds: [bufferingEmbed] });
            await newMessage.pin();
            existingMessage = newMessage;
        }

        // Wait 1.5 seconds to simulate a buffer animation.
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Retrieve the current student queue from the database.
        const studentQueue = await getQueue('studentQueue', guild.id);
        let queueDescription = 'Queue is currently empty.';
        if (studentQueue && studentQueue.length > 0) {
            queueDescription = studentQueue
                .map((userId, index) => `${index + 1}. <@${userId}>`)
                .join('\n');
        }

        // Create the final updated embed with the current queue display.
        const updatedEmbed = new EmbedBuilder()
            .setTitle('Queue Options for Students')
            .setDescription(`Use these buttons to interact with the queues.\n\n**Current Queue:**\n${queueDescription}`)
            .setColor('#0000FF');

        // Update the pinned message with the final embed.
        await existingMessage.edit({ embeds: [updatedEmbed] });
    } catch (error) {
        console.error('Error updating queue display:', error);
    }
}

// Export functions
module.exports = {
    handleJoinQueue,
    handleLeaveQueue,
    //handleViewPositions,
    //handleShowQueues,
    handleClearQueues,
    handleShuffleQueues,
};