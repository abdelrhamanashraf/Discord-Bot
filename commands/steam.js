const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

// Steam API key should be in your .env file
const STEAM_API_KEY = process.env.STEAM_API_KEY;

// Function to get the most played games on Steam
async function getTopGames() {
    try {
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

        return detailedGames;
    } catch (error) {
        console.error('Error fetching top games:', error);
        return null;
    }
}

// Function to get game details by appID
async function getGameDetails(appId) {
    try {
        const response = await axios.get('https://store.steampowered.com/api/appdetails', {
            params: {
                appids: appId
            }
        });

        if (!response.data || !response.data[appId] || !response.data[appId].success) {
            return null;
        }

        return response.data[appId].data;
    } catch (error) {
        console.error(`Error fetching game details for ${appId}:`, error);
        return null;
    }
}

// Function to search for games
async function searchGames(query) {
    try {
        const response = await axios.get('https://steamcommunity.com/actions/SearchApps', {
            params: {
                term: query
            }
        });

        if (!response.data || !Array.isArray(response.data)) {
            return [];
        }

        // Get detailed info for the top 5 results
        const detailedResults = await Promise.all(
            response.data.slice(0, 5).map(async (game) => {
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

        return detailedResults;
    } catch (error) {
        console.error('Error searching games:', error);
        return [];
    }
}

// Function to get top rated games by genre
async function getTopRatedByGenre(genre) {
    try {
        // First get a list of games to check
        const response = await axios.get('https://api.steampowered.com/ISteamApps/GetAppList/v2/');
        
        if (!response.data || !response.data.applist || !response.data.applist.apps) {
            return [];
        }
        
        // This is a huge list, so we'll sample some games
        const sampleApps = response.data.applist.apps
            .sort(() => 0.5 - Math.random()) // Shuffle
            .slice(0, 100); // Take 100 random games
        
        // Check each game for the genre and rating
        const genreGames = [];
        
        for (const app of sampleApps) {
            try {
                const details = await getGameDetails(app.appid);
                
                if (details && details.genres) {
                    const hasGenre = details.genres.some(g => 
                        g.description.toLowerCase() === genre.toLowerCase()
                    );
                    
                    if (hasGenre && details.metacritic && details.metacritic.score) {
                        genreGames.push({
                            appid: app.appid,
                            name: details.name,
                            score: details.metacritic.score,
                            header_image: details.header_image,
                            price: details.price_overview?.final_formatted || 'Free/Not Available'
                        });
                    }
                }
            } catch (error) {
                // Skip errors for individual games
                continue;
            }
            
            // If we have 10 games, stop searching
            if (genreGames.length >= 10) {
                break;
            }
        }
        
        // Sort by score
        return genreGames.sort((a, b) => b.score - a.score);
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
            .setDescription('Here are the current most played games on Steam:')
            .setTimestamp()
            .setFooter({ text: 'Data from Steam API' });
        
        topGames.forEach((game, index) => {
            embed.addFields({
                name: `${index + 1}. ${game.name}`,
                value: `👥 Players: ${game.player_count.toLocaleString()}\n⭐ Rating: ${game.rating}\n💰 Price: ${game.price}`
            });
        });
        
        if (topGames[0]?.header_image) {
            embed.setThumbnail(topGames[0].header_image);
        }
        
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
            // Add a button to show more results
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`steam_more_results_${query}`)
                    .setLabel('Show More Results')
                    .setStyle(ButtonStyle.Secondary)
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
            .setTitle(`🏆 Top Rated ${genre} Games on Steam`)
            .setColor('#1b2838')
            .setDescription(`Here are the top rated ${genre} games on Steam:`)
            .setTimestamp()
            .setFooter({ text: 'Data from Steam API' });
        
        topRatedGames.forEach((game, index) => {
            embed.addFields({
                name: `${index + 1}. ${game.name}`,
                value: `⭐ Metacritic: ${game.score}/100\n💰 Price: ${game.price}\n🔗 [View on Steam](https://store.steampowered.com/app/${game.appid})`
            });
        });
        
        if (topRatedGames[0]?.header_image) {
            embed.setThumbnail(topRatedGames[0].header_image);
        }
        
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