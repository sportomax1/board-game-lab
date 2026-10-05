function normalizePassword(value) {
  let text = String(value ?? '').trim();

  // Vercel env values are sometimes pasted with matching wrapping quotes.
  if (
    text.length >= 2 &&
    ((text.startsWith('"') && text.endsWith('"')) ||
     (text.startsWith("'") && text.endsWith("'")))
  ) {
    text = text.slice(1, -1).trim();
  }

  return text;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST required' });
  }

  const configuredPassword = normalizePassword(process.env.PASSWORD);
  if (!configuredPassword) {
    console.error('PASSWORD environment variable is not configured');
    return res.status(500).json({ ok: false, error: 'PASSWORD is not configured' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body && typeof body === 'object' ? body : {};

  const suppliedPassword = normalizePassword(body.password);
  if (!suppliedPassword || suppliedPassword !== configuredPassword) {
    console.warn('Checkout password mismatch', {
      configured: true,
      configuredLength: configuredPassword.length,
      suppliedLength: suppliedPassword.length
    });
    return res.status(401).json({ ok: false, error: 'Invalid password' });
  }

  return res.status(200).json({ ok: true });
};
