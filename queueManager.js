const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// queueManager.js
module.exports = {
    // Add a user to the student queue
    async addStudent(serverId, userId) {
        try {
            await pool.query(`
                INSERT INTO queues (server_id, queue_name, members)
                VALUES ($1, $2, ARRAY[$3])
                ON CONFLICT (server_id, queue_name)
                DO UPDATE SET members = array_append(queues.members, $3)
                WHERE NOT ($3 = ANY(queues.members))
            `, [serverId, 'studentQueue', userId]);
        } catch (error) {
            console.error('Error adding student:', error);
        }
    },

    // Remove a user from the student queue
    async removeStudent(serverId, userId) {
        try {
            await pool.query(`
                UPDATE queues
                SET members = array_remove(members, $1)
                WHERE server_id = $2 AND queue_name = $3
            `, [userId, serverId, 'studentQueue']);
        } catch (error) {
            console.error('Error removing student:', error);
        }
    },

     // Get a queue from the database for a specific server.
     async getQueue(queueName, serverId) {
        try {
            const result = await pool.query(`
                SELECT members FROM queues
                WHERE server_id = $1 AND queue_name = $2
            `, [serverId, queueName]);
            if (result.rows.length > 0) {
                return result.rows[0].members;
            } else {
                return [];
            }
        } catch (error) {
            console.error('Error fetching queue:', error);
            throw error;
        }
    },

    // Get all members of the student queue
    async handleShowQueues(interaction, guild) {
        try {
            // Fetch the student queue for the current guild.
            const studentQueue = await this.getQueue('studentQueue', guild.id);
            let response = 'Current Student Queue:\n';
    
            if (!studentQueue || studentQueue.length === 0) {
                response = 'The student queue is currently empty.';
            } else {
                response += studentQueue
                    .map((userId, index) => `${index + 1}. <@${userId}>`)
                    .join('\n');
            }
    
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: response, ephemeral: true });
            } else {
                await interaction.followUp({ content: response, ephemeral: true });
            }
        } catch (error) {
            console.error('Error in handleShowQueues:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
            } else {
                await interaction.followUp({ content: 'An error occurred while processing your request.', ephemeral: true });
            }
        }
    }
};