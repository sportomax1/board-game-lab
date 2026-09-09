const TIME_ZONE = 'America/Denver';
const BATCH_SIZE = 20;
const PROBE_WINDOW = 100;
const BGG_RETRIES = 5;
const DISCOVERY_STEP = 1000;
const LOOKBACK_IDS = 150;
const MAX_TRACKED_RANGE = 6000;
const SCAN_CONCURRENCY = 5;
const SUPABASE_BATCH_SIZE = 250;

function json(res, status, payload) {
  return res.status(status).json({ ...payload, timestamp: new Date().toISOString() });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function decodeXml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function attr(tag, name) {
  const m = String(tag || '').match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return m ? decodeXml(m[1]) : null;
}

function tagText(xml, tagName) {
  const m = String(xml || '').match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return m ? decodeXml(m[1].trim()) : null;
}

function valueTag(xml, tagName) {
  const m = String(xml || '').match(new RegExp(`<${tagName}\\b[^>]*\\bvalue="([^"]*)"[^>]*\\/?\s*>`, 'i'));
  return m ? decodeXml(m[1]) : null;
}

function linkValues(xml, type) {
  const re = new RegExp(`<link\\b[^>]*\\btype="${type}"[^>]*>`, 'gi');
  const values = [];
  for (const match of String(xml || '').matchAll(re)) {
    const value = attr(match[0], 'value');
    if (value) values.push(value);
  }
  return [...new Set(values)];
}

function parentGames(xml) {
  const re = /<link\b[^>]*\btype="boardgameexpansion"[^>]*>/gi;
  const rows = [];
  for (const match of String(xml || '').matchAll(re)) {
    if (attr(match[0], 'inbound') !== 'true') continue;
    const id = Number(attr(match[0], 'id'));
    const name = attr(match[0], 'value');
    if (Number.isFinite(id)) rows.push({ id, name: name || `BGG #${id}` });
  }
  return rows;
}

function parseNumeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseRank(itemXml) {
  const tag = itemXml.match(/<rank\b[^>]*\bname="boardgame"[^>]*>/i)?.[0] || '';
  const raw = attr(tag, 'value');
  if (!raw || raw === 'Not Ranked' || raw === 'N/A') return 0;
  return Math.max(0, Math.trunc(parseNumeric(raw, 0)));
}

function parseThingItems(xmlText) {
  const blocks = String(xmlText || '').match(/<item\b[\s\S]*?<\/item>/gi) || [];
  const rows = [];
  for (const itemXml of blocks) {
    const openTag = itemXml.match(/<item\b[^>]*>/i)?.[0] || '';
    const bggId = Number(attr(openTag, 'id'));
    if (!Number.isFinite(bggId)) continue;

    const primaryTag = itemXml.match(/<name\b[^>]*\btype="primary"[^>]*>/i)?.[0] || '';
    const name = attr(primaryTag, 'value') || `BGG #${bggId}`;
    const itemType = attr(openTag, 'type') || 'boardgame';
    const yearRaw = valueTag(itemXml, 'yearpublished');
    const year = yearRaw && Number.isFinite(Number(yearRaw)) ? Number(yearRaw) : null;
    const designers = linkValues(itemXml, 'boardgamedesigner');
    const publishers = linkValues(itemXml, 'boardgamepublisher');
    const families = linkValues(itemXml, 'boardgamefamily');
    const thumbnail = tagText(itemXml, 'thumbnail');
    const usersrated = Math.max(0, Math.trunc(parseNumeric(valueTag(itemXml, 'usersrated'), 0)));
    const owned = Math.max(0, Math.trunc(parseNumeric(valueTag(itemXml, 'owned'), 0)));
    const average = parseNumeric(valueTag(itemXml, 'average'), 0);
    const rank = parseRank(itemXml);

    rows.push({
      bgg_id: bggId,
      item_type: itemType,
      name,
      year,
      thumbnail: thumbnail || null,
      designers,
      publishers,
      families,
      parent_games: parentGames(itemXml),
      prominence_score: 0,
      callout_tags: [],
      usersrated,
      owned,
      average,
      rank
    });
  }
  return rows;
}

function bggHeaders() {
  const token = process.env.BGG_API_TOKEN;
  if (!token) throw new Error('BGG_API_TOKEN is not configured');
  return {
    'User-Agent': 'Board-Game-Lab-Max-Finder/1.0',
    'Authorization': `Bearer ${token}`,
    'Accept': 'text/xml',
    'Cache-Control': 'no-cache'
  };
}

async function fetchThing(ids, stats = false) {
  if (!ids.length) return [];
  const params = new URLSearchParams({ id: ids.join(',') });
  if (stats) params.set('stats', '1');
  const url = `https://boardgamegeek.com/xmlapi2/thing?${params}`;

  for (let attempt = 0; attempt < BGG_RETRIES; attempt++) {
    const response = await fetch(url, { headers: bggHeaders() });
    if (response.status === 202 && attempt < BGG_RETRIES - 1) {
      await sleep(1500 + attempt * 1500);
      continue;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < BGG_RETRIES - 1) {
      await sleep(1200 + attempt * 1200);
      continue;
    }
    if (!response.ok) throw new Error(`BGG thing request failed with HTTP ${response.status}`);
    return parseThingItems(await response.text());
  }
  throw new Error('BGG thing request did not complete after retries');
}

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
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

function localDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

function addCalendarDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function zonedMidnightUtc(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetLocalAsUtc = Date.UTC(y, m - 1, d, 0, 0, 0);
  let guess = Date.UTC(y, m - 1, d, 7, 0, 0);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  });
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    const representedLocalAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += targetLocalAsUtc - representedLocalAsUtc;
  }
  return new Date(guess).toISOString();
}

