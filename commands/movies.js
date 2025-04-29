const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const axios = require('axios');
const { getCachedData, setCachedData } = require('../utils/cacheManager');
require('dotenv').config();

// TMDB API key should be in your .env file
const TMDB_API_KEY = process.env.TMDB_API_KEY;

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
        
        const response = await axios.get('https://api.themoviedb.org/3/trending/movie/week', {
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
        
        const response = await axios.get('https://api.themoviedb.org/3/trending/tv/week', {
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
        
        const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
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
        
        const response = await axios.get('https://api.themoviedb.org/3/search/tv', {
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
        
        const response = await axios.get(`https://api.themoviedb.org/3/movie/${movieId}`, {
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
        
        const response = await axios.get(`https://api.themoviedb.org/3/tv/${seriesId}`, {
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
        
        const response = await axios.get('https://api.themoviedb.org/3/discover/movie', {
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
        
        const response = await axios.get('https://api.themoviedb.org/3/genre/movie/list', {
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
    
    // Create embed for the first page
    const embed = createMovieListEmbed(movies, 0, 'Trending Movies This Week');
    
    // Create navigation buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('movies_prev_page')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('movies_next_page')
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(movies.length <= 5),
            new ButtonBuilder()
                .setCustomId('movies_random')
                .setLabel('Random Movie')
                .setStyle(ButtonStyle.Success)
        );
    
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
    
    // Create embed for the first page
    const embed = createSeriesListEmbed(series, 0, 'Trending TV Series This Week');
    
    await interaction.editReply({
        embeds: [embed]
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
    
    // Create embed for the first page
    const embed = createMovieListEmbed(movies, 0, `Movie Search Results for "${query}"`);
    
    // Create navigation buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('movies_prev_page')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('movies_next_page')
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(movies.length <= 5),
            new ButtonBuilder()
                .setCustomId('movies_view_details')
                .setLabel('View Details')
                .setStyle(ButtonStyle.Success)
        );
    
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
    
    // Create embed for the first page
    const embed = createSeriesListEmbed(series, 0, `TV Series Search Results for "${query}"`);
    
    // Create navigation buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('series_prev_page')
                .setLabel('Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('series_next_page')
                .setLabel('Next')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(series.length <= 5),
            new ButtonBuilder()
                .setCustomId('series_view_details')
                .setLabel('View Details')
                .setStyle(ButtonStyle.Success)
        );
    
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
    
    // Create action buttons
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('movies_another_random')
                .setLabel('Another Random Movie')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setLabel('View on TMDB')
                .setStyle(ButtonStyle.Link)
                .setURL(`https://www.themoviedb.org/movie/${movie.id}`)
        );
    
    await interaction.editReply({
        embeds: [embed],
        components: [row]
    });
}

// Helper function to create movie list embed
function createMovieListEmbed(movies, startIndex, title) {
    const endIndex = Math.min(startIndex + 5, movies.length);
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
    
    description += `\nShowing ${startIndex + 1}-${endIndex} of ${movies.length} results`;
    
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
    const endIndex = Math.min(startIndex + 5, seriesList.length);
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
        { name: 'Cast', value: cast, inline: false }
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
    
    // Create embed
    const embed = new EmbedBuilder()
        .setTitle(`${series.name} (${series.first_air_date ? series.first_air_date.split('-')[0] : 'N/A'})`)
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
        { name: 'Cast', value: cast, inline: false }
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
            case 'movies_another_random':
                await handleRandomMovie(interaction);
                break;
                
            case 'movies_prev_page':
            case 'movies_next_page':
                await handleMoviePagination(interaction);
                break;
                
            case 'series_next_page':
            case 'series_prev_page':
                await handleSeriesPagination(interaction);
                break;
                
            case 'movies_random':
                await handleRandomMovie(interaction);
                break;
                
            case 'movies_view_details':
                await handleMovieDetails(interaction);
                break;
                
            default:
                await interaction.reply({ content: 'This button interaction is not handled.', ephemeral: true });
        }
    } catch (error) {
        console.error('Error handling button interaction:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'There was an error processing this button.',
                ephemeral: true
            });
        }
    }
}

// Add helper functions for button handlers
async function handleMoviePagination(interaction) {
    const message = interaction.message;
    const currentEmbed = message.embeds[0];
    const currentPage = parseInt(currentEmbed.footer?.text?.match(/Showing (\d+)-/)?.[1] || 1);
    const isNext = interaction.customId === 'movies_next_page';
    const newStartIndex = isNext ? currentPage + 4 : currentPage - 6;
    
    const movies = await getTrendingMovies();
    if (!movies) return;
    
    const embed = createMovieListEmbed(movies, newStartIndex, currentEmbed.title);
    const row = ActionRowBuilder.from(message.components[0]);
    
    row.components[0].setDisabled(newStartIndex <= 0);
    row.components[1].setDisabled((newStartIndex + 5) >= movies.length);
    
    await interaction.update({ embeds: [embed], components: [row] });
}

async function handleSeriesPagination(interaction) {
    const message = interaction.message;
    const currentEmbed = message.embeds[0];
    const currentPage = parseInt(currentEmbed.footer?.text?.match(/Showing (\d+)-/)?.[1] || 1);
    const isNext = interaction.customId === 'series_next_page';
    const newStartIndex = isNext ? currentPage + 4 : currentPage - 6;
    
    const series = await getTrendingSeries();
    if (!series) return;
    
    const embed = createSeriesListEmbed(series, newStartIndex, currentEmbed.title);
    const row = ActionRowBuilder.from(message.components[0]);
    
    row.components[0].setDisabled(newStartIndex <= 0);
    row.components[1].setDisabled((newStartIndex + 5) >= series.length);
    
    await interaction.update({ embeds: [embed], components: [row] });
}

async function handleMovieDetails(interaction) {
    const message = interaction.message;
    const currentEmbed = message.embeds[0];
    const movieId = currentEmbed.footer?.text?.match(/ID: (\d+)/)?.[1];
    
    if (!movieId) {
        await interaction.reply({
            content: 'Could not find movie details.',
            ephemeral: true
        });
        return;
    }
    
    const movie = await getMovieDetails(movieId);
    if (!movie) {
        await interaction.reply({
            content: 'Failed to fetch movie details.',
            ephemeral: true
        });
        return;
    }
    
    const embed = createMovieDetailEmbed(movie);
    await interaction.update({ embeds: [embed] });
}

async function handleSeriesDetails(interaction) {
    const message = interaction.message;
    const currentEmbed = message.embeds[0];
    const seriesId = currentEmbed.footer?.text?.match(/ID: (\d+)/)?.[1];
    
    if (!seriesId) {
        await interaction.reply({
            content: 'Could not find series details.',
            ephemeral: true
        });
        return;
    }
    
    const series = await getSeriesDetails(seriesId);
    if (!series) {
        await interaction.reply({
            content: 'Failed to fetch series details.',
            ephemeral: true
        });
        return;
    }
    
    const embed = createSeriesDetailEmbed(series);
    await interaction.update({ embeds: [embed] });
}

async function handleTriviaReveal(interaction) {
    const movie = interaction.client.movieTriviaAnswers?.get(interaction.user.id);
    
    if (!movie) {
        await interaction.reply({
            content: 'Could not find the trivia answer. Please try the command again.',
            ephemeral: true
        });
        return;
    }
    
    const embed = new EmbedBuilder()
        .setTitle('🎬 Movie Trivia Answer')
        .setDescription(`The movie was **${movie.title}** (${movie.release_date.split('-')[0]})!\n\n${movie.overview}`)
        .setColor('#E50914')
        .setImage(`https://image.tmdb.org/t/p/w500${movie.poster_path}`);
    
    await interaction.reply({
        embeds: [embed],
        ephemeral: true
    });
}

// Movie trivia questions
const MOVIE_TRIVIA = [
    {
        question: "Which movie features a character named Jack Dawson who boards a famous ship?",
        answer: "Titanic",
        fact: "Leonardo DiCaprio played Jack Dawson in the 1997 film Titanic, which won 11 Academy Awards."
    },
    {
        question: "In which film does Tom Hanks say the famous line, 'Life is like a box of chocolates'?",
        answer: "Forrest Gump",
        fact: "Forrest Gump (1994) won 6 Academy Awards including Best Picture and Best Actor for Tom Hanks."
    },
    {
        question: "Which animated Disney film features a young lion who eventually becomes king?",
        answer: "The Lion King",
        fact: "The Lion King (1994) is one of Disney's highest-grossing animated films and was adapted into a successful Broadway musical."
    },
    {
        question: "Which sci-fi movie features a computer system called Skynet that becomes self-aware?",
        answer: "The Terminator",
        fact: "The Terminator franchise began in 1984 with Arnold Schwarzenegger as the iconic T-800 Model 101."
    },
    {
        question: "Which film features a group of toys that come to life when humans aren't present?",
        answer: "Toy Story",
        fact: "Toy Story (1995) was the first fully computer-animated feature film and was produced by Pixar Animation Studios."
    },
    {
        question: "In which movie does a boy see dead people?",
        answer: "The Sixth Sense",
        fact: "The Sixth Sense (1999) is known for its twist ending and the famous line 'I see dead people' spoken by Haley Joel Osment."
    },
    {
        question: "Which film features a giant shark terrorizing a beach town?",
        answer: "Jaws",
        fact: "Jaws (1975), directed by Steven Spielberg, is considered the first summer blockbuster and revolutionized Hollywood marketing."
    },
    {
        question: "Which movie features a character named Indiana Jones searching for the Ark of the Covenant?",
        answer: "Raiders of the Lost Ark",
        fact: "Raiders of the Lost Ark (1981) was the first Indiana Jones film, starring Harrison Ford and directed by Steven Spielberg."
    },
    {
        question: "In which film does Keanu Reeves play a character named Neo who discovers the world is a simulation?",
        answer: "The Matrix",
        fact: "The Matrix (1999) revolutionized visual effects with its 'bullet time' sequences and spawned a successful franchise."
    },
    {
        question: "Which movie features a boy who is left home alone during Christmas and must defend his house from burglars?",
        answer: "Home Alone",
        fact: "Home Alone (1990) starred Macaulay Culkin and became one of the highest-grossing comedy films of all time."
    }
];

// Command handler for movie trivia
async function handleMovieTrivia(interaction) {
    await interaction.deferReply();
    
    try {
        const response = await axios.get('https://api.themoviedb.org/3/movie/popular', {
            params: {
                api_key: TMDB_API_KEY
            }
        });

        if (!response.data || !response.data.results || response.data.results.length === 0) {
            return interaction.editReply('Sorry, I couldn\'t fetch movie data for trivia at the moment. Please try again later.');
        }

        // Get a random movie from the results
        const movie = response.data.results[Math.floor(Math.random() * response.data.results.length)];
        
        // Get detailed movie info for trivia
        const movieDetails = await getMovieDetails(movie.id);
        
        if (!movieDetails) {
            return interaction.editReply('Sorry, I couldn\'t generate a trivia question at the moment. Please try again later.');
        }

        // Create trivia question
        const embed = new EmbedBuilder()
            .setTitle('🎬 Movie Trivia')
            .setDescription(`Here's your movie trivia question!\n\n**Question:** This ${movieDetails.release_date.substring(0, 4)} movie was directed by ${movieDetails.credits.crew.find(c => c.job === 'Director')?.name || 'an acclaimed director'} and stars ${movieDetails.credits.cast[0]?.name || 'a famous actor'}. Can you guess the movie?`)
            .setColor('#E50914')
            .setFooter({ text: 'Use the button below to reveal the answer' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('movie_trivia_reveal')
                    .setLabel('Reveal Answer')
                    .setStyle(ButtonStyle.Primary)
            );

        // Store the movie details for the reveal
        interaction.client.movieTriviaAnswers = interaction.client.movieTriviaAnswers || new Map();
        interaction.client.movieTriviaAnswers.set(interaction.user.id, movieDetails);

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Error in movie trivia:', error);
        await interaction.editReply('Sorry, there was an error generating the trivia question. Please try again later.');
    }
}

// Button handler for movie trivia
async function handleTriviaButton(interaction) {
    const triviaCache = interaction.client.triviaCache || new Map();
    const trivia = triviaCache.get(interaction.user.id);
    
    if (!trivia) {
        return interaction.reply({
            content: 'Sorry, I couldn\'t find your trivia question. Please try a new one.',
            ephemeral: true
        });
    }
    
    if (interaction.customId === 'movie_trivia_answer') {
        const embed = new EmbedBuilder()
            .setTitle('🎬 Movie Trivia Answer')
            .setDescription(`**Question:** ${trivia.question}\n\n**Answer:** ${trivia.answer}\n\n**Fun Fact:** ${trivia.fact}`)
            .setColor('#FFD700') // Gold color
            .setFooter({ text: 'Movie trivia powered by your friendly bot' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('movie_trivia_another')
                    .setLabel('Another Question')
                    .setStyle(ButtonStyle.Primary)
            );
        
        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    } else if (interaction.customId === 'movie_trivia_another') {
        // Get a new random trivia question (excluding the current one)
        let availableTrivia = MOVIE_TRIVIA.filter(t => t.question !== trivia.question);
        if (availableTrivia.length === 0) availableTrivia = MOVIE_TRIVIA; // If we've used all questions
        
        const randomIndex = Math.floor(Math.random() * availableTrivia.length);
        const newTrivia = availableTrivia[randomIndex];
        
        const embed = new EmbedBuilder()
            .setTitle('🎬 Movie Trivia Question')
            .setDescription(newTrivia.question)
            .setColor('#FFD700') // Gold color
            .setFooter({ text: 'Try to guess the answer!' })
            .setTimestamp();
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('movie_trivia_answer')
                    .setLabel('Show Answer')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('movie_trivia_another')
                    .setLabel('Another Question')
                    .setStyle(ButtonStyle.Secondary)
            );
        
        // Update the cache with the new trivia
        interaction.client.triviaCache.set(interaction.user.id, newTrivia);
        
        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    }
}

// Add to the button handler function
async function handleButton(interaction) {
    // Extract the base command from the button ID
    const [baseCommand] = interaction.customId.split('_');
    
    if (baseCommand === 'movies') {
        // Handle movie pagination and details
        // ... (similar to movie pagination)
    } else if (baseCommand === 'series') {
        // Handle series list pagination and details
        // ... (similar to movie pagination)
    } else if (baseCommand === 'movie') {
        // Handle movie trivia buttons
        if (interaction.customId.startsWith('movie_trivia')) {
            await handleTriviaButton(interaction);
        }
    }
}

// Export all the command handlers
// Add the movie trivia handler function
async function handleMovieTrivia(interaction) {
    await interaction.deferReply();
    
    try {
        const response = await axios.get('https://api.themoviedb.org/3/movie/popular', {
            params: {
                api_key: TMDB_API_KEY
            }
        });

        if (!response.data || !response.data.results || response.data.results.length === 0) {
            return interaction.editReply('Sorry, I couldn\'t fetch movie data for trivia at the moment. Please try again later.');
        }

        // Get a random movie from the results
        const movie = response.data.results[Math.floor(Math.random() * response.data.results.length)];
        
        // Get detailed movie info for trivia
        const movieDetails = await getMovieDetails(movie.id);
        
        if (!movieDetails) {
            return interaction.editReply('Sorry, I couldn\'t generate a trivia question at the moment. Please try again later.');
        }

        // Create trivia question
        const embed = new EmbedBuilder()
            .setTitle('🎬 Movie Trivia')
            .setDescription(`Here's your movie trivia question!\n\n**Question:** This ${movieDetails.release_date.substring(0, 4)} movie was directed by ${movieDetails.credits.crew.find(c => c.job === 'Director')?.name || 'an acclaimed director'} and stars ${movieDetails.credits.cast[0]?.name || 'a famous actor'}. Can you guess the movie?`)
            .setColor('#E50914')
            .setFooter({ text: 'Use the button below to reveal the answer' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('movie_trivia_reveal')
                    .setLabel('Reveal Answer')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });
    } catch (error) {
        console.error('Error in movie trivia:', error);
        await interaction.editReply('Sorry, there was an error generating the trivia question. Please try again later.');
    }
}

module.exports = {
    handleTrendingMovies,
    handleTrendingSeries,
    handleMovieSearch,
    handleSeriesSearch,
    handleRandomMovie,
    handleButton
};