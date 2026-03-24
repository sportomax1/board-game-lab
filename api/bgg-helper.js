// api/bgg-helper.js - Centralized BGG API helper with authentication

// Load environment variables from .env file for local development
if (process.env.NODE_ENV !== 'production') {
    try {
        require('dotenv').config();
    } catch (e) {
        console.warn('dotenv not available, using system environment variables');
    }
}

module.exports = async (req, res) => {
    console.log('--- START: BGG Helper Function Invoked ---');
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
        console.log('CORS Preflight (OPTIONS) request handled.');
        return res.status(200).end();
    }

    // 1. Check for BGG_API_TOKEN in environment variables
    const bggToken = process.env.BGG_API_TOKEN;
    if (!bggToken) {
        const errorMsg = 'E-500: BGG_API_TOKEN not configured in environment variables.';
        console.error(errorMsg);
        console.log('--- END: BGG Helper Failed (500) ---');
        return res.status(500).json({ 
            status: 500,
            step: 'Token Check',
            error: 'Configuration Error', 
            message: errorMsg
        });
    }

    // 2. Get the API endpoint and parameters
    const endpoint = req.query.endpoint; // e.g., 'collection', 'thing', 'user', 'hot', 'geeklist'
    const params = { ...req.query };
    delete params.endpoint; // Remove endpoint from params

    if (!endpoint) {
        const errorMsg = 'E-400: Missing endpoint parameter. Supported: collection, thing, search, user, hot, geeklist, plays, family';
        console.error(errorMsg);
        console.log('--- END: BGG Helper Failed (400) ---');
        return res.status(400).json({ 
            status: 400,
            step: 'Parameter Check',
            error: 'Bad Request', 
            message: errorMsg
        });
    }

    // 3. Build the BGG URL based on endpoint
    let bggUrl;
    const paramString = new URLSearchParams(params).toString();
    
    switch (endpoint.toLowerCase()) {
        case 'collection':
            bggUrl = `https://boardgamegeek.com/xmlapi2/collection?${paramString}&wait=1`;
            break;
        case 'thing':
            bggUrl = `https://boardgamegeek.com/xmlapi2/thing?${paramString}&wait=1`;
            break;
        case 'search':
            bggUrl = `https://boardgamegeek.com/xmlapi2/search?${paramString}`;
            break;
        case 'user':
            bggUrl = `https://boardgamegeek.com/xmlapi2/user?${paramString}`;
            break;
        case 'hot':
            bggUrl = `https://boardgamegeek.com/xmlapi2/hot?${paramString}`;
            break;
        case 'geeklist':
            // Support both v1 and v2 geeklist APIs
            const geeklistId = params.id || params.geeklist;
            if (geeklistId) {
                bggUrl = `https://boardgamegeek.com/xmlapi/geeklist/${geeklistId}?${paramString}`;
            } else {
                bggUrl = `https://boardgamegeek.com/xmlapi2/geeklist?${paramString}`;
            }
            break;
        case 'plays':
            bggUrl = `https://boardgamegeek.com/xmlapi2/plays?${paramString}`;
            break;
        case 'family':
            bggUrl = `https://boardgamegeek.com/xmlapi2/family?${paramString}`;
            break;
        case 'forumlist':
            bggUrl = `https://boardgamegeek.com/xmlapi2/forumlist?${paramString}`;
            break;
        case 'thread':
            bggUrl = `https://boardgamegeek.com/xmlapi2/thread?${paramString}`;
            break;
        case 'browse':
            // Scrape the browse page for top ranked games
            // Supports page parameter, e.g., page=1
            const page = params.page || 1;
            bggUrl = `https://boardgamegeek.com/browse/boardgame/page/${page}`;
            break;
        case 'page':
            // Fetch a specific BGG game page or other page URL
            // Pass the full URL via the 'url' parameter
            const pageUrl = params.url;
            if (!pageUrl) {
                const errorMsg = 'E-400: Missing url parameter for page endpoint.';
                console.error(errorMsg);
                console.log('--- END: BGG Helper Failed (400) ---');
                return res.status(400).json({ 
                    status: 400,
                    step: 'Parameter Check',
                    error: 'Bad Request', 
                    message: errorMsg
                });
            }
            bggUrl = pageUrl;
            break;
        default:
            const errorMsg = `E-400: Unsupported endpoint '${endpoint}'. Supported: collection, thing, search, user, hot, geeklist, plays, family, forumlist, thread, browse, page`;
            console.error(errorMsg);
            console.log('--- END: BGG Helper Failed (400) ---');
            return res.status(400).json({ 
                status: 400,
                step: 'Endpoint Validation',
                error: 'Bad Request', 
                message: errorMsg
            });
    }

    console.log(`Endpoint: ${endpoint}, URL: ${bggUrl}`);
    
    const MAX_BGG_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_BGG_RETRIES; attempt++) {
        try {
            // 4. Fetch data from BGG with authentication headers
            console.log(`Fetch Step: Attempt ${attempt + 1}/${MAX_BGG_RETRIES} to call BGG API...`);
            
            const bggResponse = await fetch(bggUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Vercel-BGG-Helper/1.0',
                    'Authorization': `Bearer ${bggToken}`,
                    'Cache-Control': 'no-cache', 
                    'Accept': 'text/xml'
                }
            });
            
            console.log(`Fetch Step: BGG API responded with Status ${bggResponse.status}`);

            // 5. Handle non-200 responses from BGG
            
            // BGG 202: The request is queued — retry after a delay
            if (bggResponse.status === 202) {
                if (attempt < MAX_BGG_RETRIES - 1) {
                    const delay = 2000 + attempt * 2000;
                    console.warn(`BGG 202 queued — retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_BGG_RETRIES})`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }
                const errorMsg = 'E-202: BGG API is busy. Request queued. Please try again in 5-10 seconds.';
                console.warn(errorMsg);
                console.log('--- END: BGG Helper Queued (202) ---');
                return res.status(202).json({ 
                    status: 202,
                    step: 'BGG Fetch Status Check',
                    error: 'Request Queued', 
                    message: errorMsg
                });
            }
            
            // Retry on transient failures (429, 5xx)
            if (!bggResponse.ok) {
                const status = bggResponse.status;

                if ((status === 429 || status >= 500) && attempt < MAX_BGG_RETRIES - 1) {
                    const delay = 1500 + attempt * 1500;
                    console.warn(`BGG ${status} — retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_BGG_RETRIES})`);
                    await new Promise(r => setTimeout(r, delay));
                    continue;
                }

                let specificError = '';
                if (status === 401 || status === 403) {
                    specificError = 'BGG API authentication failed or access forbidden.';
                } else if (status === 404) {
                    specificError = `${endpoint} not found on BGG.`;
                } else if (status === 429) {
                    specificError = 'BGG API returned 429 Too Many Requests.';
                } else {
                    specificError = 'General BGG API error or downtime.';
                }
                
                const errorMsg = `E-502: BGG API failure (BGG Status: ${status}). Detail: ${specificError}`;
                
                console.error(errorMsg);
                console.log('--- END: BGG Helper Failed (502) ---');
                return res.status(502).json({ 
                    status: status,
                    step: 'BGG Fetch Status Check',
                    error: 'BGG API Error', 
                    message: errorMsg
                });
            }

            // 6. Read the response text (it's XML)
            console.log('Response Step: BGG status is 200. Reading response body...');
            const xmlText = await bggResponse.text();

            // 7. Send the raw XML text back to the client
            console.log(`Response Step: Success! Fetched ${xmlText.length} bytes of XML. Sending to client.`);
            
            res.setHeader('Content-Type', 'text/xml');
            console.log('--- END: BGG Helper Success (200) ---');
            return res.status(200).send(xmlText);

        } catch (error) {
            if (attempt < MAX_BGG_RETRIES - 1) {
                const delay = 1500 + attempt * 1500;
                console.warn(`Fetch error — retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_BGG_RETRIES}): ${error.message}`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            // 8. Handle network or internal code errors
            const errorMsg = `E-500: Internal Helper Error. Check Vercel logs for stack trace. Message: ${error.message}`;
            console.error('*** UNCAUGHT EXCEPTION IN BGG HELPER ***');
            console.error('Error Stack:', error.stack);
            console.log('--- END: BGG Helper Failed (500) ---');
            
            return res.status(500).json({ 
                status: 500,
                step: 'Uncaught Exception',
                error: 'Internal Server Error', 
                message: errorMsg
            });
        }
    }
};