export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jadyqyrpgcmaixroizov.supabase.co';
const PUBLIC_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || PUBLIC_KEY;
const WRITE_SECRET = process.env.BGA_STUDIO_WRITE_SECRET || process.env.BGG_API_TOKEN || '';
const APP_PASSWORD = process.env.PASSWORD || '';

const HEADERS = {
  'content-type': 'application/json',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

function cleanText(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function cleanNumber(value) {
  const s = cleanText(value);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizeRow(row) {
  return {
    game_name: cleanText(row.game_name ?? row['Game name']),
    license_status: cleanText(row.license_status ?? row['License status']),
    publisher: cleanText(row.publisher ?? row['Publisher']),
    designer: cleanText(row.designer ?? row['Designer']),
    bgg_rating: cleanNumber(row.bgg_rating ?? row['BGG rating']),
    complexity: cleanNumber(row.complexity ?? row['Complexity']),
    studio_projects: cleanText(row.studio_projects ?? row['Studio projects'])
  };
}

function validPassword(password) {
  return Boolean(APP_PASSWORD) && typeof password === 'string' && password === APP_PASSWORD;
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });

  try {
    if (req.method === 'GET') {
      if (!PUBLIC_KEY) return json({ ok: false, error: 'Supabase public key is not configured.' }, 500);
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/bga_studio_games?select=*&order=game_name.asc,id.asc&limit=10000`,
        { headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${PUBLIC_KEY}` } }
      );
      const text = await r.text();
      if (!r.ok) return json({ ok: false, error: text }, r.status);
      return json({ ok: true, rows: JSON.parse(text) });
    }

    if (req.method !== 'POST') return json({ ok: false, error: 'GET or POST required.' }, 405);

    const body = await req.json();
    const action = cleanText(body.action).toLowerCase();

    if (action === 'verify') {
      return validPassword(body.password)
        ? json({ ok: true })
        : json({ ok: false, error: 'Invalid key.' }, 401);
    }

    if (action !== 'replace') return json({ ok: false, error: 'Unknown action.' }, 400);
    if (!validPassword(body.password)) return json({ ok: false, error: 'Invalid key.' }, 401);
    if (!ADMIN_KEY) return json({ ok: false, error: 'Supabase key is not configured.' }, 500);
    if (!WRITE_SECRET) {
      return json({
        ok: false,
        error: 'Studio write credential is unavailable. Expected BGG_API_TOKEN (already used by Board Game Lab) or BGA_STUDIO_WRITE_SECRET.'
      }, 500);
    }
    if (!Array.isArray(body.rows)) return json({ ok: false, error: 'rows must be an array.' }, 400);
    if (body.rows.length > 10000) return json({ ok: false, error: 'Maximum 10,000 rows per replacement.' }, 413);

    const rows = body.rows.map(normalizeRow).filter(r => r.game_name);
    if (!rows.length) return json({ ok: false, error: 'No valid games found.' }, 400);

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/replace_bga_studio_games`, {
      method: 'POST',
      headers: {
        apikey: ADMIN_KEY,
        Authorization: `Bearer ${ADMIN_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ payload: rows, p_secret: WRITE_SECRET })
    });
    const text = await r.text();
    if (!r.ok) {
      const message = /unauthorized/i.test(text)
        ? 'Studio write credential does not match Supabase Vault. Check BGG_API_TOKEN / bgg_api_token.'
        : text;
      return json({ ok: false, error: message }, r.status);
    }

    const inserted = Number(JSON.parse(text));
    return json({ ok: true, inserted, replaced: true });
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, 500);
  }
}
