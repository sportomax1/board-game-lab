export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST required' });
  }

  const configured = String(process.env.PASSWORD || '');
  const supplied = String(req.body?.password || '');

  if (!configured) {
    return res.status(500).json({ ok: false, error: 'PASSWORD is not configured' });
  }

  if (!supplied || supplied !== configured) {
    return res.status(401).json({ ok: false, error: 'Invalid access key' });
  }

  return res.status(200).json({ ok: true });
}
