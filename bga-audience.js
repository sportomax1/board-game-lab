/* BGA Audience Intelligence — CSV-driven, browser-local analytics. */
(() => {
"use strict";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmt=new Intl.NumberFormat("en-US",{maximumFractionDigits:0});
const fmt1=new Intl.NumberFormat("en-US",{maximumFractionDigits:1});
const fmt2=new Intl.NumberFormat("en-US",{maximumFractionDigits:2});
const metrics={
 played_total:"Total plays",played_realtime:"Real-time plays",played_turnbased:"Turn-based plays",
 time_spent_hr:"Time spent (hr)",premium_time_spent_hr:"Premium time spent (hr)"
};
const EXPECTED=["month","game_id","game","audience_share_pct","premium_audience_share_pct","played_realtime","played_turnbased","played_total","average_duration_min","time_spent_hr","premium_time_spent_hr","model","game_url"];
const state={db:null,rows:[],view:"overview",from:"",to:"",search:"",metric:"played_total",gameSort:"plays",gamesVisible:75,detailGame:null,detailMonth:null,importStats:null,error:"",copied:false,matrixSort:"total",matrixOnlyMatches:false,matrixVisible:90,matrixCache:null,collectionUser:"sportomax",collectionGames:[],collectionIndex:new Map(),collectionDB:null,collectionBusy:false,collectionRequest:0,collectionStatus:""};
const numericCols=EXPECTED.filter(c=>["game_id","game","month","model","game_url"].indexOf(c)<0);
const isNumber=v=>typeof v==="number"&&Number.isFinite(v);
const clean=v=>String(v??"").trim();
function n(v){
 if(isNumber(v))return v;
 const s=clean(v);
 if(s===""||s==="-"||s==="—"||s.toLowerCase()==="null")return null;
 const normalized=s.replace(/[\u00a0\u202f\s]/g,"").replace(/,/g,"").replace(/%$/,"");
 if(!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(normalized))return null;
 const x=Number(normalized);return Number.isFinite(x)?x:null;
}
function int(v){return isNumber(v)?fmt.format(v):"—"}
function dec(v){return isNumber(v)?fmt1.format(v):"—"}
function num2(v){return isNumber(v)?fmt2.format(v):"—"}
function percent(v){return isNumber(v)?num2(v)+"%":"—"}
function pctRatio(v){return isNumber(v)?fmt1.format(v*100)+"%":"—"}
function signed(v,kind="pct"){
 if(!isNumber(v))return '<span class="muted">—</span>';
 const text=(v>0?"+":"")+(kind==="pct"?fmt1.format(v*100)+"%":fmt.format(v));
 const cls=v>0?"pos":v<0?"neg":"muted";
 return '<span class="'+cls+' mono">'+esc(text)+'</span>';
}
function compact(v){
 if(!isNumber(v))return "—";
 if(Math.abs(v)>=1e6)return fmt1.format(v/1e6)+"M";
 if(Math.abs(v)>=1e3)return fmt1.format(v/1e3)+"K";
 return fmt.format(v);
}
function monthValid(s){return /^\d{4}-(0[1-9]|1[0-2])$/.test(s)}
function monthShift(month,offset){
 const [y,m]=month.split("-").map(Number);
 const d=new Date(Date.UTC(y,m-1+offset,1));
 return d.getUTCFullYear()+"-"+String(d.getUTCMonth()+1).padStart(2,"0");
}
function monthLabel(month){
 if(!monthValid(month))return month||"";
 const [y,m]=month.split("-").map(Number);
 return new Date(Date.UTC(y,m-1,1)).toLocaleDateString("en-US",{month:"short",year:"numeric",timeZone:"UTC"});
}
function monthMini(month){
 if(!monthValid(month))return month||"";
 const [y,m]=month.split("-").map(Number);
 return new Date(Date.UTC(y,m-1,1)).toLocaleDateString("en-US",{month:"short",year:"2-digit",timeZone:"UTC"});
}
function gameId(r){return r.game_id? "id:"+r.game_id : "name:"+r.game.toLocaleLowerCase().replace(/\s+/g," ").trim()}
function rowKey(r){return r.month+"|"+gameId(r)}
function trimGameUrl(v){
 try{const u=new URL(String(v));return u.protocol==="https:" && (u.hostname==="boardgamearena.com"||u.hostname.endsWith(".boardgamearena.com"))?u.href:""}catch{return ""}
}
function cleanRow(raw) {
 const r={};
 for(const key of EXPECTED)r[key]=raw[key]??"";
 r.month=clean(r.month);r.game_id=clean(r.game_id);r.game=clean(r.game);
 if(!monthValid(r.month)||!r.game)return null;
 for(const col of numericCols)r[col]=n(r[col]);
 if(!isNumber(r.played_total) && isNumber(r.played_realtime)&&isNumber(r.played_turnbased))
  r.played_total=r.played_realtime+r.played_turnbased;
 r.model=clean(r.model);
 r.game_url=trimGameUrl(r.game_url);
 r.key=rowKey(r);
 return r;
}
function parseCsv(source) {
 const s=String(source??"").replace(/^\uFEFF/,"");
 if(!s.trim())throw Error("Paste or upload an audience CSV first.");
 const table=[];let record=[],cell="",quoted=false;
 for(let i=0;i<s.length;i++){
  const c=s[i];
  if(quoted){
   if(c==='"' && s[i+1]==='"'){cell+='"';i++}
   else if(c==='"')quoted=false;
   else cell+=c;
  }else if(c==='"'){
   if(cell.trim())throw Error("Unexpected quotation mark in CSV.");
   quoted=true;
  }else if(c===","){record.push(cell);cell=""}
  else if(c==="\r"||c==="\n"){
   if(c==="\r"&&s[i+1]==="\n")i++;
   record.push(cell);cell="";
   if(record.some(x=>x!==""))table.push(record);
   record=[];
  }else cell+=c;
 }
 if(quoted)throw Error("CSV ends with an unclosed quoted field.");
 record.push(cell);if(record.some(x=>x!==""))table.push(record);
 if(!table.length)throw Error("The CSV contains no rows.");
 const headers=table.shift().map(x=>clean(x).toLowerCase().replace(/^\uFEFF/,""));
 for(const needed of ["month","game"])if(!headers.includes(needed))throw Error("Missing required CSV column: "+needed);
 if(!headers.some(x=>["played_total","played_realtime","played_turnbased","time_spent_hr"].includes(x)))throw Error("Not a BGA audience export: playback/time columns are missing.");
 let skipped=0,duplicates=0;
 const map=new Map();
 for(const cells of table){
  const raw={};headers.forEach((h,j)=>{raw[h]=cells[j]??""});
  const row=cleanRow(raw);
  if(!row){skipped++;continue}
  if(map.has(row.key))duplicates++;
  map.set(row.key,row);
 }
 const rows=[...map.values()];
 if(!rows.length)throw Error("No valid month/game rows found; dates should look like 2026-10.");
 return {rows,read:table.length,skipped,duplicates};
}
function sum(rows,key){
 let x=0,valid=0;
 for(const r of rows)if(isNumber(r[key])){x+=r[key];valid++}
 return valid?x:null;
}
function average(rows,key){
 let x=0,valid=0;
 for(const r of rows)if(isNumber(r[key])){x+=r[key];valid++}
 return valid?x/valid:null;
}
function weightedDuration(rows) {
 let weighted=0,weight=0;
 for(const r of rows){
  if(isNumber(r.average_duration_min)&&isNumber(r.played_total)&&r.played_total>0){
   weighted+=r.average_duration_min*r.played_total;weight+=r.played_total;
  }
 }
 return weight?weighted/weight:null;
}
function aggregate(rows) {
 const rt=sum(rows,"played_realtime"),tb=sum(rows,"played_turnbased"),
  plays=sum(rows,"played_total"),hours=sum(rows,"time_spent_hr"),premium=sum(rows,"premium_time_spent_hr");
 const paired=rows.filter(r=>isNumber(r.time_spent_hr)&&isNumber(r.premium_time_spent_hr));
 const pairedHours=sum(paired,"time_spent_hr"),pairedPremium=sum(paired,"premium_time_spent_hr");
 return {
  rt,tb,plays,hours,premium,
  ratio:isNumber(pairedHours)&&pairedHours>0&&isNumber(pairedPremium)?pairedPremium/pairedHours:null,
  averageDuration:weightedDuration(rows),
  audienceAvg:average(rows,"audience_share_pct"),
  premiumAudienceAvg:average(rows,"premium_audience_share_pct"),
  games:new Set(rows.map(gameId)).size,
  observations:rows.length
 };
}
function metricOf(sumRow,key){
 const k={played_total:"plays",played_realtime:"rt",played_turnbased:"tb",
 time_spent_hr:"hours",premium_time_spent_hr:"premium"}[key]||"plays";
 return sumRow[k];
}
function monthlyMap(rows){
 const m=new Map();
 for(const row of rows){if(!m.has(row.month))m.set(row.month,[]);m.get(row.month).push(row)}
 return m;
}
function allMonths(rows){return [...new Set(rows.map(x=>x.month))].sort()}
function monthRange(lo,hi){
 if(!monthValid(lo)||!monthValid(hi)||lo>hi)return [];
 const result=[];let current=lo;
 while(current<=hi && result.length<300){result.push(current);current=monthShift(current,1)}
 return result;
}
function selectedRows(){
 return state.rows.filter(r=>(!state.from||r.month>=state.from)&&(!state.to||r.month<=state.to)&&
 (!state.search||(r.game+" "+r.game_id).toLowerCase().includes(state.search)));
}
function periodsSelected(){
 const months=allMonths(state.rows);
 if(!months.length)return [];
 const lo=state.from||months[0],hi=state.to||months[months.length-1];
 return lo<=hi?monthRange(lo,hi):[];
}
function summaries(rows,months){
 const source=monthlyMap(rows);
 return months.map(month=>({month,rows:source.get(month)||[],...aggregate(source.get(month)||[]),present:source.has(month)}));
}
function growth(a,b){
 return isNumber(a)&&isNumber(b)&&b>0 ? a/b-1 : null;
}
function latestPair(months){
 const sorted=[...new Set(months)].sort();
 if(sorted.length<2)return null;
 const last=sorted[sorted.length-1],prev=monthShift(last,-1);
 return sorted.includes(prev)?[prev,last]:null;
}
function byGame(rows){
 const map=new Map();
 for(const r of rows){
  const id=gameId(r);
  if(!map.has(id))map.set(id,{id,game:r.game,game_id:r.game_id,url:r.game_url,rows:[]});
  const g=map.get(id);g.rows.push(r);
  if(r.game_url&&!g.url)g.url=r.game_url;
 }
 return [...map.values()].map(g=>{
  g.rows.sort((a,b)=>a.month.localeCompare(b.month));
  g.months=g.rows.length;g.first=g.rows[0].month;g.latest=g.rows[g.rows.length-1].month;
  const a=aggregate(g.rows);
  Object.assign(g,a);
  const current=g.rows[g.rows.length-1];
  const prior=g.rows.find(r=>r.month===monthShift(g.latest,-1));
  g.change=prior?growth(current.played_total,prior.played_total):null;
  g.lastPlays=current.played_total;
  return g;
 });
}
function escapeSvg(s){return esc(s)}
function svgEmpty(message){return '<div class="empty"><h3>Not enough data</h3><p>'+esc(message)+'</p></div>'}
function scaleLabel(v,key){
 if(!isNumber(v))return "—";
 return ["time_spent_hr","premium_time_spent_hr"].includes(key)?fmt1.format(v):fmt.format(v);
}
function lineChart(months,series,{metric="played_total",height=285,width=860}={}){
 if(!months.length)return svgEmpty("Import a CSV to build this chart.");
 const values=series.flatMap(s=>s.values).filter(isNumber);
 if(!values.length)return svgEmpty("The selected metric has no numeric observations.");
 const max=Math.max(0,...values),min=Math.min(0,...values);
 const low=min<0?min:0,high=max===low?low+1:max*1.08;
 const left=65,top=24,right=25,bottom=50,plotW=width-left-right,plotH=height-top-bottom;
 const x=i=>left+(months.length===1?plotW/2:i*plotW/(months.length-1));
 const y=v=>top+(high-v)/(high-low)*plotH;
 const palette=["#38617c","#477966","#ac8141","#9168a0"];
 let svg='<svg class="chart-svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="'+escapeSvg(series.map(s=>s.name).join(" and ")+" by month")+'">';
 for(let i=0;i<=4;i++){
  const val=low+(high-low)*i/4,yy=y(val);
  svg+='<line x1="'+left+'" y1="'+yy+'" x2="'+(width-right)+'" y2="'+yy+'" stroke="#e8eff2" stroke-width="1"/>'+
    '<text x="'+(left-10)+'" y="'+(yy+4)+'" text-anchor="end" fill="#82949e" font-size="12">'+escapeSvg(compact(val))+'</text>';
 }
 const tickEvery=Math.max(1,Math.ceil(months.length/10));
 for(let i=0;i<months.length;i++)if(i%tickEvery===0||i===months.length-1){
  svg+='<text x="'+x(i)+'" y="'+(height-20)+'" fill="#8a9ba4" font-size="12" text-anchor="middle">'+escapeSvg(monthMini(months[i]))+'</text>';
 }
 series.forEach((s,si)=>{
  const color=s.color||palette[si%palette.length],data=s.values;
  let segment=[];
  function path(){
   if(!segment.length)return;
   const d=segment.map((pt,i)=>(i?"L":"M")+pt[0].toFixed(2)+","+pt[1].toFixed(2)).join(" ");
   svg+='<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>';
   segment=[];
  }
  for(let i=0;i<data.length;i++){
   if(!isNumber(data[i])){path();continue}
   segment.push([x(i),y(data[i])]);
  }
  path();
  for(let i=0;i<data.length;i++)if(isNumber(data[i])){
   svg+='<circle cx="'+x(i)+'" cy="'+y(data[i])+'" r="4.25" fill="'+color+'" stroke="#fff" stroke-width="1.5"><title>'+
    escapeSvg(s.name+" · "+monthLabel(months[i])+": "+scaleLabel(data[i],metric))+'</title></circle>';
  }
 });
 svg+='</svg>';
 return svg;
}
function stackedBars(sums){
 const valid=sums.filter(s=>s.present&& (isNumber(s.rt)||isNumber(s.tb)));
 if(!valid.length)return svgEmpty("No mode-specific play counts found.");
 const months=sums.map(s=>s.month);
 const width=560,height=285,left=56,right=12,top=24,bottom=50,plotW=width-left-right,plotH=height-top-bottom;
 const max=Math.max(1,...sums.map(s=>(s.rt||0)+(s.tb||0)))*1.08;
 const count=sums.length,step=plotW/Math.max(1,count),bw=Math.max(3,Math.min(27,step*.52));
 let s='<svg class="chart-svg" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Monthly real-time and turn-based plays">';
 for(let i=0;i<=4;i++){const v=max*i/4,yy=top+(1-i/4)*plotH;
  s+='<line x1="'+left+'" y1="'+yy+'" x2="'+(width-right)+'" y2="'+yy+'" stroke="#e8eff2"/><text x="'+(left-7)+'" y="'+(yy+4)+'" font-size="11" fill="#8597a1" text-anchor="end">'+escapeSvg(compact(v))+'</text>';
 }
 const tickEvery=Math.max(1,Math.ceil(count/8));
 sums.forEach((r,i)=>{
  const x=left+step*i+step/2-bw/2,rt=r.rt||0,tb=r.tb||0;
  if(!r.present || (!isNumber(r.rt)&&!isNumber(r.tb)))return;
  const ht=rt/max*plotH,hb=tb/max*plotH;
  if(isNumber(r.rt)&&rt>0)s+='<rect x="'+x+'" y="'+(top+plotH-ht)+'" width="'+bw+'" height="'+ht+'" rx="2" fill="#38617c"><title>'+escapeSvg(monthLabel(r.month)+": "+int(rt)+" real-time plays")+'</title></rect>';
  if(isNumber(r.tb)&&tb>0)s+='<rect x="'+x+'" y="'+(top+plotH-ht-hb)+'" width="'+bw+'" height="'+hb+'" rx="2" fill="#477966"><title>'+escapeSvg(monthLabel(r.month)+": "+int(tb)+" turn-based plays")+'</title></rect>';
  if(i%tickEvery===0||i===count-1)s+='<text x="'+(x+bw/2)+'" y="'+(height-20)+'" text-anchor="middle" fill="#8596a0" font-size="11">'+escapeSvg(monthMini(r.month))+'</text>';
 });
 return s+'</svg>';
}
function fmtKpi(value,unit=""){return isNumber(value)?(unit==="decimal"?dec(value):compact(value)):"—"}
function kpi(label,value,detail,change){
 return '<div class="card kpi"><div class="label">'+esc(label)+'</div><div class="value">'+esc(value)+'</div><div class="sub">'+esc(detail||"")+'</div>'+
 (change?'<div class="change">'+change+'</div>':"")+'</div>';
}

/* BGG collection thumbnails. Strict/normalized name matching avoids incorrect artwork. */
function normalizeTitle(value){
 return clean(value).normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
   .toLowerCase().replace(/&/g," and ").replace(/['’]/g,"")
   .replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}
function safeImage(url){
 try{
  const u=new URL(clean(url));
  return u.protocol==="https:" &&
    /(^|\.)geekdo-images\.com$|(^|\.)geekdo-static\.com$|(^|\.)boardgamegeek\.com$/i.test(u.hostname) ? u.href : "";
 }catch{return ""}
}
function collectionFromXml(text){
 const dom=new DOMParser().parseFromString(text,"application/xml");
 if(dom.querySelector("parsererror"))throw Error("BGG returned invalid collection XML.");
 if(dom.documentElement?.nodeName!=="items"){
  const message=dom.querySelector("message")?.textContent;
  throw Error(clean(message)||"BGG did not return a game collection.");
 }
 const map=new Map();
 for(const item of dom.querySelectorAll("items > item")){
  const id=clean(item.getAttribute("objectid")),name=clean(item.querySelector("name")?.textContent);
  if(!id || !name)continue;
  const game={
   id,name,
   thumbnail:safeImage(item.querySelector("thumbnail")?.textContent),
   image:safeImage(item.querySelector("image")?.textContent)
  };
  if(!map.has(id))map.set(id,game);
 }
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
function indexCollection(games){
 const index=new Map(),candidates=new Map();
 for(const g of games){
  const key=normalizeTitle(g.name);
  if(!key)continue;
  const existing=index.get(key);
  if(!existing || (!existing.thumbnail && g.thumbnail))index.set(key,g);
  const alias=key.replace(/^the /,"");
  if(alias && alias!==key){
   if(!candidates.has(alias))candidates.set(alias,new Set());
   candidates.get(alias).add(key);
  }
 }
 // Only allow articles to be optional when there is an unambiguous full title.
 for(const [alias,keys] of candidates){
  if(keys.size===1 && !index.has(alias))index.set(alias,index.get([...keys][0]));
 }
 state.collectionGames=games;state.collectionIndex=index;
 updateCollectionStatus();
}
function gameArtwork(gameName){return state.collectionIndex.get(normalizeTitle(gameName))||null}
function thumbHtml(name,small=false){
 const game=gameArtwork(name);
 const url=game?.thumbnail||game?.image;
 if(!url)return small?"":'<span class="game-placeholder" aria-hidden="true">♟</span>';
 if(small)return '<img class="bgg-thumb-mini" src="'+esc(url)+'" alt="" title="'+esc(game.name)+'" loading="lazy" decoding="async">';
 return '<img class="game-image" src="'+esc(url)+'" alt="'+esc(game.name)+' cover" loading="lazy" decoding="async" referrerpolicy="no-referrer">';
}
function updateCollectionStatus(status="",error=false){
 if(status!==undefined && status!=="")state.collectionStatus=status;
 const matched=new Set(state.rows.map(r=>r.game).filter(name=>!!gameArtwork(name)));
 $("collectionCount").textContent=state.collectionGames.length ? int(state.collectionGames.length)+" collection games · "+int(matched.size)+" matches" : "No collection loaded";
 const info=$("collectionFeedback");
 if(info){
  info.textContent=state.collectionStatus || "Click Load collection to find game artwork.";
  info.classList.toggle("error",!!error);
 }
}
async function openCollectionDB(){
 if(!window.indexedDB)return null;
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open("bga-audience-bgg-collection",1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("collections"))req.result.createObjectStore("collections",{keyPath:"username"})};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error("Collection cache unavailable"));
 });
}
async function getCollectionCache(user){
 if(!state.collectionDB)return null;
 return new Promise((resolve,reject)=>{
  const req=state.collectionDB.transaction("collections","readonly").objectStore("collections").get(user.toLowerCase());
  req.onsuccess=()=>resolve(req.result||null);
  req.onerror=()=>reject(req.error);
 });
}
async function saveCollectionCache(user,games){
 if(!state.collectionDB)return;
 return new Promise((resolve,reject)=>{
  const tx=state.collectionDB.transaction("collections","readwrite");
  tx.objectStore("collections").put({username:user.toLowerCase(),games,savedAt:Date.now()});
  tx.oncomplete=resolve;
  tx.onerror=()=>reject(tx.error||Error("Collection cache save failed"));
 });
}
function applyCollection(games,message){
 indexCollection(games);
 updateCollectionStatus(message);
 if(state.rows.length)render();
}
async function loadCollection(force=false){
 const username=clean($("collectionUser").value).replace(/^@/,"");
 if(!/^[a-z0-9][a-z0-9_.-]{1,59}$/i.test(username)){
  updateCollectionStatus("Enter a valid BGG username.",true);return;
 }
 const switched=username.toLowerCase()!==state.collectionUser.toLowerCase();
 state.collectionUser=username;
 try{localStorage.setItem("bga-audience-collection-user",username)}catch(_){}
 const id=++state.collectionRequest;
 if(switched){indexCollection([]);if(state.rows.length)render()}
 if(!force){
  try{
   const cached=await getCollectionCache(username);
   if(id!==state.collectionRequest)return;
   if(cached?.games?.length){
    applyCollection(cached.games,"Cached "+username+" collection · "+new Date(cached.savedAt).toLocaleDateString());
    return;
   }
  }catch(_){}
 }
 if(id!==state.collectionRequest)return;
 state.collectionBusy=true;
 $("loadCollection").disabled=true;$("loadCollection").textContent="Loading…";
 updateCollectionStatus("Fetching "+username+"'s collection from BGG…");
 try{
  const q=new URLSearchParams({endpoint:"collection",username,stats:"1"});
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),65000);
  let response;
  try{response=await fetch("/api/bgg-helper?"+q,{cache:"no-store",signal:controller.signal,headers:{"Accept":"text/xml,application/xml"}})}
  finally{clearTimeout(timer)}
  if(id!==state.collectionRequest)return;
  const body=await response.text();
  if(!response.ok){
   let err="";
   try{err=JSON.parse(body).message||""}catch(_){}
   throw Error("BGG "+response.status+(err?" · "+err:""));
  }
  if(!body.trim().startsWith("<"))throw Error("BGG returned a non-XML response.");
  const games=collectionFromXml(body);
  if(!games.length)throw Error("No visible games were returned; verify the username and public collection access.");
  await saveCollectionCache(username,games).catch(()=>{});
  if(id!==state.collectionRequest)return;
  applyCollection(games,"Loaded "+username+" · "+new Date().toLocaleTimeString());
 }catch(error){
  if(id!==state.collectionRequest)return;
  updateCollectionStatus("Collection unavailable: "+(error.name==="AbortError"?"request timed out":error.message)+". Retry Load collection.",true);
 }finally{
  if(id===state.collectionRequest){state.collectionBusy=false;$("loadCollection").disabled=false;$("loadCollection").textContent="Load collection"}
 }
}
async function initializeCollection(){
 try{state.collectionDB=await openCollectionDB()}catch(_){}
 try{state.collectionUser=localStorage.getItem("bga-audience-collection-user")||"sportomax"}catch(_){}
 $("collectionUser").value=state.collectionUser;
 await loadCollection(false);
}
/* Monthly matrix. Blank months are missing observations, NOT inferred zeroes. */
function makeMatrixData(rows,months){
 const ordered=months.slice().reverse();
 let games=byGame(rows);
 if(state.matrixOnlyMatches)games=games.filter(g=>!!gameArtwork(g.game));
 const recent=ordered[0];
 games.sort((a,b)=>{
  if(state.matrixSort==="name")return a.game.localeCompare(b.game);
  if(state.matrixSort==="months")return b.months-a.months||a.game.localeCompare(b.game);
  if(state.matrixSort==="latest"){
   const val=g=>{
    const r=g.rows.find(x=>x.month===recent);
    return isNumber(r?.played_total)?r.played_total:-Infinity;
   };
   return val(b)-val(a)||a.game.localeCompare(b.game);
  }
  return (isNumber(b.plays)?b.plays:-Infinity)-(isNumber(a.plays)?a.plays:-Infinity)||a.game.localeCompare(b.game);
 });
 const visibleIds=new Set(games.map(g=>g.id));
 const included=rows.filter(r=>visibleIds.has(gameId(r)));
 return {months:ordered,games,allRows:included,monthly:monthlyMap(included),allTotal:sum(included,"played_total")};
}
function matrixRowHtml(g,months){
 const byMonth=new Map(g.rows.map(r=>[r.month,r]));
 const max=Math.max(0,...g.rows.map(r=>isNumber(r.played_total)?r.played_total:0));
 const cells=months.map(month=>{
  const row=byMonth.get(month);
  if(!row)return '<td class="month-col"><span class="missing" title="No exported observation for this game/month">—</span></td>';
  if(!isNumber(row.played_total))return '<td class="month-col"><span class="metric-unknown" title="Game exists in export but play count is missing">N/A</span></td>';
  const p=max>0?row.played_total/max:0;
  const alpha=(.06+.30*p).toFixed(3);
  return '<td class="month-col"><button class="month-value" style="background:rgba(66,116,145,'+alpha+')" type="button" data-cell-game="'+esc(g.id)+'" data-cell-month="'+esc(month)+'" title="'+esc(g.game+" · "+monthLabel(month)+": "+int(row.played_total)+" plays")+'">'+int(row.played_total)+'</button></td>';
 }).join("");
 return '<tr><td class="name-cell"><div class="game-item">'+thumbHtml(g.game)+
  '<div class="game-meta"><button type="button" class="game-name" data-matrix-game="'+esc(g.id)+'">'+esc(g.game)+'</button>'+
  '<span class="game-sub">'+g.months+' months observed'+(gameArtwork(g.game)?' · cover matched':'')+'</span></div></div></td>'+
  '<td class="total-cell"><b>'+int(g.plays)+'</b></td>'+cells+'</tr>';
}
function matrixTotalHtml(data){
 return '<tr class="matrix-total-row"><td class="name-cell"><b>Monthly totals</b><small style="display:block;color:#8296a1;font-size:10px">Available observations</small></td>'+
 '<td class="total-cell">'+int(data.allTotal)+'</td>'+
 data.months.map(month=>{
  const observations=data.monthly.get(month);
  return '<td class="month-col">'+(observations?int(sum(observations,"played_total")):"—")+'</td>';
 }).join("")+'</tr>';
}
function updateMatrixProgress(){
 const data=state.matrixCache;
 if(!data)return;
 const shown=Math.min(data.games.length,state.matrixVisible);
 $("matrixProgress").textContent=shown+" of "+data.games.length+" games displayed · Scroll to load more";
 $("matrixProgress").hidden=shown===data.games.length;
}
function appendMatrixRows(){
 const data=state.matrixCache;if(!data)return;
 const start=state.matrixVisible;
 const end=Math.min(data.games.length,start+65);
 if(end<=start)return;
 $("matrixRows").insertAdjacentHTML("beforeend",data.games.slice(start,end).map(g=>matrixRowHtml(g,data.months)).join(""));
 state.matrixVisible=end;
 updateMatrixProgress();
}
function maybeAppendMatrix(){
 const root=$("matrixScroll");
 if(state.view!=="matrix" || !state.matrixCache || state.matrixVisible>=state.matrixCache.games.length)return;
 if(root.scrollTop+root.clientHeight>=root.scrollHeight-360)appendMatrixRows();
}
function renderMatrix(rows,months){
 const view=$("matrixScroll");
 const left=view.scrollLeft;
 const data=makeMatrixData(rows,months);
 state.matrixCache=data;
 const header='<tr><th class="name-head">Game</th><th class="total-head">Total</th>'+
  data.months.map(m=>'<th class="month-col">'+esc(monthMini(m))+'</th>').join("")+'</tr>';
 $("matrixHead").innerHTML=header;
 const shown=data.games.slice(0,state.matrixVisible);
 const only=state.matrixOnlyMatches?" · collection matches only":"";
 $("matrixSummary").textContent=data.games.length+" games × "+data.months.length+" months"+only;
 $("matrixRows").innerHTML=matrixTotalHtml(data)+(
  shown.length ? shown.map(g=>matrixRowHtml(g,data.months)).join("") :
  '<tr><td colspan="'+(data.months.length+2)+'" class="muted" style="padding:20px;text-align:center">No games match these filters'+(state.matrixOnlyMatches?" and the current BGG collection":"")+'.</td></tr>');
 view.scrollLeft=left;
 updateMatrixProgress();
}

