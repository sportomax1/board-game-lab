// api/log-ranks.js - Scheduled endpoint to log game ranks to Firebase
// Called daily at 1 AM via Vercel Cron or external scheduler

const https = require('https');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

// Initialize Firebase Admin SDK
let db;

async function initializeFirebase() {
    if (db) return db;

    try {
        // Get Firebase config from environment variables
        const serviceAccountKey = {
            type: 'service_account',
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: 'https://accounts.google.com/o/oauth2/auth',
            token_uri: 'https://oauth2.googleapis.com/token',
            auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs'
        };

        // Verify required environment variables
        if (!serviceAccountKey.project_id || !serviceAccountKey.private_key) {
            throw new Error('Missing Firebase service account configuration in environment variables');
        }

        const app = initializeApp({
            credential: cert(serviceAccountKey)
        });

        db = getFirestore(app);
        console.log('✅ Firebase Admin SDK initialized');
        return db;
    } catch (error) {
        console.error('❌ Firebase initialization failed:', error.message);
        throw error;
    }
}

// Fetch BGG collection with stats
async function fetchBGGCollection(username) {
    return new Promise((resolve, reject) => {
        const bggToken = process.env.BGG_API_TOKEN;
        if (!bggToken) {
            return reject(new Error('BGG_API_TOKEN not configured'));
        }

        const params = new URLSearchParams({
            username: username,
            stats: 1,
            token: bggToken
        });

        const url = `https://www.boardgamegeek.com/xmlapi2/collection?${params}`;
        console.log(`Fetching BGG collection for ${username}...`);

        https.get(url, { timeout: 30000 }, (res) => {
            let data = '';

            res.on('data', chunk => {
                data += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 202) {
                    console.log('⏳ BGG processing... retrying in 5 seconds');
                    setTimeout(() => fetchBGGCollection(username).then(resolve).catch(reject), 5000);
                } else if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`BGG API returned status ${res.statusCode}`));
                }
            });
        }).on('error', reject).on('timeout', function() {
            this.destroy();
            reject(new Error('BGG API request timeout'));
        });
    });
}

// Parse BGG XML response
function parseGamesFromXML(xmlText) {
    const parser = require('xml2js').parseStringPromise;

    return parser(xmlText, { explicitArray: false }).then(result => {
        if (!result.items || !result.items.item) {
            return [];
        }

        const items = Array.isArray(result.items.item) ? result.items.item : [result.items.item];

        return items.map(item => {
            try {
                const rating = item.stats?.rating || {};
                const ranks = Array.isArray(rating.rank) ? rating.rank : (rating.rank ? [rating.rank] : []);

                return {
                    gameId: item.$.objectid,
                    gameName: item.name,
                    thumbnail: item.thumbnail || '',
                    year: item.yearpublished || 'N/A',
                    rating: {
                        value: parseFloat(rating.$.value) || 0,
                        usersrated: parseInt(rating.usersrated?.$.value) || 0,
                        average: parseFloat(rating.average?.$.value) || 0,
                        bayesaverage: parseFloat(rating.bayesaverage?.$.value) || 0,
                        stddev: parseFloat(rating.stddev?.$.value) || 0,
                        median: parseFloat(rating.median?.$.value) || 0
                    },
                    ranks: ranks.map(r => ({
                        type: r.$.type,
                        id: r.$.id,
                        name: r.$.name,
                        friendlyname: r.$.friendlyname,
                        value: r.$.value === 'N/A' ? null : parseInt(r.$.value),
                        bayesaverage: parseFloat(r.$.bayesaverage) || 0
                    }))
                };
            } catch (e) {
                console.error(`Error parsing game item:`, e);
                return null;
            }
        }).filter(Boolean);
    });
}

