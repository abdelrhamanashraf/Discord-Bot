const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Path to store subscriber data
const subscribersFilePath = path.join(__dirname, '..', 'data', 'subscribers.json');

// Ensure the data directory exists
if (!fs.existsSync(path.join(__dirname, '..', 'data'))) {
    fs.mkdirSync(path.join(__dirname, '..', 'data'));
}

// Load existing subscribers or create empty array
let subscribers = [];
try {
    if (fs.existsSync(subscribersFilePath)) {
        subscribers = JSON.parse(fs.readFileSync(subscribersFilePath, 'utf8'));
    } else {
        fs.writeFileSync(subscribersFilePath, JSON.stringify(subscribers), 'utf8');
    }
} catch (error) {
    console.error('Error loading subscribers:', error);
}

// Save subscribers to file
function saveSubscribers() {
    try {
        fs.writeFileSync(subscribersFilePath, JSON.stringify(subscribers), 'utf8');
    } catch (error) {
        console.error('Error saving subscribers:', error);
    }
}

// Initialize notification system
let notificationListener = null;
let targetChannelId = process.env.FREE_GAMES_CHANNEL_ID || '';
let targetBotId = process.env.TARGET_BOT_ID || '';

const command = {
    name: 'freenotify',
    description: 'Subscribe or unsubscribe from free game notifications',

    async execute(interaction) {
        const userId = interaction.user.id;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'subscribe') {
            // Check if user is already subscribed
            if (subscribers.includes(userId)) {
                return interaction.reply({
                    content: 'You are already subscribed to free game notifications!',
                    ephemeral: true
                });
            }

            // Add user to subscribers
            subscribers.push(userId);
            saveSubscribers();

            const embed = new EmbedBuilder()
                .setTitle('✅ Subscription Successful')
                .setDescription('You have successfully subscribed to free game notifications!')
                .setColor('#00FF00')
                .addFields(
                    { name: 'What to expect', value: 'You will receive a DM whenever a free game is announced in the server.' },
                    { name: 'How to unsubscribe', value: 'Use `/freenotify unsubscribe` to stop receiving notifications.' }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        else if (subcommand === 'unsubscribe') {
            // Check if user is subscribed
            const index = subscribers.indexOf(userId);
            if (index === -1) {
                return interaction.reply({
                    content: 'You are not currently subscribed to free game notifications.',
                    ephemeral: true
                });
            }

            // Remove user from subscribers
            subscribers.splice(index, 1);
            saveSubscribers();

            return interaction.reply({
                content: 'You have been unsubscribed from free game notifications.',
                ephemeral: true
            });
        }
        else if (subcommand === 'status') {
            const isSubscribed = subscribers.includes(userId);

            const embed = new EmbedBuilder()
                .setTitle('📊 Subscription Status')
                .setDescription(isSubscribed
                    ? 'You are currently subscribed to free game notifications.'
                    : 'You are not currently subscribed to free game notifications.')
                .setColor(isSubscribed ? '#00FF00' : '#FF0000')
                .addFields(
                    { name: 'Total Subscribers', value: `${subscribers.length}` },
                    {
                        name: isSubscribed ? 'How to unsubscribe' : 'How to subscribe',
                        value: isSubscribed
                            ? 'Use `/freenotify unsubscribe` to stop receiving notifications.'
                            : 'Use `/freenotify subscribe` to start receiving notifications.'
                    }
                )
                .setTimestamp();

            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    },

    // Initialize the notification system
    initNotificationSystem(client) {
        // Set channel and bot IDs from environment variables
        targetChannelId = process.env.FREE_GAMES_CHANNEL_ID || targetChannelId;
        targetBotId = process.env.TARGET_BOT_ID || targetBotId;

        // Only set up the listener if we have subscribers and valid IDs
        if (subscribers.length > 0 && targetChannelId && targetBotId) {
            console.log(`Setting up notification listener for channel ${targetChannelId} and bot ${targetBotId}`);

            // Remove any existing listener
            if (notificationListener) {
                client.removeListener('messageCreate', notificationListener);
            }

            // Create a new listener
            notificationListener = async (message) => {
                // Check if message is from the target bot and in the monitored channel
                if (message.author.id === targetBotId && message.channel.id === targetChannelId) {
                    console.log('Detected notification message, forwarding to subscribers');
                    console.log(`Found ${subscribers.length} subscribers. Starting broadcast...`);

                    // Forward the message to all subscribers
                    for (const userId of subscribers) {
                        try {
                            console.log(`Processing subscriber: ${userId}`);
                            const user = await client.users.fetch(userId);

                            // Get the first embed from original message if it exists
                            const originalEmbed = message.embeds?.[0];

                            // Create an embed for the forwarded message
                            const forwardEmbed = new EmbedBuilder()
                                .setTitle('🎮 Free Game Alert! (Click to jump to message)')
                                .setURL(message.url)
                                .setDescription(message.content || originalEmbed?.description || 'Check out this free game!')
                                .setColor(originalEmbed?.color || '#0099ff')
                                .setTimestamp()
                                .setFooter({ text: 'Forwarded from server announcement' });

                            // Copy fields if present
                            if (originalEmbed?.fields) {
                                forwardEmbed.addFields(originalEmbed.fields);
                            }

                            // Copy image from embed or attachments
                            if (originalEmbed?.image) {
                                forwardEmbed.setImage(originalEmbed.image.url);
                            } else if (message.attachments.size > 0) {
                                const attachment = message.attachments.first();
                                if (attachment.contentType && attachment.contentType.startsWith('image/')) {
                                    forwardEmbed.setImage(attachment.url);
                                }
                            }

                            // Send the DM
                            await user.send({ embeds: [forwardEmbed] });
                            console.log(`Successfully sent to ${userId}`);
                        } catch (error) {
                            console.error(`Error sending notification to user ${userId}:`, error);
                        }
                    }
                }
            };

            // Register the listener
            client.on('messageCreate', notificationListener);
            return true;
        } else {
            console.log('No subscribers or missing configuration, notification system not started');
            return false;
        }
    },

    // Method to check and update the notification system
    updateNotificationSystem(client) {
        // Only set up the listener if we have subscribers
        if (subscribers.length > 0) {
            return this.initNotificationSystem(client);
        } else if (notificationListener) {
            // Remove the listener if there are no subscribers
            client.removeListener('messageCreate', notificationListener);
            notificationListener = null;
            console.log('No subscribers, notification listener removed');
            return false;
        }
        return false;
    },

    // For testing/debugging
    getSubscriberCount() {
        return subscribers.length;
    }
};

module.exports = command;