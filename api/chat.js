export const config = { runtime: 'edge' };

// ============================================================
//  LOGGING HELPERS — color-coded, timestamped, structured
// ============================================================
const _ts = () => new Date().toISOString();
const log = {
  info:  (...a) => console.log(  `[${_ts()}] ℹ️  INFO `, ...a),
  ok:    (...a) => console.log(  `[${_ts()}] ✅  OK   `, ...a),
  warn:  (...a) => console.warn( `[${_ts()}] ⚠️  WARN `, ...a),
  error: (...a) => console.error(`[${_ts()}] ❌  ERROR`, ...a),
  debug: (...a) => console.log(  `[${_ts()}] 🐛  DEBUG`, ...a),
  api:   (...a) => console.log(  `[${_ts()}] 🌐  API  `, ...a),
};

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function isLikelyImageColumn(columnName = '') {
  return /(image|thumbnail|thumb|photo|picture|cover|avatar|poster|icon|url)$/i.test(columnName);
}

function isLikelyImageUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) && /\.(jpg|jpeg|png|gif|webp|avif)(\?|#|$)/i.test(value);
}

function formatCellForContext(key, value) {
  if (value === null || value === undefined) return value;
  if (isLikelyImageColumn(key) || isLikelyImageUrl(value)) {
    return `${value}  [render as Markdown image if relevant: ![${key || 'image'}](${value})]`;
  }
  return value;
}

function compactRowsForContext(rows) {
  return rows.map(row => {
    const out = {};
    for (const [key, value] of Object.entries(row)) out[key] = formatCellForContext(key, value);
    return out;
  });
}

function buildPrompt(message, dbContext) {
  return `You are Gemini Pro, a helpful assistant inside Kevin's Vercel app.

IMPORTANT WARNING / BOUNDS:
- Prefer database-grounded answers when the user's question is about Kevin's data, tables, records, board game collection, images/covers stored in the database, or anything clearly present in CURRENT DATABASE CONTEXT.
- If the database context does not contain the answer, say that briefly and then answer using general knowledge when appropriate.
- Do not pretend general knowledge came from the database. Label source clearly when useful: "From your database", "From general knowledge", or "Mixed".
- For current or fast-changing facts such as active sports rosters, schedules, injuries, prices, or news, include a short warning like: "This may need verification because it can change." Then give the best general answer you can.
- If a user asks for something outside safe/legal/ethical bounds, refuse briefly.

IMAGE / COVER HANDLING:
- If the database context includes an image, thumbnail, cover, photo, picture, or URL field relevant to the user request, render it directly in Markdown using: ![short label](url)
- If the user asks to SHOW a cover/photo and a relevant image URL exists in context, put the Markdown image near the top of the answer.
- You can display existing image URLs. You cannot generate brand-new AI images from this endpoint.

DATABASE + CHART RULES:
- Use Markdown tables for useful data.
- If the user asks for a chart, graph, or visualization, include a JSON block for Chart.js exactly like:
\`\`\`json
{
  "type": "CHART",
  "chartType": "pie|bar|line",
  "label": "Title",
  "data": [{"label": "A", "value": 10}]
}
\`\`\`
- For data changes or specific searches, you MAY include one JSON CRUD block if needed:
\`\`\`json
{
  "action": "READ|CREATE|UPDATE|DELETE",
  "table": "table_name",
  "query": {"field": "search_value"},
  "data": {"field": "new_value"},
  "id": "record_id"
}
\`\`\`

CURRENT DATABASE CONTEXT:
${dbContext}

USER MESSAGE:
${message}`;
}

