// api/image-proxy.js - Proxy for CORS-restricted images
module.exports = async (req, res) => {
    console.log('--- START: Image Proxy Invoked ---');
    
    // Set CORS headers to allow from anywhere
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours

    if (req.method === 'OPTIONS') {
        console.log('CORS Preflight (OPTIONS) request handled.');
        return res.status(200).end();
    }

    const imageUrl = req.query.url;
    
    if (!imageUrl) {
        console.error('E-400: Missing url parameter');
        console.log('--- END: Image Proxy Failed (400) ---');
        return res.status(400).json({ 
            status: 400,
            error: 'Missing url parameter'
        });
    }

    try {
        // Decode the URL if it's been encoded
        const decodedUrl = decodeURIComponent(imageUrl);
        
        console.log(`Fetching image from: ${decodedUrl}`);
        
        // Fetch the image
        const imageResponse = await fetch(decodedUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'image/*',
                'Referer': 'https://boardgamegeek.com/',
            }
        });

        if (!imageResponse.ok) {
            console.error(`Image fetch failed: ${imageResponse.status}`);
            return res.status(imageResponse.status).json({ 
                error: `Failed to fetch image: ${imageResponse.status}`
            });
        }

        // Get content type and pass it through
        const contentType = imageResponse.headers.get('content-type');
        if (contentType) {
            res.setHeader('Content-Type', contentType);
        }

        // Stream the image data
        const arrayBuffer = await imageResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        console.log(`✓ Image proxied successfully (${buffer.length} bytes)`);
        console.log('--- END: Image Proxy Success ---');
        
        res.status(200).send(buffer);
    } catch (err) {
        console.error(`Image proxy error: ${err.message}`);
        console.log('--- END: Image Proxy Failed (500) ---');
        return res.status(500).json({ 
            status: 500,
            error: err.message
        });
    }
};
