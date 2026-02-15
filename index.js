require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  PermissionsBitField,
  REST,
  Routes,
  ApplicationCommandOptionType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActivityType,
} = require("discord.js");
const axios = require("axios");
const { initServer } = require("./server");

const allowedRoleId = process.env.ALLOWED_ROLE_ID;

// Create a new Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Load all command files dynamically
const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

client.commands = new Map();

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  try {
    const commandModule = require(filePath);
    console.log(`Loading commands from ${file}...`);

    // Handle both single command exports and array exports
    const commands = Array.isArray(commandModule)
      ? commandModule
      : [commandModule];

    for (const command of commands) {
      // Validate command structure
      if (!command.name) {
        console.warn(`Command in ${file} is missing a name property!`);
        continue;
      }

      // Special case for prayer-notifications - we need execute function but it's optional
      if (!command.execute && command.name !== "prayer-notifications") {
        console.warn(
          `Command ${command.name} in ${file} is missing an execute function!`
        );
        continue;
      }

      client.commands.set(command.name, command);
      console.log(`Loaded command: ${command.name} from ${file}`);
    }
  } catch (error) {
    console.error(`Error loading command from ${file}:`, error);
  }
}


function hasRequiredRole(member) {
  return member.roles.cache.has(process.env.ALLOWED_ROLE_ID);
}

