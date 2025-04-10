require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, REST, Routes, ApplicationCommandOptionType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,ActivityType } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');

// Add view note state tracking
const viewNoteStates = new Map();

function trackViewNote(interactionId, noteId) {
    viewNoteStates.set(interactionId, {
        noteId,
        timestamp: Date.now()
    });
}

function untrackViewNote(interactionId) {
    viewNoteStates.delete(interactionId);
}

function getViewNoteState(interactionId) {
    return viewNoteStates.get(interactionId);
}

// Function to get all notes for a user
function getUserNotes(userId) {
    return Object.entries(notes)
        .filter(([noteId, note]) => note.userId === userId)
        .map(([noteId, note]) => ({
            id: noteId,
            ...note
        }));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

// File path for notes
const notesFile = path.join(dataDir, 'notes.json');

// Initialize or load notes
let notes = {};
try {
    notes = JSON.parse(fs.readFileSync(notesFile, 'utf8'));
} catch (error) {
    // If file doesn't exist or is invalid, start with empty notes
    notes = {};
    fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2));
}

// Function to save notes to file
function saveNotes() {
    fs.writeFileSync(notesFile, JSON.stringify(notes, null, 2));
}

// Function to create note ID
function createNoteId(userId, title) {
    return `${userId}-${title}`;
}

// Store notes and reminders
const reminders = new Map();

// Add these color constants at the top of the file after the imports
const COLORS = {
    NOTE: '#2ECC71',    // Green
    VOTE: '#3498DB',    // Blue
    REMINDER: '#E74C3C', // Red
    HELP: '#9B59B6'     // Purple
};

// Add these thumbnail constants at the top of the file after the imports
const THUMBNAILS = {
    NOTE: 'https://cdn-icons-png.flaticon.com/512/2232/2232688.png', // Keep the note icon
    VOTE: 'https://www.clipartmax.com/png/middle/243-2439989_badges-choice-vote-votes-icon-voting.png', // Voting icon
    REMINDER: 'https://cdn-icons-png.freepik.com/512/8295/8295212.png', // Clock/reminder icon
    HELP: 'https://cdn-icons-png.freepik.com/256/7498/7498864.png?semt=ais_hybrid', // Keep the help icon
    PRAYER: 'https://img.lovepik.com/png/20231005/blue-mosque-ramadan-paper-cut-religious-month-arabic_87729_wh1200.png', // Mosque/prayer icon
    ROLL: {
        DICE: 'https://png.pngtree.com/png-clipart/20230819/original/pngtree-red-design-dice-icon-picture-image_8043729.png', // Dice icon
        COIN: 'https://w7.pngwing.com/pngs/479/691/png-transparent-coin-flipping-coin-flipper-android-flippers-game-logo-sign-thumbnail.png', // Coin icon
        NUMBER: 'https://images.dwncdn.net/images/t_app-icon-l/p/d07213dc-cadb-11e8-97a8-02420a00091a/1262880248/31711_4-78088057-logo' // Number icon
    }
};

// File path for prayer subscriptions
const prayerFile = path.join(dataDir, 'prayers.json');

// Initialize or load prayer subscriptions
let prayerSubscriptions = new Map();
try {
    const savedPrayers = JSON.parse(fs.readFileSync(prayerFile, 'utf8'));
    // Convert the plain object back to a Map
    prayerSubscriptions = new Map(Object.entries(savedPrayers));
} catch (error) {
    // If file doesn't exist or is invalid, start with empty subscriptions
    prayerSubscriptions = new Map();
    fs.writeFileSync(prayerFile, JSON.stringify(Object.fromEntries(prayerSubscriptions), null, 2));
}

// Function to save prayer subscriptions to file
function savePrayerSubscriptions() {
    const prayerData = Object.fromEntries(prayerSubscriptions);
    fs.writeFileSync(prayerFile, JSON.stringify(prayerData, null, 2));
}

// Check if user has the required role
function hasRequiredRole(member) {
    return member.roles.cache.has(process.env.ALLOWED_ROLE_ID);
}

