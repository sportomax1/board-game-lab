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
module.exports=async(req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Only GET supported'})}
 const previewId=integer(req.query.previewid,93,1,9999),kind=String(req.query.kind||'meta');
 res.setHeader('Cache-Control','public, s-maxage=600, stale-while-revalidate=1200');
 try{
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