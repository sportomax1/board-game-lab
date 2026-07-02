export const config = { runtime: 'edge' };

// ============================================================
//  SUPABASE CRUD — Save/Load/Update/Delete conversations
// ============================================================
const _ts = () => new Date().toISOString();
const log = {
  info:  (...a) => console.log(  `[${_ts()}] ℹ️  INFO `, ...a),
  ok:    (...a) => console.log(  `[${_ts()}] ✅  OK   `, ...a),
  error: (...a) => console.error(`[${_ts()}] ❌  ERROR`, ...a),
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

export default async function handler(req) {
  const requestId = crypto.randomUUID().slice(0, 8);
  
  // Check for env vars
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    log.error(`[${requestId}] Missing SUPABASE_URL or SUPABASE_ANON_KEY`);
    return new Response(JSON.stringify({
      error: 'Supabase not configured',
      detail: 'Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel env vars'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  log.info(`[${requestId}] ${req.method} ${req.url}`);

  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, DELETE, PUT, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    let body = {};
    if (req.method !== 'GET') {
      body = await req.json();
    }

    // ── CREATE/SAVE a conversation ──
    if (req.method === 'POST' && action === 'save') {
      const { conversationId, messages, topic, title } = body;
      if (!conversationId || !messages || !Array.isArray(messages)) {
        return errorResponse('Missing conversationId or messages array', 400);
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
        method: 'UPSERT',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          id: conversationId,
          messages: JSON.stringify(messages),
          topic: topic || 'general',
          title: title || 'Untitled',
          updated_at: _ts(),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        log.error(`[${requestId}] Supabase UPSERT failed: ${err}`);
        return errorResponse(`Failed to save conversation: ${err}`, res.status);
      }

      log.ok(`[${requestId}] ✅ Saved conversation ${conversationId}`);
      return successResponse({ conversationId, saved: true });
    }

    // ── READ/LOAD a conversation ──
    if (req.method === 'GET' && action === 'load') {
      const conversationId = url.searchParams.get('id');
      if (!conversationId) {
        return errorResponse('Missing conversation id', 400);
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await res.text();
        log.error(`[${requestId}] Supabase SELECT failed: ${err}`);
        return errorResponse(`Failed to load conversation: ${err}`, res.status);
      }

      const data = await res.json();
      if (data.length === 0) {
        return successResponse({ found: false, conversationId });
      }

      const conv = data[0];
      log.ok(`[${requestId}] ✅ Loaded conversation ${conversationId}`);
      return successResponse({
        found: true,
        conversationId: conv.id,
        messages: typeof conv.messages === 'string' ? JSON.parse(conv.messages) : conv.messages,
        topic: conv.topic,
        title: conv.title,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
      });
    }

    // ── LIST all conversations (for a user/session) ──
    if (req.method === 'GET' && action === 'list') {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/conversations?order=updated_at.desc`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await res.text();
        log.error(`[${requestId}] Supabase SELECT list failed: ${err}`);
        return errorResponse(`Failed to list conversations: ${err}`, res.status);
      }

      const data = await res.json();
      log.ok(`[${requestId}] ✅ Listed ${data.length} conversations`);
      return successResponse({
        conversations: data.map(c => ({
          id: c.id,
          title: c.title,
          topic: c.topic,
          messageCount: c.messages ? JSON.parse(c.messages).length : 0,
          updatedAt: c.updated_at,
        })),
      });
    }

    // ── DELETE a conversation ──
    if (req.method === 'DELETE' && action === 'delete') {
      const conversationId = url.searchParams.get('id');
      if (!conversationId) {
        return errorResponse('Missing conversation id', 400);
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await res.text();
        log.error(`[${requestId}] Supabase DELETE failed: ${err}`);
        return errorResponse(`Failed to delete conversation: ${err}`, res.status);
      }

      log.ok(`[${requestId}] ✅ Deleted conversation ${conversationId}`);
      return successResponse({ conversationId, deleted: true });
    }

    // ── UPDATE conversation title/topic ──
    if (req.method === 'PUT' && action === 'update') {
      const { conversationId, title, topic } = body;
      if (!conversationId) {
        return errorResponse('Missing conversationId', 400);
      }

      const updateData = { updated_at: _ts() };
      if (title) updateData.title = title;
      if (topic) updateData.topic = topic;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${conversationId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!res.ok) {
        const err = await res.text();
        log.error(`[${requestId}] Supabase PATCH failed: ${err}`);
        return errorResponse(`Failed to update conversation: ${err}`, res.status);
      }

      log.ok(`[${requestId}] ✅ Updated conversation ${conversationId}`);
      return successResponse({ conversationId, updated: true });
    }

    return errorResponse('Unknown action or method', 400);

  } catch (err) {
    log.error(`[${requestId}] Exception: ${err.message}`);
    return errorResponse(`Server error: ${err.message}`, 500);
  }
}

function errorResponse(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function successResponse(data = {}) {
  return new Response(JSON.stringify({ ok: true, ...data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
