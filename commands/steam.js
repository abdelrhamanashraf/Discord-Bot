const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { getCachedData, setCachedData } = require('../utils/cacheManager');
require('dotenv').config();

// Steam API key should be in your .env file
const STEAM_API_KEY = process.env.STEAM_API_KEY;

// Cache expiration times
const CACHE_TIMES = {
    TOP_GAMES: 345600000,     // 4 days for top games
    GAME_DETAILS: 345600000, // 4 days for game details
    SEARCH: 345600000,       // 4 days for search results
    GENRE: 345600000         // 4 days for genre data
};

// Function to get the most played games on Steam
async function getTopGames() {
    try {
        // Check cache first
        const cacheKey = 'steam_top_games';
        const cachedData = await getCachedData(cacheKey, CACHE_TIMES.TOP_GAMES);
        
        if (cachedData) {
            console.log('Using cached top games data');
            return cachedData;
        }
        
        console.log('Fetching fresh top games data');
        
        // Get the most played games from Steam API
        const response = await axios.get('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/', {
            params: {
                key: STEAM_API_KEY
            }
        });

        if (!response.data || !response.data.response || !response.data.response.ranks) {
            return null;
        }

        const games = response.data.response.ranks;
        
        // For each game, get additional details
        const detailedGames = await Promise.all(
            games.slice(0, 10).map(async (game) => {
                try {
                    const details = await getGameDetails(game.appid);
                    return {
                        ...game,
                        name: details?.name || `Unknown Game (${game.appid})`,
                        header_image: details?.header_image || null,
                        genres: details?.genres || [],
                        price: details?.price_overview?.final_formatted || 'Free/Not Available',
                        rating: details?.metacritic?.score || 'N/A'
                    };
                } catch (error) {
                    console.error(`Error fetching details for game ${game.appid}:`, error);
                    return {
                        ...game,
                        name: `Unknown Game (${game.appid})`,
                        header_image: null,
                        genres: [],
                        price: 'N/A',
                        rating: 'N/A'
                    };
                }
            })
        );

        // Cache the results
        await setCachedData(cacheKey, detailedGames);
        
        return detailedGames;
    } catch (error) {
        console.error('Error fetching top games:', error);
        return null;
    }
}

// Function to get game details by appID
async function getGameDetails(appId) {
    try {
        // Check cache first
        const cacheKey = `steam_game_${appId}`;
        const cachedData = await getCachedData(cacheKey, CACHE_TIMES.GAME_DETAILS);
        
        if (cachedData) {
            console.log(`Using cached data for game ${appId}`);
            return cachedData;
        }
        
        console.log(`Fetching fresh data for game ${appId}`);
        
        const response = await axios.get('https://store.steampowered.com/api/appdetails', {
            params: {
                appids: appId
            }
        });

        if (!response.data || !response.data[appId] || !response.data[appId].success) {
            return null;
        }

        const gameData = response.data[appId].data;
        
        // Cache the results
        await setCachedData(cacheKey, gameData);
        
        return gameData;
    } catch (error) {
        console.error(`Error fetching game details for ${appId}:`, error);
        return null;
    }
}

// Function to search for games
async function searchGames(query) {
    try {
        // Check cache first
        const cacheKey = `steam_search_${query.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const cachedData = await getCachedData(cacheKey, CACHE_TIMES.SEARCH);
        
        if (cachedData) {
            console.log(`Using cached search results for "${query}"`);
            return cachedData;
        }
        
        console.log(`Performing fresh search for "${query}"`);
        
        // Try the Steam community search first
        let response = await axios.get('https://steamcommunity.com/actions/SearchApps', {
            params: {
                term: query
            }
        });

        let results = [];
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
            results = response.data;
        } else {
            // If no results, try the Steam store search API
            response = await axios.get('https://store.steampowered.com/api/storesearch', {
                params: {
                    term: query,
                    l: 'english',
                    cc: 'US'
                }
            });
            
            if (response.data && response.data.items && Array.isArray(response.data.items)) {
                results = response.data.items.map(item => ({
                    appid: item.id,
                    name: item.name
                }));
            }
        }

        if (results.length === 0) {
            return [];
        }

        // Get detailed info for the top 8 results
        const detailedResults = await Promise.all(
            results.slice(0, 8).map(async (game) => {
                try {
                    const details = await getGameDetails(game.appid);
                    return {
                        ...game,
                        details
                    };
                } catch (error) {
                    console.error(`Error fetching details for search result ${game.appid}:`, error);
                    return game;
                }
            })
        );

        // Filter out games with no details
        const filteredResults = detailedResults.filter(game => game.details);
        
        // Cache the results
        await setCachedData(cacheKey, filteredResults);
        
        return filteredResults;
    } catch (error) {
        console.error('Error searching games:', error);
        return [];
    }
}

// Function to get top rated games by genre using RAWG API
async function getTopRatedByGenre(genre) {
    try {
        // Check cache first
        const cacheKey = `rawg_genre_${genre.toLowerCase().replace(/[^a-zA-Z0-9]/g, '_')}`;
        const cachedData = await getCachedData(cacheKey, CACHE_TIMES.GENRE);
        
        if (cachedData) {
            console.log(`Using cached genre data for "${genre}"`);
            return cachedData;
        }
        
        console.log(`Fetching fresh genre data for "${genre}"`);
        
        // You'll need to sign up for a free API key at https://rawg.io/apidocs
        const RAWG_API_KEY = process.env.RAWG_API_KEY; // Add this to your .env file
        
        // First, find the genre ID
        const genreResponse = await axios.get(`https://api.rawg.io/api/genres`, {
            params: {
                key: RAWG_API_KEY
            }
        });
        
        if (!genreResponse.data || !genreResponse.data.results) {
            return [];
        }
        
        // Find the genre that matches our search
        const genreData = genreResponse.data.results.find(g => 
            g.name.toLowerCase() === genre.toLowerCase()
        );
        
        if (!genreData) {
            return []; // Genre not found
        }
        
        // Get games for this genre, sorted by rating
        const gamesResponse = await axios.get(`https://api.rawg.io/api/games`, {
            params: {
                key: RAWG_API_KEY,
                genres: genreData.id,
                ordering: '-rating', // Sort by rating descending
                page_size: 10 // Limit to 10 results
            }
        });
        
        if (!gamesResponse.data || !gamesResponse.data.results) {
            return [];
        }
        
        // Format the results
        const formattedResults = gamesResponse.data.results.map(game => ({
            appid: game.id,
            name: game.name,
            score: Math.round(game.rating * 20), // Convert 5-star rating to 100-point scale
            header_image: game.background_image,
            price: 'Check on Steam', // RAWG doesn't provide pricing info
            platforms: game.platforms?.map(p => p.platform.name).join(', ') || 'Various'
        }));
        
        // Cache the results
        await setCachedData(cacheKey, formattedResults);
        
        return formattedResults;
    } catch (error) {
        console.error('Error getting top rated games by genre:', error);
        return [];
    }
}

