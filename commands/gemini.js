const { ApplicationCommandOptionType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
require('dotenv').config();

// Initialize Google AI with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Store active chat sessions and their associated collectors (userId -> { chat, collector })
const activeSessions = new Map();

// --- Configuration ---
const DEFAULT_MODEL = "gemini-2.5-flash";
const IDLE_TIMEOUT = 300000; // 5 minutes

// --- Helper Functions ---

/**
 * Gets a GenerativeModel instance for starting a new chat.
 */
function getGenerativeModel(modelName = DEFAULT_MODEL) {
    if (modelName === "sonar-pro") {
        return new OpenAI({
            apiKey: process.env.PERPLEXITY_API_KEY,
            baseURL: 'https://api.perplexity.ai',
            model: "sonar-pro"
        });
    }
    return genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
        }
    });
}

/**
 * Sends a message to the Gemini chat session and returns the text response.
 */
async function sendAIResponse(message, chat, modelName = DEFAULT_MODEL) {
    try {
        if (modelName === "sonar-pro") {
            const completion = await chat.chat.completions.create({
                messages: [{ role: "user", content: message }],
                model: "sonar-pro",
                temperature: 0.9,
                max_tokens: 2048
            });
            return completion.choices[0].message.content;
        } else {
            const result = await chat.sendMessage(message);
            return result.response.text();
        }
    } catch (error) {
        console.error('Error getting AI response:', error);
        throw error;
    }
}

/**
 * Creates the "End Chat" button ActionRow.
 */
function createEndChatRow(userId) {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`end_chat_${userId}`)
                .setLabel('End Chat')
                .setStyle(ButtonStyle.Danger)
        );
}

/**
 * Sets up the collector listeners for continuous chat
 */
function setupCollectorListeners(collector, chat, interaction, userId, selectedModel) {
    collector.on('collect', async (collectedMessage) => {
        // Ignore messages sent by the bot's own collector loop
        if (collectedMessage.author.id === interaction.client.user.id) return;

        try {
            console.log(`[${userId}] Message collected: ${collectedMessage.content}`);
            
            // Respond with a "Bot is thinking..." message right away
            await collectedMessage.channel.sendTyping();

            const followUpResponseText = await sendAIResponse(collectedMessage.content, chat, selectedModel);
            const followUpRow = createEndChatRow(userId);
            
            const followUpChunks = followUpResponseText.match(/.{1,1900}/g) || [followUpResponseText];
            
            // Reply to the user's message
            for (let i = 0; i < followUpChunks.length; i++) {
                await collectedMessage.reply({
                    content: followUpChunks[i],
                    components: i === 0 ? [followUpRow] : [],
                    allowedMentions: { repliedUser: false } // Avoid pinging the user
                });
            }

            // Reset collector timer on new activity
            collector.resetTimer({ idle: IDLE_TIMEOUT });

        } catch (error) {
            console.error(`Error in collector for ${userId}:`, error);
            await collectedMessage.reply({
                content: 'Sorry, I encountered an error. The chat session has been ended.',
                allowedMentions: { repliedUser: false }
            });
            collector.stop('error');
        }
    });

    collector.on('end', (collected, reason) => {
        console.log(`Chat session ended for ${userId}. Reason: ${reason}`);
        
        // Only send a followUp if the interaction is still valid (not expired)
        if (reason === 'idle' && interaction.isRepliable()) { 
            interaction.followUp({
                content: 'Chat session ended due to inactivity (5 minutes). Start a new conversation anytime!',
                ephemeral: true
            }).catch(console.error);
        }
        activeSessions.delete(userId);
    });
}

// --- Main Command Logic ---

