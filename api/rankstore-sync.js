// api/rankstore-sync.js
// Server-side RankStore Pro sync endpoint for Vercel Cron.
// Mirrors the browser sync in rankstore.html, but writes directly to Supabase REST.

const DEFAULT_USERNAME = 'sportomax';
const BGG_RETRIES = 5;
const SUPABASE_BATCH_SIZE = 500;

function json(res, status, payload) {
  return res.status(status).json({ ...payload, timestamp: new Date().toISOString() });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
}

function textBetween(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : null;
}

function decodeXml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function inList(values) {
  return `(${values.map(v => encodeURIComponent(String(v))).join(',')})`;
}

async function fetchBggCollection(username) {
  const params = new URLSearchParams({ username, own: '1', stats: '1' });
  const url = `https://boardgamegeek.com/xmlapi2/collection?${params}&wait=1`;
  const headers = {
    'User-Agent': 'RankStore-Pro-Cron/1.0',
    'Accept': 'text/xml',
    'Cache-Control': 'no-cache'
  };

  if (process.env.BGG_API_TOKEN) {
    headers.Authorization = `Bearer ${process.env.BGG_API_TOKEN}`;
  }

  for (let attempt = 0; attempt < BGG_RETRIES; attempt++) {
    const response = await fetch(url, { headers });

    if (response.status === 202 && attempt < BGG_RETRIES - 1) {
      await sleep(2000 + attempt * 2000);
      continue;
    }

    if ((response.status === 429 || response.status >= 500) && attempt < BGG_RETRIES - 1) {
      await sleep(1500 + attempt * 1500);
      continue;
    }

    if (!response.ok) {
      throw new Error(`BGG collection request failed with HTTP ${response.status}`);
    }

    return response.text();
  }

  throw new Error('BGG collection request did not complete after retries');
}

function parseRankedGames(xmlText) {
  const items = xmlText.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const seen = new Set();
  const gameRows = [];
  const rankedGames = [];

  for (const item of items) {
    const openTag = item.match(/<item\b[^>]*>/i)?.[0] || '';
    const bggId = Number(attr(openTag, 'objectid'));
    if (!Number.isFinite(bggId) || seen.has(bggId)) continue;
    seen.add(bggId);

    const name = textBetween(item, 'name') || `BGG #${bggId}`;
    const thumbnail = textBetween(item, 'thumbnail');
    gameRows.push({ bgg_id: bggId, game_name: name, thumbnail_url: thumbnail || null });

    const rankTag = item.match(/<rank\b[^>]*name="boardgame"[^>]*>/i)?.[0] || '';
    const rankValue = attr(rankTag, 'value');
    if (!rankValue || rankValue === 'Not Ranked' || rankValue === 'N/A') continue;

    const bggRank = Number(rankValue);
    if (Number.isFinite(bggRank)) {
      rankedGames.push({ bgg_id: bggId, game_name: name, bgg_rank: bggRank });
    }
  }

  return { checkedCount: items.length, gameRows, rankedGames };
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');
  }

  return {
    baseUrl: `${url.replace(/\/$/, '')}/rest/v1`,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  };
}

