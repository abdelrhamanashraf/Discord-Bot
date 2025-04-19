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

const allowedRoleId = process.env.ALLOWED_ROLE_ID;

// Create a new Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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
    name: "note",
    description: "Save a note",
    options: [
      {
        name: "title",
        type: 3, // STRING
        description: "Title of the note",
        required: true,
      },
      {
        name: "content",
        type: 3, // STRING
        description: "Content of the note",
        required: true,
      },
      {
        name: "save_to_channel",
        type: 5, // BOOLEAN
        description: "Save the note to the current channel",
        required: false,
      },
    ],
  },
  {
    name: "getnotes",
    description: "View all your saved notes",
  },
  {
    name: "getnote",
    description: "Retrieve a saved note",
    options: [
      {
        name: "title",
        type: 3, // STRING
        description: "Title of the note to retrieve",
        required: true,
      },
    ],
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
    if (
      interaction.customId.startsWith("save_note_") ||
      interaction.customId.startsWith("edit_note_") ||
      interaction.customId.startsWith("delete_note_") ||
      interaction.customId.startsWith("confirm_delete_")
    ) {
      commandName = "getnote";
    } else if (interaction.customId.startsWith("vote_")) {
      commandName = "vote";
    } else if (interaction.customId === "end_poll") {
      commandName = "vote";
    } else if (
      interaction.customId === "prev_page" ||
      interaction.customId === "next_page"
    ) {
      commandName = "getnotes";
    } else if (interaction.customId === "cancel_delete") {
      commandName = "getnote";
    } else if (
      interaction.customId === "confirm_replace_recurring" ||
      interaction.customId === "cancel_replace_recurring"
    ) {
      commandName = "zakerny";
    } else if (interaction.customId.startsWith("anime_")) {
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
    } else {
      // Default fallback: try to extract command name from the first part
      commandName = parts[0];
    }

    console.log(`Extracted command name from button: ${commandName}`);

    const command = client.commands.get(commandName);
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
    } else {
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
    if (interaction.customId.startsWith("edit_modal_")) {
      const command = client.commands.get("getnote");
      if (command && command.handleModal) {
        try {
          console.log(`Executing modal handler for: getnote`);
          await command.handleModal(interaction);
          console.log(`Modal handler for getnote executed successfully`);
        } catch (error) {
          console.error(`Error executing modal handler for getnote:`, error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction
              .reply({
                content: "There was an error while handling this modal!",
                ephemeral: true,
              })
              .catch(console.error);
          }
        }
      } else {
        console.warn(`No modal handler found for: ${interaction.customId}`);
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({
              content: "This modal is not currently functional.",
              ephemeral: true,
            })
            .catch(console.error);
        }
      }
    } else if (interaction.customId.startsWith("anime_")) {
      // Handle anime modals
      const animeCommands = ["anime-current", "anime-top", "anime-search"];
      
      // Find the first anime command that has a handleModal method
      for (const cmdName of animeCommands) {
        const command = client.commands.get(cmdName);
        if (command && command.handleModal) {
          try {
            await command.handleModal(interaction);
            return; // Exit after handling
          } catch (error) {
            console.error(`Error handling anime modal for ${cmdName}:`, error);
          }
        }
      }
    }
  }
});

// Login to Discord with your app's token
client.login(process.env.DISCORD_TOKEN);
