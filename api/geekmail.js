const TABLE = 'geekmail_messages';
const MAX_BATCH = 250;
const MAX_IMPORT = 10000;
const FALLBACK_SUPABASE_URL = 'https://jadyqyrpgcmaixroizov.supabase.co';

const DATA_FIELDS = [
  'folder','from_username','to_username','from_avatar_url','to_avatar_url','subject',
  'message_date','message_ts','body_text','body_html','game_ids','game_names','game_urls',
  'game_artwork_urls','game_search_terms','game_match_methods','source_file'
];

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  return res.status(status).json(body);
}

function text(v) {
  return String(v ?? '');
}

function nullableText(v) {
  const s = text(v).trim();
  return s || null;
}

function cleanRow(row = {}, forcedId = null) {
  const id = forcedId ?? Number(row.message_id);
  if (!Number.isFinite(Number(id))) return null;

  return {
    message_id: Number(id),
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

function comparable(row = {}) {
  const out = {};
  for (const field of DATA_FIELDS) out[field] = row[field] == null ? '' : String(row[field]);
  return out;
}

function rowsEqual(a, b) {
  const aa = comparable(a);
  const bb = comparable(b);
  return DATA_FIELDS.every(field => aa[field] === bb[field]);
}

function getConfig() {
  const url = process.env.SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const candidates = [
    ['SUPABASE_SECRET_KEY', process.env.SUPABASE_SECRET_KEY],
    ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY]
  ];
  const hit = candidates.find(([, value]) => value);
  return { url, key: hit?.[1] || '', keySource: hit?.[0] || '' };
}

function authHeaders(key, extra = {}) {
  return {
    Authorization: `Bearer ${key}`,
    apikey: key,
    Accept: 'application/json',
    ...extra
  };
}

async function readRows(url, key, limit = MAX_IMPORT) {
  const safeLimit = Math.min(Math.max(Number(limit) || 5000, 1), MAX_IMPORT);
  const target = `${url}/rest/v1/${TABLE}?select=*&order=message_ts.desc.nullslast,message_id.desc&limit=${safeLimit}`;
  const response = await fetch(target, {
    headers: authHeaders(key, { Prefer: 'count=exact' })
  });
  const body = await response.text();
  if (!response.ok) throw Object.assign(new Error(body || `Supabase read failed (${response.status})`), { status: response.status });
  const rows = body ? JSON.parse(body) : [];
  const range = response.headers.get('content-range') || '';
  const match = range.match(/\/(\d+)$/);
  return { rows, count: match ? Number(match[1]) : rows.length };
}

async function upsertRows(url, key, rows) {
  let written = 0;
  for (let i = 0; i < rows.length; i += MAX_BATCH) {
    const batch = rows.slice(i, i + MAX_BATCH);
    const target = `${url}/rest/v1/${TABLE}?on_conflict=message_id`;
    const response = await fetch(target, {
      method: 'POST',
      headers: authHeaders(key, {
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      }),
      body: JSON.stringify(batch)
    });
    const body = await response.text();
    if (!response.ok) throw Object.assign(new Error(body || `Supabase upsert failed (${response.status})`), { status: response.status });
    written += batch.length;
  }
  return written;
}

async function deleteIds(url, key, ids) {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += MAX_BATCH) {
    const batch = ids.slice(i, i + MAX_BATCH).map(Number).filter(Number.isFinite);
    if (!batch.length) continue;
    const target = `${url}/rest/v1/${TABLE}?message_id=in.(${batch.join(',')})`;
    const response = await fetch(target, {
      method: 'DELETE',
      headers: authHeaders(key, { Prefer: 'return=representation' })
    });
    const body = await response.text();
    if (!response.ok) throw Object.assign(new Error(body || `Supabase delete failed (${response.status})`), { status: response.status });
    deleted += body ? JSON.parse(body).length : batch.length;
  }
  return deleted;
}

