export const config = { runtime: 'edge' };

const ALLOWED_TABLES = new Set(['bga_entities','bga_projects','bga_project_entities','bga_interactions']);
const SUPABASE_URL = 'https://jadyqyrpgcmaixroizov.supabase.co';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type,X-App-Password' } });
  if (req.method !== 'POST') return json({ ok:false, error:'POST required' }, 405);

  const expected = process.env.PASSWORD || '';
  const supplied = req.headers.get('x-app-password') || '';
  if (!expected || supplied !== expected) return json({ ok:false, error:'Invalid password' }, 401);

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return json({ ok:false, error:'SUPABASE_SERVICE_ROLE_KEY is not configured in Vercel' }, 500);

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type':'application/json' };
  let body;
  try { body = await req.json(); } catch { return json({ ok:false, error:'Invalid JSON' }, 400); }
  const { action, table, data, id, filters = {}, order } = body || {};
  if (action === 'AUTH') return json({ ok:true });
  if (!ALLOWED_TABLES.has(table)) return json({ ok:false, error:'Table not allowed' }, 400);

  const qs = new URLSearchParams();
  if (action === 'LIST') qs.set('select','*');
  for (const [k,v] of Object.entries(filters || {})) {
    if (!/^[a-zA-Z0-9_]+$/.test(k)) return json({ok:false,error:'Invalid filter'},400);
    qs.set(k, `eq.${v}`);
  }
  if (order) qs.set('order', order);
  if (id != null) qs.set('id', `eq.${id}`);
  const url = `${SUPABASE_URL}/rest/v1/${table}${qs.toString()?`?${qs}`:''}`;

  let method='GET', payload;
  const h={...headers};
  if (action === 'CREATE') { method='POST'; payload=JSON.stringify(data); h.Prefer='return=representation'; }
  else if (action === 'UPDATE') { method='PATCH'; payload=JSON.stringify(data); h.Prefer='return=representation'; }
  else if (action === 'DELETE') { method='DELETE'; h.Prefer='return=representation'; }
  else if (action === 'UPSERT') { method='POST'; payload=JSON.stringify(data); h.Prefer='resolution=merge-duplicates,return=representation'; }
  else if (action !== 'LIST') return json({ok:false,error:'Unknown action'},400);

  const r = await fetch(url,{method,headers:h,body:payload});
  const text = await r.text();
  let result; try { result=text?JSON.parse(text):[]; } catch { result=text; }
  if (!r.ok) return json({ok:false,error:result},r.status);
  return json({ok:true,rows:result});
}
