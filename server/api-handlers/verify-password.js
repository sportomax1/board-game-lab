module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST required' });
  }

  const configuredPassword = String(process.env.PASSWORD || '');
  if (!configuredPassword) {
    console.error('PASSWORD environment variable is not configured');
    return res.status(500).json({ ok: false, error: 'PASSWORD is not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body && typeof body === 'object' ? body : {};

  const suppliedPassword = String(body.password || '');
  if (!suppliedPassword || suppliedPassword !== configuredPassword) {
    return res.status(401).json({ ok: false, error: 'Invalid password' });
  }

  return res.status(200).json({ ok: true });
};
