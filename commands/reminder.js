const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Store active reminders
const activeReminders = new Map();

// Store recurring reminders (zakerny functionality)
const recurringReminders = new Map();

// Convert time to milliseconds
function convertToMs(amount, unit) {
    switch(unit.toLowerCase()) {
        case 'sec':
        case 'secs':
        case 'second':
        case 'seconds':
            return amount * 1000;
        case 'min':
        case 'mins':
        case 'minute':
        case 'minutes':
            return amount * 60 * 1000;
        case 'hr':
        case 'hrs':
        case 'hour':
        case 'hours':
            return amount * 60 * 60 * 1000;
        case 'day':
        case 'days':
            return amount * 24 * 60 * 60 * 1000;
        default:
            return null;
    }
}
const listofimages = [
'https://cdn.discordapp.com/attachments/1435289217122041937/1435302815323918366/82a736fa-248d-45e6-a8fc-c37992c83786.png?ex=690b7969&is=690a27e9&hm=ea7373d5cecd4daed61f40f32a63347346d79849e997948f428c3a3f52e7ff12&',
'https://cdn.discordapp.com/attachments/1435289217122041937/1435302815919767745/fff30b7a-b626-4bdf-b78a-1038d3122bf3.png?ex=690b7969&is=690a27e9&hm=bffd4183a3a00eea890da2c5e8647c55d7cb10e26a9e31992591f6e3c13f99d6&'
];
const timeIsUp = [
'https://cdn.discordapp.com/attachments/1435289217122041937/1435289450736259132/Time_is_up1.png?ex=690b6cf7&is=690a1b77&hm=5d88d4c70e22ec8ad196adeb8d491ac24b7b1ad9c53a5d1b2fd5d5348e07a4d6&',
'https://cdn.discordapp.com/attachments/1435289217122041937/1435304132591358194/Time_is_up2.png?ex=690b7aa3&is=690a2923&hm=8b7ca9d8c93cae826844ca2763020085643a6fe530235589acceeb14d9213915'
];
async function handleRemindCommand(interaction) {
    const message = interaction.options.getString('message');
    const amount = interaction.options.getInteger('time');
    const unit = interaction.options.getString('unit');
    
    // Convert to milliseconds
    const ms = convertToMs(amount, unit);
    
    if (!ms) {
        return interaction.reply({ 
            content: 'Invalid time unit. Please use "mins" or "hours".',
            ephemeral: true 
        });
    }
    
    // Calculate when the reminder will trigger
    const now = new Date();
    const reminderTime = new Date(now.getTime() + ms);
    
    // Create a formatted time string
    const timeString = reminderTime.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    const dateString = reminderTime.toLocaleDateString();
    
    // Create a confirmation embed
    const confirmEmbed = new EmbedBuilder()
        .setTitle('⏰ Reminder Set')
        .setDescription(`I'll remind you about: **${message}**`)
        .setThumbnail(listofimages[Math.floor(Math.random() * listofimages.length)])
        .addFields(
            { name: 'When', value: `${timeString} on ${dateString}`, inline: true },
            { name: 'Time from now', value: `${amount} ${unit}`, inline: true }
        )
        .setColor('#3498DB')
        .setFooter({ text: `Reminder ID: ${interaction.user.id}-${Date.now()}` })
        .setTimestamp();
    
    // Set the timeout
    const reminderId = `${interaction.user.id}-${Date.now()}`;
    const timeout = setTimeout(async () => {
        try {
            // Create the reminder embed
            const reminderEmbed = new EmbedBuilder()
                .setTitle('⏰ Reminder!')
                .setThumbnail(timeIsUp[Math.floor(Math.random() * timeIsUp.length)])
                .setDescription(`You asked me to remind you about:\n\n**${message}**`)
                .setColor('#3498DB')
                .setFooter({ text: `Reminder set ${amount} ${unit} ago` })
                .setTimestamp();
            
            // Send DM to the user
            await interaction.user.send({ embeds: [reminderEmbed] });
            
            // Remove from active reminders
            activeReminders.delete(reminderId);
        } catch (error) {
            console.error('Failed to send reminder DM:', error);
        }
    }, ms);
    
    // Store the active reminder
    activeReminders.set(reminderId, {
        userId: interaction.user.id,
        message,
        timeout,
        reminderTime
    });
    
    // Reply to the user
    await interaction.reply({ 
        embeds: [confirmEmbed],
        ephemeral: true 
    });
}

// Handle recurring reminder (zakerny) functionality
async function handleRecurringReminder(interaction) {
    const message = interaction.options.getString('message');
    const amount = interaction.options.getInteger('number');
    const unit = interaction.options.getString('unit');
    
    // Convert to milliseconds
    const ms = convertToMs(amount, unit);
    
    if (!ms) {
        return interaction.reply({ 
            content: 'Invalid time unit. Please use seconds, minutes, hours, or days.',
            ephemeral: true 
        });
    }
    
    // Check if user already has a recurring reminder
    if (recurringReminders.has(interaction.user.id)) {
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_replace_recurring')
                    .setLabel('Replace')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_replace_recurring')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );
            
        return interaction.reply({
            content: 'You already have an active recurring reminder. Do you want to replace it?',
            components: [actionRow],
            ephemeral: true
        });
    }
    
    // Set up the recurring reminder
    return createRecurringReminder(interaction, message, amount, unit, ms);
}

