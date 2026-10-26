/* GeekMail Desk: BGG collection enrichment. Public game metadata only; private messages stay in browser. */
(() => {
"use strict";
const $ = id => document.getElementById(id);
const escapeHtml=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clean=s=>String(s??"").trim();
const uniq=a=>[...new Set(a)];
const normalize=s=>String(s??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
  .replace(/&/g," and ").replace(/['’]/g,"").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
const safeImg=url=>{
 try{const u=new URL(String(url||""));return u.protocol==="https:" &&
  /(^|\.)geekdo-images\.com$|(^|\.)geekdo-static\.com$|(^|\.)boardgamegeek\.com$/i.test(u.hostname)?u.href:""}catch{return ""}
};
function parseIds(value){
 if(Array.isArray(value))return uniq(value.map(String).filter(Boolean));
 if(!value)return [];
 if(typeof value!=="string")return [];
 try{const parsed=JSON.parse(value);if(Array.isArray(parsed))return parseIds(parsed)}catch(_){}
 return uniq(value.split(/[|,;]/g).map(clean).filter(Boolean));
}
function readCollection(xml){
 const doc=new DOMParser().parseFromString(xml,"application/xml");
 if(doc.querySelector("parsererror"))throw Error("BGG collection XML could not be parsed.");
 if(doc.documentElement?.nodeName!=="items"){
  throw Error(doc.querySelector("message")?.textContent?.trim()||"BGG returned an unexpected response.");
 }
 const items=[...doc.querySelectorAll("items > item")].map(item=>({
  id:item.getAttribute("objectid")||"",
  name:item.querySelector("name")?.textContent?.trim()||"",
  thumbnail:safeImg(item.querySelector("thumbnail")?.textContent),
  image:safeImg(item.querySelector("image")?.textContent)
 })).filter(g=>g.id&&g.name);
 return [...new Map(items.map(g=>[g.id,g])).values()].sort((a,b)=>a.name.localeCompare(b.name));
}
class Tags {
 constructor(){
  this.games=[];this.byId=new Map();this.index=new Map();this.cache=new WeakMap();
  this.filterId="";this.username="sportomax";this.ctx=null;this.cacheDb=null;
  this.status="";this.pending=false;this.version=0;
 }
 async openDb(){
  if(!window.indexedDB)return null;
  return new Promise((resolve,reject)=>{
   const req=indexedDB.open("geekmail-desk-game-collections",1);
   req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("collections"))req.result.createObjectStore("collections",{keyPath:"username"})};
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
 }
 async fromCache(username){
  if(!this.cacheDb)return null;
  return new Promise((resolve,reject)=>{
   const req=this.cacheDb.transaction("collections","readonly").objectStore("collections").get(username.toLowerCase());
   req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
  });
 }
 async saveCache(username,games){
  if(!this.cacheDb)return;
  return new Promise((resolve,reject)=>{
   const tx=this.cacheDb.transaction("collections","readwrite");
   tx.objectStore("collections").put({username:username.toLowerCase(),games,saved:Date.now()});
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||Error("Collection cache write failed"));
  });
 }
 installGames(games){
  this.games=games.map(g=>({...g,norm:normalize(g.name)})).filter(g=>g.norm);
  this.byId=new Map(this.games.map(g=>[g.id,g]));
  this.index=new Map();
  const stop=new Set(["the","and","for","game","from","with","edition","this"]);
  for(const g of this.games){
   const tokens=g.norm.split(" ").sort((a,b)=>b.length-a.length);
   const pivot=tokens.find(t=>t.length>=3&&!stop.has(t))||tokens[0];
   if(!pivot)continue;
   if(!this.index.has(pivot))this.index.set(pivot,[]);
   this.index.get(pivot).push(g);
  }
  this.cache=new WeakMap();
  if(!this.byId.has(this.filterId))this.filterId="";
  this.refreshFilter();this.updateStats();this.ctx?.render();
 }
 auto(row){
  if(!this.games.length)return [];
  const cached=this.cache.get(row);
  if(cached)return cached;
  const subject=normalize(row.subject),body=normalize(row.body_text);
  const sp=" "+subject+" ",bp=" "+body+" ";
  const candidates=new Map();
  for(const token of new Set((subject+" "+body).split(" ").filter(Boolean))){
   const list=this.index.get(token);
   if(list)for(const g of list)candidates.set(g.id,g);
  }
  const hits=[];
  for(const g of candidates.values()){
   const inSubject=sp.includes(" "+g.norm+" ");
   const inBody= g.norm.length>=5 && bp.includes(" "+g.norm+" ");
   if(!(inSubject||inBody))continue;
   const source=inSubject?"Subject":"Description";
   const score=(inSubject?(subject===g.norm?300:200):100)+g.norm.length;
   hits.push({id:g.id,source,score});
  }
  hits.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  this.cache.set(row,hits);
  return hits;
 }
 matches(row){
  const ignored=new Set(parseIds(row.ignoredGameIds));
  const manual=new Set(parseIds(row.manualGameIds));
  const out=[];
  for(const id of manual)if(this.byId.has(id))out.push({...this.byId.get(id),source:"Manual"});
  for(const hit of this.auto(row)){
   if(manual.has(hit.id)||ignored.has(hit.id))continue;
   const g=this.byId.get(hit.id);
   if(g)out.push({...g,source:hit.source});
  }
  return out;
 }
 accepts(row){return !this.filterId||this.matches(row).some(g=>g.id===this.filterId)}
 mini(row){
  const matches=this.matches(row);
  if(!matches.length)return "";
  const image=matches.find(g=>g.thumbnail);
  return '<div class="mail-game-icons">'+
   (image?'<img src="'+escapeHtml(image.thumbnail)+'" loading="lazy" alt="">':"")+
   '<span class="game-name">'+escapeHtml(matches.slice(0,2).map(g=>g.name).join(" · "))+
   (matches.length>2?" +"+(matches.length-2):"")+'</span></div>';
 }
 subjects(rows){
  const found=new Map();
  for(const row of rows)for(const g of this.matches(row))found.set(g.id,g);
  if(!found.size)return "";
  const games=[...found.values()];
  return '<div class="subject-games">'+
   games.slice(0,3).map(g=>g.thumbnail?'<img src="'+escapeHtml(g.thumbnail)+'" loading="lazy" alt="'+escapeHtml(g.name)+'" title="'+escapeHtml(g.name)+'">':"").join("")+
   '<span>'+escapeHtml(games.slice(0,2).map(g=>g.name).join(" · "))+(games.length>2?" +"+(games.length-2):"")+'</span></div>';
 }
 reader(row){
  const matches=this.matches(row);
  const chips=matches.map(g=>'<span class="game-chip" title="'+escapeHtml("Matched in "+g.source)+'">'+
   (g.thumbnail?'<img src="'+escapeHtml(g.thumbnail)+'" alt="" loading="lazy">':"")+
   '<button type="button" class="game-chip" data-game-filter="'+escapeHtml(g.id)+'" title="Filter mailbox to '+escapeHtml(g.name)+'">'+escapeHtml(g.name)+'</button>'+
   '<button type="button" class="tag-remove" data-tag-remove="'+escapeHtml(g.id)+'" title="Remove tag">×</button></span>').join("");
  return '<section class="reading-game-panel"><strong>Board games in this message</strong><p>'+
   (matches.length ? matches.length+" matches based on exact game titles in the subject/description, or manual tags." : "No game title matches found. You can tag a game manually.")+
   '</p><div class="game-tag-row">'+chips+'</div>'+
   '<div class="reader-tag-controls"><select id="tagGameChoice" aria-label="Add game tag">'+
   '<option value="">+ Tag another game from collection</option>'+
   this.games.map(g=>'<option value="'+escapeHtml(g.id)+'">'+escapeHtml(g.name)+'</option>').join("")+
   '</select></div></section>';
 }
 refreshFilter(){
  const select=$("gameFilter");if(!select)return;
  select.innerHTML='<option value="">All games ('+this.games.length+')</option>'+
   this.games.map(g=>'<option value="'+escapeHtml(g.id)+'">'+escapeHtml(g.name)+'</option>').join("");
  select.value=this.filterId;
 }
 updateStats(status){
  if(status!==undefined)this.status=status;
  if(!$("collectionCount"))return;
  let total=0;
  if(this.games.length && this.ctx){
   for(const row of this.ctx.state.rows)if(this.matches(row).length)total++;
  }
  $("collectionCount").textContent=this.games.length.toLocaleString()+" games · "+total.toLocaleString()+" tagged messages";
  $("collectionStatus").textContent=this.status||"Load collection to find game matches";
 }
 async init(ctx){
  this.ctx=ctx;
  try{this.cacheDb=await this.openDb()}catch(e){this.status="Collection caching unavailable"}
  try{this.username=localStorage.getItem("geekmail-desk-collection-user")||"sportomax"}catch(_){}
  $("collectionUsername").value=this.username;
  $("collectionUsername").addEventListener("change",()=>this.changeUser());
  $("collectionUsername").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();this.load()}});
  $("loadCollection").addEventListener("click",()=>this.load());
  $("gameFilter").addEventListener("change",e=>{this.filterId=e.target.value;this.ctx.state.visible=90;this.ctx.render()});
  this.refreshFilter();this.updateStats();
  const cached=await this.fromCache(this.username).catch(()=>null);
  if(cached?.games?.length){
   this.installGames(cached.games);
   this.updateStats("Cached collection · "+new Date(cached.saved).toLocaleDateString());
  }else{
   this.updateStats("Fetching "+this.username+"'s collection…");
   // Auto-load once when a username has no cached collection.
   this.load();
  }
 }
 async changeUser(){
  const username=clean($("collectionUsername").value)||"sportomax";
  if(username.toLowerCase()===this.username.toLowerCase())return;
  this.username=username;this.version++;
  this.filterId="";this.installGames([]);
  try{localStorage.setItem("geekmail-desk-collection-user",username)}catch(_){}
  const cached=await this.fromCache(username).catch(()=>null);
  if(cached?.games?.length){
   this.installGames(cached.games);this.updateStats("Cached collection · "+new Date(cached.saved).toLocaleDateString());
  }else this.updateStats("Click Load collection for "+username);
 }
 async load(){
  const username=clean($("collectionUsername").value).replace(/^@/,"");
  if(!/^[a-z0-9][a-z0-9_.-]{1,59}$/i.test(username)){
   this.updateStats("Please enter a valid BGG username.");$("collectionStatus").classList.add("error");return;
  }
  this.username=username;
  try{localStorage.setItem("geekmail-desk-collection-user",username)}catch(_){}
  const request=++this.version;
  this.pending=true;$("loadCollection").disabled=true;$("loadCollection").textContent="Loading…";
  $("collectionStatus").classList.remove("error");this.updateStats("Fetching "+username+"'s BGG owned collection…");
  try{
   const params=new URLSearchParams({endpoint:"collection",username,own:"1",stats:"1",subtype:"boardgame"});
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),70000);
   let response;
   try{response=await fetch("/api/bgg-helper?"+params,{cache:"no-store",signal:controller.signal,headers:{"Accept":"text/xml,application/xml"}})}
   finally{clearTimeout(timeout)}
   if(request!==this.version)return;
   const xml=await response.text();
   if(!response.ok){
    let message="";
    try{message=JSON.parse(xml).message||""}catch(_){}
    throw Error("BGG returned "+response.status+(message?": "+message:""));
   }
   if(!xml.trim().startsWith("<"))throw Error("BGG returned a non-XML response.");
   const games=readCollection(xml);
   if(!games.length)throw Error("No publicly accessible owned board games found.");
   await this.saveCache(username,games).catch(()=>{});
   if(request!==this.version)return;
   this.installGames(games);this.updateStats("Loaded "+username+" · "+new Date().toLocaleTimeString());
  }catch(e){
   if(request!==this.version)return;
   $("collectionStatus").classList.add("error");
   this.updateStats("Collection unavailable: "+(e.name==="AbortError"?"request timed out":e.message)+". Try Load collection again.");
  }finally{if(request===this.version){this.pending=false;$("loadCollection").disabled=false;$("loadCollection").textContent="Load collection"}}
 }
 async edit(id,remove){
  const row=this.ctx.state.rows.find(r=>r.key===this.ctx.state.selected);
  if(!row||!this.byId.has(id))return;
  const manual=new Set(parseIds(row.manualGameIds)),ignored=new Set(parseIds(row.ignoredGameIds));
  if(remove){manual.delete(id);ignored.add(id)}else{manual.add(id);ignored.delete(id)}
  row.manualGameIds=[...manual];row.ignoredGameIds=[...ignored];
  this.cache.delete(row);
  try{await this.ctx.saveRows([row])}catch(e){this.ctx.banner("Could not save tag: "+e.message,true)}
  this.updateStats();this.ctx.render();
 }
 filtered(id){
  this.filterId=id;this.refreshFilter();
  this.ctx.state.visible=90;this.ctx.state.view="all";
  this.ctx.state.selected="";this.ctx.render();
 }
 click(e){
  const remove=e.target.closest("[data-tag-remove]");
  if(remove){e.preventDefault();e.stopPropagation();this.edit(remove.dataset.tagRemove,true);return true}
  const filter=e.target.closest("[data-game-filter]");
  if(filter){e.preventDefault();e.stopPropagation();this.filtered(filter.dataset.gameFilter);return true}
  return false;
 }
 change(e){
  if(e.target.id==="tagGameChoice" && e.target.value){this.edit(e.target.value,false);return true}
  return false;
 }
}
// Expose a deliberately narrow integration surface to the mailbox SPA.
window.GeekMailTags=new Tags();
window.GeekMailTags.parseIds=parseIds;
window.GeekMailTags.readCollection=readCollection;
})();