const TABLE = 'geekmail_messages';
const MAX_BATCH = 250;

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  return res.status(status).json(body);
}

function cleanRow(row = {}) {
  const text = (v) => String(v ?? '');
  const nullableText = (v) => {
    const s = String(v ?? '').trim();
    return s || null;
  };
  const id = Number(row.message_id);
  if (!Number.isFinite(id)) return null;

  return {
    message_id: id,
    folder: text(row.folder),
    from_username: text(row.from_username),
    to_username: text(row.to_username),
    from_avatar_url: text(row.from_avatar_url),
    to_avatar_url: text(row.to_avatar_url),
    subject: text(row.subject),
    message_date: text(row.message_date),
    message_ts: nullableText(row.message_ts),
    body_text: text(row.body_text),
    body_html: text(row.body_html),
    game_ids: text(row.game_ids),
    game_names: text(row.game_names),
    game_urls: text(row.game_urls),
    game_artwork_urls: text(row.game_artwork_urls),
    game_search_terms: text(row.game_search_terms),
    game_match_methods: text(row.game_match_methods),
    source_file: text(row.source_file),
    updated_at: new Date().toISOString()
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST required' });

  try {
    const body = req.body || {};
    const suppliedPassword = String(body.password ?? '');
    const configuredPassword = process.env.PASSWORD || '';

    if (!configuredPassword) return json(res, 500, { ok: false, error: 'PASSWORD is not configured' });
    if (!suppliedPassword || suppliedPassword !== configuredPassword) {
      return json(res, 401, { ok: false, error: 'Invalid access key' });
    }

    if (body.action === 'PING') return json(res, 200, { ok: true });

    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      return json(res, 500, {
        ok: false,
        error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required'
      });
    }

    const headers = {
      Authorization: `Bearer ${key}`,
      apikey: key,
      Accept: 'application/json'
    };

    if (body.action === 'READ') {
      const limit = Math.min(Math.max(Number(body.limit) || 5000, 1), 5000);
      const target = `${url}/rest/v1/${TABLE}?select=*&order=message_ts.desc.nullslast,message_id.desc&limit=${limit}`;
      const response = await fetch(target, {
        headers: { ...headers, Prefer: 'count=exact' }
      });
      const text = await response.text();
      if (!response.ok) return json(res, response.status, { ok: false, error: text });

      const rows = text ? JSON.parse(text) : [];
      const range = response.headers.get('content-range') || '';
      const match = range.match(/\/(\d+)$/);
      const count = match ? Number(match[1]) : rows.length;
      return json(res, 200, { ok: true, rows, count });
    }

    if (body.action === 'UPSERT') {
      if (!Array.isArray(body.rows) || !body.rows.length) {
        return json(res, 400, { ok: false, error: 'rows[] required' });
      }
      if (body.rows.length > MAX_BATCH) {
        return json(res, 413, { ok: false, error: `Maximum ${MAX_BATCH} rows per request` });
      }

      const rows = body.rows.map(cleanRow).filter(Boolean);
      if (!rows.length) return json(res, 400, { ok: false, error: 'No valid rows supplied' });

      const target = `${url}/rest/v1/${TABLE}?on_conflict=message_id`;
      const response = await fetch(target, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(rows)
      });
      const text = await response.text();
      if (!response.ok) return json(res, response.status, { ok: false, error: text });
      return json(res, 200, { ok: true, count: rows.length });
    }

    if (body.action === 'STATS') {
      const target = `${url}/rest/v1/${TABLE}?select=message_id`;
      const response = await fetch(target, {
        method: 'HEAD',
        headers: { ...headers, Prefer: 'count=exact' }
      });
      if (!response.ok) return json(res, response.status, { ok: false, error: await response.text() });
      const range = response.headers.get('content-range') || '';
      const match = range.match(/\/(\d+)$/);
      return json(res, 200, { ok: true, count: match ? Number(match[1]) : 0 });
    }

    return json(res, 400, { ok: false, error: 'Unknown action' });
  } catch (error) {
    console.error('GeekMail API error:', error);
    return json(res, 500, { ok: false, error: error.message || 'Internal error' });
  }
}