// Command handler for top games
async function handleTopGames(interaction) {
    await interaction.deferReply();
    
    try {
        const topGames = await getTopGames();
        
        if (!topGames || topGames.length === 0) {
            return interaction.editReply('Unable to fetch top games from Steam at the moment.');
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🎮 Top 10 Most Played Games on Steam')
            .setColor('#1b2838')
            .setDescription('Here are the current most played games on Steam based on player count:')
            .setTimestamp()
            .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png')
            .setFooter({ 
                text: 'Data from Steam API • Updated just now', 
                iconURL: 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/steamworks_logo.png' 
            });
        
        // Add a separator field for better organization
        embed.addFields({ name: '───────────── TOP GAMES ─────────────', value: '\u200B' });
        
        topGames.forEach((game, index) => {
            // Add null checks and fallbacks for all properties
            const playerCount = game.player_count ? game.player_count.toLocaleString() : 'N/A';
            const rating = game.rating || 'N/A';
            const price = game.price || 'Free/Not Available';
            
            // Create medal emojis for top 3
            let medal = '';
            if (index === 0) medal = '🥇 ';
            else if (index === 1) medal = '🥈 ';
            else if (index === 2) medal = '🥉 ';
            
            embed.addFields({
                name: `${medal}${index + 1}. ${game.name}`,
                value: `👥 **Current Players:** ${playerCount}\n⭐ **Rating:** ${rating}/100\n💰 **Price:** ${price}\n🔗 [View on Steam](https://store.steampowered.com/app/${game.appid})`
            });
        });
        
        return interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error handling top games command:', error);
        return interaction.editReply('An error occurred while fetching Steam data.');
    }
}

// Command handler for game search
async function handleGameSearch(interaction) {
    const query = interaction.options.getString('query');
    
    await interaction.deferReply();
    
    try {
        const searchResults = await searchGames(query);
        
        if (!searchResults || searchResults.length === 0) {
            return interaction.editReply(`No games found matching "${query}".`);
        }
        
        const game = searchResults[0];
        const details = game.details;
        
        if (!details) {
            return interaction.editReply(`Found game "${game.name}" but couldn't fetch details.`);
        }
        
        const embed = new EmbedBuilder()
            .setTitle(details.name)
            .setColor('#1b2838')
            .setURL(`https://store.steampowered.com/app/${game.appid}`)
            .setDescription(details.short_description || 'No description available.')
            .setTimestamp();
        
        if (details.header_image) {
            embed.setImage(details.header_image);
        }
        
        // Add game details
        const fields = [];
        
        if (details.genres && details.genres.length > 0) {
            fields.push({
                name: 'Genres',
                value: details.genres.map(g => g.description).join(', '),
                inline: true
            });
        }
        
        if (details.metacritic) {
            fields.push({
                name: 'Metacritic Score',
                value: `${details.metacritic.score}/100`,
                inline: true
            });
        }
        
        if (details.price_overview) {
            fields.push({
                name: 'Price',
                value: details.price_overview.final_formatted,
                inline: true
            });
        }
        
        if (details.release_date) {
            fields.push({
                name: 'Release Date',
                value: details.release_date.date || 'Unknown',
                inline: true
            });
        }
        
        if (details.developers) {
            fields.push({
                name: 'Developers',
                value: details.developers.join(', '),
                inline: true
            });
        }
        
        if (details.publishers) {
            fields.push({
                name: 'Publishers',
                value: details.publishers.join(', '),
                inline: true
            });
        }
        
        embed.addFields(fields);
        
        // Add Steam ID
        embed.addFields({
            name: 'Steam App ID',
            value: `${game.appid}`,
            inline: true
        });
        
        // Add buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel('View on Steam')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://store.steampowered.com/app/${game.appid}`)
            );
        
        if (searchResults.length > 1) {
            // Add a button to show more results - now opens Steam search page
            row.addComponents(
                new ButtonBuilder()
                    .setLabel('Show More Results')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://store.steampowered.com/search/?term=${encodeURIComponent(query)}`)
            );
        }
        
        return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error handling game search command:', error);
        return interaction.editReply('An error occurred while searching for games.');
    }
}

