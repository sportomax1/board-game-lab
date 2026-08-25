export const config = { runtime: 'edge' };

// Generic Supabase CRUD proxy used by Board Game Lab apps.
// BGA tracker tables are intentionally pinned to the myapi project so they
// cannot silently follow unrelated SUPABASE_* deployment environment vars.
const BGA_URL = 'https://jadyqyrpgcmaixroizov.supabase.co';
const BGA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZHlxeXJwZ2NtYWl4cm9pem92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTQyNjUsImV4cCI6MjA4NTk3MDI2NX0.lSlILPzOhJTqKuLjHKmmLyjLXjEHS3erQJhASO1rMmc';
const BGA_TABLES = new Set(['bga_entities','bga_projects','bga_project_entities','bga_interactions']);
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});
const validTable=t=>typeof t==='string'&&/^[a-zA-Z0-9_-]+$/.test(t);

export default async function handler(req){
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}});
 if(req.method!=='POST') return json({ok:false,error:'POST required'},405);
 try{
  const body=await req.json();
  const {action,table,query,data,id,limit=50,offset=0}=body;
  if(action==='LIST_TABLES'){
   const tables=(process.env.SUPABASE_TABLES||'').split(',').map(x=>x.trim()).filter(Boolean);
   return json({ok:true,tables});
  }
  if(!validTable(table)) return json({ok:false,error:'Invalid table'},400);
  const isBga=BGA_TABLES.has(table);
  const url=isBga?BGA_URL:process.env.SUPABASE_URL;
  const key=isBga?BGA_KEY:(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_ANON_KEY);
  if(!url||!key) return json({ok:false,error:'Supabase credentials not configured'},500);
  const headers={Authorization:`Bearer ${key}`,apikey:key,Accept:'application/json'};
  let target=`${url}/rest/v1/${table}`;
  if(action==='READ'||action==='SEARCH'){
   target+='?select=*';
   if(query) for(const [k,v] of Object.entries(query)){
    if(!/^[a-zA-Z0-9_]+$/.test(k)) continue;
    target+=`&${encodeURIComponent(k)}=${typeof v==='string'?'ilike.*'+encodeURIComponent(v)+'*':'eq.'+encodeURIComponent(v)}`;
   }
   target+=`&limit=${Math.min(Number(limit)||50,5000)}&offset=${Math.max(Number(offset)||0,0)}`;
   const r=await fetch(target,{headers}); const text=await r.text();
   if(!r.ok) return json({ok:false,error:text},r.status);
   const rows=JSON.parse(text); return json({ok:true,rows,count:rows.length});
  }
  // BGA writes require service-role credentials to remain server-side. If the
  // deployment is not configured for myapi service writes, fail explicitly
  // rather than writing to the wrong database.
  if(isBga) return json({ok:false,error:'BGA write endpoint is read-only until myapi service credentials are configured on this deployment.'},503);
  if(action==='CREATE'){
   if(!data) return json({ok:false,error:'data required'},400);
   const r=await fetch(target,{method:'POST',headers:{...headers,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(data)});const text=await r.text();
   if(!r.ok)return json({ok:false,error:text},r.status);return json({ok:true,rows:JSON.parse(text)});
  }
  if(action==='UPDATE'||action==='DELETE'){
   if(!id)return json({ok:false,error:'id required'},400); target+=`?id=eq.${encodeURIComponent(id)}`;
   const r=await fetch(target,{method:action==='UPDATE'?'PATCH':'DELETE',headers:{...headers,'Content-Type':'application/json',Prefer:'return=representation'},body:action==='UPDATE'?JSON.stringify(data):undefined});const text=await r.text();
   if(!r.ok)return json({ok:false,error:text},r.status);return json({ok:true,rows:text?JSON.parse(text):[]});
  }
  return json({ok:false,error:'Unknown action'},400);
 }catch(e){return json({ok:false,error:e.message},500)}
}