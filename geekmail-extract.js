/* BGG GeekMail Desk browser-console exporter.
 * Open https://boardgamegeek.com/geekmail while logged in,
 * paste this entire file into DevTools Console, and enter a cutoff date.
 * Runs in your own BGG tab; never sends messages to third parties.
 */
(async () => {
"use strict";
if(!/boardgamegeek\.com$/.test(location.hostname) || !location.pathname.startsWith("/geekmail")) {
 console.error("Open https://boardgamegeek.com/geekmail first.");return;
}
if(window.bggGeekMailRunning){console.warn("Another GeekMail export is already active.");return}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clean=s=>String(s??"").replace(/\u00a0/g," ").replace(/\r\n?/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
const today=new Date();
const def=new Date(today);def.setDate(def.getDate()-30);
const localDay=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const cutoff=prompt("Fetch Inbox + Outbox messages ON OR AFTER (YYYY-MM-DD)",localDay(def));
if(cutoff===null)return;
const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(cutoff.trim());
const cutoffDate=m?new Date(+m[1],+m[2]-1,+m[3]):null;
if(!cutoffDate || localDay(cutoffDate)!==cutoff.trim()){alert("Enter a valid YYYY-MM-DD date.");return;}
const icon=document.querySelector('button img[alt$=" Avatar"]');
const me=clean(icon?.alt?.replace(/\s+Avatar$/,""))||clean(prompt("BGG username:","sportomax"));
if(!me){console.error("BGG username required.");return}
const myAvatar=icon?.currentSrc||icon?.src||"";
const HEADERS=["folder","message_id","from_username","to_username","from_avatar_url","to_avatar_url","subject","message_date","body_text","body_html","export_error"];
const rows=[],errors=[],counts={Inbox:0,Outbox:0};
let stopped=false,partial=false;
window.bggGeekMailRunning=true;
window.bggGeekMailExport=rows;
window.bggGeekMailStop=()=>{stopped=true;console.warn("Stopping export after current request.");};
const wait=async(fn,label,ms=22000)=>{const start=Date.now();while(Date.now()-start<ms){if(stopped)throw Error("STOP_REQUESTED");const result=fn();if(result)return result;await sleep(125)}throw Error("Timed out waiting for "+label)};
const pageInfo=()=>{const m=document.body.innerText.match(/Pg\.\s*(\d+)\s*\/\s*(\d+)/i);return m?{cur:+m[1],total:+m[2]}:{cur:1,total:1}};
const pageIds=()=>[...document.querySelectorAll('input[name="messagelist[]"]')].map(x=>x.value).join("|");
const parseDate=value=>{
 const s=clean(value),d=new Date();
 if(/^today\b/i.test(s))return new Date(d.getFullYear(),d.getMonth(),d.getDate());
 if(/^yesterday\b/i.test(s))return new Date(d.getFullYear(),d.getMonth(),d.getDate()-1);
 const v=new Date(s.replace(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?:day)?[,]?\s+/i,""));
 return Number.isNaN(v.getTime())?null:new Date(v.getFullYear(),v.getMonth(),v.getDate());
};
const listMessages=()=>[...document.querySelectorAll('input[name="messagelist[]"]')].map(box=>{
 const id=box.value,row=box.closest("tr"),container=box.closest("table")?.parentElement;
 const subjectLink=container?.querySelector("#subject_"+CSS.escape(id));
 const raw=clean(row?.querySelector(".gm_date")?.textContent);
 const uname=clean(row?.children?.[1]?.querySelector('a[href*="/profile/"]')?.textContent)||clean(row?.children?.[1]?.textContent).replace(/^(?:From|To):\s*/i,"");
 return {id,row,subjectLink,date:raw,parsed:parseDate(raw),username:uname,subject:clean(subjectLink?.textContent)};
});
async function openFolder(folder) {
 const link=[...document.querySelectorAll("a[onclick]")].find(a=>clean(a.textContent)===folder && /ClearAndViewFolder/i.test(a.getAttribute("onclick")||""));
 if(!link)throw Error("Could not locate "+folder+" folder.");
 const before=pageIds();link.click();await sleep(1150);
 if(folder==="Outbox" && pageIds()===before)await sleep(950);
 console.log("Opened "+folder+" page "+pageInfo().cur);
}
async function nextPage(folder,n) {
 const link=[...document.querySelectorAll("a[onclick]")].find(a=>{
  const m=(a.getAttribute("onclick")||"").match(/ViewFolder\(\s*['"]([^'"]+)['"]\s*,\s*(\d+)/);
  return m&&m[1].toLowerCase()===folder.toLowerCase()&&+m[2]===n;
 });
 if(!link)throw Error("Cannot find "+folder+" page "+n);
 const before=pageIds();link.click();
 await wait(()=>pageInfo().cur===n && pageIds()!==before,"page "+n);
 await sleep(450);
}
function bodyFrom(cell){
 if(!cell)return {text:"",html:""};
 const clone=cell.cloneNode(true);
 clone.querySelector(".gm_subject")?.remove();
 clone.querySelectorAll("script,style").forEach(el=>el.remove());
 const html=clone.innerHTML.trim();
 clone.querySelectorAll("br").forEach(el=>el.replaceWith(document.createTextNode("\n")));
 clone.querySelectorAll("p,div,blockquote,li,tr").forEach(el=>el.appendChild(document.createTextNode("\n")));
 return {text:clean(clone.textContent),html};
}
async function readMessage(item,folder){
 if(!item.subjectLink)throw Error("Subject link missing.");
 let panel=document.getElementById("message_"+item.id);
 if(!panel?.querySelector(".gm_subject")){item.subjectLink.click();panel=await wait(()=>{const p=document.getElementById("message_"+item.id);return p?.querySelector(".gm_subject")?p:null},"message "+item.id);}
 try {
  const node=panel.querySelector(".js-avatar[data-username]");
  const other=clean(node?.getAttribute("data-username"))||item.username;
  const img=node?.matches?.("img")?node:node?.querySelector("img");
  const otherAvatar=img?.currentSrc||img?.src||"";
  const subjectBlock=panel.querySelector(".gm_subject");
  const body=bodyFrom(subjectBlock.closest("td"));
  const inbox=folder==="Inbox";
  return {
   folder,message_id:item.id,
   from_username:inbox?other:me,to_username:inbox?me:other,
   from_avatar_url:inbox?otherAvatar:myAvatar,to_avatar_url:inbox?myAvatar:otherAvatar,
   subject:clean(subjectBlock.querySelector("b")?.textContent)||item.subject,
   message_date:item.date,body_text:body.text,body_html:body.html,export_error:""
  };
 }finally{panel.querySelector(".gm-actions__collapse")?.click();await sleep(240)}
}
async function processFolder(folder){
 await openFolder(folder);
 const seenPages=new Set(),seenIds=new Set();
 for(let attempt=0;attempt<500 && !stopped;attempt++){
  const page=pageInfo(),items=listMessages(),signature=page.cur+":"+pageIds();
  if(seenPages.has(signature))throw Error("Repeated "+folder+" page "+page.cur);
  seenPages.add(signature);
  console.log(folder+" page "+page.cur+"/"+page.total+": "+items.length+" listed");
  for(let j=0;j<items.length&&!stopped;j++){
   const item=items[j];
   if(seenIds.has(item.id))continue;seenIds.add(item.id);
   if(item.parsed && item.parsed<cutoffDate){counts[folder]++;continue;}
   if(!item.parsed)console.warn("Unknown date; including "+folder+" #"+item.id+" ("+item.date+")");
   try{rows.push(await readMessage(item,folder));}
   catch(error){
    if(error.message==="STOP_REQUESTED"){stopped=true;break}
    errors.push(folder+" #"+item.id+": "+error.message);
    console.error("Message extraction failed",item.id,error);
    const inbox=folder==="Inbox";
    rows.push({folder,message_id:item.id,from_username:inbox?item.username:me,to_username:inbox?me:item.username,subject:item.subject,message_date:item.date,body_text:"",body_html:"",export_error:error.message});
   }
   window.bggGeekMailExport=rows;
   if((j+1)%5===0)console.log(folder+" "+(j+1)+"/"+items.length+" processed; "+rows.length+" total");
  }
  if(stopped || page.cur>=page.total || items.length===0)break;
  const dates=items.map(x=>x.parsed?.getTime()||0);
  const knownAndSorted=dates.every((v,i)=>v>0&&(i===0||v<=dates[i-1]));
  if(knownAndSorted&&dates[dates.length-1]<cutoffDate.getTime()){console.log(folder+": reached cutoff; stopping older pages");break}
  await nextPage(folder,page.cur+1);
 }
}
function csvCell(raw){let s=String(raw??"");if(/^\s*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}
function makeCSV(){return [HEADERS.join(","),...rows.map(r=>HEADERS.map(h=>csvCell(r[h])).join(","))].join("\r\n")}
async function copyCSV(text){
 try{if(typeof copy==="function"){copy(text);return true}}catch(_){}
 try{await navigator.clipboard.writeText(text);return true}catch(_){}
 const a=document.createElement("textarea");a.value=text;a.style.cssText="position:fixed;left:-9999px";document.body.appendChild(a);a.focus();a.select();
 try{return document.execCommand("copy")}catch(_){return false}finally{a.remove()}
}
function downloadCSV(csv){
 const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="bgg-geekmail-"+cutoff.trim()+"-to-"+localDay(new Date())+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
try {
 console.log("BGG GeekMail export starting for "+me+" since "+cutoff.trim()+"...");
 await processFolder("Inbox");
 if(!stopped)await processFolder("Outbox");
}catch(error){partial=true;console.error("Export interrupted; saving collected messages",error)}
finally{
 const csv=makeCSV();
 window.bggGeekMailCSV=csv;
 window.csvData=csv;
 try{console.log((await copyCSV(csv))?"CSV copied to clipboard":"Clipboard denied — run copy(window.bggGeekMailCSV) in Console")}catch(e){console.warn(e)}
 try{downloadCSV(csv)}catch(e){console.warn("Could not download CSV",e)}
 window.bggGeekMailRunning=false;
 console.table({status:stopped||partial?"PARTIAL":"complete",records:rows.length,inbox:rows.filter(x=>x.folder==="Inbox").length,outbox:rows.filter(x=>x.folder==="Outbox").length,olderSkipped:counts.Inbox+counts.Outbox,errors:errors.length});
 console.log("CSV is saved as window.bggGeekMailCSV. Return to GeekMail Desk and paste/import it.");
}
})();