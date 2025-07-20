// database.js

const { Client } = require('pg'); // PostgreSQL client library
require('dotenv').config(); // Loads environment variables from a .env file

// Create a new PostgreSQL client instance
const client = new Client({
    connectionString: process.env.DATABASE_URL, // Use DATABASE_URL from environment variables
    ssl: {
        rejectUnauthorized: false, // Required for Heroku's PostgreSQL setup
    },
});

// Connect to the database
client.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('Database connection error:', err));

function shutdown() {
    client.end()
        .then(() => console.log('PostgreSQL client disconnected'))
        .catch(err => console.error('Error during PostgreSQL disconnect:', err))
        .finally(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

// Export the client for use in other parts of your bot
module.exports = client;