// Register slash commands
const commands = [
    {
        name: 'note',
        description: 'Save a note',
        options: [
            {
                name: 'title',
                description: 'The title of the note',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'content',
                description: 'The content of the note',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'save_to_channel',
                description: 'Whether to save the note as a message in the channel',
                type: ApplicationCommandOptionType.Boolean,
                required: false
            }
        ]
    },
    {
        name: 'getnotes',
        description: 'View all your saved notes'
    },
    {
        name: 'getnote',
        description: 'Get a specific note by title',
        options: [
            {
                name: 'title',
                description: 'The title of the note to retrieve',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    {
        name: 'vote',
        description: 'Create a poll',
        options: [
            {
                name: 'question',
                description: 'The question for the poll',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'options',
                description: 'The options for the poll (separated by commas)',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'save_to_channel',
                description: 'Whether to save the vote as a message in the channel',
                type: ApplicationCommandOptionType.Boolean,
                required: false
            }
        ]
    },
    {
        name: 'reminder',
        description: 'Set a reminder',
        options: [
            {
                name: 'minutes',
                description: 'Time in minutes until reminder',
                type: ApplicationCommandOptionType.Integer,
                required: true
            },
            {
                name: 'message',
                description: 'The reminder message',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    {
        name: 'prayer-subscribe',
        description: 'Subscribe to daily prayer time notifications',
        options: [
            {
                name: 'city',
                description: 'Your city name',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'country',
                description: 'Your country name',
                type: ApplicationCommandOptionType.String,
                required: true
            }
        ]
    },
    {
        name: 'prayer-unsubscribe',
        description: 'Unsubscribe from prayer time notifications'
    },
    {
        name: 'help',
        description: 'Show all available commands'
    },
    {
        name: 'roll',
        description: 'Roll a dice, pick a random number, or toss a coin',
        options: [
            {
                name: 'numbers',
                description: 'Specify a range (e.g., 1-100) or "dice" for a dice roll',
                type: ApplicationCommandOptionType.String,
                required: false
            },
            {
                name: 'names',
                description: 'Specify "coin" for a coin toss or a list of names separated by commas',
                type: ApplicationCommandOptionType.String,
                required: false
            }
        ]
    },
    {
        name: 'zakerny',
        description: 'Set a recurring reminder message',
        options: [
            {
                name: 'message',
                description: 'The message to repeat',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'number',
                description: 'The number of units',
                type: ApplicationCommandOptionType.Integer,
                required: true
            },
            {
                name: 'unit',
                description: 'The time unit (seconds, minutes, hours, days)',
                type: ApplicationCommandOptionType.String,
                required: true,
                choices: [
                    { name: 'seconds', value: 'seconds' },
                    { name: 'minutes', value: 'minutes' },
                    { name: 'hours', value: 'hours' },
                    { name: 'days', value: 'days' }
                ]
            }
        ]
    },
    {
        name: 'clear-zakerny',
        description: 'Clear your recurring reminder'
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    try {
        // Set bot activity
        client.user.setActivity('/help or !help | Meow', { type: ActivityType.Listening });
        
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
});

// Add rate limiting for interactions
const interactionCooldowns = new Map();
const COOLDOWN_TIME = 2000; // 2 seconds cooldown

function isOnCooldown(userId) {
    const now = Date.now();
    const cooldown = interactionCooldowns.get(userId);
    if (cooldown && now - cooldown < COOLDOWN_TIME) {
        return true;
    }
    interactionCooldowns.set(userId, now);
    return false;
}

// Add interaction timeout handling
const INTERACTION_TIMEOUT = 30000; // 30 seconds

async function handleInteractionTimeout(interaction) {
    try {
        await interaction.editReply({
            content: 'This interaction has timed out. Please try again.',
            components: [],
            embeds: []
        });
    } catch (error) {
        console.error('Error handling interaction timeout:', error);
    }
}

// Add retry mechanism for file operations
async function retryFileOperation(operation, maxRetries = 3) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            console.error(`File operation attempt ${i + 1} failed:`, error);
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
        }
    }
    throw lastError;
}

// Add interaction state tracking with expiration
const activeInteractions = new Map();
const INTERACTION_EXPIRY = 30000; // 30 seconds

function trackInteraction(interactionId, data) {
    activeInteractions.set(interactionId, {
        ...data,
        expiry: Date.now() + INTERACTION_EXPIRY
    });
}

function untrackInteraction(interactionId) {
    activeInteractions.delete(interactionId);
}

function isInteractionActive(interactionId) {
    const interaction = activeInteractions.get(interactionId);
    if (!interaction) return false;
    
    if (Date.now() > interaction.expiry) {
        untrackInteraction(interactionId);
        return false;
    }
    return true;
}

// Add safe interaction response function
async function safeInteractionResponse(interaction, response) {
    try {
        if (!isInteractionActive(interaction.id)) {
            console.log('Interaction no longer active:', interaction.id);
            return;
        }

        if (interaction.replied || interaction.deferred) {
            await interaction.editReply(response);
        } else {
            await interaction.reply(response);
        }
    } catch (error) {
        if (error.code === 10062) { // Unknown interaction
            console.log('Interaction expired:', interaction.id);
            untrackInteraction(interaction.id);
        } else {
            console.error('Error responding to interaction:', error);
        }
    }
}

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;
    if (!hasRequiredRole(interaction.member)) {
        return interaction.reply({ content: 'You do not have permission to use this bot.', ephemeral: true });
    }

    const { commandName, options } = interaction;

    switch (commandName) {
        case 'note': {
            const title = options.getString('title');
            const content = options.getString('content');
            const saveToChannel = options.getBoolean('save_to_channel') || false;

            const noteId = createNoteId(interaction.user.id, title);
            notes[noteId] = {
                title,
                content,
                userId: interaction.user.id,
                createdAt: new Date().toISOString(),
                author: interaction.user.username
            };
            
            saveNotes();
            
            if (saveToChannel) {
                const noteEmbed = new EmbedBuilder()
                    .setTitle('📝 Note Saved')
                    .setDescription(`**${title}**\n\n${content}`)
                    .setColor(COLORS.NOTE)
                    .setThumbnail(THUMBNAILS.NOTE)
                    .setFooter({ 
                        text: `Note created by ${interaction.user.username}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();
                    
                
                await interaction.channel.send({ embeds: [noteEmbed] });
            }
            
            await interaction.reply({ content: `Note "${title}" has been saved!`, ephemeral: true });
            break;
        }

        case 'getnotes': {
            const userNotes = getUserNotes(interaction.user.id);
            
            if (userNotes.length === 0) {
                return interaction.reply({ content: 'You have no saved notes!', ephemeral: true });
            }

            const notesPerPage = 5;
            const pages = Math.ceil(userNotes.length / notesPerPage);
            let currentPage = 0;

            const getNotesEmbed = (page) => {
                const start = page * notesPerPage;
                const end = start + notesPerPage;
                const pageNotes = userNotes.slice(start, end);

                const embed = new EmbedBuilder()
                    .setTitle('📝 Your Notes')
                    .setColor(COLORS.NOTE)
                    .setThumbnail(THUMBNAILS.NOTE)
                    .setFooter({ 
                        text: `Page ${page + 1}/${pages} • Total Notes: ${userNotes.length}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                if (pageNotes.length === 0) {
                    embed.setDescription('No notes found on this page.');
                } else {
                    let description = '';
                    pageNotes.forEach((note, index) => {
                        const truncatedContent = note.content.length > 100 
                            ? note.content.substring(0, 100) + '...' 
                            : note.content;
                        description += `**${start + index + 1}. ${note.title}**\n`;
                        description += `${truncatedContent}\n`;
                        description += `Created: ${new Date(note.createdAt).toLocaleDateString()}\n\n`;
                    });
                    embed.setDescription(description);
                }

                return embed;
            };

            // Create navigation buttons
            const navigationRow = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('first_page')
                        .setLabel('⏪ First')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('prev_page')
                        .setLabel('◀️ Previous')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('next_page')
                        .setLabel('Next ▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(pages <= 1),
                    new ButtonBuilder()
                        .setCustomId('last_page')
                        .setLabel('Last ⏩')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(pages <= 1)
                );

            const message = await interaction.reply({ 
                embeds: [getNotesEmbed(currentPage)], 
                components: [navigationRow],
                ephemeral: true 
            });

            // Create a collector for the pagination buttons
            const collector = message.createMessageComponentCollector({ 
                time: 300000 // 5 minutes
            });

            collector.on('collect', async (i) => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: 'You cannot use these buttons!', ephemeral: true });
                }

                // Handle navigation buttons
                switch (i.customId) {
                    case 'first_page':
                        currentPage = 0;
                        break;
                    case 'prev_page':
                        currentPage = Math.max(0, currentPage - 1);
                        break;
                    case 'next_page':
                        currentPage = Math.min(pages - 1, currentPage + 1);
                        break;
                    case 'last_page':
                        currentPage = pages - 1;
                        break;
                }

                // Update button states
                navigationRow.components[0].setDisabled(currentPage === 0);
                navigationRow.components[1].setDisabled(currentPage === 0);
                navigationRow.components[2].setDisabled(currentPage === pages - 1);
                navigationRow.components[3].setDisabled(currentPage === pages - 1);

                await i.update({ 
                    embeds: [getNotesEmbed(currentPage)],
                    components: [navigationRow]
                });
            });

            collector.on('end', () => {
                navigationRow.components.forEach(button => button.setDisabled(true));
                interaction.editReply({ components: [navigationRow] }).catch(console.error);
            });

            break;
        }

        case 'getnote': {
            const title = options.getString('title');
            const userNotes = getUserNotes(interaction.user.id);
            
            if (!title) {
                // Show list of notes
                if (userNotes.length === 0) {
                    return interaction.reply({ content: 'You have no notes!', ephemeral: true });
                }

                const itemsPerPage = 5;
                const totalPages = Math.ceil(userNotes.length / itemsPerPage);
                let currentPage = 1;

                const showNotesList = async (page) => {
                    const start = (page - 1) * itemsPerPage;
                    const end = start + itemsPerPage;
                    const pageNotes = userNotes.slice(start, end);

                    const embed = new EmbedBuilder()
                        .setTitle('📝 Your Notes')
                        .setDescription(`Page ${page} of ${totalPages}`)
                        .setColor(COLORS.NOTE)
                        .setThumbnail(THUMBNAILS.NOTE)
                        .setFooter({ 
                            text: `Requested by ${interaction.user.username}`,
                            iconURL: interaction.user.displayAvatarURL()
                        })
                        .setTimestamp();

                    pageNotes.forEach(note => {
                        const preview = note.content.length > 100 
                            ? note.content.substring(0, 100) + '...' 
                            : note.content;
                        embed.addFields({
                            name: note.title,
                            value: preview,
                            inline: false
                        });
                    });

                    const row = new ActionRowBuilder();
                    const buttons = [];

                    // Add view buttons for each note
                    pageNotes.forEach(note => {
                        buttons.push(
                            new ButtonBuilder()
                                .setCustomId(`view_note:${note.id}`)
                                .setLabel(`View ${note.title}`)
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('📖')
                        );
                    });

                    // Add pagination buttons
                    if (totalPages > 1) {
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId('prev_page')
                                .setLabel('Previous')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(page === 1),
                            new ButtonBuilder()
                                .setCustomId('next_page')
                                .setLabel('Next')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(page === totalPages)
                        );
                    }

                    // Add view buttons in rows of 3
                    const viewRows = [];
                    for (let i = 0; i < buttons.length; i += 3) {
                        const viewRow = new ActionRowBuilder()
                            .addComponents(buttons.slice(i, i + 3));
                        viewRows.push(viewRow);
                    }

                    return { embeds: [embed], components: [...viewRows, row] };
                };

                const initialResponse = await showNotesList(currentPage);
                const message = await interaction.reply({ ...initialResponse, ephemeral: true });

                const collector = message.createMessageComponentCollector({ 
                    time: 300000,
                    filter: i => i.user.id === interaction.user.id
                });

                collector.on('collect', async (i) => {
                    if (i.customId === 'prev_page') {
                        currentPage--;
                        const newResponse = await showNotesList(currentPage);
                        await i.update(newResponse);
                    } else if (i.customId === 'next_page') {
                        currentPage++;
                        const newResponse = await showNotesList(currentPage);
                        await i.update(newResponse);
                    } else if (i.customId.startsWith('view_note:')) {
                        const noteId = i.customId.split(':')[1];
                        const note = notes[noteId];
                        
                        if (!note) {
                            return i.reply({ content: 'Note not found!', ephemeral: true });
                        }

                        const embed = new EmbedBuilder()
                            .setTitle('📝 Note Details')
                            .setDescription(`**${note.title}**\n\n${note.content}`)
                            .setColor(COLORS.NOTE)
                            .setThumbnail(THUMBNAILS.NOTE)
                            .addFields(
                                { name: 'Created At', value: new Date(note.createdAt).toLocaleString(), inline: true },
                                { name: 'Author', value: note.author, inline: true }
                            )
                            .setFooter({ 
                                text: `Requested by ${interaction.user.username}`,
                                iconURL: interaction.user.displayAvatarURL()
                            })
                            .setTimestamp();

                        const actionRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`save_note:${note.id}`)
                                    .setLabel('Save to Channel')
                                    .setStyle(ButtonStyle.Success)
                                    .setEmoji('📌'),
                                new ButtonBuilder()
                                    .setCustomId(`edit_note:${note.id}`)
                                    .setLabel('Edit')
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('✏️'),
                                new ButtonBuilder()
                                    .setCustomId(`delete_note:${note.id}`)
                                    .setLabel('Delete')
                                    .setStyle(ButtonStyle.Danger)
                                    .setEmoji('🗑️'),
                                new ButtonBuilder()
                                    .setCustomId('back_to_list')
                                    .setLabel('Back to List')
                                    .setStyle(ButtonStyle.Secondary)
                            );

                            await i.update({ embeds: [embed], components: [actionRow] });
                    } else if (i.customId === 'back_to_list') {
                        const newResponse = await showNotesList(currentPage);
                        await i.update(newResponse);
                    }
                });

                collector.on('end', () => {
                    message.edit({ components: [] }).catch(console.error);
                });
            } else {
                // Show specific note
                const note = userNotes.find(n => n.title.toLowerCase() === title.toLowerCase());
                
                if (!note) {
                    return interaction.reply({ content: 'Note not found!', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('📝 Note Details')
                    .setDescription(`**${note.title}**\n\n${note.content}`)
                    .setColor(COLORS.NOTE)
                    .setThumbnail(THUMBNAILS.NOTE)
                    .addFields(
                        { name: 'Created At', value: new Date(note.createdAt).toLocaleString(), inline: true },
                        { name: 'Author', value: note.author, inline: true }
                    )
                    .setFooter({ 
                        text: `Requested by ${interaction.user.username}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                const actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`save_note:${note.id}`)
                            .setLabel('Save to Channel')
                            .setStyle(ButtonStyle.Success)
                            .setEmoji('📌'),
                        new ButtonBuilder()
                            .setCustomId(`edit_note:${note.id}`)
                            .setLabel('Edit')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('✏️'),
                        new ButtonBuilder()
                            .setCustomId(`delete_note:${note.id}`)
                            .setLabel('Delete')
                            .setStyle(ButtonStyle.Danger)
                            .setEmoji('🗑️')
                    );

                await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
            }
            break;
        }

        case 'vote': {
            const question = options.getString('question');
            const optionsList = options.getString('options').split(',').map(opt => opt.trim());
            const saveToChannel = options.getBoolean('save_to_channel') || false;
            
            const embed = new EmbedBuilder()
                .setTitle('📊 New Poll')
                .setColor(COLORS.VOTE)
                .setThumbnail(THUMBNAILS.VOTE)
                .setFooter({ 
                    text: `Poll created by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            let description = `**${question}**\n\n`;
            optionsList.forEach((option, index) => {
                description += `**${index + 1}.** ${option}\n`;
            });

            embed.setDescription(description);
            
            const voteMessage = await interaction.channel.send({ embeds: [embed] });
            
            for (let i = 0; i < optionsList.length; i++) {
                await voteMessage.react(`${i + 1}️⃣`);
            }
            
            await interaction.reply({ content: 'Poll created!', ephemeral: true });
            break;
        }

        case 'reminder': {
            const minutes = options.getInteger('minutes');
            const message = options.getString('message');

            if (minutes <= 0) {
                return interaction.reply({ content: 'Please provide a valid time in minutes.', ephemeral: true });
            }

            await interaction.reply({ content: `I will remind you in ${minutes} minutes!`, ephemeral: true });
            
            setTimeout(() => {
                interaction.user.send(`⏰ Reminder: ${message}`);
            }, minutes * 60 * 1000);
            break;
        }

        case 'prayer-subscribe': {
            const city = options.getString('city');
            const country = options.getString('country');

            try {
                // Test the API call to verify location
                const response = await axios.get(`http://api.aladhan.com/v1/timingsByCity`, {
                    params: {
                        city: city,
                        country: country,
                        method: 2
                    }
                });

                prayerSubscriptions.set(interaction.user.id, { 
                    city, 
                    country,
                    subscribedAt: new Date().toISOString(),
                    username: interaction.user.username
                });
                
                savePrayerSubscriptions();
                
                const embed = new EmbedBuilder()
                    .setTitle('🕌 Prayer Time Subscription')
                    .setDescription('You have successfully subscribed to prayer time notifications!')
                    .setColor('#2ECC71')
                    .setThumbnail(THUMBNAILS.PRAYER)
                    .addFields(
                        { name: 'Location', value: `${city}, ${country}` },
                        { name: 'Subscribed At', value: new Date().toLocaleString() },
                        { name: 'Next Prayer', value: 'You will receive notifications for all prayer times' }
                    )
                    .setFooter({ 
                        text: 'May your prayers be accepted',
                        iconURL: 'https://img.lovepik.com/png/20231006/Simple-Elements-of-Blue-Mosque-Paper-cut-Style-ramazan-calligraphy_98116_wh1200.png'
                    })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } catch (error) {
                await interaction.reply({ 
                    content: 'Error: Could not find prayer times for the specified location. Please check your city and country names.', 
                    ephemeral: true 
                });
            }
            break;
        }

        case 'prayer-unsubscribe': {
            if (prayerSubscriptions.has(interaction.user.id)) {
                const subscription = prayerSubscriptions.get(interaction.user.id);
                prayerSubscriptions.delete(interaction.user.id);
                savePrayerSubscriptions();
                
                const embed = new EmbedBuilder()
                    .setTitle('🕌 Prayer Time Subscription')
                    .setDescription('You have successfully unsubscribed from prayer time notifications.')
                    .setColor('#E74C3C')
                    .setThumbnail(THUMBNAILS.PRAYER)
                    .addFields(
                        { name: 'Previous Location', value: `${subscription.city}, ${subscription.country}` },
                        { name: 'Subscription Period', value: `From ${new Date(subscription.subscribedAt).toLocaleString()} to ${new Date().toLocaleString()}` }
                    )
                    .setFooter({ 
                        text: 'You can subscribe again anytime',
                        iconURL: 'https://img.lovepik.com/png/20231006/Simple-Elements-of-Blue-Mosque-Paper-cut-Style-ramazan-calligraphy_98116_wh1200.png'
                    })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ 
                    content: 'You are not currently subscribed to prayer time notifications.', 
                    ephemeral: true 
                });
            }
            break;
        }

        case 'help': {
            const helpEmbed = new EmbedBuilder()
                .setTitle('🤖 Bot Commands')
                .setDescription('Here are all the available commands you can use:')
                .setColor(COLORS.HELP)
                .setThumbnail(THUMBNAILS.HELP)
                .addFields(
                    { 
                        name: '📝 Notes', 
                        value: '```/note [title] [content] [save_to_channel]\nSave a note with optional channel posting\n\n/getnotes\nView all your saved notes\n/getnote [title]\nRetrieve a saved note```',
                        inline: false
                    },
                    { 
                        name: '🗳️ Voting', 
                        value: '```/vote [question] [options] [save_to_channel]\nCreate a poll with multiple options\nOptions should be comma-separated```',
                        inline: false
                    },
                    { 
                        name: '⏰ Reminders', 
                        value: '```/reminder [minutes] [message]\nSet a reminder that will be sent as a DM\n\n/zakerny [message] [number] [unit]\nSet a recurring reminder (seconds/minutes/hours/days)\n/clear-zakerny\nStop your recurring reminder```',
                        inline: false
                    },
                    { 
                        name: '🕌 Prayer Times', 
                        value: '```/prayer-subscribe [city] [country]\nSubscribe to daily prayer time notifications\n\n/prayer-unsubscribe\nUnsubscribe from prayer time notifications```',
                        inline: false
                    },
                    { 
                        name: '🎲 Fun Commands', 
                        value: '```/roll [numbers] [names]\nRoll a dice, pick a random number, or toss a coin\nExamples:\n/roll numbers:dice - Roll a 6-sided dice\n/roll numbers:1-100 - Random number between 1-100\n/roll names:coin - Toss a coin\n/roll names:John,Mary,Alex - Pick a random name```',
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Requested by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();
            
            await interaction.reply({ embeds: [helpEmbed], ephemeral: true });
            break;
        }

        case 'roll': {
            const numbersArg = options.getString('numbers');
            const namesArg = options.getString('names');

            let result;
            let description;
            let color;
            let thumbnail;
            let title;
            let footerText;

            // If no arguments provided, default to dice
            if (!numbersArg && !namesArg) {
                result = Math.floor(Math.random() * 6) + 1;
                color = '#5865F2'; // Discord blue
                thumbnail = THUMBNAILS.ROLL.DICE;
                title = '🎲 Dice Roll';
                description = `**You rolled a ${result}!**\n\n${getDiceEmoji(result)}`;
                footerText = 'Try /roll numbers:1-100 for a custom range!';
            }
            // Handle numbers
            else if (numbersArg) {
                if (numbersArg === 'dice') {
                    result = Math.floor(Math.random() * 6) + 1;
                    color = '#5865F2'; // Discord blue
                    thumbnail = THUMBNAILS.ROLL.DICE;
                    title = '🎲 Dice Roll';
                    description = `**You rolled a ${result}!**\n\n${getDiceEmoji(result)}`;
                    footerText = 'Try /roll numbers:1-100 for a custom range!';
                } else {
                    const range = numbersArg.split('-').map(num => parseInt(num.trim()));
                    if (range.length !== 2 || isNaN(range[0]) || isNaN(range[1]) || range[0] >= range[1]) {
                        return interaction.reply({ 
                            content: 'Please provide a valid range in format "min-max" (e.g., 1-100)', 
                            ephemeral: true 
                        });
                    }
                    result = Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
                    color = '#2ECC71'; // Green
                    thumbnail = THUMBNAILS.ROLL.NUMBER;
                    title = '🔢 Random Number';
                    description = `**Random number between ${range[0]} and ${range[1]}:**\n\n🎯 **${result}**`;
                    footerText = 'Try /roll names:coin for a coin toss!';
                }
            }
            // Handle names
            else if (namesArg) {
                if (namesArg.toLowerCase() === 'coin') {
                    result = Math.random() < 0.5 ? 'Heads' : 'Tails';
                    color = '#F1C40F'; // Yellow
                    thumbnail = THUMBNAILS.ROLL.COIN;
                    title = '🪙 Coin Toss';
                    description = `**The coin landed on...**\n\n${result === 'Heads' ? '👑 Heads' : '🦅 Tails'}`;
                    footerText = 'Try /roll names:John,Mary,Alex to pick a random name!';
                } else {
                    const names = namesArg.split(',').map(name => name.trim()).filter(name => name);
                    if (names.length === 0) {
                        return interaction.reply({ 
                            content: 'Please provide a valid list of names separated by commas.', 
                            ephemeral: true 
                        });
                    }
                    result = names[Math.floor(Math.random() * names.length)];
                    color = '#9B59B6'; // Purple
                    thumbnail = THUMBNAILS.ROLL.NUMBER;
                    title = '🎯 Random Selection';
                    description = `**From the list:**\n${names.map(name => `• ${name}`).join('\n')}\n\n**Selected:**\n🎯 **${result}**`;
                    footerText = 'Try /roll numbers:dice for a dice roll!';
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(description)
                .setColor(color)
                .setThumbnail(thumbnail)
                .setFooter({ 
                    text: footerText,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
            break;
        }

        case 'zakerny': {
            const message = options.getString('message');
            const number = options.getInteger('number');
            const unit = options.getString('unit');

            // Convert to milliseconds
            let interval;
            switch (unit) {
                case 'seconds':
                    interval = number * 1000;
                    break;
                case 'minutes':
                    interval = number * 60 * 1000;
                    break;
                case 'hours':
                    interval = number * 60 * 60 * 1000;
                    break;
                case 'days':
                    interval = number * 24 * 60 * 60 * 1000;
                    break;
                default:
                    return interaction.reply({ content: 'Invalid time unit!', ephemeral: true });
            }

            // Check if user already has a zakerny reminder
            if (zakernyReminders.has(interaction.user.id)) {
                return interaction.reply({ 
                    content: 'You already have a recurring reminder set! Use /clear-zakerny to remove it first.', 
                    ephemeral: true 
                });
            }

            // Create the reminder
            const reminder = {
                message,
                interval,
                lastSent: Date.now(),
                userId: interaction.user.id,
                username: interaction.user.username
            };

            zakernyReminders.set(interaction.user.id, reminder);
            saveZakernyReminders();

            const embed = new EmbedBuilder()
                .setTitle('🔄 Recurring Reminder Set')
                .setDescription(`Your message will be sent every EX:istighfar ${number} ${unit}`)
                .setColor('#2ECC71')
                .addFields(
                    { name: 'Message', value: message },
                    { name: 'Interval', value: `${number} ${unit}` }
                )
                .setFooter({ 
                    text: 'Use /clear-zakerny to stop the reminder',
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
            break;
        }

        case 'clear-zakerny': {
            if (zakernyReminders.has(interaction.user.id)) {
                zakernyReminders.delete(interaction.user.id);
                saveZakernyReminders();

                const embed = new EmbedBuilder()
                    .setTitle('✅ Reminder Cleared')
                    .setDescription('Your recurring reminder has been stopped')
                    .setColor('#2ECC71')
                    .setFooter({ 
                        text: 'You can set a new reminder using /zakerny',
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ 
                    content: 'You don\'t have any recurring reminders set!', 
                    ephemeral: true 
                });
            }
            break;
        }
    }

    if (interaction.isButton()) {
        const [action, noteId] = interaction.customId.split(':');
        
        if (action === 'view') {
            try {
                const notes = getUserNotes(interaction.user.id);
                const note = notes.find(n => n.id === noteId);
                
                if (!note) {
                    await interaction.reply({ content: 'Note not found!', ephemeral: true });
                    return;
                }

                // Track the view note state
                trackViewNote(interaction.id, noteId);

                const embed = new EmbedBuilder()
                    .setTitle(note.title)
                    .setDescription(note.content)
                    .setColor('#0099ff')
                    .addFields(
                        { name: 'Created', value: new Date(note.createdAt).toLocaleString(), inline: true },
                        { name: 'Author', value: `<@${note.authorId}>`, inline: true }
                    );

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`save:${noteId}`)
                            .setLabel('Save to Channel')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`edit:${noteId}`)
                            .setLabel('Edit')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`delete:${noteId}`)
                            .setLabel('Delete')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('backToList')
                            .setLabel('Back to List')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });

                // Create a collector for the note view
                const collector = interaction.channel.createMessageComponentCollector({
                    filter: i => i.user.id === interaction.user.id,
                    time: 300000 // 5 minutes
                });

                collector.on('collect', async (i) => {
                    if (i.customId === 'backToList') {
                        // Get the current page from the view state
                        const viewState = getViewNoteState(interaction.id);
                        const currentPage = viewState ? viewState.page || 1 : 1;
                        
                        // Show the notes list again
                        await showNotesList(interaction, currentPage);
                        untrackViewNote(interaction.id);
                        return;
                    }

                    // Handle other actions (save, edit, delete)
                    if (i.customId.startsWith('save:')) {
                        const channel = await client.channels.fetch(channelId);
                        if (channel) {
                            await channel.send({ embeds: [embed] });
                            await i.reply({ content: 'Note saved to channel!', ephemeral: true });
                        }
                    } else if (i.customId.startsWith('edit:')) {
                        // Handle edit action
                        const modal = new ModalBuilder()
                            .setCustomId(`editModal:${noteId}`)
                            .setTitle('Edit Note');

                        const titleInput = new TextInputBuilder()
                            .setCustomId('title')
                            .setLabel('Title')
                            .setStyle(TextInputStyle.Short)
                            .setValue(note.title)
                            .setRequired(true);

                        const contentInput = new TextInputBuilder()
                            .setCustomId('content')
                            .setLabel('Content')
                            .setStyle(TextInputStyle.Paragraph)
                            .setValue(note.content)
                            .setRequired(true);

                        const firstActionRow = new ActionRowBuilder().addComponents(titleInput);
                        const secondActionRow = new ActionRowBuilder().addComponents(contentInput);

                        modal.addComponents(firstActionRow, secondActionRow);
                        await i.showModal(modal);
                    } else if (i.customId.startsWith('delete:')) {
                        // Handle delete action
                        deleteNote(interaction.user.id, noteId);
                        await i.reply({ content: 'Note deleted!', ephemeral: true });
                        await showNotesList(interaction, 1);
                    }
                });

                collector.on('end', () => {
                    untrackViewNote(interaction.id);
                });

            } catch (error) {
                console.error('Error handling view note:', error);
                await interaction.reply({ content: 'An error occurred while viewing the note.', ephemeral: true });
            }
        }
    }
});

// Keep the message-based commands for backward compatibility
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (!hasRequiredRole(message.member)) {
        return message.reply('You do not have permission to use this bot.');
    }

    switch (command) {
        case 'note': {
            if (args.length < 2) {
                return message.reply('Please use: !note [title] [content] [save_to_channel]');
            }
            const title = args[0];
            const content = args.slice(1, -1).join(' ');
            const saveToChannel = args[args.length - 1].toLowerCase() === 'true';

            const noteId = createNoteId(message.author.id, title);
            notes[noteId] = {
                title,
                content,
                userId: message.author.id,
                createdAt: new Date().toISOString(),
                author: message.author.username
            };
            
            saveNotes();
            
            if (saveToChannel) {
                const noteEmbed = new EmbedBuilder()
                    .setTitle('📝 Note Saved')
                    .setDescription(`**${title}**\n\n${content}`)
                    .setColor(COLORS.NOTE)
                    .setThumbnail(THUMBNAILS.NOTE)
                    .setFooter({ 
                        text: `Note created by ${message.author.username}`,
                        iconURL: message.author.displayAvatarURL()
                    })
                    .setTimestamp();
                
                await message.channel.send({ embeds: [noteEmbed] });
            }
            
            message.reply(`Note "${title}" has been saved!`);
            break;
        }

        case 'getnotes': {
            if (args.length !== 1) {
                return message.reply('Please use: !getnotes [title]');
            }
            const noteId = createNoteId(message.author.id, args[0]);
            const note = notes[noteId];
            if (!note) {
                return message.reply('Note not found!');
            }
            message.reply(`**${note.title}**: ${note.content}`);
            break;
        }

        case 'getnote': {
            if (args.length !== 1) {
                return message.reply('Please use: !getnote [title]');
            }
            const noteId = createNoteId(message.author.id, args[0]);
            const note = notes[noteId];
            if (!note) {
                return message.reply('Note not found!');
            }
            message.reply(`**${note.title}**: ${note.content}`);
            break;
        }

        case 'vote': {
            if (args.length < 2) {
                return message.reply('Please use: !vote [question] [option1,option2,...] [save_to_channel]');
            }
            const question = args[0];
            const options = args[1].split(',');
            const saveToChannel = args[2]?.toLowerCase() === 'true';
            
            const embed = new EmbedBuilder()
                .setTitle('📊 New Poll')
                .setColor(COLORS.VOTE)
                .setThumbnail(THUMBNAILS.VOTE)
                .setFooter({ 
                    text: `Poll created by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setTimestamp();

            let description = `**${question}**\n\n`;
            options.forEach((option, index) => {
                description += `**${index + 1}.** ${option}\n`;
            });

            embed.setDescription(description);
            
            const voteMessage = await message.channel.send({ embeds: [embed] });
            
            for (let i = 0; i < options.length; i++) {
                await voteMessage.react(`${i + 1}️⃣`);
            }
            break;
        }

        case 'reminder': {
            if (args.length < 2) {
                return message.reply('Please use: !reminder [minutes] [message]');
            }
            const time = parseInt(args[0]);
            const reminderMessage = args.slice(1).join(' ');

            if (isNaN(time) || time <= 0) {
                return message.reply('Please provide a valid time in minutes.');
            }

            message.reply(`I will remind you in ${time} minutes!`);
            
            setTimeout(() => {
                message.author.send(`⏰ Reminder: ${reminderMessage}`);
            }, time * 60 * 1000);
            break;
        }

        case 'help': {
            const helpEmbed = new EmbedBuilder()
                .setTitle('🤖 Bot Commands')
                .setDescription('Here are all the available commands you can use:')
                .setColor(COLORS.HELP)
                .setThumbnail(THUMBNAILS.HELP)
                .addFields(
                    { 
                        name: '📝 Notes', 
                        value: '```!note [title] [content] [save_to_channel]\nSave a note with optional channel posting\n\n!getnotes [title]\nRetrieve a saved note```',
                        inline: false
                    },
                    { 
                        name: '🗳️ Voting', 
                        value: '```!vote [question] [option1,option2,...] [save_to_channel]\nCreate a poll with multiple options\nOptions should be comma-separated```',
                        inline: false
                    },
                    { 
                        name: '⏰ Reminders', 
                        value: '```!reminder [minutes] [message]\nSet a reminder that will be sent as a DM```',
                        inline: false
                    }
                )
                .setFooter({ 
                    text: `Requested by ${message.author.username}`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setTimestamp();
            
            message.reply({ embeds: [helpEmbed] });
            break;
        }
    }
});

// Update the prayer time check function
async function checkPrayerTimes() {
    const now = moment();
    
    for (const [userId, data] of prayerSubscriptions) {
        try {
            const response = await axios.get(`http://api.aladhan.com/v1/timingsByCity`, {
                params: {
                    city: data.city,
                    country: data.country,
                    method: 2, // ISNA method
                    tune: '0,0,0,0,0,0,0,0,0' // Disable any time adjustments
                }
            });

            const timings = response.data.data.timings;
            const user = await client.users.fetch(userId);
            
            // Get the timezone for the user's location
            const timezone = response.data.data.meta.timezone;
            const localNow = now.clone().tz(timezone);

            // Check each prayer time
            const prayers = {
                Fajr: timings.Fajr,
                Dhuhr: timings.Dhuhr,
                Asr: timings.Asr,
                Maghrib: timings.Maghrib,
                Isha: timings.Isha
            };

            for (const [prayer, time] of Object.entries(prayers)) {
                const [hour, minute] = time.split(':').map(Number);
                const prayerTime = localNow.clone().set({ hour, minute, second: 0 });
                
                // Check if it's time for prayer (within 1 minute)
                if (Math.abs(localNow.diff(prayerTime, 'minutes')) <= 1) {
                    const embed = new EmbedBuilder()
                        .setTitle('🕌 Prayer Time')
                        .setDescription(`It's time for ${prayer} prayer!`)
                        .setColor('#2ECC71')
                        .setThumbnail(THUMBNAILS.PRAYER)
                        .addFields(
                            { name: 'Prayer', value: prayer, inline: true },
                            { name: 'Time', value: time, inline: true },
                            { name: 'Location', value: `${data.city}, ${data.country}`, inline: true },
                            { name: 'Timezone', value: timezone, inline: true }
                        )
                        .setFooter({ 
                            text: 'May your prayers be accepted',
                            iconURL: 'https://img.lovepik.com/png/20231006/Simple-Elements-of-Blue-Mosque-Paper-cut-Style-ramazan-calligraphy_98116_wh1200.png'
                        })
                        .setTimestamp();

                    await user.send({ embeds: [embed] });
                }
            }
        } catch (error) {
            console.error(`Error checking prayer times for user ${userId}:`, error);
        }
    }
}

// Add prayer time check interval
setInterval(checkPrayerTimes, 60000); // Check every minute

// Add error handling for file operations
function safeFileOperation(operation) {
    try {
        return operation();
    } catch (error) {
        console.error('File operation error:', error);
        return null;
    }
}

// Optimize note operations with validation
function validateNote(note, userId) {
    if (!note) return { valid: false, error: 'Note not found!' };
    if (note.userId !== userId) return { valid: false, error: 'You can only interact with your own notes!' };
    return { valid: true };
}

// Add cleanup for collectors
function cleanupCollector(collector) {
    if (collector && !collector.ended) {
        collector.stop();
    }
}

// Helper functions for note actions
async function handleSaveNote(interaction, note) {
    try {
        const noteEmbed = new EmbedBuilder()
            .setTitle('📝 Shared Note')
            .setDescription(`**${note.title}**\n\n${note.content}`)
            .setColor(COLORS.NOTE)
            .setThumbnail(THUMBNAILS.NOTE)
            .addFields(
                { name: 'Created At', value: new Date(note.createdAt).toLocaleString(), inline: true },
                { name: 'Author', value: note.author, inline: true }
            )
            .setFooter({ 
                text: `Shared by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL()
            })
            .setTimestamp();

        await interaction.channel.send({ embeds: [noteEmbed] });
        await safeInteractionResponse(interaction, {
            content: 'Note has been saved to the channel!',
            flags: [1]
        });
    } catch (error) {
        console.error('Error saving note:', error);
        await safeInteractionResponse(interaction, {
            content: 'Failed to save note to channel. Please try again later.',
            flags: [1]
        });
    }
}

async function handleEditNote(interaction, note) {
    try {
        const modal = new ModalBuilder()
            .setCustomId(`edit_modal_${note.id}`)
            .setTitle('Edit Note');

        const titleInput = new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setValue(note.title)
            .setRequired(true)
            .setMaxLength(100);

        const contentInput = new TextInputBuilder()
            .setCustomId('content')
            .setLabel('Content')
            .setStyle(TextInputStyle.Paragraph)
            .setValue(note.content)
            .setRequired(true)
            .setMaxLength(4000);

        const firstRow = new ActionRowBuilder().addComponents(titleInput);
        const secondRow = new ActionRowBuilder().addComponents(contentInput);

        modal.addComponents(firstRow, secondRow);
        await interaction.showModal(modal);
    } catch (error) {
        console.error('Error showing edit modal:', error);
        await safeInteractionResponse(interaction, {
            content: 'Failed to open edit modal. Please try again later.',
            flags: [1]
        });
    }
}

async function handleDeleteNote(interaction, note) {
    try {
        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_delete_${note.id}`)
                    .setLabel('Confirm Delete')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🗑️'),
                new ButtonBuilder()
                    .setCustomId('cancel_delete')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );

        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Confirm Deletion')
            .setDescription(`Are you sure you want to delete the note "${note.title}"?`)
            .setColor('#FF0000')
            .setFooter({ 
                text: 'This action cannot be undone',
                iconURL: interaction.user.displayAvatarURL()
            });

        await safeInteractionResponse(interaction, {
            embeds: [confirmEmbed],
            components: [confirmRow],
            flags: [1]
        });

        const collector = interaction.channel.createMessageComponentCollector({ 
            time: 30000,
            max: 1
        });

        collector.on('collect', async (i) => {
            try {
                if (i.user.id !== interaction.user.id) {
                    return safeInteractionResponse(i, {
                        content: 'This confirmation is not for you!',
                        flags: [1]
                    });
                }

                if (i.customId === `confirm_delete_${note.id}`) {
                    await retryFileOperation(async () => {
                        delete notes[note.id];
                        saveNotes();
                    });
                    await safeInteractionResponse(i, {
                        content: 'Note has been deleted!',
                        embeds: [],
                        components: []
                    });
                } else if (i.customId === 'cancel_delete') {
                    await safeInteractionResponse(i, {
                        content: 'Deletion cancelled.',
                        embeds: [],
                        components: []
                    });
                }
            } catch (error) {
                console.error('Error handling delete confirmation:', error);
                await safeInteractionResponse(i, {
                    content: 'An error occurred while processing your request. Please try again later.',
                    embeds: [],
                    components: []
                });
            }
            collector.stop();
        });

        collector.on('end', () => {
            cleanupCollector(collector);
        });
    } catch (error) {
        console.error('Error setting up delete confirmation:', error);
        await safeInteractionResponse(interaction, {
            content: 'Failed to set up delete confirmation. Please try again later.',
            flags: [1]
        });
    }
}

async function showNotesList(interaction, page = 1) {
    const notes = getUserNotes(interaction.user.id);
    const itemsPerPage = 5;
    const totalPages = Math.ceil(notes.length / itemsPerPage);
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageNotes = notes.slice(startIndex, endIndex);

    // Track the current page in the view state
    const viewState = getViewNoteState(interaction.id);
    if (viewState) {
        viewState.page = page;
    }

    const embed = new EmbedBuilder()
        .setTitle('Your Notes')
        .setDescription(`Page ${page} of ${totalPages}`)
        .setColor('#0099ff');

    // Create rows of view buttons (3 per row)
    const buttonRows = [];
    let currentRow = new ActionRowBuilder();
    let buttonCount = 0;

    for (const note of pageNotes) {
        const button = new ButtonBuilder()
            .setCustomId(`view:${note.id}`)
            .setLabel(`${note.title} 📖`)
            .setStyle(ButtonStyle.Primary);

        currentRow.addComponents(button);
        buttonCount++;

        if (buttonCount === 3 || note === pageNotes[pageNotes.length - 1]) {
            buttonRows.push(currentRow);
            currentRow = new ActionRowBuilder();
            buttonCount = 0;
        }
    }

    // Add pagination buttons
    const paginationRow = new ActionRowBuilder();
    if (page > 1) {
        paginationRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`page:${page - 1}`)
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    if (page < totalPages) {
        paginationRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`page:${page + 1}`)
                .setLabel('Next')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    if (paginationRow.components.length > 0) {
        buttonRows.push(paginationRow);
    }

    await interaction.reply({ embeds: [embed], components: buttonRows, ephemeral: true });
}

// Add single interaction handler for all button interactions
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const [action, noteId] = interaction.customId.split(':');
    
    try {
        switch (action) {
            case 'save_note': {
                const note = notes[noteId];
                if (!note) {
                    return interaction.reply({ content: 'Note not found!', ephemeral: true });
                }

                const embed = new EmbedBuilder()
                    .setTitle('📝 Note Details')
                    .setDescription(`**${note.title}**\n\n${note.content}`)
                    .setColor(COLORS.NOTE)
                    .setThumbnail(THUMBNAILS.NOTE)
                    .addFields(
                        { name: 'Created At', value: new Date(note.createdAt).toLocaleString(), inline: true },
                        { name: 'Author', value: note.author, inline: true }
                    )
                    .setFooter({ 
                        text: `Shared by ${interaction.user.username}`,
                        iconURL: interaction.user.displayAvatarURL()
                    })
                    .setTimestamp();

                await interaction.channel.send({ embeds: [embed] });
                await interaction.update({ 
                    content: 'Note saved to channel!',
                    embeds: [],
                    components: []
                });
                break;
            }

            case 'edit_note': {
                const note = notes[noteId];
                if (!note) {
                    return interaction.reply({ content: 'Note not found!', ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`edit_note_modal:${noteId}`)
                    .setTitle('Edit Note');

                const titleInput = new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('Title')
                    .setStyle(TextInputStyle.Short)
                    .setValue(note.title)
                    .setRequired(true);

                const contentInput = new TextInputBuilder()
                    .setCustomId('content')
                    .setLabel('Content')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(note.content)
                    .setRequired(true);

                const firstActionRow = new ActionRowBuilder().addComponents(titleInput);
                const secondActionRow = new ActionRowBuilder().addComponents(contentInput);

                modal.addComponents(firstActionRow, secondActionRow);
                await interaction.showModal(modal);
                break;
            }

            case 'delete_note': {
                const note = notes[noteId];
                if (!note) {
                    return interaction.reply({ content: 'Note not found!', ephemeral: true });
                }

                const confirmRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`confirm_delete:${noteId}`)
                            .setLabel('Confirm Delete')
                            .setStyle(ButtonStyle.Danger),
                        new ButtonBuilder()
                            .setCustomId('cancel_delete')
                            .setLabel('Cancel')
                            .setStyle(ButtonStyle.Secondary)
                    );

                await interaction.update({
                    content: 'Are you sure you want to delete this note? This action cannot be undone.',
                    embeds: [],
                    components: [confirmRow]
                });
                break;
            }

            case 'confirm_delete': {
                if (notes[noteId]) {
                    delete notes[noteId];
                    saveNotes();
                    await interaction.update({ 
                        content: 'Note deleted successfully!',
                        embeds: [],
                        components: []
                    });
                } else {
                    await interaction.update({ 
                        content: 'Note not found!',
                        embeds: [],
                        components: []
                    });
                }
                break;
            }

            case 'cancel_delete': {
                await interaction.update({ 
                    content: 'Deletion cancelled.',
                    embeds: [],
                    components: []
                });
                break;
            }
        }
    } catch (error) {
        console.error('Error handling button interaction:', error);
        await interaction.reply({
            content: 'An error occurred while processing your request. Please try again later.',
            ephemeral: true
        });
    }
});

// Add single modal submit handler
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId.startsWith('edit_note_modal:')) {
        const noteId = interaction.customId.split(':')[1];
        const title = interaction.fields.getTextInputValue('title');
        const content = interaction.fields.getTextInputValue('content');

        if (notes[noteId]) {
            // Store the old title for reference
            const oldTitle = notes[noteId].title;
            
            // Update the note
            notes[noteId].title = title;
            notes[noteId].content = content;
            
            // If title changed, create new note ID and move the note
            if (oldTitle !== title) {
                const newNoteId = createNoteId(interaction.user.id, title);
                notes[newNoteId] = notes[noteId];
                delete notes[noteId];
            }
            
            saveNotes();
            
            await interaction.reply({
                content: 'Note updated successfully!',
                embeds: [],
                components: []
            });
        } else {
            await interaction.reply({
                content: 'Note not found!',
                embeds: [],
                components: []
            });
        }
    }
});

