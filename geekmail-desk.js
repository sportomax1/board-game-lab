/* GeekMail Desk — local-only BGG CSV mailbox viewer. No third-party libraries. */
(() => {
"use strict";
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clean = s => String(s ?? "").replace(/\r\n?/g,"\n").trim();
const keyName = s => clean(s).toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");
const number = n => Number(n || 0).toLocaleString();
const state = { rows: [], db:null, view:"all", selected:"", search:"", order:"new", visible:90, contactLimit:72, laneLimit:100, lanePerson:"", laneOrder:"old", contactSort:"recent", laneContactsLimit:12, laneExpanded:new Map(), busy:false };
const FIELDS = ["folder","message_id","from_username","to_username","from_avatar_url","to_avatar_url","subject","message_date","body_text","body_html","manualGameIds","ignoredGameIds"];
const stamp = r => r.ts || 0;
const mailFolder = r => /outbox|sent/i.test(String(r.folder || "")) ? "Outbox" : "Inbox";
const counterpart = r => mailFolder(r) === "Inbox" ? r.from_username : r.to_username;
const otherAvatar = r => mailFolder(r) === "Inbox" ? r.from_avatar_url : r.to_avatar_url;
const contactId = s => clean(s).toLowerCase();
const titleFor = {all:"All mail",inbox:"Inbox",sent:"Sent",starred:"Starred",unread:"Unread",archived:"Archived",contacts:"Contacts",lanes:"Swim lanes"};
let toastTimer;

function isoDay(d) {
 if (!d || Number.isNaN(d.getTime())) return "";
 return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function dateOf(value) {
 const raw=clean(value);
 if(!raw) return null;
 if(/^today\b/i.test(raw)) { const d=new Date(); d.setHours(12,0,0,0); return d; }
 if(/^yesterday\b/i.test(raw)) { const d=new Date(); d.setDate(d.getDate()-1);d.setHours(12,0,0,0);return d; }
 const iso=/^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/.exec(raw);
 if(iso && raw.length===10) {
  const d=new Date(+iso[1],+iso[2]-1,+iso[3],12);
  return isoDay(d)===raw?d:null;
 }
 let d=new Date(raw);
 if (!Number.isNaN(d.getTime())) return d;
 d=new Date(raw.replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?[,]?\s+/i,""));
 return Number.isNaN(d.getTime())?null:d;
}
function shortDate(r) {
 if(!r.ts) return r.message_date || "Unknown date";
 const d=new Date(r.ts);
 return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
}
function longDate(r) {
 if(!r.ts) return r.message_date || "Unknown date";
 const d=new Date(r.ts);
 return d.toLocaleString(undefined,{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
}
function initials(name) {
 const a=clean(name).split(/[\s_.-]+/).filter(Boolean);
 return (a.length>1 ? a.slice(0,2).map(s=>s[0]).join("") : (a[0]||"?").slice(0,2)).toUpperCase();
}
function avatarHtml(r) {
 const name=counterpart(r)||"?";
 const raw=otherAvatar(r);
 let src="";
 try {
  const u=new URL(raw);
  if(u.protocol==="https:" && (/(^|\.)boardgamegeek\.com$/i.test(u.hostname) || /(^|\.)geekdo-static\.com$/i.test(u.hostname))) src=u.href;
 } catch (_) {}
 return '<span class="circle">'+(src ? '<img src="'+esc(src)+'" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">' : esc(initials(name)))+'</span>';
}
function banner(message, error=false) {
 const el=$("banner");
 el.textContent=message;
 el.classList.toggle("error",error);
 el.hidden=!message;
}
function toast(message) {
 const el=$("toast");el.textContent=message;el.hidden=false;
 clearTimeout(toastTimer);
 toastTimer=setTimeout(()=>el.hidden=true,4200);
}
function parseCSV(input) {
 const text=String(input).replace(/^\uFEFF/,"");
 const rows=[];let row=[],cell="",quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quoted){
   if(ch==='"' && text[i+1]==='"'){cell+='"';i++}
   else if(ch==='"')quoted=false;
   else cell+=ch;
  }else if(ch==='"'){
   if(cell!=="") throw new Error("Invalid quote in CSV at character "+(i+1));
   quoted=true;
  }else if(ch===","){row.push(cell);cell=""}
  else if(ch==="\n" || ch==="\r"){
   if(ch==="\r" && text[i+1]==="\n")i++;
   row.push(cell);cell="";
   if(row.some(x=>x.trim()!==""))rows.push(row);
   row=[];
  }else cell+=ch;
 }
 if(quoted)throw new Error("CSV ends inside a quoted cell.");
 row.push(cell);
 if(row.some(x=>x.trim()!==""))rows.push(row);
 if(!rows.length)throw new Error("The CSV is empty.");
 const headers=rows.shift().map(keyName);
 if(!headers.includes("subject") || !headers.some(h=>["body_text","body","message_body"].includes(h))) {
  throw new Error("Unrecognized CSV. Expected columns such as folder, subject, body_text and message_date.");
 }
 return rows.map(cells=>{
  const out={};
  headers.forEach((h,i)=>out[h]=cells[i]||"");
  return out;
 });
}
function hash(text) {
 let n=2166136261;
 for(let i=0;i<text.length;i++)n=Math.imul(n ^ text.charCodeAt(i),16777619);
 return (n>>>0).toString(36);
}
function normalize(raw) {
 const r=Object.fromEntries(Object.entries(raw||{}).map(([k,v])=>[keyName(k),v]));
 let folder=mailFolder({folder:r.folder||r.direction||r.mailbox});
 if(!r.folder && !r.direction && !r.mailbox && /sent/i.test(r.label||""))folder="Outbox";
 const from=clean(r.from_username||r.from||r.sender||r.from_user||"");
 const to=clean(r.to_username||r.to||r.recipient||r.to_user||"");
 const body=String(r.body_text ?? r.body ?? r.message_body ?? r.text ?? "");
 const subject=clean(r.subject||r.title||"");
 const date=clean(r.message_date||r.date||r.timestamp||r.sent_date||"");
 const id=clean(r.message_id||r.id||r.msg_id||"") || "fallback-"+hash([folder,from,to,subject,date,body].join("\u0001"));
 const dateObj=dateOf(date);
 return {
  key:folder+":"+id,folder,message_id:id,
  from_username:from || (folder==="Outbox"?"sportomax":""),
  to_username:to || (folder==="Inbox"?"sportomax":""),
  from_avatar_url:clean(r.from_avatar_url||""),
  to_avatar_url:clean(r.to_avatar_url||""),
  subject, message_date:date, body_text:body,
  body_html:String(r.body_html||""),
  ts:dateObj ? dateObj.getTime() : 0,
  day:dateObj ? isoDay(dateObj) : "",
  starred:false,read:true,archived:false,
  manualGameIds:window.GeekMailTags?.parseIds(r.manualgameids||r.manual_game_ids)||[],
  ignoredGameIds:window.GeekMailTags?.parseIds(r.ignoredgameids||r.ignored_game_ids)||[],
  export_error:clean(r.export_error||"")
 };
}
function parseInput(value) {
 const s=clean(value).replace(/^\uFEFF/,"");
 if(!s)throw new Error("Paste a CSV or choose a file first.");
 let rows;
 if(s.startsWith("[") || s.startsWith("{")){
  let parsed;
  try {parsed=JSON.parse(s)} catch(error){throw new Error("JSON parse failed: "+error.message)}
  rows=Array.isArray(parsed)?parsed:(parsed.records||parsed.messages||parsed.data);
  if(!Array.isArray(rows))throw new Error("JSON needs a message array or a records array.");
 }else rows=parseCSV(s);
 const mapped=rows.filter(x=>x&&typeof x==="object"&&!Array.isArray(x)).map(normalize);
 if(!mapped.length)throw new Error("No valid message rows were found.");
 return mapped;
}
function openDatabase() {
 return new Promise((resolve,reject)=>{
  if(!window.indexedDB){reject(new Error("IndexedDB unavailable"));return;}
  const req=indexedDB.open("bgg-geekmail-desk",1);
  req.onupgradeneeded=()=>{
   const db=req.result;
   if(!db.objectStoreNames.contains("messages"))db.createObjectStore("messages",{keyPath:"key"});
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||new Error("IndexedDB blocked"));
 });
}
function dbGetAll() {
 return new Promise((resolve,reject)=>{
  const tx=state.db.transaction("messages","readonly");
  const req=tx.objectStore("messages").getAll();
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
}
function dbSave(rows,replace=false) {
 if(!state.db)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const tx=state.db.transaction("messages","readwrite");
  const store=tx.objectStore("messages");
  if(replace)store.clear();
  rows.forEach(r=>store.put(r));
  tx.oncomplete=resolve;
  tx.onerror=()=>reject(tx.error||new Error("IndexedDB write failed"));
  tx.onabort=()=>reject(tx.error||new Error("IndexedDB transaction aborted"));
 });
}
function dbClear() {
 if(!state.db)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const tx=state.db.transaction("messages","readwrite");
  tx.objectStore("messages").clear();
  tx.oncomplete=resolve;
  tx.onerror=()=>reject(tx.error||new Error("Clear failed"));
 });
}
async function importData(textValue,replace=false) {
 if(state.busy)return;
 state.busy=true;
 try{
  $("importFeedback").textContent="Parsing imported messages…";
  const incoming=parseInput(textValue);
  const before=replace ? new Map() : new Map(state.rows.map(r=>[r.key,r]));
  let added=0,updated=0;
  for(const row of incoming) {
   const prev=before.get(row.key);
   if(prev){
    row.starred=!!prev.starred;row.read=prev.read!==false;row.archived=!!prev.archived;
    row.manualGameIds=window.GeekMailTags?.parseIds(prev.manualGameIds)||[];
    row.ignoredGameIds=window.GeekMailTags?.parseIds(prev.ignoredGameIds)||[];
    if(!row.body_text && prev.body_text)row.body_text=prev.body_text;
    updated++;
   }else added++;
   before.set(row.key,row);
  }
  const combined=[...before.values()];
  await dbSave(combined,replace);
  state.rows=combined;
  window.GeekMailTags?.cache && (window.GeekMailTags.cache=new WeakMap());
  window.GeekMailTags?.updateStats();
  state.visible=90;state.selected="";state.laneLimit=100;state.laneExpanded.clear();state.laneContactsLimit=12;
  refresh();
  $("pasteBox").value="";
  $("importFeedback").textContent=number(added)+" new, "+number(updated)+" updated; "+number(combined.length)+" messages stored.";
  banner("Import complete: "+number(added)+" added, "+number(updated)+" merged.");
  $("importDialog").close();
 }catch(error){
  $("importFeedback").textContent=error.message;
  banner(error.message,true);
 }finally{state.busy=false}
}
function sortedMail(input) {
 return input.sort((a,b)=>state.order==="new"?stamp(b)-stamp(a):stamp(a)-stamp(b));
}
function matched(r,includeView=true) {
 if(includeView){
  if(state.view==="inbox" && mailFolder(r)!=="Inbox")return false;
  if(state.view==="sent" && mailFolder(r)!=="Outbox")return false;
  if(state.view==="starred" && !r.starred)return false;
  if(state.view==="unread" && r.read)return false;
  if(state.view==="archived" && !r.archived)return false;
  if(state.view!=="archived" && r.archived)return false;
 }
 const from=$("fromDate").value,to=$("toDate").value;
 if(from && (!r.day || r.day<from))return false;
 if(to && (!r.day || r.day>to))return false;
 if(window.GeekMailTags && !window.GeekMailTags.accepts(r))return false;
 if(state.search){
  const hay=[r.subject,r.body_text,r.from_username,r.to_username,r.message_date].join(" ").toLowerCase();
  if(!hay.includes(state.search))return false;
 }
 return true;
}
function filteredMail() {return sortedMail(state.rows.filter(r=>matched(r)));}
function filteredPeopleMail(){return state.rows.filter(r=>matched(r,false) && !r.archived);}
function contactMap() {
 const map=new Map();
 filteredPeopleMail().forEach(r=>{
  const name=counterpart(r)||"(unknown)";
  const id=contactId(name);
  if(!map.has(id))map.set(id,{id,name,rows:[],in:0,out:0,last:null});
  const c=map.get(id);
  c.rows.push(r);
  if(mailFolder(r)==="Inbox")c.in++;else c.out++;
  if(!c.last || stamp(r)>stamp(c.last))c.last=r;
 });
 return [...map.values()];
}
function refreshStats(){
 const rows=state.rows;
 $("nAll").textContent=number(rows.filter(r=>!r.archived).length);
 $("nInbox").textContent=number(rows.filter(r=>!r.archived&&mailFolder(r)==="Inbox").length);
 $("nSent").textContent=number(rows.filter(r=>!r.archived&&mailFolder(r)==="Outbox").length);
 $("nStar").textContent=number(rows.filter(r=>r.starred&&!r.archived).length);
 $("nUnread").textContent=number(rows.filter(r=>!r.read&&!r.archived).length);
 $("nArchived").textContent=number(rows.filter(r=>r.archived).length);
 $("nContacts").textContent=number(new Set(rows.map(r=>contactId(counterpart(r))).filter(Boolean)));
}
function mailRowHtml(r){
 const who=counterpart(r)||"(unknown)";
 const isSent=mailFolder(r)==="Outbox";
 return '<div class="mail-row'+(r.key===state.selected?' selected':'')+(!r.read?' unread':'')+'" role="button" tabindex="0" data-open="'+esc(r.key)+'">'+
  avatarHtml(r)+'<div style="min-width:0"><div class="person">'+(isSent?'To: ':'From: ')+esc(who)+'</div>'+
  '<div class="subject">'+esc(r.subject||"(no subject)")+'</div><div class="snippet">'+esc((r.body_text||"").replace(/\s+/g," ").slice(0,210))+'</div>'+(window.GeekMailTags?.mini(r)||'')+'</div>'+
  '<div class="row-meta">'+esc(shortDate(r))+'<br><button class="star'+(r.starred?' on':'')+'" aria-label="Toggle star" title="Toggle star" data-star="'+esc(r.key)+'">'+(r.starred?'★':'☆')+'</button></div></div>';
}
function renderMailbox() {
 const arr=filteredMail();
 $("resultCount").textContent=number(arr.length)+" messages";
 const shown=arr.slice(0,state.visible);
 $("loadedCount").textContent=arr.length?("Showing "+number(shown.length)):"";
 $("mailRows").innerHTML=shown.length?shown.map(mailRowHtml).join(""):emptyHtml(state.rows.length?"No messages match these filters.":"Your local mailbox is empty.","Import a CSV exported from BGG to start browsing.");
 $("moreMail").hidden=arr.length<=shown.length;
 if(state.selected && !arr.some(r=>r.key===state.selected))state.selected="";
 renderReader();
}
function emptyHtml(title,desc,action=false){
 return '<div class="empty"><div class="empty-icon">✉</div><h3>'+esc(title)+'</h3><p>'+esc(desc)+'</p>'+(action?'<button class="btn primary" data-import>Import mail</button>':'')+'</div>';
}
function findSelected(){return state.rows.find(r=>r.key===state.selected)||null}
function renderReader() {
 const r=findSelected();
 const box=$("readerDetail");
 if(!r){box.innerHTML=emptyHtml("Choose a message","Select a message to read the full body.",!state.rows.length);return}
 const who=counterpart(r)||"(unknown)";
 const sent=mailFolder(r)==="Outbox";
 const recipient=sent?r.to_username:r.from_username;
 const bggLink="https://boardgamegeek.com/geekmail/compose?touser="+encodeURIComponent(recipient);
 box.innerHTML='<div class="reading"><div class="reading-header"><button class="btn small" id="backToList">← Back</button><span class="muted">'+esc(mailFolder(r))+' · ID '+esc(r.message_id)+'</span><button class="star'+(r.starred?' on':'')+'" data-star="'+esc(r.key)+'" aria-label="Toggle star">'+(r.starred?'★':'☆')+'</button></div>'+
  '<h2>'+esc(r.subject||"(no subject)")+'</h2><div class="reading-person">'+avatarHtml(r)+
  '<div style="min-width:0"><b>'+esc(sent?"To: "+who:"From: "+who)+'</b><small>'+esc("From: "+r.from_username+"  ·  To: "+r.to_username)+'</small><small>'+esc(longDate(r))+'</small></div></div>'+
  (window.GeekMailTags?.reader(r)||'')+'<div class="reading-body">'+esc(r.body_text || (r.export_error?"[Body unavailable: "+r.export_error+"]":"[No body text in export]"))+'</div>'+
  '<div class="reading-actions reading-footer"><button class="btn" data-read="'+esc(r.key)+'">'+(r.read?"Mark unread":"Mark read")+'</button><button class="btn" data-archive="'+esc(r.key)+'">'+(r.archived?"Restore":"Archive locally")+'</button><button class="btn" data-copy="'+esc(r.key)+'">Copy message</button>'+
  '<a class="btn" href="'+esc(bggLink)+'" target="_blank" rel="noopener" style="text-decoration:none">Compose on BGG ↗</a><a class="btn" href="https://boardgamegeek.com/geekmail" target="_blank" rel="noopener" style="text-decoration:none">BGG mailbox ↗</a></div></div>';
}
function personSort(arr) {
 const mode=state.contactSort;
 arr.sort((a,b)=>{
  if(mode==="name")return a.name.localeCompare(b.name);
  if(mode==="count")return b.rows.length-a.rows.length;
  if(mode==="waiting"){
   const x=mailFolder(a.last)==="Outbox"?1:0,y=mailFolder(b.last)==="Outbox"?1:0;
   if(x!==y)return y-x;
  }
  return stamp(b.last)-stamp(a.last);
 });
 return arr;
}
function renderContacts(){
 const people=personSort(contactMap());
 $("contactCaption").textContent=number(people.length)+" people in matching messages";
 const shown=people.slice(0,state.contactLimit);
 $("contactGrid").innerHTML=shown.length?shown.map(c=>
  '<button class="contact-card" data-person="'+esc(c.id)+'"><span class="circle">'+esc(initials(c.name))+'</span><span class="contact-info"><b>'+esc(c.name)+'</b><small>'+esc(shortDate(c.last))+'</small><p>'+number(c.in)+' received · '+number(c.out)+' sent</p>'+
  '<small>'+(mailFolder(c.last)==="Outbox"?"Last message: sent":"Last message: received")+'</small>'+(window.GeekMailTags?.mini(c.last)||'')+'</span></button>'
 ).join(""):emptyHtml("No contacts","Import mail or adjust your filters.");
 $("moreContacts").hidden=shown.length>=people.length;
}
function renderPersonSelect(){
 const people=contactMap().filter(c=>c.id && c.id!=="sportomax").sort((a,b)=>a.name.localeCompare(b.name));
 const select=$("contactSelect"),old=state.lanePerson;
 select.innerHTML='<option value="">All contacts</option>'+people.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+' ('+c.rows.length+')</option>').join("");
 if(people.some(c=>c.id===old))select.value=old;else {state.lanePerson="";select.value=""}
}
/* A row represents an external BGG username + one distinct subject.
   Replies and forwarded subjects collapse into their base subject. */
