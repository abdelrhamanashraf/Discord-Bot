const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const axios = require('axios');
const { getCachedData, setCachedData } = require('../utils/cacheManager');
const { addToWishlist } = require('../utils/wishlistManager');

// Open Library API Base URL
const API_BASE_URL = 'https://openlibrary.org';
const COVERS_BASE_URL = 'https://covers.openlibrary.org/b/id';

// Cache expiration times
const CACHE_TIMES = {
    SEARCH: 3600000, // 1 hour
    AUTHOR: 86400000 // 24 hours
};

// Helper function to handle API requests with caching
async function apiRequest(endpoint, cacheTime = CACHE_TIMES.SEARCH) {
    const cacheKey = `books_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Try to get data from cache first
    const cachedData = await getCachedData(cacheKey, cacheTime);
    if (cachedData) {
        console.log(`Using cached data for ${endpoint}`);
        return cachedData;
    }

    // If not in cache, make API request
    console.log(`Making API request for ${endpoint}`);
    try {
        const response = await axios.get(`${API_BASE_URL}${endpoint}`);

        // Cache the response data
        await setCachedData(cacheKey, response.data);

        return response.data;
    } catch (error) {
        console.error(`Error fetching from Open Library API (${endpoint}):`, error.message);
        throw error;
    }
}

//handle add to wishlist
async function handleAddToWishlist(interaction, category = "books") {
    const bookKey = interaction.customId.replace('books_add_', '');

    try {
        // bookKey already contains /works/, so we just append .json
        const data = await apiRequest(`${bookKey}.json`);
        const bookData = formatWorkDetailData(data);
        const added = await addToWishlist(interaction.user.id, category, bookData);

        if (added) {
            await interaction.reply({ content: `Successfully added **${bookData.title}** to your books wishlist!`, ephemeral: true });
        } else {
            await interaction.reply({ content: `**${bookData.title}** is already in your wishlist.`, ephemeral: true });
        }
    } catch (error) {
        console.error('Error adding book to wishlist:', error);
        await interaction.reply({ content: 'There was an error adding the book to your wishlist. Please try again later.', ephemeral: true });
    }
}

// Format detailed work data (from /works/OL...json)
function formatWorkDetailData(work) {
    const title = work.title || 'Unknown Title';
    // Work details don't include author names directly, only keys. 
    // We'd need another request to get author name, but for wishlist we can skip or use "Unknown"
    const authorName = 'Unknown Author';
    const firstPublishYear = work.first_publish_date || 'N/A';

    // Handle covers
    let coverUrl = null;
    if (work.covers && work.covers.length > 0) {
        coverUrl = `${COVERS_BASE_URL}/${work.covers[0]}-L.jpg`;
    }

    return {
        title,
        authorName,
        firstPublishYear,
        coverUrl,
        key: work.key,
        id: work.key // Wishlist manager requires an 'id' property
    };
}

// Format book data for display (from Search Results)
function formatBookData(book) {
    const title = book.title || 'Unknown Title';
    const authorName = book.author_name ? book.author_name[0] : 'Unknown Author';
    const authorKey = book.author_key ? book.author_key[0] : null;
    const firstPublishYear = book.first_publish_year || 'N/A';
    const coverId = book.cover_i;
    const coverUrl = coverId ? `${COVERS_BASE_URL}/${coverId}-L.jpg` : null;
    const key = book.key; // Work key, e.g., /works/OL123W

    return {
        title,
        authorName,
        authorKey,
        firstPublishYear,
        coverUrl,
        key
    };
}


// Create embed for a book
function createBookEmbed(bookData) {
    const gaurl = bookData.title.split(' ').join('+');
    const embed = new EmbedBuilder()
        .setTitle(bookData.title)
        .setURL(`${API_BASE_URL}${bookData.key}`)
        .setColor('#e1d9c5') // Paper-ish color
        .addFields(
            { name: 'Author', value: bookData.authorName, inline: true },
            { name: 'First Published', value: bookData.firstPublishYear.toString(), inline: true },
            {
                name: 'Libgen Search',
                value: `🔗 [View in libgen](https://libgen.li/index.php?req=${gaurl})`, inline: true
            }
        )
        .setFooter({ text: 'Data from Open Library' });

    if (bookData.coverUrl) {
        embed.setImage(bookData.coverUrl);
    }

    return embed;
}

// Handle book search command
async function handleBookSearch(interaction) {
    const query = interaction.options.getString('query');
    await interaction.deferReply();

    try {
        const searchEndpoint = `/search.json?q=${encodeURIComponent(query)}&limit=5`;
        const data = await apiRequest(searchEndpoint, CACHE_TIMES.SEARCH);

        if (!data.docs || data.docs.length === 0) {
            return interaction.editReply(`No books found for "${query}".`);
        }

        // Get the first result
        const book = data.docs[0];
        const bookData = formatBookData(book);
        const embed = createBookEmbed(bookData);

        const components = [];

        // Add "More by Author" button if author key exists
        if (bookData.authorKey) {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`books_author_${bookData.authorKey}`)
                        .setLabel(`More by ${bookData.authorName}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📚')
                )
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`books_add_${bookData.key}`)
                        .setLabel('Add to Wishlist')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('❤️')
                );
            components.push(row);
        }

        await interaction.editReply({ embeds: [embed], components });

    } catch (error) {
        console.error('Error searching for book:', error);
        await interaction.editReply('There was an error searching for the book. Please try again later.');
    }
}

// Handle button interactions
async function handleButton(interaction) {
    const customId = interaction.customId;

    if (customId.startsWith('books_add_')) {
        await handleAddToWishlist(interaction);
    }
    else if (customId.startsWith('books_author_')) {
        const authorKey = customId.replace('books_author_', '');
        await interaction.deferReply({ ephemeral: true });

        try {
            // Fetch author's works
            const worksEndpoint = `/authors/${authorKey}/works.json?limit=10`;
            const data = await apiRequest(worksEndpoint, CACHE_TIMES.AUTHOR);

            if (!data.entries || data.entries.length === 0) {
                return interaction.editReply('No works found for this author.');
            }

            // Create a list of works
            const worksList = data.entries.map((work, index) => {
                return `${index + 1}. [${work.title}](${API_BASE_URL}${work.key})`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setTitle(`Books by Author`)
                .setDescription(worksList.substring(0, 4096)) // Discord limit
                .setColor('#e1d9c5')
                .setFooter({ text: 'Data from Open Library' });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching author works:', error);
            await interaction.editReply('There was an error fetching the author\'s works.');
        }
    }
}

module.exports = {
    name: 'book-search',
    description: 'Search for a book by title',
    options: [
        {
            name: 'query',
            type: 3, // STRING
            description: 'The title of the book to search for',
            required: true
        }
    ],
    execute: handleBookSearch,
    handleButton: handleButton
};
