const { EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
}

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

// Prayer names mapping
const PRAYER_NAMES = {
    'Fajr': 'الفجر',
    'Sunrise': 'الشروق',
    'Dhuhr': 'الظهر',
    'Asr': 'العصر',
    'Maghrib': 'المغرب',
    'Isha': 'العشاء'
};

// Fetch prayer times from API
// Add prayer times cache
const prayerTimesCache = new Map();

// Modified fetchPrayerTimes function with caching
async function fetchPrayerTimes(city, country) {
    try {
        // Generate cache key using city, country and current date
        const today = new Date().toDateString();
        const cacheKey = `${city}_${country}_${today}`;
        
        // Check cache first
        if (prayerTimesCache.has(cacheKey)) {
            console.log(`Using cached prayer times for ${city}, ${country} on ${today}`);
            return prayerTimesCache.get(cacheKey);
        }
        
        console.log(`Fetching fresh prayer times for ${city}, ${country}`);
        const response = await axios.get(`http://api.aladhan.com/v1/timingsByCity`, {
            params: {
                city,
                country,
                method: 5 // Method 5 is the Egyptian General Authority of Survey
            }
        });
        
        if (response.data && response.data.data && response.data.data.timings) {
            // Cache the results
            prayerTimesCache.set(cacheKey, response.data.data.timings);
            
            // Set cache to expire at the end of the day
            const midnight = new Date();
            midnight.setHours(24, 0, 0, 0);
            const timeUntilMidnight = midnight - new Date();
            
            setTimeout(() => {
                prayerTimesCache.delete(cacheKey);
                console.log(`Cleared cache for ${city}, ${country} on ${today}`);
            }, timeUntilMidnight);
            
            return response.data.data.timings;
        }
        return null;
    } catch (error) {
        console.error('Error fetching prayer times:', error);
        return null;
    }
}

// Format prayer times for display
function formatPrayerTimes(timings) {
    if (!timings) return 'Unable to fetch prayer times.';
    
    let formattedTimes = '';
    for (const [prayer, time] of Object.entries(timings)) {
        if (PRAYER_NAMES[prayer]) {
            const [hours, minutes] = time.split(':');
            const formattedTime = `${hours}:${minutes}`;
            formattedTimes += `**${PRAYER_NAMES[prayer]}** (${prayer}): ${formattedTime}\n`;
        }
    }
    
    return formattedTimes;
}

// Convert prayer time to UTC based on timezone offset
function convertToUTC(timeString, timezoneOffset) {
    const [hours, minutes] = timeString.split(':').map(Number);
    
    // Parse the timezone offset
    const offsetMatch = timezoneOffset.match(/([+-])(\d{2}):(\d{2})/);
    if (!offsetMatch) return { hours, minutes }; // Return as is if invalid format
    
    const offsetSign = offsetMatch[1] === '+' ? -1 : 1; // Reverse sign for UTC conversion
    const offsetHours = parseInt(offsetMatch[2], 10);
    const offsetMinutes = parseInt(offsetMatch[3], 10);
    
    // Calculate UTC time
    let utcHours = hours + (offsetSign * offsetHours);
    let utcMinutes = minutes + (offsetSign * offsetMinutes);
    
    // Handle minute overflow/underflow
    if (utcMinutes >= 60) {
        utcHours += 1;
        utcMinutes -= 60;
    } else if (utcMinutes < 0) {
        utcHours -= 1;
        utcMinutes += 60;
    }
    
    // Handle hour overflow/underflow
    utcHours = (utcHours + 24) % 24;
    
    return { hours: utcHours, minutes: utcMinutes };
}

// Check if it's time for a prayer notification
function isPrayerTime(prayerTime, timezoneOffset) {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    
    const [prayerHour, prayerMinute] = prayerTime.split(':').map(Number);
    const utcPrayerTime = convertToUTC(prayerTime, timezoneOffset);
    
    // Check if current UTC time matches prayer UTC time
    return utcHour === utcPrayerTime.hours && Math.abs(utcMinute - utcPrayerTime.minutes) <= 1;
}

