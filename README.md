# Jeffrey Bot

Jeffrey is a Discord bot that tracks public messages in your server so that users can search past conversations.  It also exposes several slash commands for queue management and OpenAI-powered history queries.

## Requirements
* Node.js 18+
* Access to a PostgreSQL database

## Environment variables
Create a `.env` file in the project root and define the following variables:

- `ACCESS_TOKEN_DISCORD` – your Discord bot token
- `CLIENT_ID` – the application (bot) ID
- `GUILD_ID` – optional; if set, `deploy-commands.js` registers commands only for this guild
- `DATABASE_URL` – PostgreSQL connection string used to store message logs
- `OPENAI_API_KEY` – OpenAI key for history queries
- `ACCESS_TOKEN_OPENAI` – OpenAI key for other features (used by `openaiService.js`)

## Installing and running
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure the `.env` file as described above.
3. Start the bot:
   ```bash
   npm start
   ```

The bot will backfill all text channel history into the `public_messages` table and continue logging new messages. These logs are used by the history slash commands and stored indefinitely in your configured database.

## Deploying slash commands
Use `deploy-commands.js` to register or refresh slash commands:
```bash
node deploy-commands.js
```
If `GUILD_ID` is provided the commands update immediately for that guild. Without it the commands are registered globally and may take up to an hour to appear.

To remove all guild commands, run:
```bash
node purge-commands.js
```

## Database usage
`bot.js` backfills and logs every public message to a PostgreSQL table called `public_messages` with the author, content and timestamp.  The data powers DM and slash-command history searches.  Ensure you comply with your community rules before enabling this feature.
