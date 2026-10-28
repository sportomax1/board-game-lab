'use strict';
// Public family membership comes from Geekdo's paginated linkeditems endpoint.
// /geekitem/recs/boardgamefamily returns featured games (six in the supplied HAR),
// NOT the full membership list. Always use linkeditems for this Explorer.
const int=(v,min,max)=>{const n=Number(v);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null};
function normalize(row){
 const image=row.images||{};
 const img=image.previewthumb||image.thumb||image.original||'';
 return {
  item:{id:String(row.objectid||''),name:String(row.name||'Untitled game'),
    href:String(row.href||''),imageSets:{mediacard:{src:img}}},
  description:'',yearpublished:String(row.yearpublished||''),
  rating:Number(row.average)||0,rank:Number(row.rank)||0,
  numvoters:Number(row.usersrated)||0,numfans:0,
  image:{src:img}
 };
}
module.exports=async(req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Only GET supported'});}
 const id=int(req.query.familyid,1,9999999);
 const page=int(req.query.page,1,250);
 if(id===null||page===null)return res.status(400).json({error:'Invalid familyid or page'});
 const q=new URLSearchParams({
  ajax:'1',linkdata_index:'boardgame',nosession:'1',
  objectid:String(id),objecttype:'family',pageid:String(page),
  showcount:'25',sort:'name',subtype:'boardgamefamily'
 });
 try{
  const upstream=await fetch('https://api.geekdo.com/api/geekitem/linkeditems?'+q,{
   headers:{Accept:'application/json',
    Referer:'https://boardgamegeek.com/boardgamefamily/'+id+'/linkeditems/boardgame',
    'User-Agent':'Mozilla/5.0 (compatible; BoardGameLab/1.0; family membership reader)'},
   signal:AbortSignal.timeout(14000)
  });
  if(!upstream.ok){
   console.error('BGG linkeditems rejected',id,page,upstream.status);
   res.setHeader('Cache-Control','no-store');
   return res.status(upstream.status===404?404:502).json({error:'Geekdo linked-games API returned HTTP '+upstream.status,upstreamStatus:upstream.status});
  }
  const data=await upstream.json();
  if(!data||!Array.isArray(data.items)||!data.config){
   res.setHeader('Cache-Control','no-store');
   return res.status(502).json({error:'Unexpected Geekdo linked-items response (no items/config)'});
  }
  const total=Number(data.config.numitems);
  const items=data.items.map(normalize).filter(r=>r.item.id);
  res.setHeader('Cache-Control','public, s-maxage=1200, stale-while-revalidate=3600');
  return res.status(200).json({
   familyId:id,page,pageSize:25,source:'linkeditems',
   numrecs:Number.isFinite(total)&&total>=0?total:items.length,
   recs:items
  });
 }catch(error){
  console.error('Geekdo linkeditems fetch failed',id,page,error.message);
  res.setHeader('Cache-Control','no-store');
  return res.status(502).json({error:'Could not retrieve linked family games',detail:error.message});
 }
};