function dayBounds(dateStr) {
  return { start: zonedMidnightUtc(dateStr), end: zonedMidnightUtc(addCalendarDays(dateStr, 1)) };
}

async function getLatestCompletedRun() {
  const rows = await supabaseRequest('/bgg_max_runs?select=*&status=eq.completed&order=scan_date.desc,completed_at.desc&limit=1');
  return rows?.[0] || null;
}

async function getLegacySeed() {
  const rows = await supabaseRequest('/bgg_scan_state?select=last_confirmed_max,last_scanned_through&scan_key=eq.global&limit=1');
  return Number(rows?.[0]?.last_confirmed_max || rows?.[0]?.last_scanned_through || 0);
}

async function upsertRun(row) {
  const rows = await supabaseRequest('/bgg_max_runs?on_conflict=scan_date', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify([row])
  });
  return rows?.[0] || row;
}

async function updateLegacyState(maxId, newCount) {
  await supabaseRequest('/bgg_scan_state?on_conflict=scan_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{
      scan_key: 'global',
      last_confirmed_max: maxId,
      last_scanned_through: maxId,
      last_scan_at: new Date().toISOString(),
      last_new_count: newCount
    }])
  });
}

async function insertNewItems(rows, discoveredAt) {
  let inserted = 0;
  for (const chunk of chunkArray(rows, SUPABASE_BATCH_SIZE)) {
    const payload = chunk.map(row => ({ ...row, discovered_at: discoveredAt }));
    const result = await supabaseRequest('/bgg_new_items?on_conflict=bgg_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(payload)
    });
    inserted += Array.isArray(result) ? result.length : 0;
  }
  return inserted;
}

function idsFrom(start, count) {
  return Array.from({ length: count }, (_, i) => start + i).filter(id => id > 0);
}

