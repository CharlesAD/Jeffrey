# Jeffrey

Jeffrey is a Discord bot that manages student queues and logs public message history.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a PostgreSQL database and load the schema:
   ```bash
   psql < schema.sql
   ```
3. Create a `.env` file with at least:
   ```
   DATABASE_URL=postgres://USER:PASS@HOST:PORT/DBNAME
   ACCESS_TOKEN_DISCORD=your-bot-token
   CLIENT_ID=your-app-id
   ```
4. Start the bot:
   ```bash
   npm start
   ```

The `schema.sql` file defines the following tables used by the bot:
- `queues` – stores queue names and member user IDs
- `blacklisted_users` – records users blocked from specific queues
- `public_messages` – archives messages for history lookups
