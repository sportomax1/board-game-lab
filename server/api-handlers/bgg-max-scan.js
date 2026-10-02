// Vercel read proxy for the live Supabase BGG Max scanner.
// Automatic scans run in Supabase Cron/Edge Functions, so this endpoint keeps
// the web UI on the same source of truth without duplicating max-finder logic.

const EDGE_URL = process.env.BGG_MAX_EDGE_URL ||
  'https://jadyqyrpgcmaixroizov.supabase.co/functions/v1/bgg-max-scan';

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(status).json(body);
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return json(res, 405, {
      success: false,
      error: 'Automatic BGG max scans run in Supabase Cron. This Vercel endpoint is read-only.'
    });
  }

  try {
    const mode = String(req.query.mode || 'history').toLowerCase();
    if (!['history', 'status'].includes(mode)) {
      return json(res, 400, { success: false, error: 'Supported modes: history, status' });
    }

    const params = new URLSearchParams({ mode });
    if (req.query.days) params.set('days', String(req.query.days));
    if (req.query.date) params.set('date', String(req.query.date));

    const upstream = await fetch(`${EDGE_URL}?${params}`, {
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }
    });
    const text = await upstream.text();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(upstream.status).send(text);
  } catch (error) {
    console.error('BGG max history proxy failed:', error);
    return json(res, 502, { success: false, error: error.message });
  }
};