async function createRecurringReminder(interaction, message, amount, unit, ms) {
    // Clear any existing interval for this user
    clearRecurringReminder(interaction.user.id);
    
    // Set up the new interval
    const interval = setInterval(async () => {
        try {
            // Create the reminder embed
            const reminderEmbed = new EmbedBuilder()
                .setTitle('🔄 Recurring Reminder')
                .setDescription(`You asked me to remind you about:\n\n**${message}**`)
                .setColor('#9B59B6')
                .setFooter({ text: `Repeats every ${amount} ${unit}` })
                .setTimestamp();
            
            // Send DM to the user
            await interaction.user.send({ embeds: [reminderEmbed] });
        } catch (error) {
            console.error('Failed to send recurring reminder DM:', error);
            // If we can't send DMs to the user, clear the reminder
            if (error.code === 50007) { // Cannot send messages to this user
                clearRecurringReminder(interaction.user.id);
            }
        }
    }, ms);
    
    // Store the recurring reminder
    recurringReminders.set(interaction.user.id, {
        message,
        amount,
        unit,
        interval,
        createdAt: new Date().toISOString()
    });
    
    // Create a confirmation embed
    const confirmEmbed = new EmbedBuilder()
        .setTitle('🔄 Recurring Reminder Set')
        .setDescription(`I'll remind you about: **${message}**`)
        .addFields(
            { name: 'Frequency', value: `Every ${amount} ${unit}`, inline: true }
        )
        .setColor('#9B59B6')
        .setTimestamp();
    
    // If this is from a button interaction, update the message
    if (interaction.isButton()) {
        return interaction.update({ 
            content: null,
            embeds: [confirmEmbed], 
            components: [] 
        });
    }
    
    // Otherwise, send a new reply
    return interaction.reply({ 
        embeds: [confirmEmbed],
        ephemeral: true 
    });
}

function clearRecurringReminder(userId) {
    const reminder = recurringReminders.get(userId);
    if (reminder) {
        clearInterval(reminder.interval);
        recurringReminders.delete(userId);
        return true;
    }
    return false;
}

async function handleClearRecurringReminder(interaction) {
    const cleared = clearRecurringReminder(interaction.user.id);
    
    if (cleared) {
        return interaction.reply({ 
            content: 'Your recurring reminder has been cleared.',
            ephemeral: true 
        });
    } else {
        return interaction.reply({ 
            content: 'You don\'t have any active recurring reminders.',
            ephemeral: true 
        });
    }
}

async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    
    if (customId === 'confirm_replace_recurring') {
        const message = interaction.message.content.match(/message: (.*?),/)?.[1] || 'No message provided';
        const amount = parseInt(interaction.message.content.match(/amount: (\d+)/)?.[1] || '5');
        const unit = interaction.message.content.match(/unit: (\w+)/)?.[1] || 'minutes';
        const ms = convertToMs(amount, unit);
        
        return createRecurringReminder(interaction, message, amount, unit, ms);
    } 
    else if (customId === 'cancel_replace_recurring') {
        return interaction.update({ 
            content: 'Operation cancelled. Your existing recurring reminder remains active.',
            components: [],
            ephemeral: true 
        });
    }
    
    return false;
}

module.exports = [
    {
        name: 'remind',
        description: 'Set a reminder',
        options: [
            {
                name: 'message',
                type: 3, // STRING
                description: 'What to remind you about',
                required: true
            },
            {
                name: 'time',
                type: 4, // INTEGER
                description: 'Amount of time',
                required: true
            },
            {
                name: 'unit',
                type: 3, // STRING
                description: 'Time unit (mins, hours)',
                required: true,
                choices: [
                    {
                        name: 'Minutes',
                        value: 'mins'
                    },
                    {
                        name: 'Hours',
                        value: 'hours'
                    }
                ]
            }
        ],
        execute: async function(interaction) {
            return handleRemindCommand(interaction);
        }
    },
    {
        name: 'zakerny',
        description: 'Set a recurring reminder message',
        options: [
            {
                name: 'message',
                type: 3, // STRING
                description: 'The message to repeat',
                required: true
            },
            {
                name: 'number',
                type: 4, // INTEGER
                description: 'The number of units',
                required: true
            },
            {
                name: 'unit',
                type: 3, // STRING
                description: 'The time unit (seconds, minutes, hours, days)',
                required: true,
                choices: [
                    { name: 'Seconds', value: 'seconds' },
                    { name: 'Minutes', value: 'minutes' },
                    { name: 'Hours', value: 'hours' },
                    { name: 'Days', value: 'days' }
                ]
            }
        ],
        execute: async function(interaction) {
            return handleRecurringReminder(interaction);
        }
    },
    {
        name: 'clear-zakerny',
        description: 'Clear your recurring reminder',
        execute: async function(interaction) {
            return handleClearRecurringReminder(interaction);
        }
    },
    {
        handleButton: async function(interaction) {
            return handleButtonInteraction(interaction);
        }
    }
];
