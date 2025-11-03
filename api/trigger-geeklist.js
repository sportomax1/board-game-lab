// Public endpoint to manually trigger the geeklist fetch (for testing)
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs/promises');
const path = require('path');

const execAsync = promisify(exec);

const MAX_RETRIES = 5;
const RETRY_DELAY = 32000; // 32 seconds
const GEEKLIST_ID = '363504';
const GEEKLIST_URL = `https://boardgamegeek.com/xmlapi/geeklist/${GEEKLIST_ID}?comments=1`;
const OUTPUT_FILE = path.join(process.cwd(), 'vfm25bgg.xml');

module.exports = async (req, res) => {
  // Verify cron secret from environment variable
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.query.secret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log(`[${new Date().toISOString()}] Starting geeklist fetch...`);

    // Fetch the geeklist with retry logic
    let success = false;
    let retryCount = 0;

    while (retryCount < MAX_RETRIES && !success) {
      console.log(`[${new Date().toISOString()}] Attempt ${retryCount + 1} of ${MAX_RETRIES}...`);

      const response = await fetch(GEEKLIST_URL);
      const xmlData = await response.text();

      // Check if BGG is still processing the geeklist
      if (xmlData.includes('Your request for this geeklist has been accepted and will be processed')) {
        console.log(`[${new Date().toISOString()}] Geeklist is being processed by BGG. Waiting 32 seconds...`);
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          console.log(`[${new Date().toISOString()}] Retrying now...`);
        }
      } else {
        console.log(`[${new Date().toISOString()}] Geeklist data retrieved successfully!`);

        // Add apirundate to the XML header
        const currentDate = new Date().toUTCString();
        const currentTimestamp = Math.floor(Date.now() / 1000);

        // Insert apirundate after the opening geeklist tag
        const enhancedXml = xmlData.replace(
          /(<geeklist[^>]*>)/,
          `$1\n<apirundate>${currentDate}</apirundate>\n<apirundate_timestamp>${currentTimestamp}</apirundate_timestamp>`
        );

        // Write the file
        await fs.writeFile(OUTPUT_FILE, enhancedXml, 'utf8');
        console.log(`[${new Date().toISOString()}] XML file written successfully`);

        success = true;
      }
    }

    if (!success) {
      console.error(`[${new Date().toISOString()}] FAILED: All retries exhausted`);
      return res.status(500).json({
        error: 'Failed to fetch geeklist after all retries',
        timestamp: new Date().toISOString()
      });
    }

    // Commit and push to GitHub
    console.log(`[${new Date().toISOString()}] Committing and pushing changes...`);

    try {
      // Configure git
      await execAsync('git config user.name "github-actions[bot]"', { cwd: process.cwd() });
      await execAsync('git config user.email "github-actions[bot]@users.noreply.github.com"', { cwd: process.cwd() });

      // Add file
      await execAsync('git add vfm25bgg.xml', { cwd: process.cwd() });

      // Commit (allow failure if nothing changed)
      try {
        await execAsync('git commit -m "Update VFM geeklist"', { cwd: process.cwd() });
        console.log(`[${new Date().toISOString()}] Commit created`);
      } catch (commitError) {
        console.log(`[${new Date().toISOString()}] No changes to commit (or commit failed)`, commitError.message);
      }

      // Push to GitHub
      const pushResult = await execAsync('git push', { cwd: process.cwd() });
      console.log(`[${new Date().toISOString()}] Push successful`);

      return res.status(200).json({
        success: true,
        message: 'Geeklist fetched and pushed to GitHub',
        timestamp: new Date().toISOString()
      });
    } catch (gitError) {
      console.error(`[${new Date().toISOString()}] Git operation failed:`, gitError.message);
      return res.status(500).json({
        error: 'Git operation failed',
        details: gitError.message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error:`, error);
    return res.status(500).json({
      error: 'Failed to fetch geeklist',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
