// Simple test endpoint
module.exports = async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret || req.query.secret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  return res.status(200).json({
    success: true,
    message: 'Test endpoint working!',
    timestamp: new Date().toISOString(),
    env: {
      hasToken: !!process.env.GITHUB_TOKEN,
      hasBGGToken: !!process.env.BGG_API_TOKEN
    }
  });
};
