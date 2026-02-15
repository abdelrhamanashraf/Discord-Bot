const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const axios = require('axios');
const { getCachedData, setCachedData } = require('../utils/cacheManager');
const { addToWishlist } = require('../utils/wishlistManager');

// Base URL for Jikan API (unofficial MyAnimeList API)
const API_BASE_URL = 'https://api.jikan.moe/v4';

// Cooldown to avoid rate limiting (Jikan API has a limit of 3 requests per second)
const apiCooldown = new Map();
const COOLDOWN_MS = 400; // Wait 400ms between requests
const earthSeasonIcons = {
    spring: '🌸',
    summer: '☀️',
    fall: '🍂',
    winter: '❄️'
};
const datemonth = new Date().toLocaleDateString('en-CA', { day: 'numeric', month: '2-digit' });
const seasonIcon = () => {
    if (datemonth >= '03-21' && datemonth <= '06-20') return earthSeasonIcons.spring;
    if (datemonth >= '06-21' && datemonth <= '09-22') return earthSeasonIcons.summer;
    if (datemonth >= '09-23' && datemonth <= '12-20') return earthSeasonIcons.fall;
    return earthSeasonIcons.winter;
}
console.log(`Current Season Icon: ${seasonIcon()}`);

// Cache expiration times
const CACHE_TIMES = {
    SEARCH: 345600000,
    TOP: 21600000,
    SEASON: 345600000
};

// Helper function to handle API requests with cooldown and caching
async function apiRequest(endpoint, cacheTime = CACHE_TIMES.SEARCH) {
    const cacheKey = `anime_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const cachedData = await getCachedData(cacheKey, cacheTime);
    if (cachedData) {
        console.log(`Using cached data for ${endpoint}`);
        return cachedData;
    }

    console.log(`Making API request for ${endpoint}`);

    const now = Date.now();
    const lastRequest = apiCooldown.get('lastRequest') || 0;
    const timeToWait = Math.max(0, lastRequest + COOLDOWN_MS - now);

    if (timeToWait > 0) {
        await new Promise(resolve => setTimeout(resolve, timeToWait));
    }

    apiCooldown.set('lastRequest', Date.now());

    try {
        const response = await axios.get(`${API_BASE_URL}${endpoint}`);
        await setCachedData(cacheKey, response.data);
        return response.data;
    } catch (error) {
        console.error(`Error fetching from Jikan API (${endpoint}):`, error.message);
        throw error;
    }
}

// Handle add to wishlist
async function handleAddToWishlist(interaction, category = "anime") {
    const parts = interaction.customId.split('_');
    const id = parts[3];

    try {
        const animeData = await apiRequest(`/anime/${id}`);
        const added = await addToWishlist(interaction.user.id, category, animeData.data);

        if (added) {
            await interaction.reply({
                content: `Successfully added **${animeData.data.title}** to your anime wishlist!`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: `**${animeData.data.title}** is already in your wishlist.`,
                ephemeral: true
            });
        }
    } catch (error) {
        console.error(`Error adding to wishlist:`, error.message);
        await interaction.reply({
            content: 'An error occurred while adding to wishlist.',
            ephemeral: true
        });
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
    const gurl = formattedData.title.split(' ').join('+');
    const embed = new EmbedBuilder()
        .setTitle(formattedData.title)
        .setURL(formattedData.url)
        .setColor(embedColor)
        .setDescription(formattedData.synopsis?.substring(0, 300) + (formattedData.synopsis?.length > 300 ? '...' : ''))
        .setImage(formattedData.imageUrl)
        .addFields(
            { name: 'English Title', value: formattedData.titleEnglish || 'N/A', inline: true },
            { name: 'Type', value: formattedData.type, inline: true },
            { name: 'Episodes', value: formattedData.episodes.toString(), inline: true },
            { name: 'Status', value: formattedData.status, inline: true },
            { name: 'Score', value: formattedData.score, inline: true },
            { name: 'Rating', value: formattedData.rating, inline: true },
            { name: 'Aired', value: formattedData.aired, inline: true },
            { name: 'Genres', value: formattedData.genres, inline: true },
            { name: 'Studios', value: formattedData.studios, inline: true },
            { name: 'search on witanime', value: `🔗 [search on witanime](https://witanime.day/?search_param=animes&s=${gurl})`, inline: true }
        )
        .setFooter({ text: 'Data from MyAnimeList via Jikan API' })
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`wishlist_add_anime_${anime.mal_id}`)
                .setLabel('Add to Wishlist')
                .setStyle(ButtonStyle.Success)
                .setEmoji('❤️')
        );
    return { embed, row };
}

// ── Build a select menu from a list of anime ─────────────────
function buildAnimeSelectMenu(animeList, customId) {
    const menu = new StringSelectMenuBuilder()
        .setCustomId(customId)
        .setPlaceholder('Select an anime for details…')
        .addOptions(
            animeList.slice(0, 25).map((anime, i) => {
                const formattedData = formatAnimeData(anime);
                return new StringSelectMenuOptionBuilder()
                    .setLabel(`${i + 1}. ${formattedData.title}`.substring(0, 100))
                    .setDescription(`⭐ ${formattedData.score} • ${formattedData.type} • ${formattedData.episodes} eps`.substring(0, 100))
                    .setValue(anime.mal_id.toString());
            })
        );
    return new ActionRowBuilder().addComponents(menu);
}

