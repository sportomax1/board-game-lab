'use strict';
// Read-only public GeekPreview data proxy. Lazy-loaded by api/core.js.
const integer = (v,d,min,max) => {const n=Number(v);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:d};
const names = value => Array.isArray(value)?[...new Set(value.map(x=>x?.name).filter(Boolean))]:[];
function normalize(row){
 const g=row?.geekitem?.item||{}, links=g.links||{}, price=row.showprice||row.msrp||null, rating=row.rating||{}, interest=row.interestCounts||{};
 return {
  previewItemId:String(row.id||''),bggId:String(row.item?.id||''),name:g.primaryname?.name||'Unnamed game',
  year:Number(g.yearpublished)||null,playersMin:Number(g.minplayers)||0,playersMax:Number(g.maxplayers)||0,
  playtimeMin:Number(g.minplaytime)||0,playtimeMax:Number(g.maxplaytime)||0,minAge:Number(g.minage)||0,
  subtypes:g.subtypes||[],description:g.short_description||'',
  publishers:names(links.boardgamepublisher),designers:names(links.boardgamedesigner),artists:names(links.boardgameartist),
  publisherIds:row.publisherids||[],location:row.location||'',availability:row.availabilityStatus||'',
  price:price?{amount:price.amount,currency:price.currency}:null,
  rating:Number(rating.average)||0,ratingCount:Number(rating.usersrated)||0,rank:Number(rating.rank)||0,
  thumbs:Number(row.reactions?.thumbs)||0,mustHave:Number(interest.musthave)||0,
  interested:Number(interest.interested)||0,undecided:Number(interest.undecided)||0,
  image:row.imageSets?.previewthumb?.src||row.imageSets?.mediacard?.src||'',
  bggUrl:g.href?'https://boardgamegeek.com'+g.href:'',
  previewUrl:row.href?'https://boardgamegeek.com'+row.href:''
 };
}
async function request(path){
 const response=await fetch('https://api.geekdo.com'+path,{
  headers:{'Accept':'application/json','Referer':'https://boardgamegeek.com/','User-Agent':'BoardGameLab/1.0 (public GeekPreview listings)'},
  signal:AbortSignal.timeout(14000)
 });
 if(!response.ok){const e=new Error('Geekdo returned HTTP '+response.status);e.status=response.status;throw e}
 return response.json();
}