async function findCurrentMax(seed) {
  let calls = 0;
  let checked = 0;

  async function probeBatch(start) {
    const ids = idsFrom(start, BATCH_SIZE);
    const items = await fetchThing(ids, false);
    calls++;
    checked += ids.length;
    return items;
  }

  async function probeWindow(start) {
    const starts = [];
    for (let s = start; s < start + PROBE_WINDOW; s += BATCH_SIZE) starts.push(s);
    const groups = await mapLimit(starts, 3, probeBatch);
    return groups.flat();
  }

  let low = Math.max(1, Number(seed) || 1);
  if (!seed) {
    const anchors = [100000, 200000, 300000, 400000, 500000, 600000, 800000, 1000000];
    for (const anchor of anchors) {
      const items = await probeWindow(anchor);
      if (items.length) low = Math.max(low, ...items.map(x => x.bgg_id));
      else if (anchor > low) break;
    }
  }

  let high = null;
  let step = DISCOVERY_STEP;
  for (let round = 0; round < 12; round++) {
    const start = low + step;
    const items = await probeWindow(start);
    if (items.length) {
      low = Math.max(low, ...items.map(x => x.bgg_id));
      step *= 2;
    } else {
      high = start;
      break;
    }
  }
  if (high === null) high = low + step;

  for (let round = 0; round < 14 && high - low > 250; round++) {
    const mid = Math.floor((low + high) / 2);
    const start = Math.max(1, mid - Math.floor(PROBE_WINDOW / 2));
    const items = await probeWindow(start);
    if (items.length) {
      const maxHit = Math.max(...items.map(x => x.bgg_id));
      if (maxHit > low) low = maxHit;
      else high = start;
    } else {
      high = start;
    }
  }

  const denseStart = Math.max(1, low - PROBE_WINDOW);
  const denseEnd = high + PROBE_WINDOW * 2;
  const starts = [];
  for (let s = denseStart; s <= denseEnd; s += BATCH_SIZE) starts.push(s);
  const denseGroups = await mapLimit(starts, SCAN_CONCURRENCY, probeBatch);
  const denseItems = denseGroups.flat();
  let maxId = denseItems.length ? Math.max(low, ...denseItems.map(x => x.bgg_id)) : low;

  const verifyOffsets = [500, 1000, 5000];
  const verifyGroups = await mapLimit(verifyOffsets, 3, async offset => probeWindow(maxId + offset));
  const higher = verifyGroups.flat();
  if (higher.length) {
    const higherSeed = Math.max(...higher.map(x => x.bgg_id));
    const followUp = await findCurrentMax(higherSeed);
    return { maxId: followUp.maxId, calls: calls + followUp.calls, checked: checked + followUp.checked };
  }

  return { maxId, calls, checked };
}

async function scanRange(startId, endId) {
  if (endId < startId) return { items: [], checked: 0, calls: 0 };
  const total = endId - startId + 1;
  if (total > MAX_TRACKED_RANGE) {
    throw new Error(`Refusing to scan ${total} IDs in one run; max is ${MAX_TRACKED_RANGE}. Run again after reducing the gap or raise MAX_TRACKED_RANGE.`);
  }
  const batches = [];
  for (let start = startId; start <= endId; start += BATCH_SIZE) {
    batches.push(idsFrom(start, Math.min(BATCH_SIZE, endId - start + 1)));
  }
  const groups = await mapLimit(batches, SCAN_CONCURRENCY, ids => fetchThing(ids, true));
  const map = new Map();
  groups.flat().forEach(item => map.set(item.bgg_id, item));
  return { items: [...map.values()].sort((a, b) => a.bgg_id - b.bgg_id), checked: total, calls: batches.length };
}

