require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, REST, Routes, ApplicationCommandOptionType } = require('discord.js');
const axios = require('axios');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Store notes and reminders
const notes = new Map();
const reminders = new Map();

// Add these color constants at the top of the file after the imports
const COLORS = {
    NOTE: '#2ECC71',    // Green
    VOTE: '#3498DB',    // Blue
    REMINDER: '#E74C3C', // Red
    HELP: '#9B59B6'     // Purple
};

// Add prayer time storage
const prayerSubscriptions = new Map(); // Map<userId, {city, country, timezone}>

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
        name: 'getnote',
        description: 'Retrieve a saved note',
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
    }
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    
    try {
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

            notes.set(title, content);
            
            if (saveToChannel) {
                const noteEmbed = new EmbedBuilder()
                    .setTitle('📝 Note Saved')
                    .setDescription(`**${title}**\n\n${content}`)
                    .setColor(COLORS.NOTE)
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
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

        case 'getnote': {
            const title = options.getString('title');
            const note = notes.get(title);
            
            if (!note) {
                return interaction.reply({ content: 'Note not found!', ephemeral: true });
            }
            
            const noteEmbed = new EmbedBuilder()
                .setTitle('📝 Note Retrieved')
                .setDescription(`**${title}**\n\n${note}`)
                .setColor(COLORS.NOTE)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
                .setFooter({ 
                    text: `Requested by ${interaction.user.username}`,
                    iconURL: interaction.user.displayAvatarURL()
                })
                .setTimestamp();
            
            await interaction.reply({ embeds: [noteEmbed], ephemeral: true });
            break;
        }

        case 'vote': {
            const question = options.getString('question');
            const optionsList = options.getString('options').split(',').map(opt => opt.trim());
            const saveToChannel = options.getBoolean('save_to_channel') || false;
            
            const embed = new EmbedBuilder()
                .setTitle('📊 New Poll')
                .setColor(COLORS.VOTE)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
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

                prayerSubscriptions.set(interaction.user.id, { city, country });
                
                const embed = new EmbedBuilder()
                    .setTitle('🕌 Prayer Time Subscription')
                    .setDescription('You have successfully subscribed to prayer time notifications!')
                    .setColor('#2ECC71')
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
                    .addFields(
                        { name: 'Location', value: `${city}, ${country}` },
                        { name: 'Next Prayer', value: 'You will receive notifications for all prayer times' }
                    )
                    .setFooter({ 
                        text: 'May your prayers be accepted',
                        iconURL: 'https://cdn-icons-png.flaticon.com/512/2232/2232688.png'
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
                prayerSubscriptions.delete(interaction.user.id);
                
                const embed = new EmbedBuilder()
                    .setTitle('🕌 Prayer Time Subscription')
                    .setDescription('You have successfully unsubscribed from prayer time notifications.')
                    .setColor('#E74C3C')
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
                    .setFooter({ 
                        text: 'You can subscribe again anytime',
                        iconURL: 'https://cdn-icons-png.flaticon.com/512/2232/2232688.png'
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
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
                .addFields(
                    { 
                        name: '📝 Notes', 
                        value: '```/note [title] [content] [save_to_channel]\nSave a note with optional channel posting\n\n/getnote [title]\nRetrieve a saved note```',
                        inline: false
                    },
                    { 
                        name: '🗳️ Voting', 
                        value: '```/vote [question] [options] [save_to_channel]\nCreate a poll with multiple options\nOptions should be comma-separated```',
                        inline: false
                    },
                    { 
                        name: '⏰ Reminders', 
                        value: '```/reminder [minutes] [message]\nSet a reminder that will be sent as a DM```',
                        inline: false
                    },
                    { 
                        name: '🕌 Prayer Times', 
                        value: '```/prayer-subscribe [city] [country]\nSubscribe to daily prayer time notifications\n\n/prayer-unsubscribe\nUnsubscribe from prayer time notifications```',
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

            notes.set(title, content);
            
            if (saveToChannel) {
                const noteEmbed = new EmbedBuilder()
                    .setTitle('📝 Note Saved')
                    .setDescription(`**${title}**\n\n${content}`)
                    .setColor(COLORS.NOTE)
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
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

        case 'getnote': {
            if (args.length !== 1) {
                return message.reply('Please use: !getnote [title]');
            }
            const note = notes.get(args[0]);
            if (!note) {
                return message.reply('Note not found!');
            }
            message.reply(`**${args[0]}**: ${note}`);
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
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
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
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
                .addFields(
                    { 
                        name: '📝 Notes', 
                        value: '```!note [title] [content] [save_to_channel]\nSave a note with optional channel posting\n\n!getnote [title]\nRetrieve a saved note```',
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

// Add prayer time check function
async function checkPrayerTimes() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    for (const [userId, data] of prayerSubscriptions) {
        try {
            const response = await axios.get(`http://api.aladhan.com/v1/timingsByCity`, {
                params: {
                    city: data.city,
                    country: data.country,
                    method: 2 // ISNA method
                }
            });

            const timings = response.data.data.timings;
            const user = await client.users.fetch(userId);

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
                
                // Check if it's time for prayer (within 1 minute)
                if (hour === currentHour && Math.abs(minute - currentMinute) <= 1) {
                    const embed = new EmbedBuilder()
                        .setTitle('🕌 Prayer Time')
                        .setDescription(`It's time for ${prayer} prayer!`)
                        .setColor('#2ECC71')
                        .setThumbnail('https://cdn-icons-png.flaticon.com/512/2232/2232688.png')
                        .addFields(
                            { name: 'Prayer', value: prayer, inline: true },
                            { name: 'Time', value: time, inline: true },
                            { name: 'Location', value: `${data.city}, ${data.country}`, inline: true }
                        )
                        .setFooter({ 
                            text: 'May your prayers be accepted',
                            iconURL: 'https://cdn-icons-png.flaticon.com/512/2232/2232688.png'
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

client.login(process.env.DISCORD_TOKEN); 