// Command handler for top rated games by genre
async function handleTopRatedByGenre(interaction) {
    const genre = interaction.options.getString('genre');
    
    await interaction.deferReply();
    
    try {
        const topRatedGames = await getTopRatedByGenre(genre);
        
        if (!topRatedGames || topRatedGames.length === 0) {
            return interaction.editReply(`No top rated games found for genre "${genre}".`);
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`🏆 Top Rated ${genre} Games`)
            .setColor('#1b2838')
            .setDescription(`Discover the highest-rated ${genre} games on Steam based on Metacritic scores:`)
            .setTimestamp()
            .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/512px-Steam_icon_logo.svg.png')
            .setFooter({ 
                text: `Genre: ${genre} • Data from Steam API • Updated just now`, 
                iconURL: 'https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/steamworks_logo.png' 
            });
        
        // Add a separator field for better organization
        embed.addFields({ name: `───────────── TOP ${genre.toUpperCase()} GAMES ─────────────`, value: '\u200B' });
        
        topRatedGames.forEach((game, index) => {
            // Create medal emojis for top 3
            let medal = '';
            if (index === 0) medal = '🥇 ';
            else if (index === 1) medal = '🥈 ';
            else if (index === 2) medal = '🥉 ';
            
            // Format the score with stars based on rating
            let scoreDisplay = `${game.score}/100`;
            if (game.score >= 90) scoreDisplay = '⭐⭐⭐⭐⭐ ' + scoreDisplay;
            else if (game.score >= 80) scoreDisplay = '⭐⭐⭐⭐ ' + scoreDisplay;
            else if (game.score >= 70) scoreDisplay = '⭐⭐⭐ ' + scoreDisplay;
            else if (game.score >= 60) scoreDisplay = '⭐⭐ ' + scoreDisplay;
            else scoreDisplay = '⭐ ' + scoreDisplay;
            
            embed.addFields({
                name: `${medal}${index + 1}. ${game.name}`,
                value: `⭐ **Metacritic:** ${scoreDisplay}\n🎮 **Platforms:** ${game.platforms || 'Various'}\n💰 **Price:** ${game.price}\n🔗 [View on Steam](https://store.steampowered.com/app/${game.appid})`
            });
        });
        
        return interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error handling top rated by genre command:', error);
        return interaction.editReply('An error occurred while fetching top rated games.');
    }
}

// Button handler for showing more search results
async function handleButton(interaction) {
    if (!interaction.customId.startsWith('steam_more_results_')) {
        return;
    }
    
    await interaction.deferUpdate();
    
    const query = interaction.customId.replace('steam_more_results_', '');
    
    try {
        const searchResults = await searchGames(query);
        
        if (!searchResults || searchResults.length <= 1) {
            return interaction.editReply('No additional results found.');
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`Search Results for "${query}"`)
            .setColor('#1b2838')
            .setDescription('Here are additional search results:')
            .setTimestamp();
        
        // Skip the first result (already shown) and show the rest
        searchResults.slice(1).forEach((game, index) => {
            embed.addFields({
                name: `${index + 2}. ${game.name}`,
                value: `🔗 [View on Steam](https://store.steampowered.com/app/${game.appid})`
            });
        });
        
        return interaction.editReply({ embeds: [embed], components: [] });
    } catch (error) {
        console.error('Error handling more results button:', error);
        return interaction.editReply('An error occurred while fetching more results.');
    }
}

module.exports = [
    {
        name: 'steam-top',
        description: 'Get the top 10 most played games on Steam',
        execute: handleTopGames
    },
    {
        name: 'steam-search',
        description: 'Search for a game on Steam',
        options: [
            {
                name: 'query',
                type: 3, // STRING
                description: 'The game title to search for',
                required: true
            }
        ],
        execute: handleGameSearch,
        handleButton: handleButton
    },
    {
        name: 'steam-genre',
        description: 'Get top rated games by genre on Steam',
        options: [
            {
                name: 'genre',
                type: 3, // STRING
                description: 'The genre to search for (e.g., Action, RPG, Strategy)',
                required: true
            }
        ],
        execute: handleTopRatedByGenre
    }
];