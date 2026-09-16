export const config = { runtime: 'edge' };

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }
});

const normalizeRow = row => ({
  game_key: String(row.game_key ?? row.Key ?? '').trim(),
  game: String(row.game ?? row.Game ?? '').trim(),
  status: String(row.status ?? row.Status ?? '').trim(),
  players: String(row.players ?? row.Players ?? '').trim(),
  minutes: row.minutes === '' || row.minutes == null ? null : Number(row.minutes ?? row.Minutes),
  premium: typeof row.premium === 'boolean' ? row.premium : /^yes|true|1$/i.test(String(row.Premium ?? row.premium ?? '')),
  url: String(row.url ?? row.URL ?? '').trim(),
  source: String(row.source ?? 'bga_gamelist'),
  bgg_id: row.bgg_id == null || row.bgg_id === '' ? null : Number(row.bgg_id),
  bgg_name: row.bgg_name ?? null,
  bgg_thumbnail: row.bgg_thumbnail ?? null,
  bgg_username: row.bgg_username ?? null,
  bgg_status: row.bgg_status && typeof row.bgg_status === 'object' ? row.bgg_status : {},
  updated_at: new Date().toISOString()
});

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ ok: false, error: 'Supabase server credentials are not configured.' }, 500);

  const headers = { Authorization: `Bearer ${key}`, apikey: key, Accept: 'application/json' };
  const tableUrl = `${url}/rest/v1/bga_game_catalog`;

  try {
    if (req.method === 'GET') {
      const r = await fetch(`${tableUrl}?select=*&order=game.asc&limit=10000`, { headers });
      const text = await r.text();
      if (!r.ok) return json({ ok: false, error: text }, r.status);
      const rows = JSON.parse(text);
      return json({ ok: true, rows, count: rows.length });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const input = Array.isArray(body.rows) ? body.rows : [];
      const rows = input.map(normalizeRow).filter(r => r.game_key && r.game);
      if (!rows.length) return json({ ok: false, error: 'No valid rows supplied.' }, 400);

      const batchSize = 500;
      let saved = 0;
      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const r = await fetch(`${tableUrl}?on_conflict=game_key`, {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates,return=minimal'
          },
          body: JSON.stringify(batch)
        });
        const text = await r.text();
        if (!r.ok) return json({ ok: false, error: text, saved }, r.status);
        saved += batch.length;
      }
      return json({ ok: true, saved });
    }

    return json({ ok: false, error: 'GET or POST required.' }, 405);
  } catch (error) {
    return json({ ok: false, error: error.message }, 500);
  }
}
