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

function xmlDecode(v){
 return String(v||'').replace(/&(?:#x([0-9a-f]+)|#(\d+)|amp|lt|gt|quot|apos);/gi,(whole,hex,dec)=>{
  if(hex||dec){const code=parseInt(hex||dec,hex?16:10);return code>0&&code<=0x10ffff?String.fromCodePoint(code):whole;}
  return {'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&AMP;':'&'}[whole]||whole;
 });
}
function cleanHtml(v){return xmlDecode(String(v||'').replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<[^>]*>/g,'')).trim();}
function parseXmlFamily(xml,id){
 const item=xml.match(/<item\b([^>]*)>([\s\S]*?)<\/item>/i);
 if(!item || Number(item[1].match(/\bid=["'](\d+)["']/)?.[1])!==id)return null;
 const body=item[2];
 const primary=body.match(/<name\b[^>]*\bvalue=(["'])(.*?)\1[^>]*\/?>/i);
 const desc=body.match(/<description>([\s\S]*?)<\/description>/i);
 const name=primary?xmlDecode(primary[2]).trim():'';
 const description=desc?cleanHtml(desc[1]).slice(0,5000):'';
 return name?{id,name,description,available:true,source:'BGG XML API2'}:null;
}
async function familyMeta(id){
 let firstError='';
 try{
  const r=await fetch('https://boardgamegeek.com/xmlapi2/family?id='+id+'&type=boardgamefamily',
   {headers:{Accept:'application/xml,text/xml'},signal:AbortSignal.timeout(10000)});
  if(r.ok){
   const parsed=parseXmlFamily(await r.text(),id);
   if(parsed)return parsed;
   firstError='XML API returned no family metadata';
  }else firstError='XML API HTTP '+r.status;
 }catch(e){firstError='XML API: '+e.message}
 try{
  const r=await fetch('https://boardgamegeek.com/boardgamefamily/'+id,
   {headers:{Accept:'text/html'},signal:AbortSignal.timeout(10000)});
  if(r.ok){
   const html=await r.text();
   const title=html.match(/<meta\b[^>]*\bproperty=["']og:title["'][^>]*\bcontent=(["'])(.*?)\1/i)?.[2]
     ||html.match(/<title>([^<]*)<\/title>/i)?.[1]||'';
   const name=xmlDecode(title).replace(/\s*\|\s*BoardGameGeek.*$/i,'').trim();
   if(name && !/^(boardgamegeek|just a moment|access denied)/i.test(name))
    return {id,name,description:'',available:true,source:'BGG page title'};
  }
 }catch(e){}
 return {id,name:'',description:'',available:false,reason:firstError||'Family information unavailable'};
}

module.exports=async(req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Only GET supported'});}
 const id=int(req.query.familyid,1,9999999);
 const page=int(req.query.page,1,250);
 if(id===null||page===null)return res.status(400).json({error:'Invalid familyid or page'});
 if(req.query.kind==='meta'){
  const data=await familyMeta(id);
  res.setHeader('Cache-Control',data.available?'public, s-maxage=86400, stale-while-revalidate=604800':'public, s-maxage=180');
  return res.status(200).json(data);
 }
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