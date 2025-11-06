// Worker for connection test only
// This script will create a file named connection-test.txt in your repo root.

const GITHUB_OWNER = 'sportomax1';
const GITHUB_REPO = 'vercel';
const OUTPUT_FILE_PATH = 'connection-test.txt'; // New file to verify connection

// Helper function to commit the file to GitHub using the REST API
async function commitToGitHub(content, env) {
    if (!env.GITHUB_TOKEN) {
        console.error("GITHUB_TOKEN secret is missing.");
        return false;
    }

    const branch = 'main';
    const commitMessage = `TEST: Automated connection check at ${new new Date().toISOString()}`;
    // Base64-encode the content for the GitHub API
    const base64Content = btoa(content); 
    const githubUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${OUTPUT_FILE_PATH}?ref=${branch}`;

    // --- STEP A: Get the current file's SHA (required for updating an existing file) ---
    // If this fails (404), 'sha' remains null, which is fine for creating the file.
    let sha = null;
    try {
        const getResponse = await fetch(githubUrl, {
            method: 'GET',
            headers: {
                'Authorization': `token ${env.GITHUB_TOKEN}`,
                'User-Agent': 'Cloudflare-Worker-BGG-Cron-Test'
            }
        });
        if (getResponse.ok) {
            const data = await getResponse.json();
            sha = data.sha;
            console.log(`[TEST] Found existing file SHA: ${sha}`);
        }
    } catch (e) {
        // Ignore errors for file not found
    }

    // --- STEP B: Commit the file content ---
    const putBody = JSON.stringify({
        message: commitMessage,
        content: base64Content,
        sha: sha,
        branch: branch
    });

    const putResponse = await fetch(githubUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${env.GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Cloudflare-Worker-BGG-Cron-Test'
        },
        body: putBody
    });

    if (putResponse.ok) {
        const result = await putResponse.json();
        console.log(`[SUCCESS] GITHUB CONNECTION VERIFIED. Commit SHA: ${result.commit.sha}`);
        return true;
    } else {
        const errorText = await putResponse.text();
        // THIS IS THE CRITICAL LOG: It will show the GitHub rejection reason (e.g., 403 Forbidden)
        console.error(`[FAILURE] GITHUB CONNECTION REJECTED: ${putResponse.status} - ${errorText}`);
        return false;
    }
}

// The core worker handler for scheduled events
export default {
    // For manual testing via the public URL (YOUR_WORKER_URL/__test_github)
    async fetch(request, env, ctx) {
        if (new URL(request.url).pathname.endsWith('/__test_github')) {
            const testContent = `This file confirms the Cloudflare-GitHub connection is live. Last verified: ${new Date().toUTCString()}`;
            const success = await commitToGitHub(testContent, env);
            
            return new Response(
                success ? "Test success. Check your GitHub repository now!" : "Test FAILED. Check Cloudflare Worker Logs for the GitHub API error.",
                { status: success ? 200 : 500 }
            );
        }
        return new Response("OK", { status: 200 });
    },
    // Required for the scheduled trigger
    async scheduled(event, env, ctx) {
        console.log(`[TEST RUN] Starting simple GitHub connection test...`);
        const testContent = `This file confirms the Cloudflare-GitHub connection is live. Last verified: ${new Date().toUTCString()}`;
        await commitToGitHub(testContent, env);
    },
};
