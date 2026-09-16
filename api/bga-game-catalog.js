const EDGE_URL = 'https://jadyqyrpgcmaixroizov.supabase.co/functions/v1/bga-game-catalog-db';

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST required' });

  try {
    const body = req.body || {};
    const suppliedPassword = String(body.password ?? '');
    const configuredPassword = String(process.env.PASSWORD || '');

    if (!configuredPassword) return json(res, 500, { ok: false, error: 'PASSWORD is not configured' });
    if (!suppliedPassword || suppliedPassword !== configuredPassword) {
      return json(res, 401, { ok: false, error: 'Invalid access key' });
    }

    const response = await fetch(EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let payload;
    try { payload = text ? JSON.parse(text) : {}; }
    catch { payload = { ok: false, error: text || `BGA catalog DB returned HTTP ${response.status}` }; }

    if (!response.ok) {
      return json(res, response.status, {
        ok: false,
        error: payload?.error || `BGA catalog DB returned HTTP ${response.status}`,
        backend: 'supabase-edge-runtime'
      });
    }

    return json(res, 200, { ...payload, backend: 'supabase-edge-runtime' });
  } catch (error) {
    console.error('BGA catalog proxy error:', error);
    return json(res, 502, {
      ok: false,
      error: error?.message || 'BGA catalog database proxy failed',
      backend: 'supabase-edge-runtime'
    });
  }
}
