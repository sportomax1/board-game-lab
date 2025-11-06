// This script is the complete replacement for the Vercel cron-fetch-geeklist.js.
// It uses Cloudflare's scheduled handler and the GitHub REST API for committing files.

const MAX_RETRIES = 5;
const RETRY_DELAY = 32000; // 32 seconds
const GEEKLIST_ID = '363504';
const GEEKLIST_URL = `https://boardgamegeek.com/xmlapi/geeklist/${GEEKLIST_ID}?comments=1`;
const OUTPUT_FILE_PATH = 'vfm25bgg.xml'; // The file path in the root of your GitHub repo

// --- YOUR GITHUB REPO DETAILS ---
const GITHUB_OWNER = 'sportomax1';
const GITHUB_REPO = 'vercel';
// --------------------------------

// Helper function to commit the file to GitHub using the REST API
async function commitToGitHub(xmlData, env) {
    if (!env.GITHUB_TOKEN) {
        console.error("GITHUB_TOKEN secret is missing. Cannot commit to GitHub.");
        return;
    }

    const branch = 'main';
    const commitMessage = 'Automated update of VFM geeklist from Cloudflare Worker';

    // 1. Base64-encode the content, as required by the GitHub Content API
    const content = btoa(xmlData);

    const githubUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${OUTPUT_FILE_PATH}?ref=${branch}`;

    // --- STEP A: Get the current file's SHA (required for updating an existing file) ---
    const getResponse = await fetch(githubUrl, {
        method: 'GET',
        headers: {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'User-Agent': 'Cloudflare-Worker-BGG-Cron'
        }
    });

    let sha = null;
    if (getResponse.ok) {
        const data = await getResponse.json();
        sha = data.sha;
        console.log(`Found existing file SHA: ${sha}`);
    } else if (getResponse.status !== 404) {
        // If it fails for any reason other than 404 (file not found)
        console.error(`Failed to fetch current file SHA: ${getResponse.status} - ${getResponse.statusText}`);
        return;
    }

    // --- STEP B: Commit the new file content ---
    const putBody = JSON.stringify({
        message: commitMessage,
        content: content,
        sha: sha, // Include the SHA to update the file
        branch: branch
    });

    const putResponse = await fetch(githubUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Cloudflare-Worker-BGG-Cron'
        },
        body: putBody
    });

    if (putResponse.ok) {
        const result = await putResponse.json();
        console.log(`[SUCCESS] GitHub commit successful. Commit SHA: ${result.commit.sha}`);
        console.log(`File committed. Size: ${xmlData.length} bytes.`);
    } else {
        const errorText = await putResponse.text();
        console.error(`[FAILURE] GitHub commit failed: ${putResponse.status} - ${errorText}`);
    }
}


// The core worker handler for scheduled events
export default {
    async scheduled(event, env, ctx) {
        let success = false;
        let retryCount = 0;
        let xmlData = '';
        let enhancedXml = '';

        console.log(`[${new Date().toISOString()}] Starting BGG geeklist fetch...`);

        // --- FETCH AND RETRY LOGIC ---
        while (retryCount < MAX_RETRIES && !success) {
            console.log(`[${new Date().toISOString()}] Attempt ${retryCount + 1} of ${MAX_RETRIES}...`);
            const response = await fetch(GEEKLIST_URL);
            xmlData = await response.text();

            if (xmlData.includes('Your request for this geeklist has been accepted and will be processed')) {
                console.log(`[${new Date().toISOString()}] Geeklist is being processed by BGG. Waiting 32 seconds...`);
                retryCount++;
                if (retryCount < MAX_RETRIES) {
                    ctx.waitUntil(new Promise(resolve => setTimeout(resolve, RETRY_DELAY)));
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
                    console.log(`[${new Date().toISOString()}] Retrying now...`);
                }
            } else {
                success = true;
            }
        }
        // --- END FETCH AND RETRY LOGIC ---


        if (success) {
            console.log(`[${new Date().toISOString()}] Geeklist data retrieved successfully!`);

            // --- ADD APIRUNDATE LOGIC (identical to original code) ---
            const currentDate = new Date().toUTCString();
            const currentTimestamp = Math.floor(Date.now() / 1000);

            enhancedXml = xmlData.replace(
              /(<geeklist[^>]*>)/,
              `$1\n<apirundate>${currentDate}</apirundate>\n<apirundate_timestamp>${currentTimestamp}</apirundate_timestamp>`
            );
            // --- END APIRUNDATE LOGIC ---

            // --- NEW: COMMIT TO GITHUB ---
            console.log(`[${new Date().toISOString()}] Committing changes via GitHub API...`);
            await commitToGitHub(enhancedXml, env);
            // --- END NEW LOGIC ---

        } else {
            console.error(`[${new Date().toISOString()}] FAILED: All retries exhausted. Cannot update GitHub.`);
        }
    },
};
