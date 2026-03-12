// utils/imageSearch.js
const axios = require('axios');

/**
 * Searches for a representative image from Wikimedia Commons/Wikipedia.
 * @param {string} name - The name of the location
 * @returns {Promise<string|null>} - Image URL or null
 */
async function searchImageForLocation(name) {
    if (!name) return null;

    try {
        // Search Wikipedia for the page title in Hebrew
        const searchUrl = `https://he.wikipedia.org/w/api.php`;
        const response = await axios.get(searchUrl, {
            params: {
                action: 'query',
                titles: name,
                prop: 'pageimages',
                format: 'json',
                pithumbsize: 800,
                origin: '*'
            },
            timeout: 5000
        });

        const pages = response.data?.query?.pages;
        if (pages) {
            const pageId = Object.keys(pages)[0];
            if (pageId !== '-1' && pages[pageId].thumbnail) {
                return pages[pageId].thumbnail.source;
            }
        }
        return null;
    } catch (err) {
        // Silent fail to allow the script to continue
        return null;
    }
}

module.exports = { searchImageForLocation };