module.exports = {
    name: 'chat', // Top-level name property for command registration
    description: 'Chat with Gemini AI',
    data: {
        name: 'chat',
        description: 'Chat with Gemini AI',
        options: [
            {
                name: 'message',
                description: 'Your message to Gemini',
                type: ApplicationCommandOptionType.String,
                required: true
            },
            {
                name: 'private',
                description: 'Make the response private (only you can see it)',
                type: ApplicationCommandOptionType.Boolean,
                required: false
            },{
                name: 'model',
                description: 'Select the AI model to use',
                type: ApplicationCommandOptionType.String,
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
                ]
            }
           
        ]
    },

    async execute(interaction) {
        console.log('Executing chat command...');
        const userId = interaction.user.id;
        const isPrivate = interaction.options.getBoolean('private') ?? false;

        try {
            await interaction.deferReply({ ephemeral: isPrivate });

            const message = interaction.options.getString('message');
            const endSession = interaction.options.getBoolean('end_session');

            // 1. Handle explicit session end request
            if (endSession) {
                if (activeSessions.has(userId)) {
                    activeSessions.get(userId).collector.stop('manual_end'); // Stop the collector
                    activeSessions.delete(userId);
                    await interaction.editReply('Your chat session has been ended. Start a new conversation anytime!');
                } else {
                    await interaction.editReply("You don't have an active chat session to end.");
                }
                return;
            }

            // If a session exists, stop its collector before creating a new one
            if (activeSessions.has(userId)) {
                activeSessions.get(userId).collector.stop('new_command');
                activeSessions.delete(userId); // Ensure a clean start
            }

            // 2. Start a new chat session and get the initial response
            const selectedModel = interaction.options.getString('model') || DEFAULT_MODEL;
            const model = getGenerativeModel(selectedModel);
            const chat = selectedModel === 'sonar-pro' ? model : model.startChat({});
            
            const responseText = await sendAIResponse(message, chat, selectedModel);
            const endChatRow = createEndChatRow(userId);
            
            const chunks = responseText.match(/.{1,1900}/g) || [responseText];
            
            // Send the first chunk with the button
            await interaction.editReply({
                content: chunks[0],
                components: [endChatRow]
            });

            // Send subsequent chunks as follow-up messages
            for (let i = 1; i < chunks.length; i++) {
                await interaction.followUp({
                    content: chunks[i],
                    ephemeral: isPrivate
                });
            }

            // Only set up message collector for public messages
            if (!isPrivate) {
                // Set up the continuous message collector
                const collector = interaction.channel.createMessageCollector({ 
                    filter: m => m.author.id === userId && !m.author.bot && !m.content.startsWith('/'),
                    idle: IDLE_TIMEOUT,
                    componentType: ComponentType.Button
                });
                
                // Store the new session and collector
                activeSessions.set(userId, { chat, collector });

                // Set up collector listeners
                setupCollectorListeners(collector, chat, interaction, userId, selectedModel);
            } else {
                // For private messages, don't store the session
                console.log(`Private message response completed for ${userId}`);
            }


            // Collector listeners are now set up in the setupCollectorListeners function

        } catch (error) {
            console.error('Fatal Error in execute:', error);
            const errorMessage = 'Sorry, I encountered a critical error. Please try again.';
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.editReply(errorMessage);
            }
            if (activeSessions.has(userId)) {
                activeSessions.get(userId).collector.stop('fatal_error');
                activeSessions.delete(userId);
            }
        }
    },

    // --- Button Handler Logic ---
    async handleButton(interaction) {
        if (!interaction.customId.startsWith('end_chat_')) {
            console.log('Not a chat button interaction');
            return;
        }

        const buttonUserId = interaction.customId.split('_')[2];
        const interactionUserId = interaction.user.id;

        // 1. Authorization check
        if (buttonUserId !== interactionUserId) {
            await interaction.reply({
                content: 'Only the person who started the chat can end it.',
                ephemeral: true
            });
            return;
        }

        // 2. Stop the collector and remove the session
        if (activeSessions.has(interactionUserId)) {
            activeSessions.get(interactionUserId).collector.stop('button_press');
            activeSessions.delete(interactionUserId);

            await interaction.reply({
                content: 'Chat session ended. You can start a new conversation anytime!',
                ephemeral: true
            });

            // 3. Update the button message to remove the button
            try {
                // Note: The interaction.message is the message the button was clicked on.
                await interaction.message.edit({
                    content: interaction.message.content,
                    components: [] // Remove the button
                });
            } catch (error) {
                console.error('Error updating message after button press:', error);
            }
        } else {
            await interaction.reply({
                content: 'This chat session has already ended or expired.',
                ephemeral: true
            });
        }
    }
};