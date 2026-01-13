const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const { Client: WhatsAppClient, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode');

// Paths
const contactsFilePath = path.join(__dirname, '..', 'data', 'whatsapp_contacts.json');
const scheduledMessagesPath = path.join(__dirname, '..', 'data', 'scheduled_messages.json');
const groupsFilePath = path.join(__dirname, '..', 'data', 'whatsapp_groups.json');

// WhatsApp client instance
let whatsappClient = null;
let isWhatsAppReady = false;
let qrCodeData = null;
let discordClient = null; // Store Discord client for message monitoring

// Track pending messages for monitoring replies
const pendingMessages = new Map(); // Map<phoneNumber, { channelId, timestamp, contactName }>

// Load contacts
let contacts = [];
try {
    if (fs.existsSync(contactsFilePath)) {
        contacts = JSON.parse(fs.readFileSync(contactsFilePath, 'utf8'));
    } else {
        fs.writeFileSync(contactsFilePath, JSON.stringify([], null, 2), 'utf8');
    }
} catch (error) {
    console.error('Error loading WhatsApp contacts:', error);
}

// Save contacts
function saveContacts() {
    try {
        fs.writeFileSync(contactsFilePath, JSON.stringify(contacts, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving WhatsApp contacts:', error);
    }
}

// Load groups
let groups = [];
try {
    if (fs.existsSync(groupsFilePath)) {
        groups = JSON.parse(fs.readFileSync(groupsFilePath, 'utf8'));
    } else {
        fs.writeFileSync(groupsFilePath, JSON.stringify([], null, 2), 'utf8');
    }
} catch (error) {
    console.error('Error loading WhatsApp groups:', error);
}

// Save groups
function saveGroups() {
    try {
        fs.writeFileSync(groupsFilePath, JSON.stringify(groups, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving WhatsApp groups:', error);
    }
}

// Load scheduled messages
let scheduledMessages = [];
try {
    if (fs.existsSync(scheduledMessagesPath)) {
        scheduledMessages = JSON.parse(fs.readFileSync(scheduledMessagesPath, 'utf8'));
    } else {
        fs.writeFileSync(scheduledMessagesPath, JSON.stringify([], null, 2), 'utf8');
    }
} catch (error) {
    console.error('Error loading scheduled messages:', error);
}

// Save scheduled messages
function saveScheduledMessages() {
    try {
        fs.writeFileSync(scheduledMessagesPath, JSON.stringify(scheduledMessages, null, 2), 'utf8');
    } catch (error) {
        console.error('Error saving scheduled messages:', error);
    }
}



// Initialize WhatsApp client
async function initWhatsAppClient() {
    if (whatsappClient) {
        return whatsappClient;
    }

    // Initialize the client with standard puppeteer configuration
    whatsappClient = new WhatsAppClient({
        authStrategy: new LocalAuth({
            dataPath: path.join(__dirname, '..', '.wwebjs_auth')
        }),
        puppeteer: {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        }
    });

    whatsappClient.on('qr', (qr) => {
        console.log('WhatsApp QR Code received');
        qrCodeData = qr;
    });

    whatsappClient.on('ready', () => {
        console.log('WhatsApp client is ready!');
        isWhatsAppReady = true;
        qrCodeData = null;
    });

    whatsappClient.on('authenticated', () => {
        console.log('WhatsApp client authenticated');
    });

    whatsappClient.on('auth_failure', (msg) => {
        console.error('WhatsApp authentication failed:', msg);
        isWhatsAppReady = false;
    });

    whatsappClient.on('disconnected', (reason) => {
        console.log('WhatsApp client disconnected:', reason);
        isWhatsAppReady = false;
    });

    whatsappClient.on('message', async (message) => {
        try {
            // Ignore messages from groups and status messages
            if (message.from.includes('@g.us') || message.from === 'status@broadcast') {
                return;
            }

            // Ignore messages from ourselves
            if (message.fromMe) {
                return;
            }

            // Get the sender's chat ID and try to get contact info
            const senderChatId = message.from.replace('@c.us', '');
            const senderNumber = senderChatId.replace(/\D/g, '');

            // Try to get contact info to match by phone number
            let contactPhoneNumber = null;
            try {
                const contact = await message.getContact();
                if (contact && contact.number) {
                    contactPhoneNumber = contact.number.replace(/\D/g, '');
                    console.log(`[WhatsApp] Contact phone number from WhatsApp: ${contactPhoneNumber}`);
                }
            } catch (error) {
                console.log(`[WhatsApp] Could not get contact info: ${error.message}`);
            }

            // Debug: Log incoming message details
            console.log(`[WhatsApp] 📨 Received message from chat ID: ${senderChatId}`);
            console.log(`[WhatsApp] Normalized to: ${senderNumber}`);
            if (contactPhoneNumber) {
                console.log(`[WhatsApp] Contact phone: ${contactPhoneNumber}`);
            }
            console.log(`[WhatsApp] Message body: ${message.body || '(empty)'}`);
            console.log(`[WhatsApp] Current pending messages:`, Array.from(pendingMessages.keys()));

            // Try to find matching number in pending messages (exact match or partial)
            let matchingNumber = null;
            let messageData = null;

            // First, try exact match with chat ID (most reliable)
            if (pendingMessages.has(senderChatId)) {
                matchingNumber = senderChatId;
                messageData = pendingMessages.get(senderChatId);
                console.log(`[WhatsApp] ✅ Exact match found by chat ID: ${senderChatId}`);
            }
            // Try exact match with normalized number
            else if (pendingMessages.has(senderNumber)) {
                matchingNumber = senderNumber;
                messageData = pendingMessages.get(senderNumber);
                console.log(`[WhatsApp] ✅ Exact match found by number: ${senderNumber}`);
            }
            // Try match using contact's phone number (if we got it)
            else if (contactPhoneNumber && pendingMessages.has(contactPhoneNumber)) {
                matchingNumber = contactPhoneNumber;
                messageData = pendingMessages.get(contactPhoneNumber);
                console.log(`[WhatsApp] ✅ Exact match found by contact phone: ${contactPhoneNumber}`);
            }
            // Try to find by checking if any stored chat ID matches
            else {
                // Try to find by checking stored chat IDs
                for (const [storedKey, data] of pendingMessages.entries()) {
                    // Check if stored chat ID matches incoming chat ID
                    if (data.chatId && (data.chatId === senderChatId || data.chatId === senderNumber)) {
                        matchingNumber = storedKey;
                        messageData = data;
                        console.log(`[WhatsApp] ✅ Found match by chat ID: stored ${storedKey} (chatId: ${data.chatId}) matches incoming ${senderChatId}`);
                        break;
                    }
                    // Check if stored phone number matches (fallback)
                    // Check against senderNumber, contactPhoneNumber, or senderChatId
                    const numbersToCheck = [senderNumber, senderChatId];
                    if (contactPhoneNumber) {
                        numbersToCheck.push(contactPhoneNumber);
                    }

                    if (data.phoneNumber) {
                        for (const checkNum of numbersToCheck) {
                            if (data.phoneNumber === checkNum ||
                                data.phoneNumber.endsWith(checkNum) ||
                                checkNum.endsWith(data.phoneNumber)) {
                                matchingNumber = storedKey;
                                messageData = data;
                                console.log(`[WhatsApp] ✅ Found match by phone number: stored ${storedKey} (phone: ${data.phoneNumber}) matches incoming ${checkNum}`);
                                break;
                            }
                        }
                        if (matchingNumber) break;
                    }

                    // Also check if contactPhoneNumber matches stored phone
                    if (contactPhoneNumber && data.phoneNumber &&
                        (data.phoneNumber === contactPhoneNumber ||
                            data.phoneNumber.endsWith(contactPhoneNumber) ||
                            contactPhoneNumber.endsWith(data.phoneNumber))) {
                        matchingNumber = storedKey;
                        messageData = data;
                        console.log(`[WhatsApp] ✅ Found match by contact phone number: stored ${storedKey} (phone: ${data.phoneNumber}) matches contact ${contactPhoneNumber}`);
                        break;
                    }
                    // Legacy: Check if stored key itself matches (for backwards compatibility)
                    if (storedKey === senderNumber ||
                        storedKey === senderChatId ||
                        storedKey.endsWith(senderNumber) ||
                        senderNumber.endsWith(storedKey)) {
                        matchingNumber = storedKey;
                        messageData = data;
                        console.log(`[WhatsApp] ✅ Found match by key: stored ${storedKey} matches incoming ${senderChatId}`);
                        break;
                    }
                }
            }

            // Check if we're monitoring this number
            if (matchingNumber && messageData) {
                const now = Date.now();
                const timeSinceSent = now - messageData.timestamp;

                console.log(`[WhatsApp] Found pending message from ${messageData.contactName}, time since sent: ${Math.round(timeSinceSent / 1000)}s`);

                // Check if within 5 minutes (300000 ms)
                if (timeSinceSent <= 300000) {
                    // Send reply to Discord channel
                    if (discordClient) {
                        try {
                            const channel = await discordClient.channels.fetch(messageData.channelId);
                            if (channel) {
                                // Use stored phone number for display (cleaner) or fallback to sender number
                                const displayPhone = messageData.phoneNumber || senderNumber;
                                const embed = new EmbedBuilder()
                                    .setTitle('📱 WhatsApp Reply Received')
                                    .setDescription(`**From:** ${messageData.contactName}\n**Phone:** +${displayPhone}`)
                                    .addFields({ name: 'Message', value: message.body || '*(No text content)*' })
                                    .setColor('#25D366')
                                    .setTimestamp();

                                await channel.send({ embeds: [embed] });
                                console.log(`[WhatsApp] ✅ Posted reply from ${messageData.contactName} to Discord channel ${messageData.channelId}`);
                            } else {
                                console.error(`[WhatsApp] Channel not found: ${messageData.channelId}`);
                            }
                        } catch (error) {
                            console.error('[WhatsApp] Error posting WhatsApp reply to Discord:', error);
                        }
                    } else {
                        console.error('[WhatsApp] Discord client not initialized');
                    }

                    // DO NOT remove from pending messages here - keep monitoring for ALL replies within 5 minutes
                    // The timeout will automatically remove it after 5 minutes
                    console.log(`[WhatsApp] ⏱️ Still monitoring ${messageData.contactName} for more replies (time remaining: ${Math.round((300000 - timeSinceSent) / 1000)}s)`);
                } else {
                    // Message is older than 5 minutes, remove from monitoring
                    console.log(`[WhatsApp] Message from ${messageData.contactName} is older than 5 minutes, removing from monitoring`);
                    // Remove both entries if they exist
                    pendingMessages.delete(matchingNumber);
                    if (messageData.phoneNumber && messageData.phoneNumber !== matchingNumber) {
                        pendingMessages.delete(messageData.phoneNumber);
                    }
                    if (messageData.chatId && messageData.chatId !== matchingNumber) {
                        pendingMessages.delete(messageData.chatId);
                    }
                }
            } else {
                console.log(`[WhatsApp] No pending message found for ${senderNumber}`);
            }
        } catch (error) {
            console.error('[WhatsApp] Error handling WhatsApp message:', error);
        }
    });

    return whatsappClient;
}

// Format phone number for WhatsApp
function formatPhoneNumber(number) {
    // Remove all non-numeric characters
    let cleaned = number.replace(/\D/g, '');

    // Add country code if not present (assuming it starts with +)
    if (!cleaned.startsWith('1') && cleaned.length === 10) {
        // Assuming US number, add country code
        // You may want to customize this based on your needs
    }

    return cleaned + '@c.us';
}

// Handle WhatsApp connect command
async function handleWhatsAppConnect(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (isWhatsAppReady) {
        return interaction.editReply({
            content: '✅ WhatsApp is already connected!',
            ephemeral: true
        });
    }

    try {
        const client = await initWhatsAppClient();

        // Initialize the client
        await client.initialize();

        // Wait for QR code with timeout
        let attempts = 0;
        const maxAttempts = 30; // 30 seconds

        while (!qrCodeData && !isWhatsAppReady && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            attempts++;
        }

        if (isWhatsAppReady) {
            return interaction.editReply({
                content: '✅ WhatsApp is now connected!',
                ephemeral: true
            });
        }

        if (qrCodeData) {
            // Generate QR code image
            const qrImage = await qrcode.toBuffer(qrCodeData, {
                scale: 8,
                margin: 2
            });

            const attachment = new AttachmentBuilder(qrImage, { name: 'whatsapp-qr.png' });

            const embed = new EmbedBuilder()
                .setTitle('📱 WhatsApp Connection')
                .setDescription('Scan this QR code with your WhatsApp mobile app:\n\n1. Open WhatsApp on your phone\n2. Tap Menu or Settings\n3. Tap Linked Devices\n4. Tap Link a Device\n5. Point your phone at this screen')
                .setColor('#25D366')
                .setImage('attachment://whatsapp-qr.png')
                .setFooter({ text: 'QR code expires in 60 seconds' })
                .setTimestamp();

            return interaction.editReply({
                embeds: [embed],
                files: [attachment],
                ephemeral: true
            });
        }

        return interaction.editReply({
            content: '❌ Failed to generate QR code. Please try again.',
            ephemeral: true
        });

    } catch (error) {
        console.error('Error connecting to WhatsApp:', error);

        // Provide more helpful error messages
        let errorMessage = `❌ Error connecting to WhatsApp: ${error.message}`;

        if (error.message.includes('Missing Chrome dependencies') ||
            error.message.includes('libatk') ||
            error.message.includes('shared libraries') ||
            error.message.includes('cannot open shared object') ||
            error.message.includes('Failed to launch the browser process')) {

            const packageList = `libatk-1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libwayland-client0 libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 xdg-utils libu2f-udev libvulkan1 fonts-liberation`;

            errorMessage = `❌ **Missing System Libraries - Hosting Provider Required**\n\n` +
                `The Docker container is missing required Chrome/Puppeteer dependencies.\n\n` +
                `**What happened:**\n` +
                `- The system attempted to install dependencies automatically\n` +
                `- Installation failed: Container doesn't have root permissions\n` +
                `- Chrome cannot launch without these system libraries\n\n` +
                `**⚠️ ACTION REQUIRED:**\n` +
                `You **must contact your hosting provider** to fix this. The container cannot install packages itself.\n\n` +
                `**Message to send to your hosting provider:**\n` +
                `\`\`\`\n` +
                `I need the following system packages installed in my Docker container:\n` +
                `${packageList}\n\n` +
                `These are required for Puppeteer/Chrome to work. The container doesn't have root permissions to install them.\n` +
                `Can you either:\n` +
                `1. Install these packages in the base Docker image, or\n` +
                `2. Switch my container to use: ghcr.io/puppeteer/puppeteer:latest\n` +
                `\`\`\`\n\n` +
                `**Required packages:**\n` +
                `\`${packageList}\`\n\n` +
                `**Full error:** ${error.message.split('\n')[0]}`;
        } else if (error.message.includes('Failed to launch')) {
            errorMessage = `❌ **Browser Launch Failed**\n\n` +
                `Puppeteer cannot launch Chrome. This usually means:\n` +
                `1. Missing system libraries (see above)\n` +
                `2. Insufficient permissions\n` +
                `3. Chrome executable not found\n\n` +
                `**Full error:** ${error.message}`;
        }

        return interaction.editReply({
            content: errorMessage,
            ephemeral: true
        });
    }
}

// Handle WhatsApp status command
async function handleWhatsAppStatus(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('📱 WhatsApp Status')
        .setColor(isWhatsAppReady ? '#25D366' : '#E74C3C')
        .addFields(
            { name: 'Connection Status', value: isWhatsAppReady ? '✅ Connected' : '❌ Disconnected', inline: true },
            { name: 'Contacts', value: `${contacts.length} saved`, inline: true },
            { name: 'Scheduled Messages', value: `${scheduledMessages.filter(m => !m.sent).length} pending`, inline: true }
        )
        .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

// Handle WhatsApp send command
async function handleWhatsAppSend(interaction) {
    if (!isWhatsAppReady) {
        return interaction.reply({
            content: '❌ WhatsApp is not connected. Use `/whatsapp connect` first.',
            ephemeral: true
        });
    }

    if (contacts.length === 0 && groups.length === 0) {
        return interaction.reply({
            content: '❌ No contacts or groups found. Add contacts first using `/whatsapp add-contact`.',
            ephemeral: true
        });
    }

    // Build options for contacts and groups
    const options = [];

    // Add contacts
    contacts.forEach(contact => {
        options.push({
            label: `👤 ${contact.name}`,
            description: contact.number,
            value: contact.id // ID already includes "contact_" prefix
        });
    });

    // Add groups
    groups.forEach(group => {
        const memberCount = group.members.length;
        options.push({
            label: `👥 ${group.name} (Group)`,
            description: `${memberCount} members`,
            value: group.id // ID already includes "group_" prefix
        });
    });

    // Create selection menu
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('whatsapp_select_recipient')
        .setPlaceholder('Select a contact or group to message')
        .addOptions(options.slice(0, 25)); // Discord limit

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
        content: '📱 Select a contact or group to send a message:',
        components: [row],
        ephemeral: true
    });
}

// Handle WhatsApp schedule command
async function handleWhatsAppSchedule(interaction) {
    if (!isWhatsAppReady) {
        return interaction.reply({
            content: '❌ WhatsApp is not connected. Use `/whatsapp connect` first.',
            ephemeral: true
        });
    }

    if (contacts.length === 0) {
        return interaction.reply({
            content: '❌ No contacts found. Add contacts first using `/whatsapp add-contact`.',
            ephemeral: true
        });
    }

    // Create contact selection menu for scheduling
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('whatsapp_schedule_select_contact')
        .setPlaceholder('Select a contact to schedule a message')
        .addOptions(
            contacts.map(contact => ({
                label: contact.name,
                description: contact.number,
                value: contact.id
            }))
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({
        content: '📅 Select a contact to schedule a message:',
        components: [row],
        ephemeral: true
    });
}

// Handle WhatsApp contacts list
async function handleWhatsAppContacts(interaction) {
    if (contacts.length === 0) {
        return interaction.reply({
            content: '📱 No contacts saved yet.\n\nUse `/whatsapp add-contact` to add contacts.',
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('📱 WhatsApp Contacts')
        .setDescription(`Total contacts: ${contacts.length}`)
        .setColor('#25D366')
        .setTimestamp();

    contacts.forEach((contact, index) => {
        embed.addFields({
            name: `${index + 1}. ${contact.name}`,
            value: `📞 ${contact.number}${contact.notes ? `\n📝 ${contact.notes}` : ''}`,
            inline: false
        });
    });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('whatsapp_add_contact')
            .setLabel('Add Contact')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕'),
        new ButtonBuilder()
            .setCustomId('whatsapp_edit_contact')
            .setLabel('Edit Contact')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId('whatsapp_delete_contact')
            .setLabel('Delete Contact')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
    );

    return interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}

// Handle add contact command
async function handleAddContact(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('whatsapp_add_contact_modal')
        .setTitle('Add WhatsApp Contact');

    const nameInput = new TextInputBuilder()
        .setCustomId('contact_name')
        .setLabel('Contact Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('John Doe')
        .setRequired(true);

    const numberInput = new TextInputBuilder()
        .setCustomId('contact_number')
        .setLabel('Phone Number (with country code)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('+1234567890 or 1234567890')
        .setRequired(true);

    const notesInput = new TextInputBuilder()
        .setCustomId('contact_notes')
        .setLabel('Notes (optional)')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Additional notes about this contact...')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput),
        new ActionRowBuilder().addComponents(numberInput),
        new ActionRowBuilder().addComponents(notesInput)
    );

    await interaction.showModal(modal);
}

// Handle WhatsApp disconnect
async function handleWhatsAppDisconnect(interaction) {
    await interaction.deferReply({ ephemeral: true });

    if (!whatsappClient) {
        return interaction.editReply({
            content: '❌ WhatsApp client is not initialized.',
            ephemeral: true
        });
    }

    try {
        await whatsappClient.destroy();
        whatsappClient = null;
        isWhatsAppReady = false;

        return interaction.editReply({
            content: '✅ WhatsApp has been disconnected.',
            ephemeral: true
        });
    } catch (error) {
        console.error('Error disconnecting WhatsApp:', error);
        return interaction.editReply({
            content: `❌ Error disconnecting: ${error.message}`,
            ephemeral: true
        });
    }
}

// Send WhatsApp message
async function sendWhatsAppMessage(phoneNumber, message, contactName = '', channelId = '') {
    if (!isWhatsAppReady || !whatsappClient) {
        throw new Error('WhatsApp is not connected');
    }

    const formattedNumber = formatPhoneNumber(phoneNumber);
    let sentMessage;

    // Check if message contains keyword to send with image
    const keywords = ['summon', 'come']; // Add more keywords here if needed
    const shouldSendImage = keywords.some(keyword => message.toLowerCase().includes(keyword.toLowerCase()));

    if (shouldSendImage) {
        // Image URL - can be any image URL
        const listofimages = ["https://meowboteow.sirv.com/meow%20images/Gemini_Generated_Image_jmggmgjmggmgjmgg.png",
            "https://meowboteow.sirv.com/meow%20images/Gemini_Generated_Image_jmggmgjmggmgjmgg-removebg-preview.png",
            "https://meowboteow.sirv.com/meow%20images/ChatGPT_Image_Nov_19__2025__07_04_01_PM-removebg-preview.png",
            "https://meowboteow.sirv.com/meow%20images/Copilot_20251119_190409-removebg-preview.png",
            "https://meowboteow.sirv.com/meow%20images/mysterious_cat_with_cloak-removebg-preview.png",
            "https://meowboteow.sirv.com/meow%20images/output_compressed.gif",
            "https://meowboteow.sirv.com/meow%20images/Gemini_Generated_Image_f4yp2kf4yp2kf4yp-removebg-preview.png"
        ];
        const imageUrl = listofimages[Math.floor(Math.random() * listofimages.length)];

        try {
            // Download and send image as media
            const media = await MessageMedia.fromUrl(imageUrl);
            // Send message with image
            sentMessage = await whatsappClient.sendMessage(formattedNumber, media, { caption: message });
            console.log(`[WhatsApp] 📷 Sent message with image to ${contactName || phoneNumber}`);
        } catch (error) {
            console.error(`[WhatsApp] Error sending image, sending text only:`, error);
            // Fallback to text message if image fails
            sentMessage = await whatsappClient.sendMessage(formattedNumber, message);
        }
    } else {
        // Send regular text message
        sentMessage = await whatsappClient.sendMessage(formattedNumber, message);
    }

    // Add to pending messages for monitoring replies (if channelId provided)
    if (channelId && contactName) {
        // Get the chat ID from the sent message or use the formatted number
        // sentMessage.to might contain the chat ID that WhatsApp uses
        const chatIdRaw = sentMessage.to || sentMessage.id?.remote || formattedNumber;
        // Remove @c.us if present, we'll use just the ID part
        const cleanChatId = chatIdRaw.replace('@c.us', '').replace(/\D/g, '');
        const cleanNumber = phoneNumber.replace(/\D/g, '');

        // Store with chat ID as key (this is what we'll receive back)
        pendingMessages.set(cleanChatId, {
            channelId,
            timestamp: Date.now(),
            contactName,
            phoneNumber: cleanNumber, // Store original phone number for display
            chatId: cleanChatId // Store the WhatsApp chat ID
        });

        // Also store with phone number as backup key (in case we need it)
        // This allows matching by both methods
        if (cleanChatId !== cleanNumber) {
            pendingMessages.set(cleanNumber, {
                channelId,
                timestamp: Date.now(),
                contactName,
                phoneNumber: cleanNumber,
                chatId: cleanChatId
            });
        }

        console.log(`[WhatsApp] 📤 Message sent to ${contactName} (${cleanNumber})`);
        console.log(`[WhatsApp] Chat ID: ${cleanChatId}, Phone: ${cleanNumber}`);
        console.log(`[WhatsApp] Monitoring for replies in channel ${channelId}`);
        console.log(`[WhatsApp] Total pending messages: ${pendingMessages.size}`);

        // Auto-remove after 5 minutes
        setTimeout(() => {
            if (pendingMessages.has(cleanChatId)) {
                pendingMessages.delete(cleanChatId);
            }
            if (pendingMessages.has(cleanNumber) && cleanChatId !== cleanNumber) {
                pendingMessages.delete(cleanNumber);
            }
            console.log(`[WhatsApp] ⏰ Removed ${contactName} from monitoring (5 minute timeout)`);
        }, 300000); // 5 minutes
    }
}

// Schedule message checker (runs every minute)
function initScheduleChecker() {
    setInterval(async () => {
        const now = Date.now();

        for (let i = scheduledMessages.length - 1; i >= 0; i--) {
            const msg = scheduledMessages[i];

            if (!msg.sent && msg.scheduledTime <= now) {
                try {
                    await sendWhatsAppMessage(msg.phoneNumber, msg.message);
                    scheduledMessages[i].sent = true;
                    scheduledMessages[i].sentAt = now;
                    console.log(`Scheduled message sent to ${msg.contactName}`);
                } catch (error) {
                    console.error(`Failed to send scheduled message to ${msg.contactName}:`, error);
                    scheduledMessages[i].error = error.message;
                }
                saveScheduledMessages();
            }
        }
    }, 60000); // Check every minute
}

// Initialize schedule checker
initScheduleChecker();

// Handle WhatsApp groups command
async function handleWhatsAppGroups(interaction) {
    if (groups.length === 0) {
        return interaction.reply({
            content: '📱 No groups created yet.\n\nUse `/whatsapp create-group` to create a group.',
            ephemeral: true
        });
    }

    const embed = new EmbedBuilder()
        .setTitle('👥 WhatsApp Contact Groups')
        .setDescription(`Total groups: ${groups.length}`)
        .setColor('#25D366')
        .setTimestamp();

    groups.forEach((group, index) => {
        const memberNames = group.members.map(memberId => {
            const contact = contacts.find(c => c.id === memberId);
            return contact ? contact.name : 'Unknown';
        }).join(', ');

        embed.addFields({
            name: `${index + 1}. ${group.name}`,
            value: `👥 ${group.members.length} members: ${memberNames || 'No members'}`,
            inline: false
        });
    });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('whatsapp_create_group')
            .setLabel('Create Group')
            .setStyle(ButtonStyle.Success)
            .setEmoji('➕'),
        new ButtonBuilder()
            .setCustomId('whatsapp_edit_group')
            .setLabel('Edit Group')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('✏️'),
        new ButtonBuilder()
            .setCustomId('whatsapp_delete_group')
            .setLabel('Delete Group')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
    );

    return interaction.reply({
        embeds: [embed],
        components: [row],
        ephemeral: true
    });
}

// Handle create group command
async function handleCreateGroup(interaction) {
    if (contacts.length === 0) {
        return interaction.reply({
            content: '❌ You need to have contacts before creating a group. Add contacts with `/whatsapp add-contact`.',
            ephemeral: true
        });
    }

    const modal = new ModalBuilder()
        .setCustomId('whatsapp_create_group_modal')
        .setTitle('Create Contact Group');

    const nameInput = new TextInputBuilder()
        .setCustomId('group_name')
        .setLabel('Group Name')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Friends, Family, Work Team')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder().addComponents(nameInput)
    );

    await interaction.showModal(modal);
}

// Initialize Discord client reference
function initDiscordClient(client) {
    discordClient = client;
    console.log('Discord client initialized for WhatsApp monitoring');
}

// Export commands
module.exports = [
    {
        name: 'whatsapp',
        description: 'WhatsApp integration commands',
        execute: async function (interaction) {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'connect':
                    return handleWhatsAppConnect(interaction);
                case 'status':
                    return handleWhatsAppStatus(interaction);
                case 'send':
                    return handleWhatsAppSend(interaction);
                case 'schedule':
                    return handleWhatsAppSchedule(interaction);
                case 'contacts':
                    return handleWhatsAppContacts(interaction);
                case 'add-contact':
                    return handleAddContact(interaction);
                case 'groups':
                    return handleWhatsAppGroups(interaction);
                case 'create-group':
                    return handleCreateGroup(interaction);
                case 'disconnect':
                    return handleWhatsAppDisconnect(interaction);
                default:
                    return interaction.reply({
                        content: '❌ Unknown subcommand.',
                        ephemeral: true
                    });
            }
        },
        initDiscordClient, // Export the initialization function
        handleButton: async function (interaction) {
            const customId = interaction.customId;

            if (customId === 'whatsapp_add_contact') {
                return handleAddContact(interaction);
            }
            else if (customId === 'whatsapp_edit_contact') {
                if (contacts.length === 0) {
                    return interaction.reply({
                        content: '❌ No contacts to edit.',
                        ephemeral: true
                    });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('whatsapp_edit_select_contact')
                    .setPlaceholder('Select a contact to edit')
                    .addOptions(
                        contacts.map(contact => ({
                            label: contact.name,
                            description: contact.number,
                            value: contact.id
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.reply({
                    content: '📝 Select a contact to edit:',
                    components: [row],
                    ephemeral: true
                });
            }
            else if (customId === 'whatsapp_delete_contact') {
                if (contacts.length === 0) {
                    return interaction.reply({
                        content: '❌ No contacts to delete.',
                        ephemeral: true
                    });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('whatsapp_delete_select_contact')
                    .setPlaceholder('Select a contact to delete')
                    .addOptions(
                        contacts.map(contact => ({
                            label: contact.name,
                            description: contact.number,
                            value: contact.id
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.reply({
                    content: '🗑️ Select a contact to delete:',
                    components: [row],
                    ephemeral: true
                });
            }
            else if (customId.startsWith('whatsapp_confirm_delete_')) {
                const contactId = customId.replace('whatsapp_confirm_delete_', '');
                const contactIndex = contacts.findIndex(c => c.id === contactId);

                if (contactIndex === -1) {
                    return interaction.update({
                        content: '❌ Contact not found.',
                        components: []
                    });
                }

                const contactName = contacts[contactIndex].name;
                contacts.splice(contactIndex, 1);
                saveContacts();

                return interaction.update({
                    content: `✅ Contact **${contactName}** deleted successfully!`,
                    components: []
                });
            }
            else if (customId === 'whatsapp_cancel_delete') {
                return interaction.update({
                    content: '❌ Deletion cancelled.',
                    components: []
                });
            }
            else if (customId === 'whatsapp_create_group') {
                return handleCreateGroup(interaction);
            }
            else if (customId === 'whatsapp_edit_group') {
                if (groups.length === 0) {
                    return interaction.reply({
                        content: '❌ No groups to edit.',
                        ephemeral: true
                    });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('whatsapp_edit_group_select')
                    .setPlaceholder('Select a group to edit')
                    .addOptions(
                        groups.map(group => ({
                            label: group.name,
                            description: `${group.members.length} members`,
                            value: group.id
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.reply({
                    content: '📝 Select a group to edit:',
                    components: [row],
                    ephemeral: true
                });
            }
            else if (customId === 'whatsapp_delete_group') {
                if (groups.length === 0) {
                    return interaction.reply({
                        content: '❌ No groups to delete.',
                        ephemeral: true
                    });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('whatsapp_delete_group_select')
                    .setPlaceholder('Select a group to delete')
                    .addOptions(
                        groups.map(group => ({
                            label: group.name,
                            description: `${group.members.length} members`,
                            value: group.id
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.reply({
                    content: '🗑️ Select a group to delete:',
                    components: [row],
                    ephemeral: true
                });
            }
            else if (customId.startsWith('whatsapp_confirm_delete_group_')) {
                const groupId = customId.replace('whatsapp_confirm_delete_group_', '');
                const groupIndex = groups.findIndex(g => g.id === groupId);

                if (groupIndex === -1) {
                    return interaction.update({
                        content: '❌ Group not found.',
                        components: []
                    });
                }

                const groupName = groups[groupIndex].name;
                groups.splice(groupIndex, 1);
                saveGroups();

                return interaction.update({
                    content: `✅ Group **${groupName}** deleted successfully!`,
                    components: []
                });
            }
            else if (customId.startsWith('whatsapp_manage_members_')) {
                const groupId = customId.replace('whatsapp_manage_members_', '');
                const group = groups.find(g => g.id === groupId);

                if (!group) {
                    return interaction.reply({
                        content: '❌ Group not found.',
                        ephemeral: true
                    });
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`whatsapp_add_members_btn_${groupId}`)
                        .setLabel('Add Members')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('➕'),
                    new ButtonBuilder()
                        .setCustomId(`whatsapp_remove_members_btn_${groupId}`)
                        .setLabel('Remove Members')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('➖')
                );

                return interaction.update({
                    content: `👥 Manage members for **${group.name}**:`,
                    components: [row]
                });
            }
            else if (customId.startsWith('whatsapp_add_members_btn_')) {
                const groupId = customId.replace('whatsapp_add_members_btn_', '');
                const group = groups.find(g => g.id === groupId);

                if (!group) {
                    return interaction.reply({
                        content: '❌ Group not found.',
                        ephemeral: true
                    });
                }

                const availableContacts = contacts.filter(c => !group.members.includes(c.id));

                if (availableContacts.length === 0) {
                    return interaction.update({
                        content: '❌ All contacts are already in this group.',
                        components: []
                    });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`whatsapp_select_member_for_${groupId}`)
                    .setPlaceholder('Select contacts to add')
                    .setMaxValues(Math.min(availableContacts.length, 10))
                    .addOptions(
                        availableContacts.map(contact => ({
                            label: contact.name,
                            description: contact.number,
                            value: contact.id
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.update({
                    content: `➕ Select contacts to add to **${group.name}**:`,
                    components: [row]
                });
            }
            else if (customId.startsWith('whatsapp_remove_members_btn_')) {
                const groupId = customId.replace('whatsapp_remove_members_btn_', '');
                const group = groups.find(g => g.id === groupId);

                if (!group) {
                    return interaction.reply({
                        content: '❌ Group not found.',
                        ephemeral: true
                    });
                }

                if (group.members.length === 0) {
                    return interaction.update({
                        content: '❌ This group has no members to remove.',
                        components: []
                    });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`whatsapp_remove_member_from_${groupId}`)
                    .setPlaceholder('Select members to remove')
                    .setMaxValues(Math.min(group.members.length, 10))
                    .addOptions(
                        group.members.map(memberId => {
                            const contact = contacts.find(c => c.id === memberId);
                            return {
                                label: contact ? contact.name : 'Unknown',
                                description: contact ? contact.number : 'N/A',
                                value: memberId
                            };
                        })
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.update({
                    content: `➖ Select members to remove from **${group.name}**:`,
                    components: [row]
                });
            }
        },
        handleSelectMenu: async function (interaction) {
            const customId = interaction.customId;
            const selectedId = interaction.values[0];

            if (customId === 'whatsapp_select_recipient' || customId === 'whatsapp_select_contact') {
                // Parse the selection (selectedId is already the full ID like "contact_123" or "group_456")
                let recipientName = '';
                let recipientType = '';
                let recipientId = selectedId;

                if (selectedId.startsWith('contact_')) {
                    recipientType = 'contact';
                    const contact = contacts.find(c => c.id === selectedId);
                    if (!contact) {
                        return interaction.reply({
                            content: '❌ Contact not found.',
                            ephemeral: true
                        });
                    }
                    recipientName = contact.name;
                    // Extract the ID part after "contact_" for the modal customId
                    recipientId = selectedId.replace('contact_', '');
                } else if (selectedId.startsWith('group_')) {
                    recipientType = 'group';
                    const group = groups.find(g => g.id === selectedId);
                    if (!group) {
                        return interaction.reply({
                            content: '❌ Group not found.',
                            ephemeral: true
                        });
                    }
                    recipientName = `${group.name} (${group.members.length} members)`;
                    // Extract the ID part after "group_" for the modal customId
                    recipientId = selectedId.replace('group_', '');
                } else {
                    // Fallback: try to find as contact first
                    const contact = contacts.find(c => c.id === selectedId);
                    if (contact) {
                        recipientType = 'contact';
                        recipientName = contact.name;
                        recipientId = selectedId.replace('contact_', '');
                    } else {
                        return interaction.reply({
                            content: '❌ Invalid selection. Please try again.',
                            ephemeral: true
                        });
                    }
                }

                const modal = new ModalBuilder()
                    .setCustomId(`whatsapp_send_message_${recipientType}_${recipientId}`)
                    .setTitle(`Send message to ${recipientName}`);

                const messageInput = new TextInputBuilder()
                    .setCustomId('message_text')
                    .setLabel('Message')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Type your message here...')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(messageInput)
                );

                await interaction.showModal(modal);
            }
            else if (customId === 'whatsapp_schedule_select_contact') {
                // Show schedule message modal
                const contact = contacts.find(c => c.id === selectedId);
                if (!contact) {
                    return interaction.reply({
                        content: '❌ Contact not found.',
                        ephemeral: true
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`whatsapp_schedule_message_${selectedId}`)
                    .setTitle(`Schedule message to ${contact.name}`);

                const messageInput = new TextInputBuilder()
                    .setCustomId('message_text')
                    .setLabel('Message')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder('Type your message here...')
                    .setRequired(true);

                const timeInput = new TextInputBuilder()
                    .setCustomId('schedule_time')
                    .setLabel('Schedule Time (minutes from now)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('e.g., 30 for 30 minutes')
                    .setRequired(true);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(messageInput),
                    new ActionRowBuilder().addComponents(timeInput)
                );

                await interaction.showModal(modal);
            }
            else if (customId === 'whatsapp_edit_select_contact') {
                // Show edit modal
                const contact = contacts.find(c => c.id === selectedId);
                if (!contact) {
                    return interaction.reply({
                        content: '❌ Contact not found.',
                        ephemeral: true
                    });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`whatsapp_edit_contact_modal_${selectedId}`)
                    .setTitle(`Edit ${contact.name}`);

                const nameInput = new TextInputBuilder()
                    .setCustomId('contact_name')
                    .setLabel('Contact Name')
                    .setStyle(TextInputStyle.Short)
                    .setValue(contact.name)
                    .setRequired(true);

                const numberInput = new TextInputBuilder()
                    .setCustomId('contact_number')
                    .setLabel('Phone Number')
                    .setStyle(TextInputStyle.Short)
                    .setValue(contact.number)
                    .setRequired(true);

                const notesInput = new TextInputBuilder()
                    .setCustomId('contact_notes')
                    .setLabel('Notes')
                    .setStyle(TextInputStyle.Paragraph)
                    .setValue(contact.notes || '')
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(nameInput),
                    new ActionRowBuilder().addComponents(numberInput),
                    new ActionRowBuilder().addComponents(notesInput)
                );

                await interaction.showModal(modal);
            }
            else if (customId === 'whatsapp_delete_select_contact') {
                // Confirm deletion
                const contact = contacts.find(c => c.id === selectedId);
                if (!contact) {
                    return interaction.reply({
                        content: '❌ Contact not found.',
                        ephemeral: true
                    });
                }

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`whatsapp_confirm_delete_${selectedId}`)
                        .setLabel('Confirm Delete')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('whatsapp_cancel_delete')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                );

                return interaction.update({
                    content: `⚠️ Are you sure you want to delete **${contact.name}** (${contact.number})?`,
                    components: [confirmRow]
                });
            }
            else if (customId === 'whatsapp_add_members_to_group') {
                // After group is created, show contact selection for adding members
                const groupId = selectedId;
                const group = groups.find(g => g.id === groupId);

                if (!group) {
                    return interaction.reply({
                        content: '❌ Group not found.',
                        ephemeral: true
                    });
                }

                // Show available contacts (not already in group)
                const availableContacts = contacts.filter(c => !group.members.includes(c.id));

                if (availableContacts.length === 0) {
                    return interaction.reply({
                        content: '❌ All contacts are already in this group.',
                        ephemeral: true
                    });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId(`whatsapp_select_member_for_${groupId}`)
                    .setPlaceholder('Select contact to add to group')
                    .setMaxValues(Math.min(availableContacts.length, 10)) // Allow multiple selections
                    .addOptions(
                        availableContacts.map(contact => ({
                            label: contact.name,
                            description: contact.number,
                            value: contact.id
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.reply({
                    content: `👥 Select contacts to add to **${group.name}**:`,
                    components: [row],
                    ephemeral: true
                });
            }
            else if (customId.startsWith('whatsapp_select_member_for_')) {
                // Add selected contacts to group
                const groupId = customId.replace('whatsapp_select_member_for_', '');
                const group = groups.find(g => g.id === groupId);

                if (!group) {
                    return interaction.reply({
                        content: '❌ Group not found.',
                        ephemeral: true
                    });
                }

                // Get all selected contact IDs
                const selectedContactIds = interaction.values;

                // Add to group members
                selectedContactIds.forEach(contactId => {
                    if (!group.members.includes(contactId)) {
                        group.members.push(contactId);
                    }
                });

                saveGroups();

                const addedNames = selectedContactIds.map(id => {
                    const contact = contacts.find(c => c.id === id);
                    return contact ? contact.name : 'Unknown';
                }).join(', ');

                return interaction.update({
                    content: `✅ Added ${selectedContactIds.length} contact(s) to **${group.name}**: ${addedNames}`,
                    components: []
                });
            }
            else if (customId === 'whatsapp_edit_group_select') {
                // Show edit options for selected group
                const group = groups.find(g => g.id === selectedId);
                if (!group) {
                    return interaction.reply({
                        content: '❌ Group not found.',
                        ephemeral: true
                    });
                }

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`whatsapp_rename_group_${selectedId}`)
                        .setLabel('Rename Group')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✏️'),
                    new ButtonBuilder()
                        .setCustomId(`whatsapp_manage_members_${selectedId}`)
                        .setLabel('Manage Members')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('👥')
                );

                return interaction.update({
                    content: `📝 Edit **${group.name}**:\n\n👥 Current members: ${group.members.length}`,
                    components: [row]
                });
            }
            else if (customId === 'whatsapp_delete_group_select') {
                // Confirm group deletion
                const group = groups.find(g => g.id === selectedId);
                if (!group) {
                    return interaction.reply({
                        content: '❌ Group not found.',
                        ephemeral: true
                    });
                }

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`whatsapp_confirm_delete_group_${selectedId}`)
                        .setLabel('Confirm Delete')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('whatsapp_cancel_delete')
                        .setLabel('Cancel')
                        .setStyle(ButtonStyle.Secondary)
                );

                return interaction.update({
                    content: `⚠️ Are you sure you want to delete group **${group.name}** with ${group.members.length} members?`,
                    components: [confirmRow]
                });
            }
            else if (customId.startsWith('whatsapp_remove_member_from_')) {
                // Remove selected members from group
                const groupId = customId.replace('whatsapp_remove_member_from_', '');
                const group = groups.find(g => g.id === groupId);

                if (!group) {
                    return interaction.reply({
                        content: '❌ Group not found.',
                        ephemeral: true
                    });
                }

                // Get all selected contact IDs to remove
                const selectedContactIds = interaction.values;

                // Remove from group members
                group.members = group.members.filter(memberId => !selectedContactIds.includes(memberId));

                saveGroups();

                const removedNames = selectedContactIds.map(id => {
                    const contact = contacts.find(c => c.id === id);
                    return contact ? contact.name : 'Unknown';
                }).join(', ');

                return interaction.update({
                    content: `✅ Removed ${selectedContactIds.length} member(s) from **${group.name}**: ${removedNames}`,
                    components: []
                });
            }
        },
        handleModal: async function (interaction) {
            const customId = interaction.customId;

            if (customId === 'whatsapp_add_contact_modal') {
                const name = interaction.fields.getTextInputValue('contact_name');
                const number = interaction.fields.getTextInputValue('contact_number');
                const notes = interaction.fields.getTextInputValue('contact_notes') || '';

                const newContact = {
                    id: `contact_${Date.now()}`,
                    name,
                    number: number.replace(/[^\d+]/g, ''),
                    notes,
                    createdAt: Date.now()
                };

                contacts.push(newContact);
                saveContacts();

                return interaction.reply({
                    content: `✅ Contact **${name}** added successfully!`,
                    ephemeral: true
                });
            }
            else if (customId.startsWith('whatsapp_send_message_')) {
                // Parse customId to determine if it's a contact or group
                // Format: whatsapp_send_message_contact_1234567890 or whatsapp_send_message_group_1234567890
                const remaining = customId.replace('whatsapp_send_message_', '');
                const parts = remaining.split('_');
                const type = parts[0]; // 'contact' or 'group'
                // Reconstruct the full ID (everything after the type)
                const fullId = `${type}_${parts.slice(1).join('_')}`;

                const message = interaction.fields.getTextInputValue('message_text');
                const channelId = interaction.channelId;

                await interaction.deferReply({ ephemeral: true });

                try {
                    if (type === 'contact') {
                        const contact = contacts.find(c => c.id === fullId);
                        if (!contact) {
                            return interaction.editReply({
                                content: '❌ Contact not found.',
                                ephemeral: true
                            });
                        }

                        await sendWhatsAppMessage(contact.number, message, contact.name, channelId);

                        return interaction.editReply({
                            content: `✅ Message sent to **${contact.name}**!\n\n📱 *Monitoring for replies in the next 5 minutes...*`,
                            ephemeral: true
                        });
                    } else if (type === 'group') {
                        const group = groups.find(g => g.id === fullId);
                        if (!group) {
                            return interaction.editReply({
                                content: '❌ Group not found.',
                                ephemeral: true
                            });
                        }

                        // Send message to all group members
                        let successCount = 0;
                        let failCount = 0;

                        for (const memberId of group.members) {
                            const contact = contacts.find(c => c.id === memberId);
                            if (contact) {
                                try {
                                    await sendWhatsAppMessage(contact.number, message, contact.name, channelId);
                                    successCount++;
                                } catch (error) {
                                    console.error(`Failed to send to ${contact.name}:`, error);
                                    failCount++;
                                }
                            }
                        }

                        return interaction.editReply({
                            content: `✅ Group message sent to **${group.name}**!\n\n📊 Success: ${successCount} | Failed: ${failCount}\n\n📱 *Monitoring for replies in the next 5 minutes...*`,
                            ephemeral: true
                        });
                    }
                } catch (error) {
                    console.error('Error sending WhatsApp message:', error);
                    return interaction.editReply({
                        content: `❌ Failed to send message: ${error.message}`,
                        ephemeral: true
                    });
                }
            }
            else if (customId === 'whatsapp_create_group_modal') {
                const groupName = interaction.fields.getTextInputValue('group_name');

                const newGroup = {
                    id: `group_${Date.now()}`,
                    name: groupName,
                    members: [],
                    createdAt: Date.now(),
                    createdBy: interaction.user.id
                };

                groups.push(newGroup);
                saveGroups();

                // Now show contact selection to add members
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('whatsapp_add_members_to_group')
                    .setPlaceholder('Select the group to add members')
                    .addOptions([{
                        label: groupName,
                        description: 'Just created - 0 members',
                        value: newGroup.id
                    }]);

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return interaction.reply({
                    content: `✅ Group **${groupName}** created!\n\nNow add contacts to this group:`,
                    components: [row],
                    ephemeral: true
                });
            }
            else if (customId.startsWith('whatsapp_schedule_message_')) {
                const contactId = customId.replace('whatsapp_schedule_message_', '');
                const contact = contacts.find(c => c.id === contactId);

                if (!contact) {
                    return interaction.reply({
                        content: '❌ Contact not found.',
                        ephemeral: true
                    });
                }

                const message = interaction.fields.getTextInputValue('message_text');
                const minutes = parseInt(interaction.fields.getTextInputValue('schedule_time'));

                if (isNaN(minutes) || minutes <= 0) {
                    return interaction.reply({
                        content: '❌ Invalid time. Please enter a positive number of minutes.',
                        ephemeral: true
                    });
                }

                const scheduledTime = Date.now() + (minutes * 60 * 1000);

                const scheduledMessage = {
                    id: `scheduled_${Date.now()}`,
                    contactId: contact.id,
                    contactName: contact.name,
                    phoneNumber: contact.number,
                    message,
                    scheduledTime,
                    sent: false,
                    createdAt: Date.now(),
                    createdBy: interaction.user.id
                };

                scheduledMessages.push(scheduledMessage);
                saveScheduledMessages();

                const scheduleDate = new Date(scheduledTime);

                return interaction.reply({
                    content: `✅ Message scheduled to **${contact.name}** for ${scheduleDate.toLocaleString()}`,
                    ephemeral: true
                });
            }
            else if (customId.startsWith('whatsapp_edit_contact_modal_')) {
                const contactId = customId.replace('whatsapp_edit_contact_modal_', '');
                const contactIndex = contacts.findIndex(c => c.id === contactId);

                if (contactIndex === -1) {
                    return interaction.reply({
                        content: '❌ Contact not found.',
                        ephemeral: true
                    });
                }

                const name = interaction.fields.getTextInputValue('contact_name');
                const number = interaction.fields.getTextInputValue('contact_number');
                const notes = interaction.fields.getTextInputValue('contact_notes') || '';

                contacts[contactIndex] = {
                    ...contacts[contactIndex],
                    name,
                    number: number.replace(/[^\d+]/g, ''),
                    notes,
                    updatedAt: Date.now()
                };

                saveContacts();

                return interaction.reply({
                    content: `✅ Contact **${name}** updated successfully!`,
                    ephemeral: true
                });
            }
        }
    }
];



