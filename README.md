# Discord Bot

A Discord bot with note-taking, voting, and reminder functionality that can only be used by specific roles.

## Features

- 📝 Note taking and retrieval
- 🗳️ Create polls with multiple options
- ⏰ Set reminders
- 🔒 Role-based command access
- 💬 Slash commands support
- 📢 Option to save notes and votes as channel messages

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following content:
```
DISCORD_TOKEN=your_bot_token_here
ALLOWED_ROLE_ID=your_role_id_here
```

3. Replace `your_bot_token_here` with your Discord bot token
4. Replace `your_role_id_here` with the ID of the role that should have access to the bot

5. Start the bot:
```bash
node index.js
```

## Commands

### Slash Commands (Recommended)
- `/note [title] [content] [save_to_channel]` - Save a note
- `/getnote [title]` - Retrieve a saved note
- `/vote [question] [options] [save_to_channel]` - Create a poll
- `/reminder [minutes] [message]` - Set a reminder
- `/help` - Show all available commands



## Notes

- The bot will only respond to users who have the specified role
- Notes are stored in memory and will be lost when the bot restarts
- Reminders will be sent as direct messages
- When using the `save_to_channel` option, notes and votes will be posted as messages in the current channel
- For votes, options should be separated by commas when using slash commands
- Slash commands provide a better user experience with built-in command descriptions and parameter validation 