// Handle prayer subscription command
async function handlePrayerSubscribe(interaction) {
    const city = interaction.options.getString('city');
    const country = interaction.options.getString('country');
    const timezone = interaction.options.getString('timezone') || '+02:00'; // Default to Cairo timezone
    
    // Fetch prayer times to validate city and country
    const timings = await fetchPrayerTimes(city, country);
    
    if (!timings) {
        return interaction.reply({ 
            content: 'Unable to fetch prayer times. Please check your city and country names.', 
            ephemeral: true 
        });
    }
    
    // Save subscription
    prayerSubscriptions.set(interaction.user.id, {
        city,
        country,
        timezone,
        subscribedAt: new Date().toISOString()
    });
    
    savePrayerSubscriptions();
    
    // Create embed with prayer times
    const embed = new EmbedBuilder()
        .setTitle('🕌 Prayer Times Subscription')
        .setDescription(`You have subscribed to prayer time notifications for **${city}, ${country}**.\n\n**Today's Prayer Times:**\n${formatPrayerTimes(timings)}`)
        .setColor('#009900')
        .setThumbnail('https://img.lovepik.com/png/20231005/blue-mosque-ramadan-paper-cut-religious-month-arabic_87729_wh1200.png')
        .setFooter({ 
            text: `Subscribed at ${new Date().toLocaleString()}`,
            iconURL: interaction.user.displayAvatarURL()
        })
        .setTimestamp();
    
    return interaction.reply({ embeds: [embed], ephemeral: true });
}

// Handle prayer unsubscribe command
async function handlePrayerUnsubscribe(interaction) {
    const userId = interaction.user.id;
    
    if (!prayerSubscriptions.has(userId)) {
        return interaction.reply({ 
            content: 'You are not subscribed to prayer time notifications.', 
            ephemeral: true 
        });
    }
    
    prayerSubscriptions.delete(userId);
    savePrayerSubscriptions();
    
    return interaction.reply({ 
        content: 'You have been unsubscribed from prayer time notifications.', 
        ephemeral: true 
    });
}

// Check for prayer times and send notifications
async function checkPrayerTimes(client) {
    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();
    
    for (const [userId, subscription] of prayerSubscriptions.entries()) {
        try {
            const timings = await fetchPrayerTimes(subscription.city, subscription.country);
            
            if (!timings) continue;
            
            // Check each prayer time
            for (const [prayer, time] of Object.entries(timings)) {
                if (PRAYER_NAMES[prayer] && isPrayerTime(time, subscription.timezone)) {
                    try {
                        const user = await client.users.fetch(userId);
                        
                        const embed = new EmbedBuilder()
                            .setTitle(`🕌 Prayer Time: ${PRAYER_NAMES[prayer]} (${prayer})`)
                            .setDescription(`It's time for ${PRAYER_NAMES[prayer]} prayer in **${subscription.city}, ${subscription.country}**.\n\nThe prayer time is **${time}**.`)
                            .setColor('#009900')
                            .setThumbnail('https://img.lovepik.com/png/20231005/blue-mosque-ramadan-paper-cut-religious-month-arabic_87729_wh1200.png')
                            .setFooter({ text: `Prayer time notification` })
                            .setTimestamp();
                        
                        await user.send({ embeds: [embed] });
                        console.log(`Sent ${prayer} prayer notification to ${user.tag}`);
                    } catch (error) {
                        console.error(`Failed to send prayer notification to user ${userId}:`, error);
                    }
                }
            }
        } catch (error) {
            console.error(`Error checking prayer times for user ${userId}:`, error);
        }
    }
}

// Schedule function to check prayer times
function schedulePrayerNotifications(client) {
    // Run once immediately to check if any prayers are due now
    checkPrayerTimes(client).catch(err => {
        console.error('Error in initial prayer time check:', err);
    });
    
    // Check every minute
    setInterval(() => {
        checkPrayerTimes(client).catch(err => {
            console.error('Error in scheduled prayer time check:', err);
        });
    }, 60 * 1000); // Check every minute
    
    console.log('Prayer time notifications scheduled');
}

module.exports = [
    {
        name: 'prayer-subscribe',
        description: 'Subscribe to prayer time notifications',
        options: [
            {
                name: 'city',
                type: 3, // STRING
                description: 'Your city name',
                required: true
            },
            {
                name: 'country',
                type: 3, // STRING
                description: 'Your country name',
                required: true
            },
            {
                name: 'timezone',
                type: 3, // STRING
                description: 'Your timezone offset (e.g., +02:00)',
                required: false
            }
        ],
        execute: async function(interaction) {
            return handlePrayerSubscribe(interaction);
        }
    },
    {
        name: 'prayer-unsubscribe',
        description: 'Unsubscribe from prayer time notifications',
        execute: async function(interaction) {
            return handlePrayerUnsubscribe(interaction);
        }
    },
    {
        name: 'prayer-notifications',
        initPrayerNotifications: function(client) {
            schedulePrayerNotifications(client);
        }
    }
];