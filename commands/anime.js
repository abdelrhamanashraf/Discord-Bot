const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
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
            { name: 'Studios', value: formattedData.studios, inline: false },
            {name:'View on MyAnimeList',value: formattedData.url,inline: false}
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
                    .setLabel('Select Anime for Details')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error fetching current season anime:', error);
        await interaction.editReply('There was an error fetching the current season anime. Please try again later.');
    }
}

// Handle the top anime command (now with optional genre parameter)
async function handleTopAnime(interaction) {
    await interaction.deferReply();
    
    const genre = interaction.options.getString('genre');
    
    try {
        let data;
        let animeList;
        let title;
        let description;
        
        if (genre) {
            // First, get the genre ID from the name
            const genresData = await apiRequest('/genres/anime');
            const genres = genresData.data;
            
            const genreObj = genres.find(g => g.name.toLowerCase() === genre.toLowerCase());
            
            if (!genreObj) {
                return interaction.editReply(`Genre "${genre}" not found. Please try a different genre.`);
            }
            
            // Now get anime by genre ID
            data = await apiRequest(`/anime?genres=${genreObj.mal_id}&order_by=score&sort=desc&limit=10`);
            animeList = data.data;
            title = `🎭 Top ${genre} Anime`;
            description = `Here are the top rated ${genre} anime:`;
            
            // Store the genre results for button interactions
            interaction.client.animeGenreResults = interaction.client.animeGenreResults || new Map();
            interaction.client.animeGenreResults.set(interaction.user.id, {
                animeList,
                genreName: genre
            });
        } else {
            // Default behavior - get overall top anime
            data = await apiRequest('/top/anime?limit=10');
            animeList = data.data;
            title = '🏆 Top Anime';
            description = 'Here are the top rated anime of all time:';
        }
        
        if (animeList.length === 0) {
            return interaction.editReply(genre ? `No anime found for genre: "${genre}"` : 'No top anime found.');
        }
        
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor('#FF6F61')
            .setDescription(description)
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
        
        const customId = genre ? 'anime_more_genre' : 'anime_more_top';
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(customId)
                    .setLabel('Select Anime for Details')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error fetching top anime:', error);
        await interaction.editReply(genre ? 
            `There was an error fetching anime for genre "${genre}". Please try again later.` : 
            'There was an error fetching the top anime. Please try again later.');
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

// Handle the anime by season command
async function handleAnimeBySeason(interaction) {
    const year = interaction.options.getInteger('year');
    const season = interaction.options.getString('season');
    
    await interaction.deferReply();
    
    try {
        const data = await apiRequest(`/seasons/${year}/${season.toLowerCase()}`);
        const animeList = data.data.slice(0, 10); // Get top 10 anime from the specified season
        
        if (animeList.length === 0) {
            return interaction.editReply(`No anime found for ${season} ${year}.`);
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`🍂 ${season.charAt(0).toUpperCase() + season.slice(1)} ${year} Anime`)
            .setColor('#FF6F61')
            .setDescription(`Here are the top anime from ${season} ${year}:`)
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
        
        // Store the season results for button interactions
        interaction.client.animeSeasonResults = interaction.client.animeSeasonResults || new Map();
        interaction.client.animeSeasonResults.set(interaction.user.id, {
            animeList,
            year,
            season
        });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('anime_more_season')
                    .setLabel('Select Anime for Details')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error fetching anime by season:', error);
        await interaction.editReply(`There was an error fetching anime for ${season} ${year}. Please try again later.`);
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
    else if (customId === 'anime_more_current' || customId === 'anime_more_top' || 
             customId === 'anime_more_season' || customId === 'anime_more_genre') {
        // Create a modal for selecting an anime from current season, top anime, specific season, or genre
        const modalId = customId === 'anime_more_current' ? 'anime_current_modal' : 
                        customId === 'anime_more_top' ? 'anime_top_modal' : 
                        customId === 'anime_more_season' ? 'anime_season_modal' : 'anime_genre_modal';
        
        const modal = new ModalBuilder()
            .setCustomId(modalId)
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
    else if (customId === 'anime_season_modal') {
        const animeNumber = parseInt(interaction.fields.getTextInputValue('anime_number'));
        
        if (isNaN(animeNumber) || animeNumber < 1 || animeNumber > 10) {
            return interaction.reply({ content: 'Please enter a valid number between 1 and 10.', ephemeral: true });
        }
        
        try {
            const seasonData = interaction.client.animeSeasonResults.get(interaction.user.id);
            
            if (!seasonData || !seasonData.animeList || !seasonData.animeList[animeNumber - 1]) {
                return interaction.reply({ content: 'Could not find the selected anime. Please try searching again.', ephemeral: true });
            }
            
            const selectedAnime = seasonData.animeList[animeNumber - 1];
            const embed = createAnimeEmbed(selectedAnime);
            
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Error fetching anime details:', error);
            await interaction.reply({ content: 'There was an error fetching the anime details. Please try again later.', ephemeral: true });
        }
    }
    else if (customId === 'anime_genre_modal') {
        const animeNumber = parseInt(interaction.fields.getTextInputValue('anime_number'));
        
        if (isNaN(animeNumber) || animeNumber < 1 || animeNumber > 10) {
            return interaction.reply({ content: 'Please enter a valid number between 1 and 10.', ephemeral: true });
        }
        
        try {
            const genreData = interaction.client.animeGenreResults.get(interaction.user.id);
            
            if (!genreData || !genreData.animeList || !genreData.animeList[animeNumber - 1]) {
                return interaction.reply({ content: 'Could not find the selected anime. Please try searching again.', ephemeral: true });
            }
            
            const selectedAnime = genreData.animeList[animeNumber - 1];
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
        description: 'Get a list of top-rated anime, optionally filtered by genre',
        options: [
            {
                name: 'genre',
                type: 3, // STRING
                description: 'Filter by genre (e.g., Action, Romance, Comedy)',
                required: false
            }
        ],
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
    },
    {
        name: 'anime-season',
        description: 'Get anime from a specific year and season',
        options: [
            {
                name: 'year',
                type: 4, // INTEGER
                description: 'The year (e.g., 2023)',
                required: true
            },
            {
                name: 'season',
                type: 3, // STRING
                description: 'The season (winter, spring, summer, fall)',
                required: true,
                choices: [
                    { name: 'Winter', value: 'winter' },
                    { name: 'Spring', value: 'spring' },
                    { name: 'Summer', value: 'summer' },
                    { name: 'Fall', value: 'fall' }
                ]
            }
        ],
        execute: handleAnimeBySeason,
        handleButton: handleButton,
        handleModal: handleModal
    }
];