// Helper function to get dice emoji
function getDiceEmoji(number) {
    const diceEmojis = {
        1: '⚀',
        2: '⚁',
        3: '⚂',
        4: '⚃',
        5: '⚄',
        6: '⚅'
    };
    return diceEmojis[number] || '🎲';
}

// Add this after the other file paths
// File path for zakerny reminders
const zakernyFile = path.join(dataDir, 'zakerny.json');

// Initialize or load zakerny reminders
let zakernyReminders = new Map();
try {
    const savedZakerny = JSON.parse(fs.readFileSync(zakernyFile, 'utf8'));
    zakernyReminders = new Map(Object.entries(savedZakerny));
} catch (error) {
    zakernyReminders = new Map();
    fs.writeFileSync(zakernyFile, JSON.stringify(Object.fromEntries(zakernyReminders), null, 2));
}

// Function to save zakerny reminders to file
function saveZakernyReminders() {
    const zakernyData = Object.fromEntries(zakernyReminders);
    fs.writeFileSync(zakernyFile, JSON.stringify(zakernyData, null, 2));
}

// Add this after the prayer time check interval
// Add zakerny reminder check interval
setInterval(async () => {
    const now = Date.now();
    for (const [userId, reminder] of zakernyReminders) {
        if (now - reminder.lastSent >= reminder.interval) {
            try {
                const user = await client.users.fetch(userId);
                await user.send(`🔄 Reminder: ${reminder.message}`);
                reminder.lastSent = now;
                saveZakernyReminders();
            } catch (error) {
                console.error(`Error sending zakerny reminder to user ${userId}:`, error);
                // If we can't send to the user, remove the reminder
                zakernyReminders.delete(userId);
                saveZakernyReminders();
            }
        }
    }
}, 1000); // Check every second

client.login(process.env.DISCORD_TOKEN); 