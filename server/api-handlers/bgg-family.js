'use strict';
// Read-only proxy for the linked games on a public BGG board-game family page.
// BGG's website endpoint has restrictive browser CORS; this route runs on Vercel.
// The endpoint is undocumented and may reject server-side traffic or change.
const int=(v,min,max)=>{const n=Number(v);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null};
module.exports=async(req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Only GET requests are supported'})}
 const id=int(req.query.familyid,1,9999999);
 const page=int(req.query.page,1,250);
 if(id===null||page===null)return res.status(400).json({error:'Use a valid familyid (1–9999999) and page (1–250)'});
 try{
  const query=new URLSearchParams({
   ajax:'1',linkdata_index:'boardgame',objectid:String(id),objecttype:'family',pageid:String(page)
  });
  const upstream=await fetch('https://api.geekdo.com/api/geekitem/recs/boardgamefamily?'+query,{
   headers:{
    Accept:'application/json',
    Referer:'https://boardgamegeek.com/boardgamefamily/'+id,
    'User-Agent':'Mozilla/5.0 (compatible; BoardGameLab/1.0; public board-game family read)'
   },
   signal:AbortSignal.timeout(12000)
  });
  if(!upstream.ok){
   console.error('BGG family upstream rejected',id,page,upstream.status);
   res.setHeader('Cache-Control','no-store');
   return res.status(upstream.status===404?404:502).json({
    error:'BGG family API returned HTTP '+upstream.status,
    detail:'The public Geekdo JSON endpoint may block server-side requests; a local HAR/JSON import remains available.',
    upstreamStatus:upstream.status
   });
  }
  const data=await upstream.json();
  if(!data||!Array.isArray(data.recs)){
   res.setHeader('Cache-Control','no-store');
   return res.status(502).json({error:'BGG API returned an unexpected response format'});
  }
  const total=Number(data.numrecs);
  res.setHeader('Cache-Control','public, s-maxage=1200, stale-while-revalidate=3600');
  return res.status(200).json({familyId:id,page,numrecs:Number.isFinite(total)&&total>=0?total:0,recs:data.recs});
 }catch(error){
  console.error('BGG family proxy failed',id,page,error.message);
  res.setHeader('Cache-Control','no-store');
  return res.status(502).json({error:'BGG family API request failed',detail:error.message});
 }
};