function laneSubject(raw){
 const subject=clean(raw).replace(/^(?:(?:re|fw|fwd)\s*:\s*)+/gi,"").replace(/\s+/g," ").trim();
 return subject || "(no subject)";
}
function laneThreads(person){
 const groups=new Map();
 for(const r of person.rows){
  const subject=laneSubject(r.subject);
  const id=subject.toLocaleLowerCase();
  if(!groups.has(id))groups.set(id,{id,subject,rows:[],in:0,out:0,latest:0,earliest:Infinity});
  const g=groups.get(id);
  g.rows.push(r);
  if(mailFolder(r)==="Inbox")g.in++;else g.out++;
  g.latest=Math.max(g.latest,stamp(r));
  g.earliest=Math.min(g.earliest,stamp(r));
 }
 return [...groups.values()].sort((a,b)=>
  (b.latest-a.latest) || a.subject.localeCompare(b.subject)
 );
}
function laneEvent(r){
 const inbound=mailFolder(r)==="Inbox";
 const direction=inbound ? "Inbound" : "Outbound";
 const dateLabel=r.ts
  ? new Date(r.ts).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})
  : (r.message_date || "Date unknown");
 const timeLabel=r.ts
  ? new Date(r.ts).toLocaleTimeString(undefined,{hour:"numeric",minute:"2-digit"})
  : "";
 const snippet=clean(r.body_text).replace(/\s+/g," ").slice(0,95);
 return '<button type="button" class="lane-event '+(inbound?'inbound':'outbound')+
  '" data-lane-open="'+esc(r.key)+'" title="'+esc(direction+" · "+longDate(r)+" · "+r.subject)+'">'+
  '<span class="lane-event-kind">'+(inbound?'↓ IN':'↑ OUT')+'</span>'+
  '<span class="lane-event-date">'+esc(dateLabel)+'</span>'+
  (timeLabel?'<span class="lane-event-time">'+esc(timeLabel)+'</span>':'')+
  (snippet?'<span class="lane-event-preview">'+esc(snippet)+'</span>':'')+(window.GeekMailTags?.mini(r)||'')+
  '</button>';
}
function laneGroupHtml(person){
 const subjects=laneThreads(person);
 const total=person.rows.length;
 const isLastSent=mailFolder(person.last)==="Outbox";
 let body='<section class="lane-group" aria-label="Messages with '+esc(person.name)+'">'+
  '<div class="lane-title"><div class="lane-person">'+
  '<span class="circle">'+esc(initials(person.name))+'</span><div>'+
  '<b>'+esc(person.name)+'</b><small>'+subjects.length+' subject'+(subjects.length===1?'':'s')+
  ' · '+number(total)+' messages'+(isLastSent?' · Last: sent':' · Last: received')+'</small>'+
  '</div></div><div class="lane-stat"><span class="lane-summary-in">'+number(person.in)+' IN</span>'+
  '<span class="lane-summary-out">'+number(person.out)+' OUT</span></div></div>';
 body+='<div class="subject-rows">';
 for(const thread of subjects){
  const sorted=thread.rows.slice().sort((a,b)=>
   (state.laneOrder==="old" ? stamp(a)-stamp(b) : stamp(b)-stamp(a)) ||
   a.key.localeCompare(b.key)
  );
  const unique=person.id+"::"+thread.id;
  const cap=state.laneExpanded.get(unique)||24;
  const shown=sorted.slice(0,cap);
  body+='<div class="subject-row">'+
   '<div class="subject-identity"><div class="eyebrow">Subject</div>'+
   '<div class="subject-title" title="'+esc(thread.subject)+'">'+esc(thread.subject)+'</div>'+
   '<div class="subject-meta">'+number(thread.rows.length)+' messages · '+number(thread.in)+' in / '+number(thread.out)+' out</div>'+(window.GeekMailTags?.subjects(thread.rows)||'')+'</div>'+
   '<div class="thread-area"><div class="thread-timeline" data-thread="'+esc(unique)+'" aria-label="Chronological messages for '+esc(thread.subject)+'">'+
   shown.map(laneEvent).join('')+
   (sorted.length>shown.length ? '<button type="button" class="thread-load" data-thread-more="'+
      esc(unique)+'">+'+number(Math.min(24,sorted.length-shown.length))+' more →</button>' : '')+
   '</div></div></div>';
 }
 body+='</div></section>';
 return body;
}
function renderLanes(){
 const offsets=new Map([...$("laneBoard").querySelectorAll(".thread-timeline[data-thread]")].map(x=>[x.dataset.thread,x.scrollLeft]));
 renderPersonSelect();
 // Explicitly exclude the signed-in BGG username from the external-contact list.
 const people=personSort(contactMap().filter(c=>c.id && c.id!=="sportomax"));
 const candidates=state.lanePerson ? people.filter(c=>c.id===state.lanePerson) : people;
 const shown=candidates.slice(0,state.lanePerson ? candidates.length : state.laneContactsLimit);
 const subjects=shown.reduce((n,c)=>n+laneThreads(c).length,0);
 $("laneCaption").textContent=number(candidates.length)+" external users · "+
  number(subjects)+" visible subject lanes";
 $("laneBoard").innerHTML=shown.length ? shown.map(laneGroupHtml).join("") :
  emptyHtml("No conversations","Choose an external username or import your Inbox and Outbox CSV.");
 $("moreLanes").hidden=!!state.lanePerson || candidates.length<=shown.length;
 for(const el of $("laneBoard").querySelectorAll(".thread-timeline[data-thread]"))el.scrollLeft=offsets.get(el.dataset.thread)||0;
}

