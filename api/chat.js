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

export default async function handler(req) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const debugLog = [];              // accumulate per-request debug trail
  const pushDebug = (entry) => { debugLog.push({ t: _ts(), ...entry }); };

  log.info(`[${requestId}] ── NEW REQUEST ─────────────────────────`);
  log.debug(`[${requestId}] Method: ${req.method}  URL: ${req.url}`);

  // ── CORS preflight ──
  if (req.method === 'OPTIONS') {
    log.info(`[${requestId}] CORS preflight — returning 200`);
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  try {
    // ── Parse body ──
    let body;
    try {
      body = await req.json();
      log.debug(`[${requestId}] Parsed body:`, JSON.stringify(body).slice(0, 500));
      pushDebug({ step: 'parse_body', ok: true, keys: Object.keys(body) });
    } catch (parseErr) {
      log.error(`[${requestId}] Body parse failed:`, parseErr.message);
      pushDebug({ step: 'parse_body', ok: false, error: parseErr.message });
      return new Response(JSON.stringify({
        reply: 'Invalid request body — expected JSON with { "message": "..." }',
        debug: debugLog,
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { message } = body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      log.warn(`[${requestId}] Empty or missing "message" field`);
      pushDebug({ step: 'validate_message', ok: false, received: typeof message });
      return new Response(JSON.stringify({
        reply: 'Missing "message" field in request body.',
        debug: debugLog,
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    log.info(`[${requestId}] User message (${message.length} chars): "${message.slice(0, 120)}…"`);
    pushDebug({ step: 'validate_message', ok: true, len: message.length });

    // ── API key check ──
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      log.error(`[${requestId}] 🔑 GOOGLE_GEMINI_API_KEY is NOT set in environment!`);
      pushDebug({ step: 'api_key_check', ok: false });
      return new Response(JSON.stringify({
        reply: 'Server config error: GOOGLE_GEMINI_API_KEY is not set. Add it in Vercel → Settings → Environment Variables.',
        debug: debugLog,
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    const maskedKey = apiKey.slice(0, 6) + '…' + apiKey.slice(-4);
    log.ok(`[${requestId}] 🔑 API key present (${maskedKey}), length=${apiKey.length}`);
    pushDebug({ step: 'api_key_check', ok: true, masked: maskedKey, len: apiKey.length });

    // ── Model cascade ──────────────────────────────────────────
    // Models from Google's 2026 quickstart + stable fallbacks.
    // Each entry: [model_name, api_version].
    // We try newest first, skip instantly on 404/429, move to next.
    // TOTAL budget must stay under Vercel's 25s edge timeout!
    const modelEntries = [
      ['gemini-3-flash-preview',         'v1beta'],   // newest (from quickstart)
      ['gemini-3.1-flash-lite-preview',  'v1beta'],   // lite variant
      ['gemini-2.0-flash',               'v1beta'],   // stable 2.0
      ['gemini-2.0-flash',               'v1'    ],   // stable 2.0, older endpoint
      ['gemini-1.5-flash',               'v1'    ],   // legacy fallback
    ];
    log.info(`[${requestId}] Will try ${modelEntries.length} model+version combos (no retry waits to beat 25s timeout)`);
    modelEntries.forEach(([m, v]) => log.info(`[${requestId}]   → ${m} (${v})`));

    let lastError = '';
    const PER_CALL_TIMEOUT_MS = 8000;    // abort any single API call after 8s

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    let tablesEnv = process.env.SUPABASE_TABLES;

    // ── Auto-discover tables if not provided ──
    if (!tablesEnv && supabaseUrl && supabaseServiceKey) {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/pg_tables?select=tablename&schemaname=eq.public`, {
          headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'apikey': supabaseServiceKey }
        });
        if (res.ok) {
          const rows = await res.json();
          tablesEnv = rows.map(r => r.tablename).join(',');
        }
      } catch (e) { log.warn("Auto-discovery failed"); }
    }

    let dbContext = "No database context available.";
    if (supabaseUrl && supabaseServiceKey && tablesEnv) {
      log.info(`[${requestId}] Building schema map for: ${tablesEnv}`);
      try {
        const tables = tablesEnv.split(',').map(t => t.trim()).filter(Boolean);
        const contextParts = [];
        
        for (const table of tables) {
          // Fetch a sample AND the column structure (via a limit 0 call if possible, or just limit 10)
          const res = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=15`, {
            headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'apikey': supabaseServiceKey }
          });
          if (res.ok) {
            const data = await res.json();
            const columns = data.length > 0 ? Object.keys(data[0]) : ["unknown"];
            contextParts.push(`TABLE: ${table}\nCOLUMNS: ${columns.join(', ')}\nDATA SAMPLE (up to 15 rows):\n${JSON.stringify(data, null, 2)}`);
          }
        }
        dbContext = contextParts.join('\n\n---\n\n');
      } catch (err) { log.warn("DB Context fetch failed"); }
    }

    // ── System instruction: DATABASE EXPERT + VISUALIZER ──
    const systemInstruction = {
      parts: [{ text:
        `You are a strict Database Content Expert and Data Visualizer.

YOUR DATA SOURCE:
You MUST ONLY use the data provided in the "CURRENT DATABASE CONTEXT" section below.

RULES:
1) ONLY answer based on the provided context. 
2) IMAGES/THUMBNAILS: If a record contains a URL for an image, thumbnail, or picture (e.g., ends in .jpg, .png, .webp, or is in a column named 'image', 'thumbnail', 'photo'), you MUST display it using Markdown: ![Image](url).
3) CLEAN OUTPUT: Do not include unnecessary blank lines or empty lines between paragraphs or table rows. Keep the response compact.
4) If the user asks for a chart, graph, or visualization, include a JSON block for Chart.js:

\`\`\`json
{
  "type": "CHART",
  "chartType": "pie|bar|line",
  "label": "Title",
  "data": [{"label": "A", "value": 10}]
}
\`\`\`

5) Use Markdown tables for data. If a table has an image column, put the image Markdown in the cell.

CURRENT DATABASE CONTEXT:
${dbContext}

SUPABASE CRUD OPERATIONS:
For data changes or specific searches, use:
\`\`\`json
{
  "action": "READ|CREATE|UPDATE|DELETE",
  "table": "table_name",
  "query": {"field": "search_value"},
  "data": {"field": "new_value"},
  "id": record_id
}
\`\`\`

Strictly adhere to the provided schema. No hallucinations.`
      }]
    };

    // ── Try each model+version combo ──
    for (let i = 0; i < modelEntries.length; i++) {
      const [model, apiVersion] = modelEntries[i];
      const attempt = i + 1;
      log.api(`[${requestId}] ── Attempt ${attempt}/${modelEntries.length}  model=${model}  version=${apiVersion}`);
      pushDebug({ step: 'model_attempt', attempt, model, apiVersion });

      try {
        const apiUrl = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;
        log.debug(`[${requestId}] POST …/${apiVersion}/models/${model}:generateContent?key=***`);

        const payload = {
          system_instruction: systemInstruction,
          contents: [{ parts: [{ text: message }] }],
        };

        // AbortController to enforce per-call timeout
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

        log.api(`[${requestId}] Response: status=${response.status} (${elapsed}ms)`);
        pushDebug({ step: 'api_response', model, apiVersion, status: response.status, ms: elapsed });

        let data;
        try {
          data = await response.json();
          log.debug(`[${requestId}] Response keys: ${Object.keys(data).join(', ')}`);
        } catch (jsonErr) {
          log.error(`[${requestId}] JSON parse failed:`, jsonErr.message);
          pushDebug({ step: 'api_json_parse', model, ok: false, error: jsonErr.message });
          lastError = `JSON parse error from ${model}`;
          continue;
        }

        // ── Success ──
        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const replyText = data.candidates[0].content.parts[0].text;
          log.ok(`[${requestId}] ✅ SUCCESS  model=${model} (${apiVersion})  reply_len=${replyText.length}  ${elapsed}ms`);
          pushDebug({ step: 'success', model, apiVersion, reply_len: replyText.length, ms: elapsed });

          return new Response(JSON.stringify({
            reply: replyText,
            model_used: model,
            latency_ms: elapsed,
            debug: debugLog,
          }), { headers: { 'Content-Type': 'application/json' } });
        }

        // ── Failure — log detail and move to next model instantly ──
        lastError = data.error?.message || JSON.stringify(data).slice(0, 300);
        const code = data.error?.code || response.status;
        log.warn(`[${requestId}] Model ${model} (${apiVersion}) → ${code}: ${lastError.slice(0, 200)}`);
        pushDebug({ step: 'model_rejected', model, apiVersion, code, error: lastError });
        continue;

      } catch (fetchErr) {
        const errMsg = fetchErr.name === 'AbortError'
          ? `Timed out after ${PER_CALL_TIMEOUT_MS}ms` : fetchErr.message;
        log.error(`[${requestId}] Fetch exception on ${model} (${apiVersion}): ${errMsg}`);
        pushDebug({ step: 'fetch_exception', model, apiVersion, error: errMsg });
        lastError = errMsg;
        continue;
      }
    }

    // ── All models exhausted ──
    log.error(`[${requestId}] ❌ ALL ${modelEntries.length} MODELS FAILED.  Last error: ${lastError}`);
    pushDebug({ step: 'all_models_failed', error: lastError });

    return new Response(JSON.stringify({
      reply: `All models failed. Last error: ${lastError}`,
      debug: debugLog,
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    log.error(`[${requestId}] 💥 UNHANDLED EXCEPTION:`, err.message, err.stack);
    pushDebug({ step: 'unhandled_exception', error: err.message, stack: err.stack });
    return new Response(JSON.stringify({
      reply: `Server error: ${err.message}`,
      debug: debugLog,
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
