# Jeffrey

A Discord bot powered by OpenAI. To run the bot locally, copy `.env.example` to `.env` and fill in the required values.

## Required environment variables

- `ACCESS_TOKEN_DISCORD` – Discord bot token
- `CLIENT_ID` – Discord application client ID
- `GUILD_ID` – ID of the guild where commands are deployed
- `DATABASE_URL` – PostgreSQL connection string
- `OPENAI_API_KEY` – OpenAI API key used for all features

After configuring `.env`, install dependencies with `npm install` and start the bot using `npm start`.
