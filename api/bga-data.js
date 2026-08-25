export const config = { runtime: 'edge' };
const SUPABASE_URL='https://jadyqyrpgcmaixroizov.supabase.co';
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphZHlxeXJwZ2NtYWl4cm9pem92Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzOTQyNjUsImV4cCI6MjA4NTk3MDI2NX0.lSlILPzOhJTqKuLjHKmmLyjLXjEHS3erQJhASO1rMmc';
const allowed=new Set(['bga_entities','bga_projects']);
export default async function handler(req){
 try{
  if(req.method!=='POST') return new Response(JSON.stringify({ok:false,error:'POST required'}),{status:405,headers:{'content-type':'application/json'}});
  const {table,limit=2000}=await req.json();
  if(!allowed.has(table)) return new Response(JSON.stringify({ok:false,error:'Invalid table'}),{status:400,headers:{'content-type':'application/json'}});
  const r=await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${Math.min(Number(limit)||2000,5000)}`,{headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}});
  const text=await r.text();
  if(!r.ok) return new Response(JSON.stringify({ok:false,error:text}),{status:r.status,headers:{'content-type':'application/json','cache-control':'no-store'}});
  return new Response(JSON.stringify({ok:true,rows:JSON.parse(text)}),{headers:{'content-type':'application/json','cache-control':'no-store'}});
 }catch(e){return new Response(JSON.stringify({ok:false,error:e.message}),{status:500,headers:{'content-type':'application/json','cache-control':'no-store'}})}
}