async function supabaseRequest(path, options = {}) {
  const cfg = supabaseConfig();
  const response = await fetch(`${cfg.baseUrl}${path}`, {
    ...options,
    headers: { ...cfg.headers, ...(options.headers || {}) }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${options.method || 'GET'} ${path} failed: HTTP ${response.status} ${body}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function insertRun(username, now) {
  const rows = await supabaseRequest('/rank_runs?select=id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify([{ username, status: 'running', started_at: now, notes: 'Cron sync started' }])
  });
  return rows?.[0]?.id;
}

async function updateRun(id, patch) {
  if (!id) return;
  await supabaseRequest(`/rank_runs?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(patch)
  });
}

async function upsertRows(table, rows, conflictColumn) {
  if (!rows.length) return;
  for (const chunk of chunkArray(rows, SUPABASE_BATCH_SIZE)) {
    await supabaseRequest(`/${table}?on_conflict=${conflictColumn}`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(chunk)
    });
  }
}

async function insertRows(table, rows) {
  if (!rows.length) return;
  for (const chunk of chunkArray(rows, SUPABASE_BATCH_SIZE)) {
    await supabaseRequest(`/${table}`, {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(chunk)
    });
  }
}

async function loadCurrentRankMap(ids) {
  const map = new Map();
  for (const chunk of chunkArray(ids, SUPABASE_BATCH_SIZE)) {
    const rows = await supabaseRequest(`/rank_current?select=bgg_id,bgg_rank&bgg_id=in.${inList(chunk)}`);
    (rows || []).forEach(row => map.set(Number(row.bgg_id), row));
  }
  return map;
}

async function closeActivePeriods(ids, now) {
  if (!ids.length) return;
  for (const chunk of chunkArray(ids, SUPABASE_BATCH_SIZE)) {
    await supabaseRequest(`/rank_periods?bgg_id=in.${inList(chunk)}&valid_to=is.null`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ valid_to: now })
    });
  }
}

async function runRankStoreSync(username) {
  const now = new Date().toISOString();
  let runId = null;

  try {
    runId = await insertRun(username, now);

    const xml = await fetchBggCollection(username);
    const { checkedCount, gameRows, rankedGames } = parseRankedGames(xml);

    const stampedGameRows = gameRows.map(row => ({ ...row, updated_at: now }));
    const stampedRankRows = rankedGames.map(row => ({ ...row, last_checked_at: now, updated_at: now }));

    await upsertRows('rank_games', stampedGameRows, 'bgg_id');

    const existing = await loadCurrentRankMap(stampedRankRows.map(row => row.bgg_id));
    const insertedIds = [];
    const changedIds = [];
    const unchangedIds = [];
    const newPeriods = [];

    for (const game of stampedRankRows) {
      const prev = existing.get(game.bgg_id);
      if (!prev) {
        insertedIds.push(game.bgg_id);
        newPeriods.push({
          bgg_id: game.bgg_id,
          game_name: game.game_name,
          bgg_rank: game.bgg_rank,
          valid_from: now,
          valid_to: null
        });
      } else if (Number(prev.bgg_rank) === Number(game.bgg_rank)) {
        unchangedIds.push(game.bgg_id);
      } else {
        changedIds.push(game.bgg_id);
        newPeriods.push({
          bgg_id: game.bgg_id,
          game_name: game.game_name,
          bgg_rank: game.bgg_rank,
          valid_from: now,
          valid_to: null
        });
      }
    }

    await upsertRows('rank_current', stampedRankRows, 'bgg_id');
    await closeActivePeriods(changedIds, now);
    await insertRows('rank_periods', newPeriods);

    const summary = {
      checked_count: checkedCount,
      ranked_count: stampedRankRows.length,
      inserted_count: insertedIds.length,
      changed_count: changedIds.length,
      unchanged_count: unchangedIds.length,
      finished_at: new Date().toISOString(),
      status: 'success',
      notes: `Cron OK: ${stampedRankRows.length} ranked, ${newPeriods.length} new periods.`
    };

    await updateRun(runId, summary);

    return {
      success: true,
      runId,
      username,
      checkedCount,
      rankedCount: stampedRankRows.length,
      insertedCount: insertedIds.length,
      changedCount: changedIds.length,
      unchangedCount: unchangedIds.length,
      newPeriods: newPeriods.length
    };
  } catch (error) {
    await updateRun(runId, {
      finished_at: new Date().toISOString(),
      status: 'error',
      notes: error.message
    }).catch(() => {});
    throw error;
  }
}

module.exports = async (req, res) => {
  if (!['GET', 'POST'].includes(req.method)) {
    return json(res, 405, { success: false, error: 'Method not allowed' });
  }

  const expectedToken = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;

  if (authHeader && expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return json(res, 401, { success: false, error: 'Unauthorized' });
  }

  const username = req.query.username || process.env.BGG_USERNAME || DEFAULT_USERNAME;
  const dryRun = req.query.dryRun === 'true';

  try {
    if (dryRun) {
      const xml = await fetchBggCollection(username);
      const parsed = parseRankedGames(xml);
      return json(res, 200, {
        success: true,
        dryRun: true,
        username,
        checkedCount: parsed.checkedCount,
        rankedCount: parsed.rankedGames.length,
        sample: parsed.rankedGames.slice(0, 5)
      });
    }

    const result = await runRankStoreSync(username);
    return json(res, 200, result);
  } catch (error) {
    console.error('RankStore cron sync failed:', error);
    return json(res, 500, {
      success: false,
      error: error.message,
      hint: 'Check Vercel env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY, optional BGG_USERNAME, optional BGG_API_TOKEN.'
    });
  }
};
