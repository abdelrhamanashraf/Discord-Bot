const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const axios = require('axios');
const { getCachedData, setCachedData } = require('../utils/cacheManager');
const { addToWishlist } = require('../utils/wishlistManager');
require('dotenv').config();

// TMDB API key should be in your .env file
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const baseApiUrl = 'https://api.themoviedb.org/3';
// Cache expiration times
const CACHE_TIMES = {
    TRENDING: 3600000,      // 1 hour for trending content
    SEARCH: 43200000,       // 12 hours for search results
    DETAILS: 86400000,      // 24 hours for movie/series details
    GENRE: 604800000        // 1 week for genre data (rarely changes)
};

// Function to get trending movies
async function getTrendingMovies() {
    try {
        // Check cache first
        const cacheKey = 'tmdb_trending_movies';
        const cachedData = await getCachedData(cacheKey, CACHE_TIMES.TRENDING);

        if (cachedData) {
            console.log('Using cached trending movies data');
            return cachedData;
        }

        console.log('Fetching fresh trending movies data');

        const response = await axios.get(`${baseApiUrl}/trending/movie/week`, {
            params: {
                api_key: TMDB_API_KEY
            }
        });

        if (!response.data || !response.data.results) {
            return null;
        }

        // Cache the results
        await setCachedData(cacheKey, response.data.results);

        return response.data.results;
    } catch (error) {
        console.error('Error fetching trending movies:', error);
        return null;
    }
}

// Function to get trending TV series
async function getTrendingSeries() {
    try {
        // Check cache first
        const cacheKey = 'tmdb_trending_series';
        const cachedData = await getCachedData(cacheKey, CACHE_TIMES.TRENDING);

        if (cachedData) {
            console.log('Using cached trending series data');
            return cachedData;
        }

        console.log('Fetching fresh trending series data');

        const response = await axios.get(`${baseApiUrl}/trending/tv/week`, {
            params: {
                api_key: TMDB_API_KEY
            }
        });

        if (!response.data || !response.data.results) {
            return null;
        }

        // Cache the results
        await setCachedData(cacheKey, response.data.results);

        return response.data.results;
    } catch (error) {
        console.error('Error fetching trending series:', error);
        return null;
    }
}