// The BGG /previews directory is the authoritative discovery source when available.
// Keep known, verified preview IDs for periods when the site blocks automated reads.
const CATALOG_SEEDS = [
 {id:94,name:'PAX Unplugged 2026 Preview',startDate:'2026-12-04',location:'Philadelphia, PA'},
 {id:93,name:'SPIEL Essen 2026',startDate:'2026-10-22',location:'Essen, Germany'},
 {id:92,name:'Gen Con 2026 Preview',startDate:'2026-07-30',location:'Indianapolis, IN'},
 {id:91,name:'Origins Game Fair 2026 Preview',startDate:'2026-06-17',location:'Columbus, OH'},
 {id:87,name:'Game Market 2026 Spring Preview',startDate:'2026-05-23',location:'Chiba, Japan'},
 {id:86,name:'UK Games Expo',startDate:'2026-05-29',location:'Birmingham, UK'},
 {id:81,name:'2025 BoardGameGeek Holiday Gift Guide',startDate:'2025-11-25',location:'Everywhere'},
 {id:78,name:'SPIEL Essen 25 Preview',startDate:'2025-10-23',location:'Essen, Germany'},
 {id:77,name:'Gen Con 2025 Preview',startDate:'2025-07-31',location:'Indianapolis, IN'},
 {id:75,name:'Game Market 2025 Spring Preview',startDate:'2025-05-17',location:'Chiba, Japan'},
 {id:68,name:'SPIEL Essen 24 Preview',startDate:'2024-10-03',location:'Essen, Germany'}
];
const unescapeHtml = v => String(v||'').replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(whole,key)=>{
 const known={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
 const lower=key.toLowerCase();
 if(known[lower])return known[lower];
 const value=lower.startsWith('#x')?parseInt(lower.slice(2),16):parseInt(lower.slice(1),10);
 return Number.isInteger(value)&&value>0&&value<=0x10ffff?String.fromCodePoint(value):whole;
});
const textOnly = html => unescapeHtml(String(html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
function catalogFromHtml(html){
 const items=new Map();
 // SSR links for https://boardgamegeek.com/previews.
 const anchor=/<a\b[^>]*\bhref\s*=\s*(["'])([^"']*\/geekpreview\/(\d+)(?:\/[^"']*)?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi;
 for(const m of html.matchAll(anchor)){
  const id=Number(m[3]);
  if(!Number.isSafeInteger(id)||id<1||id>9999)continue;
  const heading=m[4].match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i);
  const name=textOnly(heading?heading[1]:m[4]).slice(0,170);
  if(!name||/^(view|read|learn|image|preview)$/i.test(name))continue;
  const url='https://boardgamegeek.com'+new URL(m[2],'https://boardgamegeek.com').pathname;
  const old=items.get(id);
  if(!old||name.length<old.name.length)items.set(id,{id,name,url});
 }
 return [...items.values()];
}
async function previewCatalog(){
 const fallback=CATALOG_SEEDS.map(e=>({...e,url:'https://boardgamegeek.com/geekpreview/'+e.id}));
 try{
  const r=await fetch('https://boardgamegeek.com/previews',{
   headers:{Accept:'text/html','User-Agent':'Mozilla/5.0 (compatible; BoardGameLabPreviewDirectory/1.0)'},
   signal:AbortSignal.timeout(11000)
  });
  if(!r.ok)throw Error('BGG directory HTTP '+r.status);
  const html=await r.text();
  const discovered=catalogFromHtml(html);
  if(discovered.length<8)throw Error('Could not extract preview links from directory');
  const all=new Map(fallback.map(e=>[e.id,e]));
  for(const item of discovered)all.set(item.id,{...all.get(item.id),...item});
  return {previews:[...all.values()].sort((a,b)=>b.id-a.id),complete:true,
   source:'BGG /previews directory',discovered:discovered.length,
   note:'Live directory titles; listing counts can be fetched separately.'};
 }catch(error){
  return {previews:fallback.sort((a,b)=>b.id-a.id),complete:false,
   source:'Verified saved selections',discovered:0,
   note:'BGG directory could not be read ('+error.message+'). Showing verified previews only. Other previews can still be opened by entering their BGG preview ID.'};
 }
}

module.exports=async(req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Only GET supported'})}
 const previewId=integer(req.query.previewid,93,1,9999),kind=String(req.query.kind||'meta');
 res.setHeader('Cache-Control','public, s-maxage=600, stale-while-revalidate=1200');
 try{
  if(kind==='catalog')return res.status(200).json(await previewCatalog());
  if(kind==='meta'){
   const m=await request('/api/preview/'+previewId);
   const totalItems=Number(m.config?.numitems)||0;
   return res.status(200).json({
    previewId,name:m.name||'GeekPreview '+previewId,location:m.location||'',startDate:m.startDate||'',endDate:m.endDate||'',
    totalItems,totalPages:Math.ceil(totalItems/20),
    originalUrl:'https://boardgamegeek.com'+(m.href||'/geekpreview/'+previewId)
   });
  }
  if(kind==='items'){
   const start=integer(req.query.start,1,1,10000),count=integer(req.query.count,3,1,4);
   const pages=Array.from({length:count},(_,i)=>start+i);
   const results=await Promise.all(pages.map(page=>{
    const q=new URLSearchParams({previewid:String(previewId),partial:'listing',pageid:String(page),pagesize:'20'});
    return request('/api/previewitem?'+q);
   }));
   const pagination=results[0]?.pagination||{};
   return res.status(200).json({
    previewId,pages,totalItems:Number(pagination.totalItems)||0,totalPages:Number(pagination.totalPages)||0,
    items:results.flatMap(r=>(r.data||[]).map(normalize))
   });
  }
  return res.status(400).json({error:'Invalid kind; use meta or items'});
 }catch(err){
  console.error('GeekPreview upstream error',previewId,err.message);
  return res.status([429,503].includes(err.status)?503:502).json({error:'Geekdo request failed. Try again or import HAR/JSON.',detail:err.message});
 }
};