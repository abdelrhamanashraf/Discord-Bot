const fs = require('fs').promises;
const path = require('path');

// Create cache directory if it doesn't exist
const CACHE_DIR = path.join(__dirname, '..', 'cache');

// Initialize cache directory
async function initCacheDir() {
    try {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating cache directory:', error);
    }
}

// Initialize cache on module load
initCacheDir();

/**
 * Get cached data if it exists and is not expired
 * @param {string} cacheKey - Unique identifier for the cached data
 * @param {number} maxAgeMs - Maximum age of cache in milliseconds
 * @returns {Promise<object|null>} - Cached data or null if not found/expired
 */
async function getCachedData(cacheKey, maxAgeMs = 3600000) { // Default: 1 hour
    try {
        const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
        
        // Check if cache file exists
        try {
            await fs.access(cacheFile);
        } catch (error) {
            return null; // File doesn't exist
        }
        
        // Read and parse cache file
        const cacheData = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
        
        // Check if cache is expired
        if (Date.now() - cacheData.timestamp > maxAgeMs) {
            return null; // Cache expired
        }
        
        return cacheData.data;
    } catch (error) {
        console.error(`Error reading cache for ${cacheKey}:`, error);
        return null;
    }
}

/**
 * Save data to cache
 * @param {string} cacheKey - Unique identifier for the cached data
 * @param {object} data - Data to cache
 * @returns {Promise<boolean>} - Success status
 */
async function setCachedData(cacheKey, data) {
    try {
        const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
        const cacheData = {
            timestamp: Date.now(),
            data: data
        };
        
        await fs.writeFile(cacheFile, JSON.stringify(cacheData), 'utf8');
        return true;
    } catch (error) {
        console.error(`Error writing cache for ${cacheKey}:`, error);
        return false;
    }
}

/**
 * Clear expired cache files
 * @param {number} maxAgeMs - Maximum age of cache in milliseconds
 */
async function clearExpiredCache(maxAgeMs = 86400000) { // Default: 24 hours
    try {
        const files = await fs.readdir(CACHE_DIR);
        
        for (const file of files) {
            if (!file.endsWith('.json')) continue;
            
            const cacheFile = path.join(CACHE_DIR, file);
            try {
                const cacheData = JSON.parse(await fs.readFile(cacheFile, 'utf8'));
                
                if (Date.now() - cacheData.timestamp > maxAgeMs) {
                    await fs.unlink(cacheFile);
                    console.log(`Cleared expired cache: ${file}`);
                }
            } catch (error) {
                console.error(`Error processing cache file ${file}:`, error);
            }
        }
    } catch (error) {
        console.error('Error clearing expired cache:', error);
    }
}

// Clear expired cache on module load and every 6 hours
clearExpiredCache();
setInterval(clearExpiredCache, 21600000);

// Add a generic cache with configurable expiration
const apiCache = new Map();

/**
 * Get cached data with expiration check
 * @param {string} key - The cache key
 * @param {number} expirationTime - Time in milliseconds before cache expires
 * @returns {any|null} - The cached data or null if expired/not found
 */
async function getCachedData(key, expirationTime) {
    if (apiCache.has(key)) {
        const { data, timestamp } = apiCache.get(key);
        const now = Date.now();
        
        // Check if cache is still valid
        if (now - timestamp < expirationTime) {
            return data;
        }
        
        // Cache expired, remove it
        apiCache.delete(key);
    }
    
    return null;
}

/**
 * Set data in cache with timestamp
 * @param {string} key - The cache key
 * @param {any} data - The data to cache
 */
async function setCachedData(key, data) {
    apiCache.set(key, {
        data,
        timestamp: Date.now()
    });
}

module.exports = {
    getCachedData,
    setCachedData
};