// Function to search for movies
async function searchMovies(query) {
    try {
        // Check cache first
        const cacheKey = `tmdb_movie_search_${query.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const cachedData = await getCachedData(cacheKey, CACHE_TIMES.SEARCH);

        if (cachedData) {
            console.log(`Using cached movie search results for "${query}"`);
            return cachedData;
        }

        console.log(`Performing fresh movie search for "${query}"`);

        const response = await axios.get(`${baseApiUrl}/search/movie`, {
            params: {
                api_key: TMDB_API_KEY,
                query: query,
                include_adult: false
            }
        });

        if (!response.data || !response.data.results) {
            return [];
        }

        // Cache the results
        await setCachedData(cacheKey, response.data.results);

        return response.data.results;
    } catch (error) {
        console.error(`Error searching for movies with query "${query}":`, error);
        return [];
    }
}

// Function to search for TV series
async function searchSeries(query) {
    try {
        // Check cache first
        const cacheKey = `tmdb_series_search_${query.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const cachedData = await getCachedData(cacheKey, CACHE_TIMES.SEARCH);

        if (cachedData) {
            console.log(`Using cached series search results for "${query}"`);
            return cachedData;
        }

        console.log(`Performing fresh series search for "${query}"`);

        const response = await axios.get(`${baseApiUrl}/search/tv`, {
            params: {
                api_key: TMDB_API_KEY,
                query: query,
                include_adult: false
            }
        });

        if (!response.data || !response.data.results) {
            return [];
        }

        // Cache the results
        await setCachedData(cacheKey, response.data.results);

        return response.data.results;
    } catch (error) {
        console.error(`Error searching for series with query "${query}":`, error);
        return [];
    }
}

// Function to get movie details
async function getMovieDetails(movieId) {
    try {
        // Check cache first
        const cacheKey = `tmdb_movie_${movieId}`;
        const cachedData = await getCachedData(cacheKey, CACHE_TIMES.DETAILS);

        if (cachedData) {
            console.log(`Using cached data for movie ${movieId}`);
            return cachedData;
        }

        console.log(`Fetching fresh data for movie ${movieId}`);

        const response = await axios.get(`${baseApiUrl}/movie/${movieId}`, {
            params: {
                api_key: TMDB_API_KEY,
                append_to_response: 'credits,videos,recommendations'
            }
        });

        if (!response.data) {
            return null;
        }

        // Cache the results
        await setCachedData(cacheKey, response.data);

        return response.data;
    } catch (error) {
        console.error(`Error fetching movie details for ${movieId}:`, error);
        return null;
    }
}

// Function to get TV series details
async function getSeriesDetails(seriesId) {
    try {
        // Check cache first
        const cacheKey = `tmdb_series_${seriesId}`;
        const cachedData = await getCachedData(cacheKey, CACHE_TIMES.DETAILS);

        if (cachedData) {
            console.log(`Using cached data for series ${seriesId}`);
            return cachedData;
        }

        console.log(`Fetching fresh data for series ${seriesId}`);

        const response = await axios.get(`${baseApiUrl}/tv/${seriesId}`, {
            params: {
                api_key: TMDB_API_KEY,
                append_to_response: 'credits,videos,recommendations'
            }
        });

        if (!response.data) {
            return null;
        }

        // Cache the results
        await setCachedData(cacheKey, response.data);

        return response.data;
    } catch (error) {
        console.error(`Error fetching series details for ${seriesId}:`, error);
        return null;
    }
}

// Function to get movies by genre
async function getMoviesByGenre(genreId) {
    try {
        // Check cache first
        const cacheKey = `tmdb_movies_genre_${genreId}`;
        const cachedData = await getCachedData(cacheKey, CACHE_TIMES.GENRE);

        if (cachedData) {
            console.log(`Using cached movies for genre ${genreId}`);
            return cachedData;
        }

        console.log(`Fetching fresh movies for genre ${genreId}`);

        const response = await axios.get(`${baseApiUrl}/discover/movie`, {
            params: {
                api_key: TMDB_API_KEY,
                with_genres: genreId,
                sort_by: 'popularity.desc'
            }
        });

        if (!response.data || !response.data.results) {
            return [];
        }

        // Cache the results
        await setCachedData(cacheKey, response.data.results);

        return response.data.results;
    } catch (error) {
        console.error(`Error fetching movies for genre ${genreId}:`, error);
        return [];
    }
}

// Function to get all movie genres
async function getMovieGenres() {
    try {
        // Check cache first
        const cacheKey = 'tmdb_movie_genres';
        const cachedData = await getCachedData(cacheKey, CACHE_TIMES.GENRE);

        if (cachedData) {
            console.log('Using cached movie genres');
            return cachedData;
        }

        console.log('Fetching fresh movie genres');

        const response = await axios.get(`${baseApiUrl}/genre/movie/list`, {
            params: {
                api_key: TMDB_API_KEY
            }
        });

        if (!response.data || !response.data.genres) {
            return [];
        }

        // Cache the results
        await setCachedData(cacheKey, response.data.genres);

        return response.data.genres;
    } catch (error) {
        console.error('Error fetching movie genres:', error);
        return [];
    }
}

// Function to get random movie recommendation
async function getRandomMovie() {
    try {
        // Get a list of popular movies first
        const popularMovies = await getTrendingMovies();

        if (!popularMovies || popularMovies.length === 0) {
            return null;
        }

        // Pick a random movie from the list
        const randomIndex = Math.floor(Math.random() * popularMovies.length);
        const randomMovie = popularMovies[randomIndex];

        // Get full details for the random movie
        return await getMovieDetails(randomMovie.id);
    } catch (error) {
        console.error('Error getting random movie:', error);
        return null;
    }
}

// Command handler for trending movies
async function handleTrendingMovies(interaction) {
    await interaction.deferReply();

    const movies = await getTrendingMovies();

    if (!movies || movies.length === 0) {
        return interaction.editReply('Sorry, I couldn\'t fetch trending movies at the moment. Please try again later.');
    }

    // Create embed showing 10 movies
    const embed = createMovieListEmbed(movies, 0, 'Trending Movies This Week');

    // Create select menu for movies
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('movie_select_details')
        .setPlaceholder('Select a movie for more details')
        .addOptions(
            movies.slice(0, 25).map(movie =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(movie.title.substring(0, 100))
                    .setDescription(movie.release_date ? `Released: ${movie.release_date}` : 'No release date')
                    .setValue(movie.id.toString())
            )
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

// Command handler for trending series
async function handleTrendingSeries(interaction) {
    await interaction.deferReply();

    const series = await getTrendingSeries();

    if (!series || series.length === 0) {
        return interaction.editReply('Sorry, I couldn\'t fetch trending TV series at the moment. Please try again later.');
    }

    // Create embed showing 10 series
    const embed = createSeriesListEmbed(series, 0, 'Trending TV Series This Week');

    // Create select menu for series
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('series_select_details')
        .setPlaceholder('Select a series for more details')
        .addOptions(
            series.slice(0, 25).map(s =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(s.name.substring(0, 100))
                    .setDescription(s.first_air_date ? `First Air: ${s.first_air_date}` : 'No air date')
                    .setValue(s.id.toString())
            )
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

// Command handler for movie search
async function handleMovieSearch(interaction) {
    const query = interaction.options.getString('query');

    await interaction.deferReply();

    const movies = await searchMovies(query);

    if (!movies || movies.length === 0) {
        return interaction.editReply(`No movies found matching "${query}". Try a different search term.`);
    }

    // Create embed showing search results
    const embed = createMovieListEmbed(movies, 0, `Movie Search Results for "${query}"`);

    // Create select menu for movies
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('movie_select_details')
        .setPlaceholder('Select a movie for more details')
        .addOptions(
            movies.slice(0, 25).map(movie =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(movie.title.substring(0, 100))
                    .setDescription(movie.release_date ? `Released: ${movie.release_date}` : 'No release date')
                    .setValue(movie.id.toString())
            )
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

// Command handler for series search
async function handleSeriesSearch(interaction) {
    const query = interaction.options.getString('query');

    await interaction.deferReply();

    const series = await searchSeries(query);

    if (!series || series.length === 0) {
        return interaction.editReply(`No TV series found matching "${query}". Try a different search term.`);
    }

    // Create embed showing search results
    const embed = createSeriesListEmbed(series, 0, `TV Series Search Results for "${query}"`);

    // Create select menu for series
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('series_select_details')
        .setPlaceholder('Select a series for more details')
        .addOptions(
            series.slice(0, 25).map(s =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(s.name.substring(0, 100))
                    .setDescription(s.first_air_date ? `First Air: ${s.first_air_date}` : 'No air date')
                    .setValue(s.id.toString())
            )
        );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

// Command handler for random movie
async function handleRandomMovie(interaction) {
    await interaction.deferReply();

    const movie = await getRandomMovie();

    if (!movie) {
        return interaction.editReply('Sorry, I couldn\'t fetch a random movie at the moment. Please try again later.');
    }

    // Create detailed movie embed
    const embed = createMovieDetailEmbed(movie);

    await interaction.editReply({
        embeds: [embed]
    });
}

// Helper function to create movie list embed
function createMovieListEmbed(movies, startIndex, title) {
    const endIndex = Math.min(startIndex + 10, movies.length);
    const currentMovies = movies.slice(startIndex, endIndex);

    let description = '';
    currentMovies.forEach((movie, index) => {
        const releaseYear = movie.release_date ? `(${movie.release_date.split('-')[0]})` : '';
        const rating = movie.vote_average ? `⭐ ${movie.vote_average.toFixed(1)}/10` : '';

        description += `**${startIndex + index + 1}. ${movie.title} ${releaseYear}** ${rating}\n`;
        if (movie.overview) {
            description += `${movie.overview.length > 150 ? movie.overview.substring(0, 150) + '...' : movie.overview}\n\n`;
        } else {
            description += 'No description available.\n\n';
        }
    });

    description += `\nShowing ${startIndex + 1}-${endIndex} `;

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor('#E50914') // Netflix red
        .setFooter({ text: 'Powered by TMDB API' })
        .setTimestamp();

    // Add poster of the first movie if available
    if (currentMovies[0] && currentMovies[0].poster_path) {
        embed.setThumbnail(`https://image.tmdb.org/t/p/w200${currentMovies[0].poster_path}`);
    }

    return embed;
}

// Helper function to create series list embed
function createSeriesListEmbed(seriesList, startIndex, title) {
    const endIndex = Math.min(startIndex + 10, seriesList.length);
    const currentSeries = seriesList.slice(startIndex, endIndex);

    let description = '';
    currentSeries.forEach((series, index) => {
        const firstAirYear = series.first_air_date ? `(${series.first_air_date.split('-')[0]})` : '';
        const rating = series.vote_average ? `⭐ ${series.vote_average.toFixed(1)}/10` : '';

        description += `**${startIndex + index + 1}. ${series.name} ${firstAirYear}** ${rating}\n`;
        if (series.overview) {
            description += `${series.overview.length > 150 ? series.overview.substring(0, 150) + '...' : series.overview}\n\n`;
        } else {
            description += 'No description available.\n\n';
        }
    });

    description += `\nShowing ${startIndex + 1}-${endIndex} of ${seriesList.length} results`;

    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor('#0F79AF') // HBO blue
        .setFooter({ text: 'Powered by TMDB API' })
        .setTimestamp();

    // Add poster of the first series if available
    if (currentSeries[0] && currentSeries[0].poster_path) {
        embed.setThumbnail(`https://image.tmdb.org/t/p/w200${currentSeries[0].poster_path}`);
    }

    return embed;
}

// Helper function to create detailed movie embed
function createMovieDetailEmbed(movie) {
    // Format runtime as hours and minutes
    let runtime = '';
    if (movie.runtime) {
        const hours = Math.floor(movie.runtime / 60);
        const minutes = movie.runtime % 60;
        runtime = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }
    const gaurl = movie.title.split(' ').join('+');
    const aurl = movie.title.split(' ').join('%20');
    // Format release date
    const releaseDate = movie.release_date ? new Date(movie.release_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'Unknown';

    // Get genres
    const genres = movie.genres ? movie.genres.map(g => g.name).join(', ') : 'Not specified';

    // Get director
    let director = 'Unknown';
    if (movie.credits && movie.credits.crew) {
        const directors = movie.credits.crew.filter(person => person.job === 'Director');
        if (directors.length > 0) {
            director = directors.map(d => d.name).join(', ');
        }
    }

    // Get cast (top 5)
    let cast = 'Unknown';
    if (movie.credits && movie.credits.cast && movie.credits.cast.length > 0) {
        cast = movie.credits.cast.slice(0, 5).map(actor => actor.name).join(', ');
        if (movie.credits.cast.length > 5) {
            cast += ', ...';
        }
    }

    // Create embed
    const embed = new EmbedBuilder()
        .setTitle(`${movie.title} (${movie.release_date ? movie.release_date.split('-')[0] : 'N/A'})`)
        .setURL(`https://www.themoviedb.org/movie/${movie.id}`)
        .setColor('#E50914') // Netflix red
        .setFooter({ text: 'Powered by TMDB API' })
        .setTimestamp();

    // Add poster if available
    if (movie.poster_path) {
        embed.setImage(`https://image.tmdb.org/t/p/w500${movie.poster_path}`);
    }

    // Add fields
    embed.addFields(
        { name: 'Rating', value: movie.vote_average ? `⭐ ${movie.vote_average.toFixed(1)}/10 (${movie.vote_count} votes)` : 'Not rated', inline: true },
        { name: 'Runtime', value: runtime || 'Unknown', inline: true },
        { name: 'Release Date', value: releaseDate, inline: true },
        { name: 'Genres', value: genres, inline: false },
        { name: 'Director', value: director, inline: false },
        { name: 'Cast', value: cast, inline: false },
        { name: 'search on egydead', value: `🔗 [search on egydead](https://a.egydead.watch/?s=${gaurl})`, inline: true },
        { name: 'search on flixer', value: `🔗 [search on flixer](https://flixer.sh/search?q=${aurl})`, inline: true },
    );

    // Add overview
    if (movie.overview) {
        embed.setDescription(movie.overview);
    }

    return embed;
}

// Helper function to create detailed series embed
function createSeriesDetailEmbed(series) {

    // Format first air date
    const firstAirDate = series.first_air_date ? new Date(series.first_air_date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }) : 'Unknown';

    // Get genres
    const genres = series.genres ? series.genres.map(g => g.name).join(', ') : 'Not specified';

    // Get creators
    let creators = 'Unknown';
    if (series.created_by && series.created_by.length > 0) {
        creators = series.created_by.map(c => c.name).join(', ');
    }

    // Get cast (top 5)
    let cast = 'Unknown';
    if (series.credits && series.credits.cast && series.credits.cast.length > 0) {
        cast = series.credits.cast.slice(0, 5).map(actor => actor.name).join(', ');
        if (series.credits.cast.length > 5) {
            cast += ', ...';
        }
    }
    const gaurl = series.name.split(' ').join('+');
    const aurl = series.name.split(' ').join('%20');

    // Create embed
    const embed = new EmbedBuilder()
        .setTitle(`${series.name} (${series.first_air_date ? series.first_air_date.split('-')[0] : 'N/A'})`)
        .setURL(`https://www.themoviedb.org/tv/${series.id}`)
        .setColor('#0F79AF') // HBO blue
        .setFooter({ text: 'Powered by TMDB API' })
        .setTimestamp();

    // Add poster if available
    if (series.poster_path) {
        embed.setImage(`https://image.tmdb.org/t/p/w500${series.poster_path}`);
    }

    // Add fields
    embed.addFields(
        { name: 'Rating', value: series.vote_average ? `⭐ ${series.vote_average.toFixed(1)}/10 (${series.vote_count} votes)` : 'Not rated', inline: true },
        { name: 'Seasons', value: series.number_of_seasons ? series.number_of_seasons.toString() : 'Unknown', inline: true },
        { name: 'Episodes', value: series.number_of_episodes ? series.number_of_episodes.toString() : 'Unknown', inline: true },
        { name: 'First Air Date', value: firstAirDate, inline: true },
        { name: 'Status', value: series.status || 'Unknown', inline: true },
        { name: 'Genres', value: genres, inline: false },
        { name: 'Created By', value: creators, inline: false },
        { name: 'Cast', value: cast, inline: false },
        { name: 'search on egydead', value: `🔗 [search on egydead](https://a.egydead.watch/?s=${gaurl})`, inline: true },
        { name: 'search on flixer', value: `🔗 [search on flixer](https://flixer.sh/search?q=${aurl})`, inline: true },
    );

    // Add overview
    if (series.overview) {
        embed.setDescription(series.overview);
    }

    return embed;
}

// Button handler
async function handleButton(interaction) {
    try {
        switch (interaction.customId) {

            case 'wishlist_add_movie':
                await handleAddToWishlist(interaction, 'movies');
                break;

            case 'wishlist_add_series':
                await handleAddToWishlist(interaction, 'series');
                break;

            default:
                if (interaction.customId.startsWith('wishlist_add_movie_')) {
                    await handleAddToWishlist(interaction, 'movies');
                } else if (interaction.customId.startsWith('wishlist_add_series_')) {
                    await handleAddToWishlist(interaction, 'series');
                } else {
                    await interaction.reply({ content: 'This button is not handled.', ephemeral: true });
                }
                break;
        }
    } catch (error) {
        console.error('Error handling button interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
        }
    }
}

async function handleSelectMenuDetails(interaction, type) {
    const selectedId = interaction.values[0];

    if (type === 'movie') {
        const movie = await getMovieDetails(selectedId);
        if (!movie) {
            return interaction.reply({ content: 'Failed to fetch movie details.', ephemeral: true });
        }

        const embed = createMovieDetailEmbed(movie);
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`wishlist_add_movie_${movie.id}`)
                    .setLabel('Add to Wishlist')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('❤️')
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    } else if (type === 'series') {
        const series = await getSeriesDetails(selectedId);
        if (!series) {
            return interaction.reply({ content: 'Failed to fetch series details.', ephemeral: true });
        }

        const embed = createSeriesDetailEmbed(series);
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`wishlist_add_series_${series.id}`)
                    .setLabel('Add to Wishlist')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('❤️')
            );

        await interaction.reply({ embeds: [embed], components: [row] });
    }
}

async function handleAddToWishlist(interaction, category) {
    // Extract ID from customId (format: wishlist_add_category_ID)
    const parts = interaction.customId.split('_');
    const id = parts[3];

    let item;
    if (category === 'movies') {
        item = await getMovieDetails(id);
    } else {
        item = await getSeriesDetails(id);
    }

    if (!item) {
        return interaction.reply({ content: 'Failed to fetch item details for wishlist.', ephemeral: true });
    }

    try {
        const added = await addToWishlist(interaction.user.id, category, item);
        if (added) {
            await interaction.reply({ content: `Successfully added **${item.title || item.name}** to your ${category} wishlist!`, ephemeral: true });
        } else {
            await interaction.reply({ content: `**${item.title || item.name}** is already in your wishlist.`, ephemeral: true });
        }
    } catch (error) {
        console.error('Wishlist error:', error);
        await interaction.reply({ content: 'An error occurred while adding to wishlist.', ephemeral: true });
    }
}

// Main Select Menu Handler
async function handleSelectMenu(interaction) {
    if (interaction.customId === 'movie_select_details') {
        await handleSelectMenuDetails(interaction, 'movie');
    } else if (interaction.customId === 'series_select_details') {
        await handleSelectMenuDetails(interaction, 'series');
    } else {
        await interaction.reply({ content: 'This selection menu is not handled.', ephemeral: true });
    }
}

// Export all the command handlers
module.exports = [
    {
        name: 'movie-trending',
        description: 'Get trending movies this week',
        execute: handleTrendingMovies,
        handleButton: handleButton,
        handleSelectMenu: handleSelectMenu
    },
    {
        name: 'series-trending',
        description: 'Get trending TV series this week',
        execute: handleTrendingSeries,
        handleButton: handleButton,
        handleSelectMenu: handleSelectMenu
    },
    {
        name: 'movie-search',
        description: 'Search for a movie by title',
        execute: handleMovieSearch,
        handleButton: handleButton,
        handleSelectMenu: handleSelectMenu
    },
    {
        name: 'series-search',
        description: 'Search for a TV series by title',
        execute: handleSeriesSearch,
        handleButton: handleButton,
        handleSelectMenu: handleSelectMenu
    },
    {
        name: 'movie-random',
        description: 'Get a random movie recommendation',
        execute: handleRandomMovie,
        handleButton: handleButton,
        handleSelectMenu: handleSelectMenu
    }
];