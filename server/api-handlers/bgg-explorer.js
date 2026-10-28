'use strict';
// Unified read-only listing API for public BoardGameGeek linked-game indexes.
// BGG's internal website JSON interface is undocumented and may change.
const TYPES=Object.freeze({
 family:{objecttype:'family',linkdata_index:'boardgame',subtype:'boardgamefamily',path:'boardgamefamily'},
 publisher:{objecttype:'company',linkdata_index:'boardgamepublisher',subtype:'boardgame',path:'boardgamepublisher'},
 designer:{objecttype:'person',linkdata_index:'boardgamedesigner',subtype:'boardgame',path:'boardgamedesigner'},
 developer:{objecttype:'person',linkdata_index:'boardgamedeveloper',subtype:'boardgame',path:'boardgamedesigner'},
 artist:{objecttype:'person',linkdata_index:'boardgameartist',subtype:'boardgame',path:'boardgameartist'},
 mechanic:{objecttype:'property',linkdata_index:'boardgamemechanic',subtype:'boardgame',path:'boardgamemechanic'},
 category:{objecttype:'property',linkdata_index:'boardgamecategory',subtype:'boardgame',path:'boardgamecategory'}
});
const num=(x)=>Number(x)||0;
const validInt=(x,min,max)=>{const n=Number(x);return Number.isSafeInteger(n)&&n>=min&&n<=max?n:null};
const decode=v=>String(v||'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(whole,code)=>{
 const k=code.toLowerCase(),entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};
 if(entities[k])return entities[k];
 const n=k.startsWith('#x')?parseInt(k.slice(2),16):parseInt(k.slice(1),10);
 return Number.isFinite(n)&&n>0&&n<=0x10ffff?String.fromCodePoint(n):whole;
});
function normalize(row){
 const images=row.images||{};
 return {
  id:String(row.objectid||''),name:String(row.name||'Unnamed game'),year:num(row.yearpublished),
  rating:num(row.average),rank:num(row.rank),weight:num(row.avgweight),
  voters:num(row.usersrated),owned:num(row.numowned),
  image:String(images.previewthumb||images.thumb||images.square200||images.original||''),
  url:String(row.href||'').startsWith('/boardgame/')?'https://boardgamegeek.com'+row.href:'',
  subtype:String(row.subtype||'')
 };
}
async function getJson(url){
 const r=await fetch(url,{
  headers:{Accept:'application/json',Referer:'https://boardgamegeek.com/',
   'User-Agent':'Mozilla/5.0 (compatible; BoardGameLab/1.0; public index)'},
  signal:AbortSignal.timeout(14000)
 });
 if(!r.ok){const e=new Error('Geekdo HTTP '+r.status);e.status=r.status;throw e}
 return r.json();
}
function htmlToText(s){return decode(decode(String(s||''))).replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n').replace(/<[^>]+>/g,'').replace(/\n{3,}/g,'\n\n').trim().slice(0,7000)}
async function metadata(type,id,cfg){
 let name='',description='',source='',error='';
 if(type==='family'){
  try{
   const r=await fetch('https://boardgamegeek.com/xmlapi2/family?id='+id+'&type=boardgamefamily',{
    headers:{Accept:'text/xml,application/xml'},signal:AbortSignal.timeout(9000)});
   if(r.ok){
    const xml=await r.text();
    const match=xml.match(/<item\b([^>]*)>([\s\S]*?)<\/item>/i);
    if(match&&Number(match[1].match(/\bid=["'](\d+)["']/)?.[1])===id){
     const m=match[2].match(/<name\b[^>]*\bvalue=(["'])(.*?)\1/i);
     name=decode(m?.[2]||'');
     description=htmlToText(match[2].match(/<description>([\s\S]*?)<\/description>/i)?.[1]||'');
     if(name)source='BGG XML API2';
    }
   }else error='XML API HTTP '+r.status;
  }catch(e){error=e.message;}
 }
 if(!name){
  try{
   const r=await fetch('https://boardgamegeek.com/'+cfg.path+'/'+id,{
    headers:{Accept:'text/html'},signal:AbortSignal.timeout(9000)});
   if(r.ok){
    const html=await r.text();
    const tag=html.match(/<meta\s+[^>]*property=["']og:title["'][^>]*>/i)?.[0]||'';
    const title=tag.match(/content=(["'])(.*?)\1/i)?.[2]||html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||'';
    const clean=decode(title).replace(/\s*[\|–-]\s*BoardGameGeek.*$/i,'').trim();
    if(clean&&!/^(boardgamegeek|just a moment|access denied)/i.test(clean)){
     name=clean;source='BGG public page title';
    }
   }else error='BGG page HTTP '+r.status;
  }catch(e){error=e.message;}
 }
 return {type,id,name,description,source,available:!!name,error:!name?error||'Title unavailable':'',
  url:'https://boardgamegeek.com/'+cfg.path+'/'+id};
}
module.exports=async(req,res)=>{
 res.setHeader('Content-Type','application/json; charset=utf-8');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'GET only'})}
 const type=String(req.query.type||'family').toLowerCase(),cfg=TYPES[type];
 const id=validInt(req.query.id,1,9999999),page=validInt(req.query.page??1,1,2500);
 if(!cfg||id===null||page===null)return res.status(400).json({error:'Invalid entity type, ID, or page'});
 const kind=String(req.query.kind||'games');
 try{
  if(kind==='meta'){
   const m=await metadata(type,id,cfg);
   res.setHeader('Cache-Control',m.available?'public, s-maxage=86400, stale-while-revalidate=604800':'public, s-maxage=120');
   return res.status(200).json(m);
  }
  if(kind!=='games')return res.status(400).json({error:'Invalid kind'});
  const q=new URLSearchParams({
   ajax:'1',linkdata_index:cfg.linkdata_index,nosession:'1',
   objectid:String(id),objecttype:cfg.objecttype,pageid:String(page),
   showcount:'25',sort:'name',subtype:cfg.subtype
  });
  const data=await getJson('https://api.geekdo.com/api/geekitem/linkeditems?'+q.toString());
  if(!Array.isArray(data?.items)||!data.config){
   res.setHeader('Cache-Control','no-store');
   return res.status(502).json({error:'Unexpected linkeditems response. This entity type may not be supported.',type});
  }
  const total=Number(data.config.numitems);
  const games=data.items.map(normalize).filter(g=>g.id);
  res.setHeader('Cache-Control','public, s-maxage=900, stale-while-revalidate=3600');
  return res.status(200).json({type,id,page,pageSize:25,total:Number.isFinite(total)&&total>=0?total:games.length,
   games,hasMore:Number.isFinite(total)&&total>=0?page*25<total:games.length===25,
   source:'BGG linkeditems'});
 }catch(e){
  console.error('BGG Explorer',type,id,kind,page,e.message);
  res.setHeader('Cache-Control','no-store');
  return res.status(e.status===404?404:502).json({error:e.message,
   detail:'BGG may reject server-side requests or change its website API. Verify the BGG page or try another entity.'});
 }
};