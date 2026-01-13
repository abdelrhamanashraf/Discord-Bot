module.exports = [
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
                    { name: "Cartoons", value: "cartoons" }
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
            },
            {
                name: "apikey",
                type: 3, // STRING
                description: "Your Development API Key (RGAPI-...)",
                required: false
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
    }
];
