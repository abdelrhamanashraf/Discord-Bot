# Discord Bot

A feature-rich Discord bot with AI chat capabilities, utility features, gaming integrations, entertainment information, and fun commands. The bot supports notes, voting, reminders, prayer times, game notifications, anime tracking, movie recommendations, and more.

## Features

### 🤖 AI Chat
- Multiple AI models support (Sonar Pro, Gemini)
- Public and private response options
- Contextual chat history
- Interactive conversations

Commands:
- `/chat [message] [model] [private]` - Chat with AI
  - Available models: Sonar pro, Gemini
  - Set private:true for private responses

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
- `/vote [question] [options]` - Create a poll

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

### 🎮 Game Notifications
- Free game alerts
- Multi-platform support
- Subscription management
- Instant notifications

Commands:
- `/freenotify subscribe` - Subscribe to free game notifications
- `/freenotify unsubscribe` - Unsubscribe from notifications
- `/freenotify status` - Check your subscription status

### 🎮 Riot Games
- Valorant profile statistics
- League of Legends profile information
- Multi-region support
- Detailed player stats

Under Development

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

### 🎥 Movies & TV Series
- Browse trending movies and TV series
- Search for movies and TV shows
- View detailed information and ratings
- Get random movie recommendations
- Movie trivia questions

Commands:
- `/movie-trending` - Get trending movies this week
- `/series-trending` - Get trending TV series this week
- `/movie-search [query]` - Search for a movie by title
- `/series-search [query]` - Search for a TV series by title
- `/movie-random` - Get a random movie recommendation
- `/movie-trivia` - Get a random movie trivia question

### 🎯 Trivia Game
- Multiple categories
- Difficulty levels
- Score tracking
- Interactive gameplay

Commands:
- `/trivia [questions] [category] [difficulty]` - Start a trivia game
  - Questions: 1-10
  - Categories: General Knowledge, Books, Film, Music, TV, Games, Science, Computers, Mathematics, Sports, Geography, History, Politics, Art, Animals, Vehicles, Comics, Gadgets, Anime & Manga, Cartoons
  - Difficulty: Easy, Medium, Hard

### � Fun Commands
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
   # Required
   DISCORD_TOKEN=your_bot_token
   ALLOWED_ROLE_ID=your_role_id
   
   # API Keys
   TMDB_API_KEY=your_tmdb_api_key          # For movies & TV features
   RIOT_API_KEY=your_riot_api_key          # For Riot Games features
   STEAM_API_KEY=your_steam_api_key        # For Steam features
   MAL_CLIENT_ID=your_mal_client_id        # For anime features
   GOOGLE_API_KEY=your_google_api_key      # For AI chat features
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
