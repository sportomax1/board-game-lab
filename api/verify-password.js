function normalizePassword(value) {
  let text = String(value ?? '').trim();
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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST required' });
  }

  const configuredPassword = normalizePassword(process.env.PASSWORD);
  if (!configuredPassword) {
    return res.status(500).json({ ok: false, error: 'PASSWORD is not configured in Vercel' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body && typeof body === 'object' ? body : {};

  const suppliedPassword = normalizePassword(body.password);
  const ok = suppliedPassword.length > 0 && suppliedPassword === configuredPassword;

  if (!ok) {
    return res.status(401).json({
      ok: false,
      error: 'Invalid password',
      envDetected: true,
      suppliedLength: suppliedPassword.length,
      configuredLength: configuredPassword.length
    });
  }

  return res.status(200).json({ ok: true, envDetected: true });
};
