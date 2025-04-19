# Discord Bot

A feature-rich Discord bot with various utilities including notes, voting, reminders, prayer times, anime information, Steam game data, and fun commands.

## Features

### 📝 Notes
- Save and manage personal notes
- View all your notes with pagination
- Share notes in channels
- Edit and delete notes
- Persistent storage

Commands:
- `/note [title] [content] [save_to_channel]` - Save a note
- `/getnotes` - View all your notes
- `/getnote [title]` - View a specific note

### 🗳️ Voting
- Create polls with multiple options
- Automatic reaction management
- Channel sharing option
- Real-time vote counting

Commands:
- `/vote [question] [options] [save_to_channel]` - Create a poll

### ⏰ Reminders
- One-time reminders
- Recurring reminders (zakerny)
- Custom time intervals
- DM notifications

Commands:
- `/remind [message] [time] [unit]` - Set a one-time reminder
- `/zakerny [message] [number] [unit]` - Set a recurring reminder
- `/clear-zakerny` - Stop your recurring reminder

### 🕌 Prayer Times
- Daily prayer time notifications
- Location-based prayer times
- Subscription management
- Beautiful prayer time embeds

Commands:
- `/prayer-subscribe [city] [country]` - Subscribe to prayer times
- `/prayer-unsubscribe` - Unsubscribe from prayer times

### 🎮 Steam Games
- Browse top games on Steam
- Search for specific games
- View game details and ratings
- Find top-rated games by genre

Commands:
- `/steam-top` - Get the top 10 most played games on Steam
- `/steam-search [query]` - Search for a game on Steam
- `/steam-genre [genre]` - Get top-rated games by genre

### 🎬 Anime Information
- Browse current season anime
- Search for specific anime
- View anime details and ratings
- Browse anime by season and year

Commands:
- `/anime-current` - Get a list of anime from the current season
- `/anime-search [query]` - Search for an anime by name
- `/anime-top [genre]` - Get a list of top-rated anime, optionally filtered by genre
- `/anime-season [year] [season]` - Get anime from a specific year and season

### 🎲 Fun Commands
- Dice rolling
- Random number generation
- Coin tossing
- Random name selection

Commands:
- `/roll [numbers] [names]` - Various random operations
  - `/roll numbers:dice` - Roll a 6-sided dice
  - `/roll numbers:1-100` - Random number between 1-100
  - `/roll names:coin` - Toss a coin
  - `/roll names:John,Mary,Alex` - Pick a random name

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with:
   ```
   DISCORD_TOKEN=your_bot_token
   ALLOWED_ROLE_ID=your_role_id
   ```
4. Run the bot:
   ```bash
   node index.js
   ```

## Requirements

- Node.js 16.9.0 or higher
- Discord.js 14.0.0 or higher
- Other dependencies listed in package.json

## Data Storage

The bot uses JSON files for persistent storage:
- `data/notes.json` - User notes
- `data/prayers.json` - Prayer subscriptions


## Permissions

The bot requires the following permissions:
- Send Messages
- Embed Links
- Add Reactions
- Read Message History
- Manage Messages (for polls)

## Support

For issues or feature requests, please open an issue on the repository