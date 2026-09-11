export const config = { runtime: 'edge' };

const SHEET_ID = '12JnWPs0cGbTfI37770cEvFzNuQNKiYorXEf6m8Yx2UU';
const DEFAULT_TAB = 'Data';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const textResponse = (body, status = 200, extra = {}) => new Response(body, {
  status,
  headers: {
    ...corsHeaders,
    'Content-Type': 'text/plain; charset=utf-8',
    ...extra,
  },
});

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    ...corsHeaders,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  },
});

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'GET') return jsonResponse({ ok: false, error: 'GET required' }, 405);

  try {
    const url = new URL(req.url);
    const tab = (url.searchParams.get('tab') || DEFAULT_TAB).trim();
    if (!/^[\w .()&'!-]{1,80}$/.test(tab)) {
      return jsonResponse({ ok: false, error: 'Invalid sheet tab name' }, 400);
    }

    const googleUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
    const upstream = await fetch(googleUrl, {
      headers: { 'User-Agent': 'BoardGameLab-BGAPlays/1.0' },
      redirect: 'follow',
    });
    const body = await upstream.text();
    const contentType = upstream.headers.get('content-type') || '';

    if (!upstream.ok) {
      return jsonResponse({ ok: false, error: `Google Sheets returned HTTP ${upstream.status}` }, 502);
    }

    const looksLikeHtml = /^\s*</.test(body) || contentType.includes('text/html');
    const hasExpectedHeader = /(^|,)"?Year"?(,|\r?\n)/.test(body.slice(0, 500));
    if (looksLikeHtml || !hasExpectedHeader) {
      return jsonResponse({
        ok: false,
        error: 'The Google Sheet is not publicly readable as CSV. Set sharing to Anyone with the link (Viewer) or publish the Data tab.',
      }, 502);
    }

    return textResponse(body, 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
      'X-BGA-Plays-Tab': tab,
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error?.message || 'Unknown error' }, 500);
  }
}
