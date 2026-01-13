# Discord Bot

A feature-rich Discord bot with AI chat capabilities, utility features, gaming integrations, entertainment information, and fun commands. The bot supports notes, voting, reminders, prayer times, game notifications, anime tracking, movie recommendations, multiple game integrations, and more.

## Features

### 🤖 AI Chat
- Multiple AI models support (Sonar pro, Gemini)
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

### 📚 Books
- Search for books by title
- View book covers, authors, and publication details
- **Libgen Integration**: Direct links to search and download books
- search for other books by same author

Commands:
- `/book-search [query]` - Search for a book by title

### 🎥 Movies & TV Series
- Browse trending movies and TV series
- Search for movies and TV shows
- View detailed information and ratings
- Get random movie recommendations
- Movie trivia questions
- **Watch Links**: Direct search links for streaming

Commands:
- `/movie-trending` - Get trending movies this week
- `/series-trending` - Get trending TV series this week
- `/movie-search [query]` - Search for a movie by title
- `/series-search [query]` - Search for a TV series by title
- `/movie-random` - Get a random movie recommendation
- `/movie-trivia` - Get a random movie trivia question

### 🎬 Anime Information
- Browse current season anime
- Search for specific anime
- View anime details and ratings
- Browse anime by season and year
- **Watch Links**: Direct search links for streaming

Commands:
- `/anime-current` - Get a list of anime from the current season
- `/anime-search [query]` - Search for an anime by name
- `/anime-top [genre]` - Get a list of top-rated anime, optionally filtered by genre
- `/anime-season [year] [season]` - Get anime from a specific year and season

### 🕹️ Gaming Integration

#### Steam
- Browse top games on Steam
- Search for specific games
- View game details and ratings
- Find top-rated games by genre

Commands:
- `/steam-top` - Get the top 10 most played games on Steam
- `/steam-search [query]` - Search for a game on Steam
- `/steam-genre [genre]` - Get top-rated games by genre

#### Riot Games (League of Legends, Valorant, TFT)
- **League of Legends**: Profile stats, rank, and champion mastery
- **Valorant**: Profile stats, recent matches, and rank
- **Teamfight Tactics (TFT)**: 
  - Profile and rank information
  - Detailed match history with placement, traits, units, and augments
  - Beautiful generated rank cards and match summaries

Commands:
- `/lol [summoner] [region]` - Get League of Legends profile
- `/valorant [name] [tag] [region]` - Get Valorant profile
- `/tft [summoner] [tag] [region]` - Get TFT profile and match history

#### Game Notifications
- Free game alerts (Epic Games, Steam, etc.)
- Subscription management
- Instant notifications when paid games go free

Commands:
- `/freenotify subscribe` - Subscribe to free game notifications
- `/freenotify unsubscribe` - Unsubscribe from notifications
- `/freenotify status` - Check your subscription status

### 📂 File Upload
- Upload files to various cloud providers directly from Discord
- Bypass file size limits by using third-party hosts
- Supports: Gofile, Vikingfile, DDownload, Fileq, Rootz, DataVaults, Pixeldrain
- Real-time notification in Discord when upload is complete

Commands:
- `/upload [provider]` - Start a file upload session

### ☕ Quotes & Inspiration
- Get a random quote with a coffee aesthetic
- Sources: ZenQuotes, Game of Thrones, Animechan

Commands:
- `/quote-of-the-day` - Get a random quote

### 🔐 Security
- Check if your email or username has been involved in data breaches
- Uses LeakCheck public API

Commands:
- `/leakcheck [email]` - Check for data leaks

### ❤️ Wishlist
- Manage your personal wishlist for various categories
- Categories: Movies, Series, Anime, Books, Games
- Add items directly from search results
- Auto-generated links for viewing or downloading

Commands:
- `/wishlist` - View your wishlist

### 🎯 Trivia Game
- Multiple categories (General Knowledge, Books, Film, Music, etc.)
- Difficulty levels (Easy, Medium, Hard)
- Score tracking
- Interactive gameplay

Commands:
- `/trivia [questions] [category] [difficulty]` - Start a trivia game

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

### 📱 WhatsApp Integration
- Send WhatsApp messages from Discord
- Contact groups - message multiple people at once!
- Auto-monitor replies!
- Schedule messages for later
- Contact management system
- QR code authentication via terminal

Commands:
- `/whatsapp connect` - Connect to WhatsApp via QR code
- `/whatsapp send` - Send a message to a contact or group
- `/whatsapp schedule` - Schedule a message for later
- `/whatsapp contacts` - View and manage contacts
- `/whatsapp add-contact` - Add a new contact
- `/whatsapp groups` - View and manage contact groups
- `/whatsapp create-group` - Create a new contact group
- `/whatsapp status` - Check connection status
- `/whatsapp disconnect` - Disconnect from WhatsApp

**Setup Guide**: See [WHATSAPP_SETUP.md](WHATSAPP_SETUP.md) for detailed instructions
**New Features**: See [WHATSAPP_NEW_FEATURES.md](WHATSAPP_NEW_FEATURES.md) for groups & monitoring

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
   
   # Optional API Keys (for enhanced features)
   GOFILE_TOKEN=your_gofile_token          # For file uploads
   DD_TOKEN=your_ddownload_token           # For DDownload uploads
   QFILE_KEY=your_fileq_key                # For FileQ uploads
   DATAVALUTS_KEY=your_datavaults_key      # For DataVaults uploads
   PIXELDRAIN_KEY=your_pixeldrain_key      # For Pixeldrain uploads
   ROOTZ_TOKEN=your_rootz_token            # For Rootz uploads
   ```
4. Run the bot:
   ```bash
   node index.js
   ```

## Requirements

- Node.js 16.9.0 or higher
- Discord.js 14.0.0 or higher
- Other dependencies listed in `package.json`

## Data Storage

The bot uses JSON files for persistent storage:
- `data/notes.json` - User notes
- `data/prayers.json` - Prayer subscriptions
- `data/wishlist.json` - User wishlists

## Permissions

The bot requires the following permissions:
- Send Messages
- Embed Links
- Add Reactions
- Read Message History
- Manage Messages (for polls)

## Support

For issues or feature requests, please open an issue on the repository