export default async function handler(req) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const debugLog = [];
  const pushDebug = (entry) => { debugLog.push({ t: _ts(), ...entry }); };

  log.info(`[${requestId}] ── NEW REQUEST ─────────────────────────`);
  log.debug(`[${requestId}] Method: ${req.method}  URL: ${req.url}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ reply: 'Use POST with JSON body: { "message": "..." }', debug: debugLog }, 405);
  }

  try {
    let body;
    try {
      body = await req.json();
      log.debug(`[${requestId}] Parsed body:`, JSON.stringify(body).slice(0, 500));
      pushDebug({ step: 'parse_body', ok: true, keys: Object.keys(body) });
    } catch (parseErr) {
      pushDebug({ step: 'parse_body', ok: false, error: parseErr.message });
      return jsonResponse({ reply: 'Invalid request body — expected JSON with { "message": "..." }', debug: debugLog }, 400);
    }

    const { message } = body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      pushDebug({ step: 'validate_message', ok: false, received: typeof message });
      return jsonResponse({ reply: 'Missing "message" field in request body.', debug: debugLog }, 400);
    }
    pushDebug({ step: 'validate_message', ok: true, len: message.length });

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      pushDebug({ step: 'api_key_check', ok: false });
      return jsonResponse({
        reply: 'Server config error: GOOGLE_GEMINI_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.',
        debug: debugLog,
      }, 500);
    }
    pushDebug({ step: 'api_key_check', ok: true, masked: apiKey.slice(0, 6) + '…' + apiKey.slice(-4), len: apiKey.length });

    // Use stable text-generation models and avoid system_instruction because some model/API combos reject it.
    const modelEntries = [
      ['gemini-2.0-flash', 'v1beta'],
      ['gemini-1.5-flash', 'v1beta'],
      ['gemini-1.5-flash', 'v1'],
    ];
    pushDebug({ step: 'model_list', models: modelEntries.map(([model, apiVersion]) => `${model}/${apiVersion}`) });

    const PER_CALL_TIMEOUT_MS = 8000;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    let tablesEnv = process.env.SUPABASE_TABLES;

    if (!tablesEnv && supabaseUrl && supabaseServiceKey) {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/pg_tables?select=tablename&schemaname=eq.public`, {
          headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'apikey': supabaseServiceKey }
        });
        if (res.ok) {
          const rows = await res.json();
          tablesEnv = rows.map(r => r.tablename).join(',');
          pushDebug({ step: 'discover_tables', ok: true, count: rows.length });
        } else {
          pushDebug({ step: 'discover_tables', ok: false, status: res.status });
        }
      } catch (e) {
        log.warn(`[${requestId}] Auto-discovery failed:`, e.message);
        pushDebug({ step: 'discover_tables', ok: false, error: e.message });
      }
    }

    let dbContext = 'No database context available.';
    if (supabaseUrl && supabaseServiceKey && tablesEnv) {
      try {
        const tables = tablesEnv.split(',').map(t => t.trim()).filter(Boolean);
        const contextParts = [];

        for (const table of tables) {
          const res = await fetch(`${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?select=*&limit=15`, {
            headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'apikey': supabaseServiceKey }
          });
          if (res.ok) {
            const data = await res.json();
            const rowsForContext = compactRowsForContext(Array.isArray(data) ? data : []);
            const columns = rowsForContext.length > 0 ? Object.keys(rowsForContext[0]) : ['unknown'];
            contextParts.push(`TABLE: ${table}\nCOLUMNS: ${columns.join(', ')}\nDATA SAMPLE (up to 15 rows):\n${JSON.stringify(rowsForContext, null, 2)}`);
          } else {
            contextParts.push(`TABLE: ${table}\nERROR: Could not fetch sample rows. HTTP ${res.status}`);
          }
        }
        dbContext = contextParts.join('\n\n---\n\n');
        pushDebug({ step: 'db_context', ok: true, tables: tables.length, chars: dbContext.length });
      } catch (err) {
        log.warn(`[${requestId}] DB Context fetch failed:`, err.message);
        pushDebug({ step: 'db_context', ok: false, error: err.message });
      }
    } else {
      pushDebug({ step: 'db_context', ok: false, reason: 'Missing Supabase env vars or table list' });
    }

    const fullPrompt = buildPrompt(message, dbContext);
    let lastError = '';

    for (let i = 0; i < modelEntries.length; i++) {
      const [model, apiVersion] = modelEntries[i];
      const attempt = i + 1;
      const apiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
      pushDebug({ step: 'model_attempt', attempt, model, apiVersion });

      try {
        const payload = {
          contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.35,
            topP: 0.95,
            maxOutputTokens: 2048,
          }
        };

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
        const t0 = Date.now();
        let response;
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
        const elapsed = Date.now() - t0;
        pushDebug({ step: 'api_response', model, apiVersion, status: response.status, ms: elapsed });

        let data;
        try {
          data = await response.json();
        } catch (jsonErr) {
          lastError = `JSON parse error from ${model}: ${jsonErr.message}`;
          pushDebug({ step: 'api_json_parse', model, ok: false, error: jsonErr.message });
          continue;
        }

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const replyText = data.candidates[0].content.parts[0].text;
          pushDebug({ step: 'success', model, apiVersion, reply_len: replyText.length, ms: elapsed });
          return jsonResponse({
            reply: replyText,
            model_used: model,
            latency_ms: elapsed,
            debug: debugLog,
          });
        }

        lastError = data.error?.message || JSON.stringify(data).slice(0, 300);
        const code = data.error?.code || response.status;
        pushDebug({ step: 'model_rejected', model, apiVersion, code, error: lastError });
      } catch (fetchErr) {
        lastError = fetchErr.name === 'AbortError' ? `Timed out after ${PER_CALL_TIMEOUT_MS}ms` : fetchErr.message;
        pushDebug({ step: 'fetch_exception', model, apiVersion, error: lastError });
      }
    }

    return jsonResponse({
      reply: `All models failed. Last error: ${lastError}`,
      debug: debugLog,
    }, 500);

  } catch (err) {
    log.error(`[${requestId}] 💥 UNHANDLED EXCEPTION:`, err.message, err.stack);
    pushDebug({ step: 'unhandled_exception', error: err.message, stack: err.stack });
    return jsonResponse({ reply: `Server error: ${err.message}`, debug: debugLog }, 500);
  }
}
