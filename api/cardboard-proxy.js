// api/cardboard-proxy.js - Simple server-side proxy for Cardboard Events API
// Usage: /api/cardboard-proxy?url=<encoded-url>&token=<optional-token>

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    const decoded = decodeURIComponent(url);
    const headers = {
      'User-Agent': 'Vercel-Cardboard-Proxy/1.0',
      'Accept': 'application/json'
    };

    // Optional token forwarded from client
    if (req.query.token) headers['Authorization'] = `Bearer ${req.query.token}`;

    const r = await fetch(decoded, { method: 'GET', headers });

    const body = await r.text();
    // Propagate status code and content-type
    const ct = r.headers.get('content-type') || 'application/json';
    res.setHeader('Content-Type', ct);
    return res.status(r.status).send(body);
  } catch (e) {
    console.error('cardboard-proxy error', e && e.message);
    return res.status(500).json({ error: e.message || String(e) });
  }
};
