const fs = require('fs');
const path = require('path');

const wishlistPath = path.join(__dirname, '../data/wishlist.json');

// Ensure the data directory and wishlist file exist
function ensureWishlistFile() {
    const dirPath = path.dirname(wishlistPath);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
    if (!fs.existsSync(wishlistPath)) {
        fs.writeFileSync(wishlistPath, JSON.stringify({}, null, 2));
    }
}

/**
 * Add an item to the user's wishlist
 * @param {string} userId - The Discord user ID
 * @param {string} category - 'movies' or 'series'
 * @param {object} item - The item details (id, title, poster_path, etc.)
 * @returns {Promise<boolean>} - True if added, false if already exists
 */
async function addToWishlist(userId, category, item) {
    ensureWishlistFile();

    try {
        const data = fs.readFileSync(wishlistPath, 'utf8');
        const wishlist = JSON.parse(data);

        if (!wishlist[userId]) {
            wishlist[userId] = {
                movies: [],
                series: []
            };
        }

        if (!wishlist[userId][category]) {
            wishlist[userId][category] = [];
        }

        // Check if item already exists
        const itemId = category === 'anime' ? item.mal_id : item.id;
        const exists = wishlist[userId][category].some(i => i.id === itemId);
        if (exists) {
            return false;
        }

        let newItem = {
            id: itemId,
            added_at: new Date().toISOString()
        };

        if (category === 'anime') {
            newItem.title = item.title;
            newItem.poster_path = item.images?.jpg?.large_image_url || item.images?.jpg?.image_url;
            newItem.vote_average = item.score;
            newItem.release_date = item.aired?.from ? item.aired.from.split('T')[0] : null;
        } else if (category === 'books') {
            newItem.title = item.title;
            newItem.poster_path = item.coverUrl;
            newItem.vote_average = null; // Books don't have a score in this context usually
            newItem.release_date = item.firstPublishYear ? item.firstPublishYear.toString() : null;
        } else if (category === 'games') {
            newItem.title = item.name;
            newItem.poster_path = item.header_image;
            newItem.vote_average = item.price; // Storing price in vote_average for now, or could add a custom field
            newItem.release_date = null; // Release date not always available in this context easily
        } else {
            newItem.title = item.title || item.name;
            newItem.poster_path = item.poster_path;
            newItem.vote_average = item.vote_average;
            newItem.release_date = item.release_date || item.first_air_date;
        }

        wishlist[userId][category].push(newItem);

        fs.writeFileSync(wishlistPath, JSON.stringify(wishlist, null, 2));
        return true;
    } catch (error) {
        console.error('Error adding to wishlist:', error);
        throw error;
    }
}

/**
 * Get the user's wishlist
 * @param {string} userId - The Discord user ID
 * @returns {object} - The user's wishlist
 */
function getWishlist(userId) {
    ensureWishlistFile();

    try {
        const data = fs.readFileSync(wishlistPath, 'utf8');
        const wishlist = JSON.parse(data);
        return wishlist[userId] || {};
    } catch (error) {
        console.error('Error getting wishlist:', error);
        return {};
    }
}

module.exports = {
    addToWishlist,
    getWishlist
};
