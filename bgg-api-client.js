// bgg-api-client.js - Client-side utility for BGG API calls via Vercel serverless functions

class BGGAPIClient {
    constructor() {
        this.baseUrl = '/api/bgg-helper';
    }

    /**
     * Generic BGG API call helper
     * @param {string} endpoint - BGG API endpoint (collection, thing, user, hot, geeklist, plays)
     * @param {Object} params - Parameters for the BGG API call
     * @returns {Promise<string>} - XML response from BGG
     */
    async call(endpoint, params = {}) {
        const urlParams = new URLSearchParams({
            endpoint: endpoint,
            ...params
        });

        const response = await fetch(`${this.baseUrl}?${urlParams}`);
        
        if (!response.ok) {
            // Try to parse JSON error response
            try {
                const errorData = await response.json();
                throw new Error(`BGG API Error: ${errorData.message || 'Unknown error'}`);
            } catch (e) {
                // If not JSON, throw with status
                throw new Error(`BGG API Error: ${response.status} ${response.statusText}`);
            }
        }
        
        return await response.text();
    }

    /**
     * Get user's BGG collection
     * @param {string} username - BGG username
     * @param {Object} options - Additional options (stats, own, etc.)
     */
    async getCollection(username, options = {}) {
        return this.call('collection', {
            username: username,
            stats: 1,
            ...options
        });
    }

    /**
     * Get BGG thing (game) information
     * @param {string|number} id - Game ID or comma-separated IDs
     * @param {Object} options - Additional options (stats, etc.)
     */
    async getThing(id, options = {}) {
        return this.call('thing', {
            id: id,
            stats: 1,
            ...options
        });
    }

    /**
     * Get BGG user information
     * @param {string} username - BGG username
     */
    async getUser(username) {
        return this.call('user', {
            name: username
        });
    }

    /**
     * Get BGG hot games
     * @param {string} type - Type of items (boardgame, rpg, videogame, etc.)
     */
    async getHot(type = 'boardgame') {
        return this.call('hot', {
            type: type
        });
    }

    /**
     * Get BGG geeklist
     * @param {string|number} id - Geeklist ID
     * @param {Object} options - Additional options (comments, etc.)
     */
    async getGeeklist(id, options = {}) {
        return this.call('geeklist', {
            id: id,
            ...options
        });
    }

    /**
     * Get BGG plays
     * @param {string} username - BGG username
     * @param {Object} options - Additional options (mindate, maxdate, etc.)
     */
    async getPlays(username, options = {}) {
        return this.call('plays', {
            username: username,
            ...options
        });
    }
}

// Create a global instance
const bggAPI = new BGGAPIClient();

// Legacy function mappings for backward compatibility
async function fetchBGGCollection(username, options = {}) {
    return bggAPI.getCollection(username, options);
}

async function fetchBGGThing(id, options = {}) {
    return bggAPI.getThing(id, options);
}

async function fetchBGGUser(username) {
    return bggAPI.getUser(username);
}

async function fetchBGGHot(type = 'boardgame') {
    return bggAPI.getHot(type);
}

async function fetchBGGGeeklist(id, options = {}) {
    return bggAPI.getGeeklist(id, options);
}

async function fetchBGGPlays(username, options = {}) {
    return bggAPI.getPlays(username, options);
}