// Register slash commands
const commands = [
  {
    name: "chat",
    description: "Chat with MeowAI",
    options: [
      {
        name: "message",
        type: 3, // STRING
        description: "Your message to MeowAI",
        required: true,
      },
      {
        name: "model",
        type: 3, // STRING
        description: "Choose an AI model",
        required: false,
        choices: [
          {
            name: "Sonar pro",
            value: "sonar-pro",
          },
          {
            name: "Gemini",
            value: "gemini-2.5-flash",
          },
          {
            name: "Qwen",
            value: "alibaba/qwen3-max-preview",
          },
          {
            name: "Gemini 3",
            value: "google/gemini-3-pro-preview",
          },
          {
            name: "DeepSeek",
            value: "deepseek/deepseek-non-thinking-v3.2-exp",
          },
          {
            name: "GPT 5",
            value: "openai/gpt-5-1",
          },
          {
            name: "GPT 4o",
            value: "gpt-4o",
          }
        ],
      },
      {
        name: "private",
        type: 5, // BOOLEAN
        description: "Make the response private (only you can see it)",
        required: false,
      }
    ],
  },

  {
    name: "roll",
    description: "Roll a dice, pick a random number, or toss a coin",
    options: [
      {
        name: "numbers",
        type: 3, // STRING
        description: "Specify a range (e.g., 1-100) or dice",
        required: false,
      },
      {
        name: "names",
        type: 3, // STRING
        description: "Provide names separated by commas",
        required: false,
      },
    ],
  },
  {
    name: "mynotes",
    description: "View and manage your personal notes",
  },
  {
    name: "help",
    description: "Show all available commands",
  },
  {
    name: "vote",
    description: "Create a poll with multiple options",
    options: [
      {
        name: "question",
        type: 3, // STRING
        description: "The poll question",
        required: true,
      },
      {
        name: "options",
        type: 3, // STRING
        description: "Comma-separated list of options",
        required: true,
      },
    ],
  },
  {
    name: "remind",
    description: "Set a reminder",
    options: [
      {
        name: "message",
        type: 3, // STRING
        description: "What to remind you about",
        required: true,
      },
      {
        name: "time",
        type: 4, // INTEGER
        description: "Amount of time",
        required: true,
      },
      {
        name: "unit",
        type: 3, // STRING
        description: "Time unit (mins, hours)",
        required: true,
        choices: [
          {
            name: "Minutes",
            value: "mins",
          },
          {
            name: "Hours",
            value: "hours",
          },
        ],
      },
    ],
  },
  {
    name: "zakerny",
    description: "Set a recurring reminder message",
    options: [
      {
        name: "message",
        type: 3, // STRING
        description: "The message to repeat",
        required: true,
      },
      {
        name: "number",
        type: 4, // INTEGER
        description: "The number of units",
        required: true,
      },
      {
        name: "unit",
        type: 3, // STRING
        description: "The time unit (seconds, minutes, hours, days)",
        required: true,
        choices: [
          { name: "Seconds", value: "seconds" },
          { name: "Minutes", value: "minutes" },
          { name: "Hours", value: "hours" },
          { name: "Days", value: "days" },
        ],
      },
    ],
  },
  {
    name: "clear-zakerny",
    description: "Clear your recurring reminder",
  },
  {
    name: "prayer-subscribe",
    description: "Subscribe to daily prayer time notifications",
    options: [
      {
        name: "city",
        type: 3, // STRING
        description: "Your city name",
        required: true,
      },
      {
        name: "country",
        type: 3, // STRING
        description: "Your country name",
        required: true,
      },
      {
        name: "timezone",
        type: 3, // STRING
        description: "Your timezone offset (e.g., +02:00)",
        required: false,
      },
    ],
  },
  {
    name: "prayer-unsubscribe",
    description: "Unsubscribe from prayer time notifications",
  },
  {
    name: "anime-current",
    description: "Get a list of anime from the current season"
  },
  {
    name: "anime-top",
    description: "Get a list of top-rated anime, optionally filtered by genre",
    options: [
      {
        name: "genre",
        type: 3, // STRING
        description: "Filter by genre (e.g., Action, Romance, Comedy)",
        required: false
      }
    ]
  },
  {
    name: "anime-search",
    description: "Search for an anime by name",
    options: [
      {
        name: "query",
        type: 3, // STRING
        description: "The anime title to search for",
        required: true
      }
    ]
  },
  {
    name: "anime-season",
    description: "Get anime from a specific year and season",
    options: [
      {
        name: "year",
        type: 4, // INTEGER
        description: "The year (e.g., 2023)",
        required: true
      },
      {
        name: "season",
        type: 3, // STRING
        description: "The season (winter, spring, summer, fall)",
        required: true,
        choices: [
          { name: "Winter", value: "winter" },
          { name: "Spring", value: "spring" },
          { name: "Summer", value: "summer" },
          { name: "Fall", value: "fall" }
        ]
      }
    ]
  },
  {
    name: "steam-top",
    description: "Get the top 10 most played games on Steam",
  },
  {
    name: "steam-search",
    description: "Search for a game on Steam",
    options: [
      {
        name: "query",
        type: 3, // STRING
        description: "The game title to search for",
        required: true
      }
    ]
  },
  {
    name: "steam-genre",
    description: "Get top rated games by genre on Steam",
    options: [
      {
        name: "genre",
        type: 3, // STRING
        description: "The genre to search for (e.g., Action, RPG, Strategy)",
        required: true
      }
    ]
  },
  {
    name: "movie-trending",
    description: "Get trending movies this week"
  },
  {
    name: "series-trending",
    description: "Get trending TV series this week"
  },
  {
    name: "movie-search",
    description: "Search for a movie by title",
    options: [
      {
        name: "query",
        type: 3, // STRING
        description: "The movie title to search for",
        required: true
      }
    ]
  },
  {
    name: "series-search",
    description: "Search for a TV series by title",
    options: [
      {
        name: "query",
        type: 3, // STRING
        description: "The TV series title to search for",
        required: true
      }
    ]
  },
  {
    name: "movie-random",
    description: "Get a random movie recommendation"
  },
  {
    name: "trivia",
    description: "Play a trivia game with multiple-choice questions",
    options: [
      {
        name: "questions",
        type: 4, // INTEGER
        description: "Number of questions (1-10)",
        required: false,
        min_value: 1,
        max_value: 10
      },
      {
        name: "category",
        type: 3, // STRING
        description: "Question category",
        required: false,
        choices: [
          { name: "General Knowledge", value: "general" },
          { name: "Books", value: "books" },
          { name: "Film", value: "film" },
          { name: "Music", value: "music" },
          { name: "Television", value: "television" },
          { name: "Video Games", value: "videogames" },
          { name: "Science", value: "science" },
          { name: "Computers", value: "computers" },
          { name: "Mathematics", value: "mathematics" },
          { name: "Sports", value: "sports" },
          { name: "Geography", value: "geography" },
          { name: "History", value: "history" },
          { name: "Politics", value: "politics" },
          { name: "Art", value: "art" },
          { name: "Animals", value: "animals" },
          { name: "Vehicles", value: "vehicles" },
          { name: "Comics", value: "comics" },
          { name: "Gadgets", value: "gadgets" },
          { name: "Anime & Manga", value: "anime" },
          { name: "Cartoons", value: "cartoons" },
          { name: "Mythology", value: "mythology" },
          { name: "Celebrities", value: "celebrities" },
          { name: "BoardGames", value: "boardgames" }
        ]
      },
      {
        name: "difficulty",
        type: 3, // STRING
        description: "Question difficulty",
        required: false,
        choices: [
          { name: "Easy", value: "easy" },
          { name: "Medium", value: "medium" },
          { name: "Hard", value: "hard" }
        ]
      }
    ]
  },
  {
    name: "freenotify",
    description: "Subscribe or unsubscribe from free game notifications",
    options: [
      {
        name: "subscribe",
        type: 1, // SUB_COMMAND
        description: "Subscribe to free game notifications"
      },
      {
        name: "unsubscribe",
        type: 1, // SUB_COMMAND
        description: "Unsubscribe from free game notifications"
      },
      {
        name: "status",
        type: 1, // SUB_COMMAND
        description: "Check your subscription status"
      }
    ]
  }, {
    name: "summoner-profile",
    description: "Get League of Legends Summoner Profile & History",
    options: [
      {
        name: "name",
        type: 3, // STRING
        description: "Riot ID Game Name",
        required: true
      },
      {
        name: "tag",
        type: 3, // STRING
        description: "Riot ID Tag Line",
        required: true
      },
      {
        name: "region",
        type: 3, // STRING
        description: "Region (e.g. EUW1, NA1)",
        required: false,
        choices: [
          { name: 'EU West', value: 'euw1' },
          { name: 'EU Nordic & East', value: 'eun1' },
          { name: 'North America', value: 'na1' },
          { name: 'Korea', value: 'kr' },
          { name: 'Brazil', value: 'br1' }
        ]
      }
    ]
  },
  {
    name: "whatsapp",
    description: "WhatsApp integration commands",
    options: [
      {
        name: "connect",
        type: 1, // SUB_COMMAND
        description: "Connect to WhatsApp"
      },
      {
        name: "status",
        type: 1, // SUB_COMMAND
        description: "Check WhatsApp connection status"
      },
      {
        name: "send",
        type: 1, // SUB_COMMAND
        description: "Send a message to a contact"
      },
      {
        name: "schedule",
        type: 1, // SUB_COMMAND
        description: "Schedule a message to be sent later"
      },
      {
        name: "contacts",
        type: 1, // SUB_COMMAND
        description: "View all saved contacts"
      },
      {
        name: "add-contact",
        type: 1, // SUB_COMMAND
        description: "Add a new contact"
      },
      {
        name: "disconnect",
        type: 1, // SUB_COMMAND
        description: "Disconnect from WhatsApp"
      },
      {
        name: "reconnect",
        type: 1, // SUB_COMMAND
        description: "Force reconnect to WhatsApp (use if connection is buggy)"
      },
      {
        name: "groups",
        type: 1, // SUB_COMMAND
        description: "View and manage contact groups"
      },
      {
        name: "create-group",
        type: 1, // SUB_COMMAND
        description: "Create a new contact group"
      }
    ]
  },
  {
    name: "quote-of-the-day",
    description: "Get a random quote with a nice cup of coffee",

  },
  {
    name: "book-search",
    description: "Search for a book by title",
    options: [
      {
        name: "query",
        type: 3, // STRING
        description: "The title of the book to search for",
        required: true
      }
    ]
  }, {
    name: "upload",
    description: "Upload a file to a third-party provider",
    options: [
      {
        name: "provider",
        type: 3, // STRING
        description: "Choose a file provider",
        required: true,
        choices: [
          { name: "Gofile.io", value: "gofile" },
          { name: "Vikingfile.com", value: "vikingfile" },
          { name: "DDownload.com", value: "ddownload" },
          { name: "Fileq.net", value: "fileq" },
          { name: "Rootz.so", value: "rootz" },
          { name: "DataVaults.co", value: "datavaults" },
          { name: "Pixeldrain.com", value: "pixeldrain" }
        ]
      }
    ]
  },
  {
    name: "wishlist",
    description: "View your wishlist",
    type: 1 // SUB_COMMAND
  },
  {
    name: "valorant",
    description: "Valorant stats and match history",
    options: [
      {
        name: "profile",
        description: "Get player profile stats and rank",
        type: 1, // SUB_COMMAND
        options: [
          { name: "name", type: 3, description: "Riot Name", required: true },
          { name: "tag", type: 3, description: "Riot Tag", required: true }
        ]
      },

      {
        name: "leaderboard",
        description: "Get top 5 players in a region",
        type: 1, // SUB_COMMAND
        options: [
          {
            name: "region",
            type: 3,
            description: "Region",
            required: true,
            choices: [
              { name: "EU", value: "eu" },
              { name: "NA", value: "na" },
              { name: "AP", value: "ap" },
              { name: "KR", value: "kr" },
              { name: "LATAM", value: "latam" },
              { name: "BR", value: "br" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "tft",
    description: "Get TFT Profile and Match History (PoC)",
    options: [
      {
        name: "summoner",
        type: 3, // STRING
        description: "Summoner User Name (Game Name)",
        required: true
      },
      {
        name: "tag",
        type: 3, // STRING
        description: "Tag Line (e.g., EUW, 1234)",
        required: true
      },
      {
        name: "region",
        type: 3, // STRING
        description: "Region",
        required: true,
        choices: [
          { name: 'EUNE', value: 'eun1' },
          { name: 'EUW', value: 'euw1' },
          { name: 'NA', value: 'na1' }
        ]
      }
    ]
  },
  {
    name: "leakcheck",
    description: "Check if an email has been leaked",
    options: [
      {
        name: "email",
        type: 3, // STRING
        description: "The email to check or username",
        required: true
      }
    ]
  },
  {
    name: "invite",
    description: "Generate a decorated QR code for a Discord invite link",

  },
  {
    name: "webtrivia",
    description: "Play a trivia game about the web",

  },
  {
    name: "codenames",
    description: "Start a Codenames-style word spy game in the browser",

  }
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// Single 'ready' event handler
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  client.user.setActivity("/help| Meow", { type: ActivityType.Listening });

  // Initialize prayer notifications
  console.log("Attempting to initialize prayer notifications...");

  // First try to find the prayer-notifications command directly
  let prayerModule = client.commands.get("prayer-notifications");

  // If not found directly, try to find it by searching all commands
  if (!prayerModule || !prayerModule.initPrayerNotifications) {
    console.log("Prayer-notifications command not found directly, searching all commands...");

    for (const [name, command] of client.commands.entries()) {
      console.log(`Checking command: ${name}`);
      if (command.initPrayerNotifications) {
        console.log(`Found prayer notifications in command: ${name}`);
        prayerModule = command;
        break;
      }
    }
  }

  if (prayerModule && prayerModule.initPrayerNotifications) {
    console.log("Found prayer module, initializing notifications...");
    prayerModule.initPrayerNotifications(client);
    console.log("Prayer notifications initialized successfully");
  } else {
    console.error("Prayer module not found or missing initPrayerNotifications function");
    console.log("Available commands:", Array.from(client.commands.keys()).join(", "));
  }



  // Initialize the free games notification system
  const freeNotifyCommand = client.commands.get('freenotify');
  if (freeNotifyCommand) {
    freeNotifyCommand.initNotificationSystem(client);
  }

  // Initialize WhatsApp message monitoring
  const whatsappCommand = client.commands.get('whatsapp');
  if (whatsappCommand && whatsappCommand.initDiscordClient) {
    whatsappCommand.initDiscordClient(client);
  }

  // Initialize Web Server
  initServer(client);

  // Register commands after the bot is ready
  (async () => {
    try {
      console.log("Started refreshing application (/) commands.");

      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );

      console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
      console.error("Error registering commands:", error);
    }
  })();
});

// Single interactionCreate event handler
client.on("interactionCreate", async (interaction) => {
  if (!hasRequiredRole(interaction.member)) {
    return interaction.reply({ content: 'You do not have permission to use this bot.', ephemeral: true });
  }
  // Handle command interactions
  if (interaction.isCommand()) {
    console.log(`Received command: ${interaction.commandName}`);

    // Use the command handler pattern instead of a switch statement
    const command = client.commands.get(interaction.commandName);
    if (command) {
      try {
        console.log(`Executing command: ${interaction.commandName}`);
        await command.execute(interaction);
        console.log(`Command ${interaction.commandName} executed successfully`);
      } catch (error) {
        console.error(
          `Error executing command ${interaction.commandName}:`,
          error
        );
        // Make sure we respond to the interaction even if there's an error
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({
              content: "There was an error while executing this command!",
              ephemeral: true,
            })
            .catch(console.error);
        }
      }
    } else {
      console.warn(
        `Command not found in command handler: ${interaction.commandName}`
      );

      // For debugging, let's check if we're in the switch case
      console.log(`Checking switch case for: ${interaction.commandName}`);
    }
  }
  // Handle button interactions
  else if (interaction.isButton()) {
    console.log(`Received button interaction: ${interaction.customId}`);

    // Extract command name from button ID (format: action_command_data)
    let commandName;
    const parts = interaction.customId.split("_");

    // Handle different button formats
    if (interaction.customId.startsWith("notes_")) {
      commandName = "mynotes";
    } else if (interaction.customId.startsWith("vote_")) {
      commandName = "vote";
    } else if (interaction.customId.startsWith("end_chat_")) {
      commandName = "chat";
    } else if (interaction.customId === "end_poll") {
      commandName = "vote";
    } else if (
      interaction.customId === "confirm_replace_recurring" ||
      interaction.customId === "cancel_replace_recurring"
    ) {
      commandName = "zakerny";
    } else if (interaction.customId.startsWith("anime_") || interaction.customId.startsWith("wishlist_add_anime_")) {
      // Handle anime buttons
      const animeCommands = ["anime-current", "anime-top", "anime-search"];

      // Find the first anime command that has a handleButton method
      for (const cmdName of animeCommands) {
        const command = client.commands.get(cmdName);
        if (command && command.handleButton) {
          try {
            await command.handleButton(interaction);
            return; // Exit after handling
          } catch (error) {
            console.error(`Error handling anime button for ${cmdName}:`, error);
          }
        }
      }
      return; // Exit if no handler found
    } else if (interaction.customId.startsWith("webtrivia_join_")) {
      // Handle web trivia join button — captures user identity
      const webtriviaCommand = client.commands.get("webtrivia");
      if (webtriviaCommand && webtriviaCommand.handleButton) {
        try {
          await webtriviaCommand.handleButton(interaction);
          return;
        } catch (error) {
          console.error(`Error handling webtrivia button:`, error);
        }
      }
      return;
    } else if (interaction.customId.startsWith("codenames_join_")) {
      // Handle codenames join button — captures user identity
      const codenamesCommand = client.commands.get("codenames");
      if (codenamesCommand && codenamesCommand.handleButton) {
        try {
          await codenamesCommand.handleButton(interaction);
          return;
        } catch (error) {
          console.error(`Error handling codenames button:`, error);
        }
      }
      return;
    } else if (interaction.customId.startsWith("trivia_")) {
      // Handle trivia buttons
      const triviaCommand = client.commands.get("trivia");
      if (triviaCommand && triviaCommand.handleButton) {
        try {
          await triviaCommand.handleButton(interaction);
          return; // Exit after handling
        } catch (error) {
          console.error(`Error handling trivia button:`, error);
        }
      }
      return; // Exit if no handler found
    }
    else if (interaction.customId.startsWith("movies_") || interaction.customId.startsWith("series_") || interaction.customId.startsWith("wishlist_")) {
      // Handle Movie/Series/Wishlist buttons
      const movieCommand = client.commands.get("movie-search");
      if (movieCommand && movieCommand.handleButton) {
        try {
          await movieCommand.handleButton(interaction);
          return; // Exit after handling
        } catch (error) {
          console.error(`Error handling Movie/Series button:`, error);
        }
      }
      return; // Exit if no handler found
    } else if (interaction.customId.startsWith("whatsapp_")) {
      // Handle WhatsApp buttons
      const whatsappCommand = client.commands.get("whatsapp");
      if (whatsappCommand && whatsappCommand.handleButton) {
        try {
          await whatsappCommand.handleButton(interaction);
          return; // Exit after handling
        } catch (error) {
          console.error(`Error handling WhatsApp button:`, error);
        }
      }
      return; // Exit if no handler found
    } else if (interaction.customId.startsWith("sumprof_")) {
      const lolCommand = client.commands.get("summoner-profile");
      if (lolCommand && lolCommand.handleButton) {
        try {
          await lolCommand.handleButton(interaction);
          return;
        } catch (error) {
          console.error(`Error handling Summoner Profile button:`, error);
        }
      }
      return;
    } else if (interaction.customId.startsWith("show_wishlist_")) {
      // Handle Wishlist buttons
      const wishlistCommand = client.commands.get("wishlist");
      if (wishlistCommand && wishlistCommand.handleButton) {
        try {
          await wishlistCommand.handleButton(interaction);
          return; // Exit after handling
        } catch (error) {
          console.error(`Error handling Wishlist button:`, error);
        }
      }
      return; // Exit if no handler found
    }
    else {
      // Default fallback: try to extract command name from the first part
      commandName = parts[0];
    }

    console.log(`Extracted command name from button: ${commandName}`);

    const command = client.commands.get(commandName);
    console.log(`Looking for command: ${commandName}`);
    console.log(`Found command:`, command ? 'yes' : 'no');
    console.log(`Has handleButton:`, command?.handleButton ? 'yes' : 'no');

    if (command && command.handleButton) {
      try {
        console.log(`Executing button handler for: ${commandName}`);
        await command.handleButton(interaction);
        console.log(`Button handler for ${commandName} executed successfully`);
      } catch (error) {
        console.error(
          `Error executing button handler for ${commandName}:`,
          error
        );
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({
              content: "There was an error while handling this button!",
              ephemeral: true,
            })
            .catch(console.error);
        }
      }
    } else if (interaction.customId.startsWith("books_")) {
      // Handle Books buttons
      const booksCommand = client.commands.get("book-search");
      if (booksCommand && booksCommand.handleButton) {
        try {
          await booksCommand.handleButton(interaction);
          return; // Exit after handling
        } catch (error) {
          console.error(`Error handling Books button:`, error);
        }
      }
      return; // Exit if no handler found
    } else if (interaction.customId.startsWith("steam_") || interaction.customId.startsWith("steam_add_to_wishlist_")) {
      // Handle Steam buttons
      const steamCommand = client.commands.get("steam-search");
      if (steamCommand && steamCommand.handleButton) {
        try {
          await steamCommand.handleButton(interaction);
          return; // Exit after handling
        } catch (error) {
          console.error(`Error handling Steam button:`, error);
        }
      }
      return; // Exit if no handler found
    } else if (interaction.customId.startsWith("sumprof:")) {
      const lolCommand = client.commands.get("summoner-profile");
      if (lolCommand && lolCommand.handleButton) {
        try {
          await lolCommand.handleButton(interaction);
          return;
        } catch (error) {
          console.error(`Error handling Summoner Profile button:`, error);
        }
      }
      return;
    } else if (interaction.customId.startsWith("show_wishlist_")) {
      // Handle Wishlist buttons
      const wishlistCommand = client.commands.get("wishlist");
      if (wishlistCommand && wishlistCommand.handleButton) {
        try {
          await wishlistCommand.handleButton(interaction);
          return; // Exit after handling
        } catch (error) {
          console.error(`Error handling Wishlist button:`, error);
        }
      }
      return; // Exit if no handler found
    }
    else {
      console.warn(`No button handler found for: ${interaction.customId}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content: "This button is not currently functional.",
            ephemeral: true,
          })
          .catch(console.error);
      }
    }
  }
  // Handle modal submissions
  else if (interaction.isModalSubmit()) {
    console.log(`Received modal submission: ${interaction.customId}`);

    // Find the appropriate command to handle the modal
    if (interaction.customId.startsWith("notes_")) {
      const command = client.commands.get("mynotes");
      if (command && command.handleModal) {
        try {
          await command.handleModal(interaction);
        } catch (error) {
          console.error(`Error executing modal handler for mynotes:`, error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction
              .reply({
                content: "There was an error while handling this modal!",
                ephemeral: true,
              })
              .catch(console.error);
          }
        }
      }
    } else if (interaction.customId.startsWith("whatsapp_")) {
      // Handle WhatsApp modals
      const command = client.commands.get("whatsapp");
      if (command && command.handleModal) {
        try {
          await command.handleModal(interaction);
          return; // Exit after handling
        } catch (error) {
          console.error(`Error handling WhatsApp modal:`, error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction
              .reply({
                content: "There was an error while handling this modal!",
                ephemeral: true,
              })
              .catch(console.error);
          }
        }
      }
    }
  }
  // Handle select menu interactions
  else if (interaction.isStringSelectMenu()) {
    console.log(`Received select menu interaction: ${interaction.customId}`);
    if (interaction.customId === 'tft_nav') return;

    // Extract command name from customId
    let commandName;
    if (interaction.customId === 'notes_select') {
      commandName = "mynotes";
    } else if (interaction.customId.startsWith("anime_select_")) {
      // Route to the first anime command that has handleSelectMenu
      const animeCommands = ["anime-current", "anime-top", "anime-search", "anime-season"];
      for (const cmdName of animeCommands) {
        const cmd = client.commands.get(cmdName);
        if (cmd && cmd.handleSelectMenu) {
          try {
            await cmd.handleSelectMenu(interaction);
            return;
          } catch (error) {
            console.error(`Error handling anime select menu for ${cmdName}:`, error);
          }
        }
      }
      return;
    } else if (interaction.customId.startsWith("whatsapp_")) {
      commandName = "whatsapp";
    } else if (interaction.customId.startsWith("val_match_")) {
      commandName = "valorant";
    } else if (interaction.customId.startsWith("movie_") || interaction.customId.startsWith("series_")) {
      commandName = "movie-search";
    } else if (interaction.customId === "wishlist_select") {
      commandName = "wishlist";
    } else if (interaction.customId.startsWith("sumprof:")) {
      commandName = "summoner-profile";
    } else {
      // Default fallback: try to extract command name from the first part
      commandName = interaction.customId.split("_")[0];
    }

    const command = client.commands.get(commandName);
    if (command && command.handleSelectMenu) {
      try {
        console.log(`Executing select menu handler for: ${commandName}`);
        await command.handleSelectMenu(interaction);

        console.log(`Select menu handler for ${commandName} executed successfully`);
      } catch (error) {
        console.error(
          `Error executing select menu handler for ${commandName}:`,
          error
        );
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({
              content: "There was an error while handling this selection!",
              ephemeral: true,
            })
            .catch(console.error);
        }
      }
    } else {
      console.warn(`No select menu handler found for: ${interaction.customId}`);
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content: "This selection menu is not currently functional.",
            ephemeral: true,
          })
          .catch(console.error);
      }
    }
  }
});





// Login to Discord with your app's token
client.login(process.env.DISCORD_TOKEN);
