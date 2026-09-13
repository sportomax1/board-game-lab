export const config={runtime:'edge'};
const U='https://jadyqyrpgcmaixroizov.supabase.co';
const K=process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ALLOWED=new Set(['bga_entities','bga_projects','bgg_collection','bgg_games','bga_studio_games']);
const SELECTS={
  bgg_collection:'bgg_id,name,year,bgg_rating,primary_rank,avgweight,thumb,image,own,prevowned,fortrade,want,wanttoplay,wanttobuy,wishlist,preordered',
  bga_studio_games:'game_name,license_status,publisher,designer,bgg_rating,complexity,studio_projects,updated_at'
};
export default async function handler(req){try{if(req.method!=='POST')return reply({ok:false,error:'POST required'},405);if(!K)return reply({ok:false,error:'Supabase public key is not configured'},500);const {table,limit=2000}=await req.json();if(!ALLOWED.has(table))return reply({ok:false,error:'Invalid table'},400);const n=Math.min(Number(limit)||2000,10000);const select=SELECTS[table]||'*';const r=await fetch(`${U}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${n}`,{headers:{apikey:K,Authorization:`Bearer ${K}`}});const text=await r.text();if(!r.ok)return reply({ok:false,error:text},r.status);return reply({ok:true,table,rows:JSON.parse(text)});}catch(e){return reply({ok:false,error:e.message},500)}}
function reply(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}})}