function calculateDelta(existingRows, incomingRows) {
  const existing = new Map(existingRows.map(r => [Number(r.message_id), r]));
  const incoming = new Map(incomingRows.map(r => [Number(r.message_id), r]));
  const added = [];
  const changed = [];
  const unchanged = [];
  const missing = [];

  for (const [id, row] of incoming) {
    const old = existing.get(id);
    if (!old) added.push(row);
    else if (!rowsEqual(old, row)) changed.push(row);
    else unchanged.push(row);
  }
  for (const [id, row] of existing) {
    if (!incoming.has(id)) missing.push(row);
  }
  return { added, changed, unchanged, missing };
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

    const { url, key, keySource } = getConfig();

    if (body.action === 'PING') {
      return json(res, 200, {
        ok: true,
        storageConfigured: Boolean(url && key),
        keySource: keySource || null
      });
    }

    if (!url || !key) {
      return json(res, 500, {
        ok: false,
        error: 'Supabase admin key is not configured. Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY in Vercel.'
      });
    }

    if (body.action === 'READ') {
      const result = await readRows(url, key, body.limit);
      return json(res, 200, { ok: true, ...result });
    }

    if (body.action === 'STATS') {
      const result = await readRows(url, key, 1);
      return json(res, 200, { ok: true, count: result.count, keySource });
    }

    if (body.action === 'CREATE') {
      const row = cleanRow(body.row || body.data || {});
      if (!row) return json(res, 400, { ok: false, error: 'A numeric message_id is required' });
      const target = `${url}/rest/v1/${TABLE}`;
      const response = await fetch(target, {
        method: 'POST',
        headers: authHeaders(key, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(row)
      });
      const payload = await response.text();
      if (!response.ok) return json(res, response.status, { ok: false, error: payload });
      return json(res, 200, { ok: true, row: (payload ? JSON.parse(payload) : [row])[0] || row });
    }

    if (body.action === 'UPDATE') {
      const id = Number(body.message_id ?? body.id);
      if (!Number.isFinite(id)) return json(res, 400, { ok: false, error: 'message_id is required' });
      const row = cleanRow(body.row || body.data || {}, id);
      const target = `${url}/rest/v1/${TABLE}?message_id=eq.${encodeURIComponent(id)}`;
      const response = await fetch(target, {
        method: 'PATCH',
        headers: authHeaders(key, { 'Content-Type': 'application/json', Prefer: 'return=representation' }),
        body: JSON.stringify(row)
      });
      const payload = await response.text();
      if (!response.ok) return json(res, response.status, { ok: false, error: payload });
      return json(res, 200, { ok: true, row: (payload ? JSON.parse(payload) : [row])[0] || row });
    }

    if (body.action === 'DELETE') {
      const id = Number(body.message_id ?? body.id);
      if (!Number.isFinite(id)) return json(res, 400, { ok: false, error: 'message_id is required' });
      const deleted = await deleteIds(url, key, [id]);
      return json(res, 200, { ok: true, deleted });
    }

    if (body.action === 'UPSERT') {
      if (!Array.isArray(body.rows) || !body.rows.length) {
        return json(res, 400, { ok: false, error: 'rows[] required' });
      }
      if (body.rows.length > MAX_IMPORT) {
        return json(res, 413, { ok: false, error: `Maximum ${MAX_IMPORT} rows per request` });
      }
      const rows = body.rows.map(cleanRow).filter(Boolean);
      if (!rows.length) return json(res, 400, { ok: false, error: 'No valid rows supplied' });
      const count = await upsertRows(url, key, rows);
      return json(res, 200, { ok: true, count });
    }

    if (body.action === 'DELTA' || body.action === 'SYNC') {
      if (!Array.isArray(body.rows)) return json(res, 400, { ok: false, error: 'rows[] required' });
      if (body.rows.length > MAX_IMPORT) {
        return json(res, 413, { ok: false, error: `Maximum ${MAX_IMPORT} rows per request` });
      }
      const rows = body.rows.map(cleanRow).filter(Boolean);
      const current = await readRows(url, key, MAX_IMPORT);
      const delta = calculateDelta(current.rows, rows);
      const summary = {
        incoming: rows.length,
        existing: current.count,
        added: delta.added.length,
        changed: delta.changed.length,
        unchanged: delta.unchanged.length,
        missing: delta.missing.length
      };

      if (body.action === 'DELTA') {
        return json(res, 200, {
          ok: true,
          summary,
          samples: {
            added: delta.added.slice(0, 25),
            changed: delta.changed.slice(0, 25),
            missing: delta.missing.slice(0, 25)
          }
        });
      }

      const mode = String(body.mode || 'merge').toLowerCase();
      if (!['merge', 'replace'].includes(mode)) {
        return json(res, 400, { ok: false, error: 'mode must be merge or replace' });
      }

      const writeRows = [...delta.added, ...delta.changed];
      const upserted = writeRows.length ? await upsertRows(url, key, writeRows) : 0;
      const deleted = mode === 'replace' && delta.missing.length
        ? await deleteIds(url, key, delta.missing.map(r => r.message_id))
        : 0;

      return json(res, 200, {
        ok: true,
        mode,
        upserted,
        deleted,
        summary
      });
    }

    return json(res, 400, { ok: false, error: 'Unknown action' });
  } catch (error) {
    console.error('GeekMail API error:', error);
    return json(res, error.status || 500, { ok: false, error: error.message || 'Internal error' });
  }
}