async function runScan() {
  const startedAt = new Date().toISOString();
  const scanDate = localDate(new Date());
  const previousRun = await getLatestCompletedRun();
  const legacySeed = await getLegacySeed();
  const previousMax = previousRun?.max_id ? Number(previousRun.max_id) : legacySeed;
  const isBaseline = !previousRun;

  await upsertRun({
    scan_date: scanDate,
    started_at: startedAt,
    completed_at: null,
    previous_max_id: previousMax || null,
    max_id: null,
    id_delta: null,
    ids_checked: 0,
    valid_items_found: 0,
    new_items_inserted: 0,
    status: 'running',
    is_baseline: isBaseline,
    error: null
  });

  try {
    const discovery = await findCurrentMax(previousMax);
    const maxId = discovery.maxId;
    let range = { items: [], checked: 0, calls: 0 };
    let inserted = 0;

    if (!isBaseline) {
      const rangeStart = Math.max(1, previousMax - LOOKBACK_IDS + 1);
      range = await scanRange(rangeStart, maxId);
      inserted = await insertNewItems(range.items, new Date().toISOString());
    }

    const completedAt = new Date().toISOString();
    const row = await upsertRun({
      scan_date: scanDate,
      started_at: startedAt,
      completed_at: completedAt,
      previous_max_id: previousMax || null,
      max_id: maxId,
      id_delta: previousMax ? maxId - previousMax : null,
      ids_checked: discovery.checked + range.checked,
      valid_items_found: range.items.length,
      new_items_inserted: inserted,
      status: 'completed',
      is_baseline: isBaseline,
      error: null
    });

    await updateLegacyState(maxId, inserted);

    return {
      success: true,
      scanDate,
      baseline: isBaseline,
      previousMax: previousMax || null,
      maxId,
      delta: previousMax ? maxId - previousMax : null,
      discoveryCalls: discovery.calls,
      rangeCalls: range.calls,
      idsChecked: discovery.checked + range.checked,
      validItemsFound: range.items.length,
      newItemsInserted: inserted,
      run: row
    };
  } catch (error) {
    await upsertRun({
      scan_date: scanDate,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      previous_max_id: previousMax || null,
      max_id: null,
      id_delta: null,
      ids_checked: 0,
      valid_items_found: 0,
      new_items_inserted: 0,
      status: 'error',
      is_baseline: isBaseline,
      error: error.message
    }).catch(() => {});
    throw error;
  }
}

async function loadHistory(days = 30) {
  const limit = Math.max(1, Math.min(90, Number(days) || 30));
  return supabaseRequest(`/bgg_max_runs?select=*&order=scan_date.desc&limit=${limit}`);
}

async function loadHistoryDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) throw new Error('date must be YYYY-MM-DD');
  const runs = await supabaseRequest(`/bgg_max_runs?select=*&scan_date=eq.${encodeURIComponent(dateStr)}&limit=1`);
  const { start, end } = dayBounds(dateStr);
  const items = await supabaseRequest(`/bgg_new_items?select=bgg_id,item_type,name,year,thumbnail,designers,publishers,families,parent_games,usersrated,owned,average,rank,discovered_at&discovered_at=gte.${encodeURIComponent(start)}&discovered_at=lt.${encodeURIComponent(end)}&order=bgg_id.desc&limit=5000`);
  return { run: runs?.[0] || null, items: items || [] };
}

function authorized(req) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.authorization || '';
  const querySecret = req.query?.secret || '';
  return header === `Bearer ${expected}` || querySecret === expected;
}

module.exports = async (req, res) => {
  if (!['GET', 'POST'].includes(req.method)) return json(res, 405, { success: false, error: 'Method not allowed' });
  const mode = String(req.query.mode || (req.method === 'POST' ? 'scan' : 'history')).toLowerCase();

  try {
    if (mode === 'history') {
      if (req.query.date) {
        const result = await loadHistoryDate(String(req.query.date));
        return json(res, 200, { success: true, ...result });
      }
      const runs = await loadHistory(req.query.days);
      return json(res, 200, { success: true, runs });
    }

    if (mode === 'status') {
      const run = await getLatestCompletedRun();
      return json(res, 200, { success: true, run });
    }

    if (mode !== 'scan') return json(res, 400, { success: false, error: 'Unknown mode' });
    if (!authorized(req)) return json(res, 401, { success: false, error: 'Unauthorized' });

    const result = await runScan();
    return json(res, 200, result);
  } catch (error) {
    console.error('BGG max scan failed:', error);
    return json(res, 500, {
      success: false,
      error: error.message,
      hint: 'Check BGG_API_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, and Vercel runtime logs.'
    });
  }
};