function render(){
 refreshStats();
 $("viewTitle").textContent=titleFor[state.view]||"Mail";
 document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===state.view));
 $("mailPane").hidden=["contacts","lanes"].includes(state.view);
 $("contactPane").hidden=state.view!=="contacts";
 $("lanePane").hidden=state.view!=="lanes";
 $("mailControls").hidden=["contacts","lanes"].includes(state.view);
 if(state.view==="contacts")renderContacts();
 else if(state.view==="lanes")renderLanes();
 else renderMailbox();
}
function refresh(){render()}
function setView(v){state.view=v;state.visible=90;state.contactLimit=72;state.laneLimit=100;state.selected="";$("mailSplit").classList.remove("reading-mobile");render()}
async function mutateRow(id,field){
 const r=state.rows.find(m=>m.key===id);
 if(!r)return;
 r[field]=!r[field];
 try{await dbSave([r])}catch(error){banner("Local save failed: "+error.message,true)}
 refresh();
}
async function openMessage(id) {
 const r=state.rows.find(m=>m.key===id);if(!r)return;
 state.selected=id;
 if(!r.read){r.read=true;try{await dbSave([r])}catch(e){banner(e.message,true)}}
 renderMailbox();
 $("mailSplit").classList.add("reading-mobile");
 if(window.innerWidth>680)$("reader").scrollTop=0;
}
function toCSV(rows) {
 const fields=[...FIELDS,"starred","read","archived","export_error"];
 const cell=v=>{let s=String(v??"");if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
 return [fields.join(","),...rows.map(r=>fields.map(k=>cell(r[k])).join(","))].join("\r\n");
}
function download(text,name) {
 const blob=new Blob(["\uFEFF",text],{type:"text/csv;charset=utf-8"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function copy(text){
 try{await navigator.clipboard.writeText(text);return true}catch(_){}
 const el=document.createElement("textarea");el.value=text;el.style.cssText="position:fixed;left:-10000px";document.body.appendChild(el);el.select();
 try{return document.execCommand("copy")}catch(_){return false}finally{el.remove()}
}
async function copyExtractor(){
 try{
  const res=await fetch("geekmail-extract.js",{cache:"no-store"});
  if(!res.ok)throw new Error("Extractor file unavailable ("+res.status+")");
  const s=await res.text();
  if(await copy(s))toast("Extractor copied. Open BGG GeekMail → F12 → Console → Paste.");
  else {const box=$("pasteBox");box.value=s;$("importDialog").showModal();box.focus();box.select();toast("Clipboard blocked. Extractor is selected for manual copying.");}
 }catch(err){toast(err.message)}
}
function openImport(){$("importDialog").showModal();$("importFeedback").textContent=""}
function uiAction(e){
 if(window.GeekMailTags?.click(e))return;
 const star=e.target.closest("[data-star]");
 if(star){e.stopPropagation();mutateRow(star.dataset.star,"starred");return}
 const read=e.target.closest("[data-read]");
 if(read){mutateRow(read.dataset.read,"read");return}
 const archive=e.target.closest("[data-archive]");
 if(archive){mutateRow(archive.dataset.archive,"archived");return}
 const cc=e.target.closest("[data-copy]");
 if(cc){const r=state.rows.find(x=>x.key===cc.dataset.copy);if(r)copy([r.subject,"From: "+r.from_username,"To: "+r.to_username,"Date: "+r.message_date,"",r.body_text].join("\n")).then(ok=>toast(ok?"Message copied":"Clipboard unavailable"));return}
 if(e.target.closest("[data-import]")){openImport();return}
 const person=e.target.closest("[data-person]");
 if(person){state.lanePerson=person.dataset.person;setView("lanes");return}
 const more=e.target.closest("[data-thread-more]");
 if(more){const id=more.dataset.threadMore;state.laneExpanded.set(id,(state.laneExpanded.get(id)||24)+24);renderLanes();return}
 const card=e.target.closest("[data-open],[data-lane-open]");
 if(card){
  if(card.hasAttribute("data-lane-open")){state.view="all";state.search="";$("search").value="";$("fromDate").value="";$("toDate").value="";state.selected=card.dataset.laneOpen;render();$("mailSplit").classList.add("reading-mobile")}
  else openMessage(card.dataset.open);
 }
}

/* Scroll to progressively append list pages; horizontal subject rows load on demand. */
function autoScrollLoad(area){
 const positions={
  mail:[$("mailPane").querySelector(".mail-column"),$("moreMail"),$("moreMailBtn")],
  contacts:[$("contactPane"),$("moreContacts"),$("moreContactsBtn")],
  lanes:[$("lanePane"),$("moreLanes"),$("moreLanesBtn")]
 };
 const [el,wrapper,button]=positions[area];
 if(el && !wrapper.hidden && el.scrollHeight-el.scrollTop-el.clientHeight<430)button.click();
}
function autoThreadLoad(event){
 const el=event.target;
 if(!el.classList?.contains("thread-timeline"))return;
 if(el.scrollWidth-el.clientWidth-el.scrollLeft>150)return;
 const button=el.querySelector("[data-thread-more]");
 if(button)button.click();
}

function bind(){
 $("readerDetail").addEventListener("change",e=>window.GeekMailTags?.change(e));
 $("mailPane").querySelector(".mail-column").addEventListener("scroll",()=>autoScrollLoad("mail"),{passive:true});
 $("contactPane").addEventListener("scroll",()=>autoScrollLoad("contacts"),{passive:true});
 $("lanePane").addEventListener("scroll",()=>autoScrollLoad("lanes"),{passive:true});
 $("laneBoard").addEventListener("scroll",autoThreadLoad,true);
 document.querySelectorAll("[data-view]").forEach(btn=>btn.addEventListener("click",()=>setView(btn.dataset.view)));
 $("copyScript").onclick=copyExtractor;$("copyDialogScript").onclick=copyExtractor;
 $("openImport").onclick=openImport;$("closeImport").onclick=()=>$("importDialog").close();
 $("importPaste").onclick=()=>importData($("pasteBox").value,$("replace").checked);
 $("readClipboard").onclick=async()=>{try{const v=await navigator.clipboard.readText();$("pasteBox").value=v;await importData(v,$("replace").checked)}catch(e){toast("Clipboard permission unavailable. Paste with Ctrl+V.")}};
 $("fileInput").onchange=async e=>{
  const files=[...e.target.files];e.target.value="";
  if(!files.length)return;
  for(let i=0;i<files.length;i++)await importData(await files[i].text(),$("replace").checked && i===0);
 };
 $("drop").addEventListener("dragover",e=>{e.preventDefault();e.currentTarget.classList.add("drag")});
 $("drop").addEventListener("dragleave",e=>e.currentTarget.classList.remove("drag"));
 $("drop").addEventListener("drop",async e=>{e.preventDefault();$("drop").classList.remove("drag");const files=[...e.dataTransfer.files].filter(f=>/\.(csv|json|txt)$/i.test(f.name));for(let i=0;i<files.length;i++)await importData(await files[i].text(),$("replace").checked&&i===0)});
 $("search").oninput=e=>{state.search=e.target.value.toLowerCase().trim();state.visible=90;state.contactLimit=72;state.laneLimit=100;render()};
 $("fromDate").onchange=render;$("toDate").onchange=render;
 $("sort").onchange=e=>{state.order=e.target.value;render()};
 $("resetFilters").onclick=()=>{$("search").value="";$("fromDate").value="";$("toDate").value="";state.search="";render()};
 $("exportCsv").onclick=()=>{const rows=filteredMail();if(!rows.length)return toast("No messages to export.");download(toCSV(rows),"geekmail-desk-"+new Date().toISOString().slice(0,10)+".csv");toast(number(rows.length)+" messages exported")};
 $("moreMailBtn").onclick=()=>{state.visible+=90;renderMailbox()};
 $("moreContactsBtn").onclick=()=>{state.contactLimit+=72;renderContacts()};
 $("moreLanesBtn").onclick=()=>{state.laneContactsLimit+=12;renderLanes()};
 $("contactSort").onchange=e=>{state.contactSort=e.target.value;renderContacts()};
 $("contactSelect").onchange=e=>{state.lanePerson=e.target.value;state.laneLimit=100;renderLanes()};
 $("laneOrder").onchange=e=>{state.laneOrder=e.target.value;renderLanes()};
 $("mailRows").addEventListener("click",uiAction);$("readerDetail").addEventListener("click",uiAction);$("contactGrid").addEventListener("click",uiAction);$("laneBoard").addEventListener("click",uiAction);
 $("mailRows").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ") && e.target.hasAttribute("data-open")){e.preventDefault();openMessage(e.target.dataset.open)}});
 $("readerDetail").addEventListener("click",e=>{if(e.target.id==="backToList")$("mailSplit").classList.remove("reading-mobile")});
 $("clearAll").onclick=async()=>{if(!confirm("Permanently remove all locally saved GeekMail messages and viewer flags from this browser?"))return;try{await dbClear();state.rows=[];state.selected="";window.GeekMailTags?.updateStats();render();banner("Local GeekMail archive cleared.")}catch(e){banner(e.message,true)}};
 document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("importDialog").open)$("importDialog").close();else $("mailSplit").classList.remove("reading-mobile")}if(e.key==="/" && !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)){$("search").focus();e.preventDefault()}});
}
async function init(){
 bind();
 try {
  state.db=await openDatabase();
  state.rows=(await dbGetAll()).map(r=>({...r,ts:Number(r.ts)||0,day:r.day||isoDay(dateOf(r.message_date)),read:r.read!==false,starred:!!r.starred,archived:!!r.archived}));
 } catch(error){
  banner("IndexedDB unavailable. Mail can be viewed during this session but cannot be saved after refresh: "+error.message,true);
 }
 render();
 try{await window.GeekMailTags?.init({state,render,saveRows:dbSave,banner})}catch(e){console.warn("Game enrichment unavailable",e)}
 if(!state.rows.length)openImport();
}
init();
})();