function renderOverview(rows,months){
 const stats=aggregate(rows),monthly=summaries(rows,months);
 const pair=latestPair(monthly.filter(x=>x.present).map(x=>x.month));
 const map=new Map(monthly.map(s=>[s.month,s]));
 const current=pair?map.get(pair[1]):null,prev=pair?map.get(pair[0]):null;
 const change=pair?growth(current.plays,prev.plays):null;
 const suffix=pair?monthLabel(pair[1])+" vs "+monthLabel(pair[0]):"No adjacent month comparison";
 $("kpiGrid").innerHTML=[
  kpi("Recorded plays",fmtKpi(stats.plays),rows.length+" game-month records",isNumber(change)?("MoM "+signed(change)):""),
  kpi("Real-time plays",fmtKpi(stats.rt),"Across selected months"),
  kpi("Turn-based plays",fmtKpi(stats.tb),"Across selected months"),
  kpi("Time spent",fmtKpi(stats.hours)+" hr","Sum of available time"),
  kpi("Premium time",fmtKpi(stats.premium)+" hr",pctRatio(stats.ratio)+" of paired hours")
 ].join("");
 $("trendHeading").textContent=metrics[state.metric]+" trend";
 $("trendRange").textContent=months.length?monthLabel(months[0])+" – "+monthLabel(months[months.length-1]):"No dates";
 $("trendChart").innerHTML=lineChart(months,[{name:metrics[state.metric],values:monthly.map(x=>x.present?metricOf(x,state.metric):null)}],{metric:state.metric});
 $("modeChart").innerHTML=stackedBars(monthly);
 const games=byGame(rows).sort((a,b)=>(b.plays||-1)-(a.plays||-1)).slice(0,8);
 $("topGames").innerHTML=games.length?games.map((g,i)=>
  '<div class="mini-line"><span class="mini-rank">'+(i+1)+'</span>'+(thumbHtml(g.game,true)||'')+'<span class="mini-name" title="'+esc(g.game)+'">'+esc(g.game)+'</span><span class="mini-value">'+int(g.plays)+'</span></div>').join(""):svgEmpty("No games in this filter.");
 $("moversPeriod").textContent=suffix+" · games appearing in both months";
 if(pair){
  const beforeRows=monthly.find(x=>x.month===pair[0]).rows,afterRows=monthly.find(x=>x.month===pair[1]).rows;
  const old=new Map(beforeRows.map(r=>[gameId(r),r])),next=new Map(afterRows.map(r=>[gameId(r),r]));
  const changes=[];
  for(const [id,r] of next){
   const previous=old.get(id);
   if(previous&&isNumber(r.played_total)&&isNumber(previous.played_total)){
    changes.push({game:r.game,change:r.played_total-previous.played_total,base:previous.played_total,current:r.played_total});
   }
  }
  changes.sort((a,b)=>Math.abs(b.change)-Math.abs(a.change));
  $("movers").innerHTML=changes.length?changes.slice(0,8).map((g,i)=>
   '<div class="mini-line"><span class="mini-rank">'+(i+1)+'</span><span class="mini-name" title="'+esc(g.game)+'">'+esc(g.game)+'</span><span class="mini-value '+(g.change>=0?"pos":"neg")+'">'+(g.change>0?"+":"")+int(g.change)+'</span></div>').join(""):svgEmpty("There are no games with play counts in both adjacent months.");
 }else $("movers").innerHTML=svgEmpty("Import at least two adjacent months for a meaningful month-over-month comparison.");
 const all=allMonths(state.rows),gaps=monthRange(all[0]||"",all[all.length-1]||"").filter(m=>!all.includes(m));
 const missing=rows.filter(r=>!isNumber(r.played_total)).length;
 const statPieces=[];
 if(gaps.length)statPieces.push(gaps.length+" calendar month"+(gaps.length===1?"":"s")+" absent from the archive");
 if(missing)statPieces.push(missing+" selected game-month row"+(missing===1?" has":"s have")+" no total-play count");
 if(state.importStats?.skipped)statPieces.push(state.importStats.skipped+" invalid import rows were skipped");
 $("coverageNote").textContent=statPieces.length?"Caveats: "+statPieces.join("; ")+".":"No missing calendar months detected across the loaded range.";
}
function monthlyDetails(month,rows){
 state.detailMonth=month;
 const group=rows.filter(r=>r.month===month).sort((a,b)=>(b.played_total||0)-(a.played_total||0));
 $("monthDetails").hidden=false;
 $("monthDetailsTitle").textContent=monthLabel(month)+" · "+group.length+" games";
 $("monthGameRows").innerHTML=group.map(r=>'<tr data-game="'+esc(gameId(r))+'"><td>'+esc(r.game)+'</td><td class="num">'+int(r.played_total)+'</td><td class="num">'+int(r.played_realtime)+'</td><td class="num">'+int(r.played_turnbased)+'</td><td class="num">'+dec(r.time_spent_hr)+'</td><td class="num">'+dec(r.premium_time_spent_hr)+'</td><td class="num">'+percent(r.audience_share_pct)+'</td><td class="num">'+percent(r.premium_audience_share_pct)+'</td><td class="num">'+dec(r.average_duration_min)+'</td></tr>').join("")||'<tr><td colspan="9">No records for this month.</td></tr>';
}
function renderMonthly(rows,months){
 const arr=summaries(rows,months).sort((a,b)=>b.month.localeCompare(a.month));
 const index=new Map(arr.map(x=>[x.month,x]));
 $("monthlyCount").textContent=arr.length+" calendar months";
 $("monthRows").innerHTML=arr.map(s=>{
  const prev=index.get(monthShift(s.month,-1));
  const delta=s.present&&prev?.present?growth(s.plays,prev.plays):null;
  return '<tr data-month="'+esc(s.month)+'"><td><strong>'+esc(monthLabel(s.month))+'</strong>'+(!s.present?'<small>Not imported</small>':'')+'</td>'+
  '<td class="num">'+(s.present?int(s.games):"—")+'</td><td class="num">'+int(s.rt)+'</td><td class="num">'+int(s.tb)+'</td><td class="num"><b>'+int(s.plays)+'</b></td>'+
  '<td class="num">'+signed(delta)+'</td><td class="num">'+dec(s.hours)+'</td><td class="num">'+dec(s.premium)+'</td>'+
  '<td class="num">'+pctRatio(s.ratio)+'</td><td class="num">'+dec(s.averageDuration)+'</td></tr>';
 }).join("");
 if(state.detailMonth && months.includes(state.detailMonth))monthlyDetails(state.detailMonth,rows);
 else{$("monthDetails").hidden=true;state.detailMonth=null}
}
function gamesFiltered(rows){return byGame(rows)}
function renderGames(rows){
 const sort=state.gameSort;
 const compare=(a,b)=>{
  if(sort==="name")return a.game.localeCompare(b.game);
  if(sort==="first")return b.latest.localeCompare(a.latest);
  if(sort==="growth"){
   const aa=isNumber(a.change)?a.change:-Infinity,bb=isNumber(b.change)?b.change:-Infinity;
   return bb-aa||a.game.localeCompare(b.game);
  }
  const k=sort==="premium"?"premium":sort==="time"?"hours":"plays";
  return (isNumber(b[k])?b[k]:-Infinity)-(isNumber(a[k])?a[k]:-Infinity)||a.game.localeCompare(b.game);
 };
 const games=gamesFiltered(rows).sort(compare);
 $("gamesCount").textContent=games.length+" games";
 const shown=games.slice(0,state.gamesVisible);
 $("gameRows").innerHTML=shown.map(g=>
  '<tr data-game="'+esc(g.id)+'"><td><div class="inline-game">'+(thumbHtml(g.game,true)||'')+'<span><strong>'+esc(g.game)+'</strong><small>'+esc(g.game_id?"BGA game #"+g.game_id:"Name-based key")+' · '+esc(monthLabel(g.latest))+'</small></span></div></td>'+
  '<td class="num">'+int(g.months)+'</td><td class="num">'+int(g.rt)+'</td><td class="num">'+int(g.tb)+'</td><td class="num"><b>'+int(g.plays)+'</b></td>'+
  '<td class="num">'+dec(g.hours)+'</td><td class="num">'+dec(g.premium)+'</td><td class="num">'+pctRatio(g.ratio)+'</td>'+
  '<td class="num">'+percent(g.audienceAvg)+'</td><td class="num">'+signed(g.change)+'</td></tr>'
 ).join("")||'<tr><td colspan="10" class="muted">No games match the filters.</td></tr>';
 $("gamesMore").hidden=games.length<=shown.length;
}
function renderCompare(rows,months){
 const games=byGame(rows).sort((a,b)=>((b.plays||0)-(a.plays||0)));
 const choices=games.map(g=>'<option value="'+esc(g.id)+'">'+esc(g.game)+'</option>').join("");
 const prevA=$("compareA").value,prevB=$("compareB").value;
 $("compareA").innerHTML=choices;$("compareB").innerHTML=choices;
 $("compareA").value=games.some(g=>g.id===prevA)?prevA:(games[0]?.id||"");
 $("compareB").value=games.some(g=>g.id===prevB)?prevB:(games[1]?.id||games[0]?.id||"");
 const a=games.find(g=>g.id===$("compareA").value),b=games.find(g=>g.id===$("compareB").value);
 if(!a||!b){$("compareChart").innerHTML=svgEmpty("Select two games to compare.");$("compareCards").innerHTML="";return}
 const mk=g=>{
  const m=new Map(g.rows.map(r=>[r.month,r]));
  return months.map(k=>{
   const r=m.get(k);
   return r?(r[state.metric]??null):null;
  });
 };
 $("compareChart").innerHTML=lineChart(months,[
  {name:a.game,values:mk(a),color:"#38617c"},
  {name:b.game,values:mk(b),color:"#477966"}
 ],{metric:state.metric});
 $("compareCards").innerHTML=[a,b].map((g,i)=>'<div class="card pad" style="margin-top:12px"><div class="eyebrow">Game '+(i?"B":"A")+'</div><h3>'+esc(g.game)+'</h3><div class="muted small">'+g.months+' observed months · '+int(g.plays)+' plays · '+dec(g.hours)+' hours · '+pctRatio(g.ratio)+' premium hour share</div></div>').join("");
}
function renderGameDetail(id,focusedMonth=null){
 const rows=selectedRows(),games=byGame(rows);
 const g=games.find(x=>x.id===id);if(!g)return;
 state.detailGame=id;
 $("detailName").textContent=g.game;
 $("detailStats").innerHTML=[
  kpi("Total plays",fmtKpi(g.plays),"Selected months"),
  kpi("Time spent",fmtKpi(g.hours)+" hr","Observed hours"),
  kpi("Premium hours",fmtKpi(g.premium)+" hr",pctRatio(g.ratio)+" share"),
  kpi("Avg audience share",percent(g.audienceAvg),"Unweighted monthly mean"),
  kpi("Avg duration",dec(g.averageDuration)+" min","Weighted by recorded plays")
 ].join("");
 const months=periodsSelected(),data=new Map(g.rows.map(r=>[r.month,r]));
 $("detailChart").innerHTML=lineChart(months,[{name:g.game,values:months.map(m=>data.get(m)?.[state.metric]??null)}],{metric:state.metric});
 $("detailRows").innerHTML=months.slice().reverse().map(month=>{
  const r=data.get(month);
  if(!r)return '<tr><td>'+esc(monthLabel(month))+'</td><td colspan="8" class="muted">Not present in export</td></tr>';
  return '<tr'+(month===focusedMonth?' style="background:#e8f1f6"':'')+' data-detail-month="'+esc(month)+'"><td>'+esc(monthLabel(month))+'</td><td class="num">'+int(r.played_total)+'</td><td class="num">'+int(r.played_realtime)+'</td><td class="num">'+int(r.played_turnbased)+'</td><td class="num">'+dec(r.time_spent_hr)+'</td><td class="num">'+dec(r.premium_time_spent_hr)+'</td><td class="num">'+percent(r.audience_share_pct)+'</td><td class="num">'+percent(r.premium_audience_share_pct)+'</td><td class="num">'+dec(r.average_duration_min)+'</td></tr>';
 }).join("");
 $("detailLink").innerHTML=g.url?'<a class="btn" href="'+esc(g.url)+'" target="_blank" rel="noopener">Open on BGA ↗</a>':'<span class="small muted">No BGA game URL in imported rows.</span>';
 $("gameDialog").showModal();
 if(focusedMonth){const row=[...$("detailRows").querySelectorAll("[data-detail-month]")].find(x=>x.dataset.detailMonth===focusedMonth);row?.scrollIntoView({block:"nearest"})}
}
function renderPeriodOptions() {
 const months=allMonths(state.rows);
 const options='<option value="">All available</option>'+months.map(month=>'<option value="'+month+'">'+esc(monthLabel(month))+'</option>').join("");
 $("fromMonth").innerHTML=options;$("toMonth").innerHTML=options;
 $("fromMonth").value=state.from;$("toMonth").value=state.to;
}
function render(){
 const has=state.rows.length>0;
 $("setupPane").hidden=has;$("dataWorkspace").hidden=!has;
 $("sourceSummary").textContent=has?int(state.rows.length)+" game-month rows · "+int(byGame(state.rows).length)+" games imported":"No audience CSV imported";
 $("sourceMonths").hidden=!has;
 if(!has)return;
 const monthsAll=allMonths(state.rows);
 $("sourceMonths").textContent=monthLabel(monthsAll[0])+" – "+monthLabel(monthsAll[monthsAll.length-1]);
 const gaps=monthRange(monthsAll[0],monthsAll[monthsAll.length-1]).filter(m=>!monthsAll.includes(m));
 $("sourceIssues").hidden=!gaps.length;
 $("sourceIssues").textContent=gaps.length+" missing calendar month"+(gaps.length===1?"":"s");
 renderPeriodOptions();
 const rows=selectedRows(),months=periodsSelected();
 $("filterStatus").textContent=int(rows.length)+" rows · "+byGame(rows).length+" games";
 document.querySelectorAll(".tab[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===state.view));
 for(const name of ["overview","monthly","games","matrix","compare"])$("tab-"+name).hidden=name!==state.view;
 if(state.view==="overview")renderOverview(rows,months);
 else if(state.view==="monthly")renderMonthly(rows,months);
 else if(state.view==="games")renderGames(rows);
 else if(state.view==="matrix")renderMatrix(rows,months);
 else if(state.view==="compare")renderCompare(rows,months);
}
function alertBox(message,type=""){
 const el=$("alert");
 el.className="message"+(type?" "+type:"");el.textContent=message;el.hidden=!message;
}
function showImportFeedback(message,kind=""){
 const el=$("importFeedback");
 el.textContent=message;el.className="message"+(kind?" "+kind:"");el.hidden=!message;
}
function showImport(){$("importDialog").showModal();showImportFeedback("")}
function openDb(){
 if(!indexedDB)throw Error("IndexedDB unavailable");
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open("bga-audience-intelligence",1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("rows"))req.result.createObjectStore("rows",{keyPath:"key"})};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
function fetchSaved(){
 if(!state.db)return Promise.resolve([]);
 return new Promise((resolve,reject)=>{
  const req=state.db.transaction("rows","readonly").objectStore("rows").getAll();
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
 });
}
function saveRows(rows,deleteMonths=[]){
 if(!state.db)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const tx=state.db.transaction("rows","readwrite"),store=tx.objectStore("rows");
  // Queue deletions before new puts, without a competing cursor.
  // IndexedDB keeps the transaction alive while the getAllKeys request runs.
  if(deleteMonths.length){
   const keys=store.getAllKeys(),allowed=new Set(deleteMonths);
   keys.onsuccess=()=>{
    for(const key of keys.result)if(allowed.has(String(key).slice(0,7)))store.delete(key);
    for(const row of rows)store.put(row);
   };
  }else for(const row of rows)store.put(row);
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error("IndexedDB save failed"));
  tx.onabort=()=>reject(tx.error||Error("IndexedDB save aborted"));
 });
}
async function importCsv(textValue,replaceMonths=false){
 try{
  const parsed=parseCsv(textValue);
  const imported=parsed.rows,months=[...new Set(imported.map(r=>r.month))];
  const map=new Map((replaceMonths?state.rows.filter(r=>!months.includes(r.month)):state.rows).map(r=>[r.key,r]));
  let added=0,updated=0;
  for(const row of imported){
   const prev=map.get(row.key);
   if(prev){
    updated++;
    for(const col of numericCols)if(row[col]===null && isNumber(prev[col]))row[col]=prev[col];
    if(!row.model)row.model=prev.model;
    if(!row.game_url)row.game_url=prev.game_url;
   }else added++;
   map.set(row.key,row)
  }
  await saveRows(imported,replaceMonths?months:[]);
  state.rows=[...map.values()];
  state.importStats=parsed;
  state.gamesVisible=75;state.matrixVisible=90;
  $("importText").value="";
  $("importDialog").close();
  render();
  alertBox("Imported "+int(added)+" new and "+int(updated)+" updated game-month records across "+months.length+" months"+
   (parsed.skipped?"; skipped "+parsed.skipped+" invalid rows":"")+
   (parsed.duplicates?"; collapsed "+parsed.duplicates+" repeated keys":"")+".");
  return true;
 }catch(e){
  showImportFeedback(e.message,"error");
  return false;
 }
}
function downloadMergedCSV(){
 if(!state.rows.length)return alertBox("No rows to export yet.","warn");
 const quote=value=>{
  let s=value==null?"":String(value);
  if(/^\s*[=+@-]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 };
 const rows=state.rows.slice().sort((a,b)=>a.month.localeCompare(b.month)||a.game.localeCompare(b.game));
 const csv=[EXPECTED.join(","),...rows.map(r=>EXPECTED.map(k=>quote(r[k])).join(","))].join("\r\n");
 const blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob);
 const link=document.createElement("a");link.href=url;link.download="bga_audience_merged_"+new Date().toISOString().slice(0,10)+".csv";
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),8000);
 alertBox("Downloaded "+int(rows.length)+" merged audience rows.");
}

