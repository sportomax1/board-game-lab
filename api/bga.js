export const config = { runtime: 'edge' };

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jadyqyrpgcmaixroizov.supabase.co';
const PUBLIC_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || PUBLIC_KEY;
const WRITE_SECRET = process.env.BGA_STUDIO_WRITE_SECRET || process.env.BGG_API_TOKEN || '';
const APP_PASSWORD = process.env.PASSWORD || '';
const CATALOG_EDGE_URL = 'https://jadyqyrpgcmaixroizov.supabase.co/functions/v1/bga-game-catalog-db';
const PLAYS_SHEET_ID = '12JnWPs0cGbTfI37770cEvFzNuQNKiYorXEf6m8Yx2UU';
const PLAYS_DEFAULT_TAB = 'Data';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ALLOWED_DATA_TABLES = new Set(['bga_entities', 'bga_projects', 'bgg_collection', 'bgg_games', 'bga_studio_games']);
const DATA_SELECTS = {
  bgg_collection: 'bgg_id,name,year,bgg_rating,primary_rank,avgweight,thumb,image,designers,own,prevowned,fortrade,want,wanttoplay,wanttobuy,wishlist,preordered',
  bga_studio_games: 'id,game_name,license_status,publisher,designer,bgg_rating,complexity,studio_projects,updated_at',
};
const STUDIO_HEADERS = ['Game name', 'License status', 'Publisher', 'Designer', 'BGG rating', 'Complexity', 'Studio projects'];
const STUDIO_FIELDS = ['game_name', 'license_status', 'publisher', 'designer', 'bgg_rating', 'complexity', 'studio_projects'];

