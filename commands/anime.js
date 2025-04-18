const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');

// Base URL for Jikan API (unofficial MyAnimeList API)
const API_BASE_URL = 'https://api.jikan.moe/v4';

// Cooldown to avoid rate limiting (Jikan API has a limit of 3 requests per second)
const apiCooldown = new Map();
const COOLDOWN_MS = 400; // Wait 400ms between requests

// Helper function to handle API requests with cooldown
async function apiRequest(endpoint) {
    // Check if we need to wait before making another request
    const now = Date.now();
    const lastRequest = apiCooldown.get('lastRequest') || 0;
    const timeToWait = Math.max(0, lastRequest + COOLDOWN_MS - now);
    
    if (timeToWait > 0) {
        await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    
    // Update the last request time
    apiCooldown.set('lastRequest', Date.now());
    
    try {
        const response = await axios.get(`${API_BASE_URL}${endpoint}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching from Jikan API (${endpoint}):`, error.message);
        throw error;
    }
}

// Format anime data for display in embeds
function formatAnimeData(anime) {
    const genres = anime.genres?.map(g => g.name).join(', ') || 'N/A';
    const studios = anime.studios?.map(s => s.name).join(', ') || 'N/A';
    const score = anime.score ? `${anime.score}/10` : 'N/A';
    const episodes = anime.episodes || 'N/A';
    const status = anime.status || 'N/A';
    const aired = anime.aired?.string || 'N/A';
    
    return {
        title: anime.title || 'Unknown Title',
        titleEnglish: anime.title_english || anime.title,
        url: anime.url,
        imageUrl: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url,
        synopsis: anime.synopsis || 'No synopsis available.',
        genres,
        studios,
        score,
        episodes,
        status,
        aired,
        type: anime.type || 'N/A',
        rating: anime.rating || 'N/A'
    };
}

// Create an embed for a single anime
function createAnimeEmbed(anime, embedColor = '#FF6F61') {
    const formattedData = formatAnimeData(anime);
    
    const embed = new EmbedBuilder()
        .setTitle(formattedData.title)
        .setURL(formattedData.url)
        .setColor(embedColor)
        .setDescription(formattedData.synopsis?.substring(0, 300) + (formattedData.synopsis?.length > 300 ? '...' : ''))
        .setThumbnail(formattedData.imageUrl)
        .addFields(
            { name: 'English Title', value: formattedData.titleEnglish || 'N/A', inline: true },
            { name: 'Type', value: formattedData.type, inline: true },
            { name: 'Episodes', value: formattedData.episodes.toString(), inline: true },
            { name: 'Status', value: formattedData.status, inline: true },
            { name: 'Score', value: formattedData.score, inline: true },
            { name: 'Rating', value: formattedData.rating, inline: true },
            { name: 'Aired', value: formattedData.aired, inline: false },
            { name: 'Genres', value: formattedData.genres, inline: false },
            { name: 'Studios', value: formattedData.studios, inline: false }
        )
        .setFooter({ text: 'Data from MyAnimeList via Jikan API' })
        .setTimestamp();
    
    return embed;
}

// Handle the current season anime command
async function handleCurrentSeason(interaction) {
    await interaction.deferReply();
    
    try {
        const data = await apiRequest('/seasons/now');
        const animeList = data.data.slice(0, 10); // Get top 10 anime from current season
        
        if (animeList.length === 0) {
            return interaction.editReply('No anime found for the current season.');
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🌸 Current Season Anime')
            .setColor('#FF6F61')
            .setDescription('Here are the top anime from the current season:')
            .setFooter({ text: 'Data from MyAnimeList via Jikan API' })
            .setTimestamp();
        
        animeList.forEach((anime, index) => {
            const formattedData = formatAnimeData(anime);
            embed.addFields({
                name: `${index + 1}. ${formattedData.title}`,
                value: `**Score:** ${formattedData.score} | **Episodes:** ${formattedData.episodes} | **Type:** ${formattedData.type}\n` +
                      `**Genres:** ${formattedData.genres}\n` +
                      `[View on MyAnimeList](${formattedData.url})`
            });
        });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('anime_more_current')
                    .setLabel('View More Details')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error fetching current season anime:', error);
        await interaction.editReply('There was an error fetching the current season anime. Please try again later.');
    }
}

// Handle the top anime command
async function handleTopAnime(interaction) {
    await interaction.deferReply();
    
    try {
        const data = await apiRequest('/top/anime?limit=10');
        const animeList = data.data;
        
        if (animeList.length === 0) {
            return interaction.editReply('No top anime found.');
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🏆 Top Anime')
            .setColor('#FF6F61')
            .setDescription('Here are the top rated anime of all time:')
            .setFooter({ text: 'Data from MyAnimeList via Jikan API' })
            .setTimestamp();
        
        animeList.forEach((anime, index) => {
            const formattedData = formatAnimeData(anime);
            embed.addFields({
                name: `${index + 1}. ${formattedData.title}`,
                value: `**Score:** ${formattedData.score} | **Episodes:** ${formattedData.episodes} | **Type:** ${formattedData.type}\n` +
                      `**Genres:** ${formattedData.genres}\n` +
                      `[View on MyAnimeList](${formattedData.url})`
            });
        });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('anime_more_top')
                    .setLabel('View More Details')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error fetching top anime:', error);
        await interaction.editReply('There was an error fetching the top anime. Please try again later.');
    }
}

// Handle the anime search command
async function handleAnimeSearch(interaction) {
    const query = interaction.options.getString('query');
    
    await interaction.deferReply();
    
    try {
        const data = await apiRequest(`/anime?q=${encodeURIComponent(query)}&limit=10`);
        const animeList = data.data;
        
        if (animeList.length === 0) {
            return interaction.editReply(`No anime found for query: "${query}"`);
        }
        
        // If only one result, show detailed view
        if (animeList.length === 1) {
            const embed = createAnimeEmbed(animeList[0]);
            return interaction.editReply({ embeds: [embed] });
        }
        
        // Otherwise, show list of results
        const embed = new EmbedBuilder()
            .setTitle(`🔍 Search Results for "${query}"`)
            .setColor('#FF6F61')
            .setDescription(`Found ${animeList.length} results:`)
            .setFooter({ text: 'Data from MyAnimeList via Jikan API' })
            .setTimestamp();
        
        animeList.forEach((anime, index) => {
            const formattedData = formatAnimeData(anime);
            embed.addFields({
                name: `${index + 1}. ${formattedData.title}`,
                value: `**Score:** ${formattedData.score} | **Episodes:** ${formattedData.episodes} | **Type:** ${formattedData.type}\n` +
                      `**Genres:** ${formattedData.genres}\n` +
                      `[View on MyAnimeList](${formattedData.url})`
            });
        });
        
        // Store the search results for button interactions
        interaction.client.animeSearchResults = interaction.client.animeSearchResults || new Map();
        interaction.client.animeSearchResults.set(interaction.user.id, animeList);
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('anime_select')
                    .setLabel('Select Anime for Details')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error searching for anime:', error);
        await interaction.editReply(`There was an error searching for "${query}". Please try again later.`);
    }
}

// Handle button interactions
async function handleButton(interaction) {
    const customId = interaction.customId;
    
    if (customId === 'anime_select') {
        // Create a modal for selecting an anime from search results
        const modal = new ModalBuilder()
            .setCustomId('anime_select_modal')
            .setTitle('Select Anime');
        
        const animeNumberInput = new TextInputBuilder()
            .setCustomId('anime_number')
            .setLabel('Enter the number of the anime (1-10)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(2);
        
        const firstActionRow = new ActionRowBuilder().addComponents(animeNumberInput);
        modal.addComponents(firstActionRow);
        
        await interaction.showModal(modal);
    } 
    else if (customId === 'anime_more_current' || customId === 'anime_more_top') {
        // Create a modal for selecting an anime from current season or top anime
        const modal = new ModalBuilder()
            .setCustomId(customId === 'anime_more_current' ? 'anime_current_modal' : 'anime_top_modal')
            .setTitle('Select Anime');
        
        const animeNumberInput = new TextInputBuilder()
            .setCustomId('anime_number')
            .setLabel('Enter the number of the anime (1-10)')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMinLength(1)
            .setMaxLength(2);
        
        const firstActionRow = new ActionRowBuilder().addComponents(animeNumberInput);
        modal.addComponents(firstActionRow);
        
        await interaction.showModal(modal);
    }
}

// Handle modal submissions
async function handleModal(interaction) {
    const customId = interaction.customId;
    
    if (customId === 'anime_select_modal') {
        const animeNumber = parseInt(interaction.fields.getTextInputValue('anime_number'));
        
        if (isNaN(animeNumber) || animeNumber < 1 || animeNumber > 10) {
            return interaction.reply({ content: 'Please enter a valid number between 1 and 10.', ephemeral: true });
        }
        
        const searchResults = interaction.client.animeSearchResults.get(interaction.user.id);
        
        if (!searchResults || !searchResults[animeNumber - 1]) {
            return interaction.reply({ content: 'Could not find the selected anime. Please try searching again.', ephemeral: true });
        }
        
        const selectedAnime = searchResults[animeNumber - 1];
        const embed = createAnimeEmbed(selectedAnime);
        
        await interaction.reply({ embeds: [embed] });
    }
    else if (customId === 'anime_current_modal') {
        const animeNumber = parseInt(interaction.fields.getTextInputValue('anime_number'));
        
        if (isNaN(animeNumber) || animeNumber < 1 || animeNumber > 10) {
            return interaction.reply({ content: 'Please enter a valid number between 1 and 10.', ephemeral: true });
        }
        
        try {
            const data = await apiRequest('/seasons/now');
            const animeList = data.data;
            
            if (!animeList || !animeList[animeNumber - 1]) {
                return interaction.reply({ content: 'Could not find the selected anime. Please try again.', ephemeral: true });
            }
            
            const selectedAnime = animeList[animeNumber - 1];
            const embed = createAnimeEmbed(selectedAnime);
            
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching anime details:', error);
            await interaction.reply({ content: 'There was an error fetching the anime details. Please try again later.', ephemeral: true });
        }
    }
    else if (customId === 'anime_top_modal') {
        const animeNumber = parseInt(interaction.fields.getTextInputValue('anime_number'));
        
        if (isNaN(animeNumber) || animeNumber < 1 || animeNumber > 10) {
            return interaction.reply({ content: 'Please enter a valid number between 1 and 10.', ephemeral: true });
        }
        
        try {
            const data = await apiRequest('/top/anime?limit=10');
            const animeList = data.data;
            
            if (!animeList || !animeList[animeNumber - 1]) {
                return interaction.reply({ content: 'Could not find the selected anime. Please try again.', ephemeral: true });
            }
            
            const selectedAnime = animeList[animeNumber - 1];
            const embed = createAnimeEmbed(selectedAnime);
            
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching anime details:', error);
            await interaction.reply({ content: 'There was an error fetching the anime details. Please try again later.', ephemeral: true });
        }
    }
}

module.exports = [
    {
        name: 'anime-current',
        description: 'Get a list of anime from the current season',
        execute: handleCurrentSeason,
        handleButton: handleButton,
        handleModal: handleModal
    },
    {
        name: 'anime-top',
        description: 'Get a list of top-rated anime',
        execute: handleTopAnime,
        handleButton: handleButton,
        handleModal: handleModal
    },
    {
        name: 'anime-search',
        description: 'Search for an anime by name',
        options: [
            {
                name: 'query',
                type: 3, // STRING
                description: 'The anime title to search for',
                required: true
            }
        ],
        execute: handleAnimeSearch,
        handleButton: handleButton,
        handleModal: handleModal
    }
];