async function copyExtractor(){
 try{
  const res=await fetch("bga-audience-export.js",{cache:"no-store"});
  if(!res.ok)throw Error("Exporter file unavailable ("+res.status+").");
  const script=await res.text();
  try{await navigator.clipboard.writeText(script);alertBox("Exporter copied. Open BGA Audience List, press F12 → Console, paste, and choose 1–120 months.");}
  catch{
   alertBox("Clipboard permission blocked. Open the script link, select all, and copy manually.","warn");
   window.open("bga-audience-export.js","_blank","noopener");
  }
 }catch(e){alertBox(e.message,"error")}
}
function bind(){
 $("loadCollection").onclick=()=>loadCollection(true);
 $("collectionUser").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();loadCollection(false)}});
 $("collectionUser").addEventListener("change",()=>loadCollection(false));
 $("matrixSort").addEventListener("change",event=>{state.matrixSort=event.target.value;state.matrixVisible=90;$("matrixScroll").scrollTop=0;render()});
 $("matrixOnlyMatches").addEventListener("change",event=>{state.matrixOnlyMatches=event.target.checked;state.matrixVisible=90;$("matrixScroll").scrollTop=0;render()});
 $("matrixScroll").addEventListener("scroll",maybeAppendMatrix,{passive:true});
 $("matrixRows").addEventListener("click",e=>{const c=e.target.closest("[data-cell-game]");if(c){renderGameDetail(c.dataset.cellGame,c.dataset.cellMonth);return}const g=e.target.closest("[data-matrix-game]");if(g)renderGameDetail(g.dataset.matrixGame)});
 $("copyExtractor").onclick=copyExtractor;$("setupCopy").onclick=copyExtractor;$("exportMerged").onclick=downloadMergedCSV;
 $("openImport").onclick=showImport;$("setupImport").onclick=showImport;
 $("closeImport").onclick=()=>$("importDialog").close();
 $("commitImport").onclick=()=>importCsv($("importText").value,$("replaceImport").checked);
 $("pasteClipboard").onclick=async()=>{try{$("importText").value=await navigator.clipboard.readText();showImportFeedback("Clipboard pasted. Choose Import rows to merge.");}catch{showImportFeedback("Clipboard permission unavailable. Paste directly with Ctrl+V.","warn")}};
 $("importFiles").onchange=async e=>{
  const files=[...e.target.files];e.target.value="";
  if(!files.length)return;
  for(const file of files){const ok=await importCsv(await file.text(),$("replaceImport").checked);if(!ok)break}
 };
 for(const tab of document.querySelectorAll("[data-tab]"))tab.onclick=()=>{state.view=tab.dataset.tab;if(state.view==="matrix")state.matrixVisible=90;render()};
 $("fromMonth").onchange=e=>{state.from=e.target.value;render()};
 $("toMonth").onchange=e=>{state.to=e.target.value;render()};
 $("metric").onchange=e=>{state.metric=e.target.value;render()};
 $("gameSearch").oninput=e=>{state.search=e.target.value.trim().toLowerCase();state.gamesVisible=75;state.matrixVisible=90;render()};
 $("clearFilters").onclick=()=>{state.from="";state.to="";state.search="";state.metric="played_total";state.gamesVisible=75;state.matrixVisible=90;$("gameSearch").value="";$("metric").value=state.metric;render()};
 $("gameSort").onchange=e=>{state.gameSort=e.target.value;state.gamesVisible=75;render()};
 $("loadMoreGames").onclick=()=>{state.gamesVisible+=75;renderGames(selectedRows())};
 $("monthRows").onclick=e=>{const tr=e.target.closest("[data-month]");if(tr){monthlyDetails(tr.dataset.month,selectedRows());$("monthDetails").scrollIntoView({behavior:"smooth",block:"nearest"})}};
 $("closeMonth").onclick=()=>{$("monthDetails").hidden=true;state.detailMonth=null};
 $("gameRows").onclick=e=>{const tr=e.target.closest("[data-game]");if(tr)renderGameDetail(tr.dataset.game)};
 $("monthGameRows").onclick=e=>{const tr=e.target.closest("[data-game]");if(tr)renderGameDetail(tr.dataset.game)};
 $("closeGame").onclick=()=>$("gameDialog").close();
 $("compareA").onchange=()=>renderCompare(selectedRows(),periodsSelected());
 $("compareB").onchange=()=>renderCompare(selectedRows(),periodsSelected());
 document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("gameDialog").open)$("gameDialog").close();if($("importDialog").open)$("importDialog").close()}});
}
async function init(){
 bind();
 try{
  state.db=await openDb();
  state.rows=(await fetchSaved()).map(cleanRow).filter(Boolean);
 }catch(e){alertBox("Browser persistence unavailable; imports can be viewed in this tab but may not survive refresh. "+e.message,"warn")}
 render();
 initializeCollection().catch(e=>updateCollectionStatus("Collection initialization failed: "+e.message,true));
}
init();
})();