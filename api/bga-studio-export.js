export const config={runtime:'edge'};
const U=process.env.SUPABASE_URL||'https://jadyqyrpgcmaixroizov.supabase.co';
const K=process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H=['Game name','License status','Publisher','Designer','BGG rating','Complexity','Studio projects'];
const F=['game_name','license_status','publisher','designer','bgg_rating','complexity','studio_projects'];
const q=v=>{const s=String(v??'');return /[",\r\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s};
export default async function handler(){
  if(!K)return new Response('Supabase public key is not configured',{status:500});
  const r=await fetch(`${U}/rest/v1/bga_studio_games?select=*&order=game_name.asc&limit=10000`,{headers:{apikey:K,Authorization:`Bearer ${K}`}});
  if(!r.ok)return new Response(await r.text(),{status:r.status});
  const rows=await r.json();
  const csv=[H.join(','),...rows.map(row=>F.map(f=>q(row[f])).join(','))].join('\n');
  return new Response(csv,{headers:{'content-type':'text/csv; charset=utf-8','cache-control':'no-store','content-disposition':'inline; filename="bga-studio.csv"'}});
}