function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { ...CORS, ...headers } });
}
function json(body, status = 200, headers = {}) {
  return response(JSON.stringify(body), status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
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
function normalizeStudioRow(row = {}) {
  return {
    game_name: cleanText(row.game_name ?? row['Game name']),
    license_status: cleanText(row.license_status ?? row['License status']),
    publisher: cleanText(row.publisher ?? row.Publisher),
    designer: cleanText(row.designer ?? row.Designer),
    bgg_rating: cleanNumber(row.bgg_rating ?? row['BGG rating']),
    complexity: cleanNumber(row.complexity ?? row.Complexity),
    studio_projects: cleanText(row.studio_projects ?? row['Studio projects']),
  };
}
function validPassword(password) {
  return Boolean(APP_PASSWORD) && typeof password === 'string' && password === APP_PASSWORD;
}
function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
async function supabaseRows(path, key = PUBLIC_KEY) {
  if (!key) throw new Error('Supabase public key is not configured');
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const text = await r.text();
  if (!r.ok) throw Object.assign(new Error(text), { status: r.status });
  return text ? JSON.parse(text) : [];
}

async function handleData(req) {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST required' }, 405);
  if (!PUBLIC_KEY) return json({ ok: false, error: 'Supabase public key is not configured' }, 500);
  const { table, limit = 2000 } = await req.json();
  if (!ALLOWED_DATA_TABLES.has(table)) return json({ ok: false, error: 'Invalid table' }, 400);
  const n = Math.min(Number(limit) || 2000, 10000);
  const select = DATA_SELECTS[table] || '*';
  const order = table === 'bga_studio_games' ? '&order=game_name.asc,id.asc' : '';
  try {
    const rows = await supabaseRows(`${table}?select=${encodeURIComponent(select)}&limit=${n}${order}`);
    return json({ ok: true, table, rows });
  } catch (error) {
    return json({ ok: false, error: error.message }, error.status || 500);
  }
}

async function handlePlays(req, url) {
  if (req.method !== 'GET') return json({ ok: false, error: 'GET required' }, 405);
  const tab = (url.searchParams.get('tab') || PLAYS_DEFAULT_TAB).trim();
  if (!/^[\w .()&'!-]{1,80}$/.test(tab)) return json({ ok: false, error: 'Invalid sheet tab name' }, 400);
  try {
    const googleUrl = `https://docs.google.com/spreadsheets/d/${PLAYS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
    const upstream = await fetch(googleUrl, {
      headers: { 'User-Agent': 'BoardGameLab-BGAPlays/1.0' },
      redirect: 'follow',
    });
    const body = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';
    if (!upstream.ok) return json({ ok: false, error: `Google Sheets returned HTTP ${upstream.status}` }, 502);
    const looksLikeHtml = /^\s*</.test(body) || contentType.includes('text/html');
    const hasExpectedHeader = /(^|,)"?Year"?(,|\r?\n)/.test(body.slice(0, 500));
    if (looksLikeHtml || !hasExpectedHeader) {
      return json({ ok: false, error: 'The Google Sheet is not publicly readable as CSV. Set sharing to Anyone with the link (Viewer) or publish the Data tab.' }, 502);
    }
    return response(body, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
      'X-BGA-Plays-Tab': tab,
    });
  } catch (error) {
    return json({ ok: false, error: error?.message || 'Unknown error' }, 500);
  }
}

async function handleStudioData(req) {
  try {
    if (req.method === 'GET') {
      if (!PUBLIC_KEY) return json({ ok: false, error: 'Supabase public key is not configured.' }, 500);
      const rows = await supabaseRows('bga_studio_games?select=*&order=game_name.asc,id.asc&limit=10000');
      return json({ ok: true, rows });
    }
    if (req.method !== 'POST') return json({ ok: false, error: 'GET or POST required.' }, 405);
    const body = await req.json();
    const action = cleanText(body.action).toLowerCase();
    if (action === 'verify') {
      return validPassword(body.password) ? json({ ok: true }) : json({ ok: false, error: 'Invalid key.' }, 401);
    }
    if (action !== 'replace') return json({ ok: false, error: 'Unknown action.' }, 400);
    if (!validPassword(body.password)) return json({ ok: false, error: 'Invalid key.' }, 401);
    if (!ADMIN_KEY) return json({ ok: false, error: 'Supabase key is not configured.' }, 500);
    if (!WRITE_SECRET) return json({ ok: false, error: 'Studio write credential is unavailable. Expected BGG_API_TOKEN (already used by Board Game Lab) or BGA_STUDIO_WRITE_SECRET.' }, 500);
    if (!Array.isArray(body.rows)) return json({ ok: false, error: 'rows must be an array.' }, 400);
    if (body.rows.length > 10000) return json({ ok: false, error: 'Maximum 10,000 rows per replacement.' }, 413);
    const rows = body.rows.map(normalizeStudioRow).filter(r => r.game_name);
    if (!rows.length) return json({ ok: false, error: 'No valid games found.' }, 400);
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/replace_bga_studio_games`, {
      method: 'POST',
      headers: { apikey: ADMIN_KEY, Authorization: `Bearer ${ADMIN_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ payload: rows, p_secret: WRITE_SECRET }),
    });
    const text = await r.text();
    if (!r.ok) {
      const message = /unauthorized/i.test(text) ? 'Studio write credential does not match Supabase Vault. Check BGG_API_TOKEN / bgg_api_token.' : text;
      return json({ ok: false, error: message }, r.status);
    }
    return json({ ok: true, inserted: Number(JSON.parse(text)), replaced: true });
  } catch (error) {
    return json({ ok: false, error: error?.message || String(error) }, error.status || 500);
  }
}

async function handleStudioExport(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return response('GET required', 405, { 'Content-Type': 'text/plain; charset=utf-8' });
  if (!PUBLIC_KEY) return response('Supabase public key is not configured', 500, { 'Content-Type': 'text/plain; charset=utf-8' });
  try {
    const rows = await supabaseRows('bga_studio_games?select=*&order=game_name.asc,id.asc&limit=10000');
    const csv = [STUDIO_HEADERS.join(','), ...rows.map(row => STUDIO_FIELDS.map(f => csvCell(row[f])).join(','))].join('\n');
    return response(req.method === 'HEAD' ? '' : csv, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Disposition': 'inline; filename="bga-studio.csv"',
    });
  } catch (error) {
    return response(error.message, error.status || 500, { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

async function handleGameCatalog(req) {
  if (req.method !== 'POST') return json({ ok: false, error: 'POST required' }, 405);
  try {
    const body = await req.json();
    const suppliedPassword = String(body.password ?? '');
    if (!APP_PASSWORD) return json({ ok: false, error: 'PASSWORD is not configured' }, 500);
    if (!suppliedPassword || suppliedPassword !== APP_PASSWORD) return json({ ok: false, error: 'Invalid access key' }, 401);
    const upstream = await fetch(CATALOG_EDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await upstream.text();
    let payload;
    try { payload = text ? JSON.parse(text) : {}; }
    catch { payload = { ok: false, error: text || `BGA catalog DB returned HTTP ${upstream.status}` }; }
    if (!upstream.ok) return json({ ok: false, error: payload?.error || `BGA catalog DB returned HTTP ${upstream.status}`, backend: 'supabase-edge-runtime' }, upstream.status);
    return json({ ...payload, backend: 'supabase-edge-runtime' });
  } catch (error) {
    console.error('BGA catalog proxy error:', error);
    return json({ ok: false, error: error?.message || 'BGA catalog database proxy failed', backend: 'supabase-edge-runtime' }, 502);
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return response(null, 204);
  const url = new URL(req.url);
  const route = (url.searchParams.get('route') || '').toLowerCase();
  switch (route) {
    case 'data': return handleData(req);
    case 'plays': return handlePlays(req, url);
    case 'studio-data': return handleStudioData(req);
    case 'studio-export': return handleStudioExport(req);
    case 'game-catalog': return handleGameCatalog(req);
    default:
      return json({ ok: false, error: 'Unknown BGA route', routes: ['data', 'plays', 'studio-data', 'studio-export', 'game-catalog'] }, 404);
  }
}
