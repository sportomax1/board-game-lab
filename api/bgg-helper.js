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
        const errorMsg = 'E-400: Missing endpoint parameter. Supported: collection, thing, user, hot, geeklist';
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
        default:
            const errorMsg = `E-400: Unsupported endpoint '${endpoint}'. Supported: collection, thing, user, hot, geeklist, plays`;
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
    
    try {
        // 4. Fetch data from BGG with authentication headers
        console.log('Fetch Step: Attempting to call BGG API...');
        
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
        
        // BGG 202: The request is queued
        if (bggResponse.status === 202) {
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
        
        // Handle all other failures
        if (!bggResponse.ok) {
            const status = bggResponse.status;
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
};