// Save rank snapshot to Firestore
async function saveRankSnapshot(db, gameData) {
    try {
        const snapshot = {
            gameId: gameData.gameId,
            gameName: gameData.gameName,
            thumbnail: gameData.thumbnail,
            year: gameData.year,
            rating: gameData.rating,
            ranks: gameData.ranks,
            timestamp: Timestamp.now(),
            dateCaptured: new Date().toISOString().split('T')[0],
            source: 'automated-daily'
        };

        const docRef = await db.collection('game_ranks').add(snapshot);
        console.log(`✅ Saved rank snapshot for "${gameData.gameName}" (Doc ID: ${docRef.id})`);
        return docRef.id;
    } catch (error) {
        console.error(`❌ Failed to save rank snapshot for "${gameData.gameName}":`, error.message);
        throw error;
    }
}

// Main handler
module.exports = async (req, res) => {
    console.log('=== LOG-RANKS ENDPOINT TRIGGERED ===');
    console.log(`Time: ${new Date().toISOString()}`);
    console.log(`Request origin: ${req.headers.origin || req.headers.referer || 'Direct/Cron'}`);

    // Verify authorization
    const authToken = req.headers['authorization'];
    const expectedToken = process.env.CRON_SECRET || 'default-token';

    if (authToken && authToken !== `Bearer ${expectedToken}`) {
        console.log('❌ Unauthorized request rejected');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const bggUsername = req.query.username || process.env.BGG_USERNAME || 'sportomax';
    const dryRun = req.query.dryRun === 'true';

    try {
        // Initialize Firebase
        const database = await initializeFirebase();

        // Fetch BGG collection
        console.log(`📚 Fetching BGG collection for user: ${bggUsername}`);
        const xmlResponse = await fetchBGGCollection(bggUsername);

        // Parse games from XML
        console.log('📋 Parsing XML response...');
        const games = await parseGamesFromXML(xmlResponse);
        console.log(`📊 Found ${games.length} games with rank data`);

        if (games.length === 0) {
            console.warn('⚠️ No games found in collection');
            return res.status(400).json({
                success: false,
                message: 'No games found in collection',
                username: bggUsername
            });
        }

        if (dryRun) {
            console.log('🔍 DRY RUN MODE - Not saving to Firestore');
            return res.status(200).json({
                success: true,
                dryRun: true,
                message: `Dry run complete. Would have saved ${games.length} games`,
                gamesProcessed: games.length,
                sampleGames: games.slice(0, 3).map(g => ({
                    name: g.gameName,
                    id: g.gameId,
                    mainRank: g.ranks[0]?.value || 'N/A'
                }))
            });
        }

        // Save each game's rank snapshot
        console.log(`💾 Saving ${games.length} rank snapshots to Firestore...`);
        const savedIds = [];
        let successCount = 0;
        let failCount = 0;

        for (const game of games) {
            try {
                const docId = await saveRankSnapshot(database, game);
                savedIds.push(docId);
                successCount++;
            } catch (error) {
                failCount++;
                console.error(`Error saving ${game.gameName}:`, error.message);
            }
        }

        console.log(`\n=== SUMMARY ===`);
        console.log(`✅ Successfully saved: ${successCount} games`);
        console.log(`❌ Failed: ${failCount} games`);
        console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
        console.log(`=== END ===\n`);

        return res.status(200).json({
            success: true,
            message: `Rank logging complete for ${bggUsername}`,
            gamesProcessed: games.length,
            successCount: successCount,
            failCount: failCount,
            timestamp: new Date().toISOString(),
            savedDocuments: savedIds,
            sample: games.slice(0, 3).map(g => ({
                name: g.gameName,
                id: g.gameId,
                mainRank: g.ranks[0]?.value || 'N/A',
                bayesAverage: g.rating.bayesaverage.toFixed(2)
            }))
        });
    } catch (error) {
        console.error('❌ FATAL ERROR:', error.message);
        console.error('Stack:', error.stack);

        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
            hint: 'Check Vercel environment variables: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL, BGG_API_TOKEN'
        });
    }
};