// ── Command handlers ─────────────────────────────────────────

// Handle the current season anime command
async function handleCurrentSeason(interaction) {
    await interaction.deferReply();

    try {
        const data = await apiRequest('/seasons/now', CACHE_TIMES.SEASON);
        const animeList = data.data.slice(0, 10);

        if (animeList.length === 0) {
            return interaction.editReply('No anime found for the current season.');
        }

        const embed = new EmbedBuilder()
            .setTitle(`${seasonIcon()}  Current Season Anime`)
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

        const selectRow = buildAnimeSelectMenu(animeList, 'anime_select_current');

        await interaction.editReply({ embeds: [embed], components: [selectRow] });
    } catch (error) {
        console.error('Error fetching current season anime:', error);
        await interaction.editReply('There was an error fetching the current season anime. Please try again later.');
    }
}

// Handle the top anime command (with optional genre parameter)
async function handleTopAnime(interaction) {
    await interaction.deferReply();

    const genre = interaction.options.getString('genre');

    try {
        let data;
        let animeList;
        let title;
        let description;

        if (genre) {
            const genresData = await apiRequest('/genres/anime', CACHE_TIMES.TOP);
            const genres = genresData.data;

            const genreObj = genres.find(g => g.name.toLowerCase() === genre.toLowerCase());

            if (!genreObj) {
                return interaction.editReply(`Genre "${genre}" not found. Please try a different genre.`);
            }

            data = await apiRequest(`/anime?genres=${genreObj.mal_id}&order_by=score&sort=desc&limit=10`, CACHE_TIMES.TOP);
            animeList = data.data;
            title = `🎭 Top ${genre} Anime`;
            description = `Here are the top rated ${genre} anime:`;
        } else {
            data = await apiRequest('/top/anime?limit=10', CACHE_TIMES.TOP);
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

        const selectRow = buildAnimeSelectMenu(animeList, genre ? 'anime_select_genre' : 'anime_select_top');

        await interaction.editReply({ embeds: [embed], components: [selectRow] });
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
        const data = await apiRequest(`/anime?q=${encodeURIComponent(query)}&limit=10`, CACHE_TIMES.SEARCH);
        const animeList = data.data;

        if (animeList.length === 0) {
            return interaction.editReply(`No anime found for query: "${query}"`);
        }

        // If only one result, show detailed view
        if (animeList.length === 1) {
            const { embed, row } = createAnimeEmbed(animeList[0]);
            return interaction.editReply({ embeds: [embed], components: [row] });
        }

        // Otherwise, show list with select menu
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

        const selectRow = buildAnimeSelectMenu(animeList, 'anime_select_search');

        await interaction.editReply({ embeds: [embed], components: [selectRow] });
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
        const data = await apiRequest(`/seasons/${year}/${season.toLowerCase()}`, CACHE_TIMES.SEASON);
        const animeList = data.data.slice(0, 10);

        if (animeList.length === 0) {
            return interaction.editReply(`No anime found for ${season} ${year}.`);
        }

        const embed = new EmbedBuilder()
            .setTitle(`${earthSeasonIcons[season]} ${season.charAt(0).toUpperCase() + season.slice(1)} ${year} Anime`)
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

        const selectRow = buildAnimeSelectMenu(animeList, 'anime_select_season');

        await interaction.editReply({ embeds: [embed], components: [selectRow] });
    } catch (error) {
        console.error('Error fetching anime by season:', error);
        await interaction.editReply(`There was an error fetching anime for ${season} ${year}. Please try again later.`);
    }
}

// ── Button handler (only wishlist buttons now) ───────────────
async function handleButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('wishlist_add_anime_')) {
        await handleAddToWishlist(interaction);
    }
}

// ── Select menu handler ──────────────────────────────────────
async function handleSelectMenu(interaction) {
    const customId = interaction.customId;

    if (!customId.startsWith('anime_select_')) return;

    const animeId = interaction.values[0];

    try {
        const animeData = await apiRequest(`/anime/${animeId}`);
        const { embed, row } = createAnimeEmbed(animeData.data);

        await interaction.reply({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error('Error fetching anime details:', error);
        await interaction.reply({
            content: 'There was an error fetching the anime details. Please try again later.',
            ephemeral: true
        });
    }
}

// ── Export ────────────────────────────────────────────────────
module.exports = [
    {
        name: 'anime-current',
        description: 'Get a list of anime from the current season',
        execute: handleCurrentSeason,
        handleButton,
        handleSelectMenu
    },
    {
        name: 'anime-top',
        description: 'Get a list of top-rated anime, optionally filtered by genre',
        options: [
            {
                name: 'genre',
                type: 3,
                description: 'Filter by genre (e.g., Action, Romance, Comedy)',
                required: false
            }
        ],
        execute: handleTopAnime,
        handleButton,
        handleSelectMenu
    },
    {
        name: 'anime-search',
        description: 'Search for an anime by name',
        options: [
            {
                name: 'query',
                type: 3,
                description: 'The anime title to search for',
                required: true
            }
        ],
        execute: handleAnimeSearch,
        handleButton,
        handleSelectMenu
    },
    {
        name: 'anime-season',
        description: 'Get anime from a specific year and season',
        options: [
            {
                name: 'year',
                type: 4,
                description: 'The year (e.g., 2023)',
                required: true
            },
            {
                name: 'season',
                type: 3,
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
        handleButton,
        handleSelectMenu
    }
];