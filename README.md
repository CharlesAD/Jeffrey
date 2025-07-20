# Jeffrey

Jeffrey is a Discord bot that logs public messages to a PostgreSQL database. These stored messages may be sent to OpenAI's API to provide smart responses and history search features.

## Privacy

Messages from public channels are saved indefinitely in PostgreSQL for search and analysis. They may also be shared with OpenAI when generating responses. Delete requests are honored when a message is removed from Discord.

When deploying Jeffrey, notify your server members that their messages are being logged and may be processed through OpenAI's services.

