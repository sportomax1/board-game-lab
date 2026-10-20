(() => {
'use strict';
const DB='bgg-recommend-pro', STORE='data', KEYS=['own','prevowned','fortrade','want','wanttoplay','wanttobuy','wishlist','preordered'];
const NUMERIC=new Set('rating numplays weight own fortrade want wanttobuy wanttoplay prevowned preordered wishlist wishlistpriority baverage average avgweight rank numowned minplayers maxplayers playingtime minplaytime maxplaytime yearpublished pricepaid currvalue quantity objectid collid'.split(' '));
const DATES=new Set(['acquisitiondate','invdate']);
const LABELS={objectname:'Game name',rating:'Personal rating',numplays:'Plays',wishlistpriority:'Wishlist priority',baverage:'Bayesian average',average:'BGG rating',avgweight:'BGG weight',rank:'BGG rank',numowned:'Number owned',minplayers:'Min players',maxplayers:'Max players',playingtime:'Play time',pricepaid:'Price paid',currvalue:'Current value',acquisitiondate:'Acquisition date',acquiredfrom:'Acquired from',invlocation:'Storage location',invdate:'Inventory date',wishlistcomment:'Wishlist comment',version_publishers:'Version publishers'};
const $=id=>document.getElementById(id);
const currentUser=()=>($('username').value.trim()||'sportomax').toLowerCase();
const toNum=v=>v===undefined||v===null||String(v).trim()===''?null:(Number.isFinite(Number(String(v).replace(/[$,]/g,'')))?Number(String(v).replace(/[$,]/g,'')):null);
const label=k=>LABELS[k]||k.replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
let dbOpen,base=[],csv=[],fields=[],csvUser='',owner='',selected=new Set(),art={},view='list',direction='default',shown=120,restoring=false,saveTimer=0,loadingImages=new Set();
function db(){if(!window.indexedDB)return Promise.resolve(null);if(!dbOpen)dbOpen=new Promise(resolve=>{try{let req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);req.onblocked=()=>resolve(null)}catch{resolve(null)}});return dbOpen}
async function get(k){const d=await db();if(!d)return null;return new Promise(r=>{try{const q=d.transaction(STORE).objectStore(STORE).get(k);q.onsuccess=()=>r(q.result??null);q.onerror=()=>r(null)}catch{r(null)}})}
async function put(k,v){const d=await db();if(!d){status(false);return false}return new Promise(r=>{try{const t=d.transaction(STORE,'readwrite');t.objectStore(STORE).put(v,k);t.oncomplete=()=>{status(true);r(true)};t.onerror=()=>{status(false);r(false)};t.onabort=()=>{status(false);r(false)}}catch{status(false);r(false)}})}
function status(ok){if($('cacheStatus'))$('cacheStatus').textContent=(ok?'Saved in this browser':'Local storage unavailable')+' · '+(base.length?base.length.toLocaleString()+' BGG games':'No BGG cache')+(csv.length?' · '+csv.length.toLocaleString()+' CSV rows':'')}
function preferences(){return{username:currentUser(),view,direction,sort:$('sortSelect').value,selection:$('selectionFilter').value,filters:Object.fromEntries(KEYS.map(k=>[k,$('filter-'+k).checked]))}}
function savePrefs(){if(restoring)return;clearTimeout(saveTimer);saveTimer=setTimeout(()=>void put('prefs',preferences()),300)}
function saveSelected(){selected=new Set(collectionGames.filter(g=>g.selected).map(g=>String(g.objectid)));void put('selected',{user:owner,ids:[...selected]})}
function mapCsvGame(row){const rank=toNum(row.rank);return{name:row.objectname||row.originalname||'Game '+row.objectid,objectid:String(row.objectid),thumb:art[row.objectid]||'',rating:row.rating||'N/A',average:row.average||'N/A',year:row.yearpublished||'',numplays:toNum(row.numplays)??0,numowned:toNum(row.numowned)??0,bggRank:rank&&rank>0?rank:null,weight:toNum(row.avgweight)??toNum(row.weight),status:Object.fromEntries(KEYS.map(k=>[k,row[k]==='1'])),selected:false}}
function rebuild(){
 for(const game of collectionGames)if(game.selected)selected.add(String(game.objectid));
 const merged=new Map(base.map(g=>[String(g.objectid),{...g,status:{...g.status},csv:null}]));
 if(csvUser===owner)for(const row of csv){if(!/^\d+$/.test(String(row.objectid)))continue;const id=String(row.objectid),g=merged.get(id)||mapCsvGame(row);g.csv=row;if(!g.thumb&&art[id])g.thumb=art[id];if(!Number.isFinite(g.weight))g.weight=toNum(row.avgweight)??toNum(row.weight);merged.set(id,g)}
 collectionGames=[...merged.values()];for(const g of collectionGames)g.selected=selected.has(String(g.objectid));
 updateCsvSorts();filterCollection();$('tab-1').disabled=collectionGames.length===0;status(true)
}
function parseCSV(text){
 const lines=[];let row=[],field='',quoted=false;text=String(text).replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++}else if(c==='"')quoted=false;else field+=c}
 else if(c==='"'&&field==='')quoted=true;else if(c===','){row.push(field);field=''}else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>x.trim()))lines.push(row);row=[]}else field+=c}
 if(quoted)throw Error('Unclosed quoted CSV field');
 row.push(field);if(row.some(x=>x.trim()))lines.push(row);if(!lines.length)throw Error('CSV is empty');
 const headers=lines.shift().map(x=>x.trim().toLowerCase());if(!headers.includes('objectid'))throw Error('CSV requires a BGG objectid column');
 const rows=lines.map(cells=>Object.fromEntries(headers.map((key,i)=>[key,(cells[i]||'').trim()]))).filter(r=>/^\d+$/.test(r.objectid));
 if(!rows.length)throw Error('CSV does not contain valid BGG game IDs');
 return{headers:[...new Set(headers.filter(Boolean))],rows}
}
async function upload(file){
 if(!file)return;
 try{
 if(!/\.csv$/i.test(file.name))throw Error('Please choose a .csv file');
 const parsed=parseCSV(await file.text()),next=currentUser(),sameUser=!owner||owner===next;
 if(!sameUser){base=[];collectionGames=[];selected.clear()}
 else selected=new Set(collectionGames.filter(g=>g.selected).map(g=>String(g.objectid)));
 csv=parsed.rows;fields=parsed.headers;csvUser=next;owner=next;rebuild();
 await put('csv',{user:owner,rows:csv,headers:fields});await put('selected',{user:owner,ids:[...selected]});
 savePrefs();$('csvFeedback').textContent=`Imported ${csv.length.toLocaleString()} games and ${fields.length} CSV fields. Your data is stored locally.`;
 switchTab(1)
 }catch(err){console.error(err);$('csvFeedback').textContent=err.message||'CSV import failed'}
 finally{$('csvUpload').value=''}
}
function updateCsvSorts(){
 const control=$('sortSelect'),old=control.dataset.restoreSort||control.value;control.querySelector('#customCsvSorts')?.remove();
 if(fields.length&&csvUser===owner){const group=document.createElement('optgroup');group.id='customCsvSorts';group.label='Uploaded CSV fields';
 for(const key of fields){if(key==='objectid')continue;const option=document.createElement('option');option.value='csv:'+key;option.textContent=label(key);group.append(option)}control.append(group)}
 control.value=[...control.options].some(x=>x.value===old)?old:'rating';delete control.dataset.restoreSort
}
const sortOriginal=sortGames;
sortGames=function(){
 const by=$('sortSelect').value;
 if(!by.startsWith('csv:')){
 sortOriginal();
 if(direction!=='default'){
  const values={rating:g=>toNum(g.rating),average:g=>toNum(g.average),plays:g=>toNum(g.numplays),numowned:g=>toNum(g.numowned),bggRank:g=>toNum(g.bggRank),weight:g=>toNum(g.weight),year:g=>toNum(g.year),name:g=>g.name};
  const read=values[by]||values.rating;
  activeGames.sort((a,b)=>compare({value:read(a),missing:read(a)==null},{value:read(b),missing:read(b)==null},direction==='desc')||a.name.localeCompare(b.name))
 }return
 }
 const key=by.slice(4),isDesc=direction==='default'?(NUMERIC.has(key)||DATES.has(key))&&!['rank','wishlistpriority'].includes(key):direction==='desc';
 activeGames.sort((a,b)=>compare(csvSortValue(a,key),csvSortValue(b,key),isDesc)||a.name.localeCompare(b.name))
};
function csvSortValue(game,key){let v=game.csv?.[key];if(v==null||String(v).trim()==='')return{missing:true};
 if(NUMERIC.has(key)){v=toNum(v);return{value:v,missing:v===null}}
 if(DATES.has(key)){v=Date.parse(v);return{value:v,missing:!Number.isFinite(v)}}
 return{value:String(v),missing:false}
}
function compare(a,b,desc){
 if(a.missing||b.missing)return a.missing?(b.missing?0:1):-1;
 const x=a.value,y=b.value;const cmp=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),undefined,{numeric:true,sensitivity:'base'});
 return desc?-cmp:cmp
}
function displayMetadata(g){
 const result=[];
 if(g.year)result.push(g.year);
 if(toNum(g.rating)!=null)result.push('You '+toNum(g.rating).toFixed(1));
 if(toNum(g.average)!=null)result.push('BGG '+toNum(g.average).toFixed(1));
 result.push((g.numplays||0)+' plays');
 if(Number.isFinite(g.weight))result.push('Weight '+g.weight.toFixed(2));
 const sort=$('sortSelect').value;
 if(sort.startsWith('csv:')){const key=sort.slice(4),v=g.csv?.[key];if(v!=null&&v!=='')result.push(label(key)+': '+String(v).slice(0,90))}
 return result.join(' · ')
}
function visible(){
 const query=$('searchInput').value.trim().toLowerCase(),filter=$('selectionFilter').value;
 return activeGames.filter(g=>(filter!=='selected'||g.selected)&&(filter!=='notselected'||!g.selected)&&
 (!query||g.name.toLowerCase().includes(query)||g.csv&&['acquiredfrom','invlocation','comment','wishlistcomment','version_publishers'].some(k=>String(g.csv[k]||'').toLowerCase().includes(query))))
}
function makeCard(g){
 const grid=view==='grid',el=document.createElement('label');el.dataset.gameId=String(g.objectid);
 el.className=grid?'relative bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col cursor-pointer hover:border-indigo-400':'flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 cursor-pointer hover:bg-indigo-50 min-w-0';
 if(grid&&g.selected)el.classList.add('ring-2','ring-indigo-400');
 const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=g.selected;checkbox.setAttribute('aria-label','Select '+g.name);
 checkbox.className=grid?'absolute top-2 left-2 z-10 w-5 h-5 accent-indigo-600':'w-5 h-5 accent-indigo-600 flex-shrink-0';
 checkbox.onchange=()=>{g.selected=checkbox.checked;updateSelectedCount();saveSelected();if(grid)el.classList.toggle('ring-2',g.selected);if($('selectionFilter').value!=='all')renderGameList()};
 el.append(checkbox);
 const artBox=document.createElement('div');artBox.className=grid?'relative w-full aspect-square bg-slate-100 overflow-hidden':'relative w-14 h-14 sm:w-16 sm:h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0';
 const fallback=document.createElement('span');fallback.className='absolute inset-0 flex items-center justify-center font-bold text-2xl text-slate-300';fallback.textContent=g.name[0]||'?';artBox.append(fallback);
 if(g.thumb)addThumb(artBox,g.thumb);
 artBox.title='Open '+g.name+' on BoardGameGeek';artBox.classList.add('thumb-clickable');
 artBox.onclick=e=>{e.preventDefault();e.stopPropagation();window.open('https://boardgamegeek.com/boardgame/'+encodeURIComponent(g.objectid),'_blank','noopener')};
 el.append(artBox);
 const info=document.createElement('div');info.className=grid?'p-2 min-w-0':'flex-1 min-w-0';
 const title=document.createElement('div');title.className=grid?'font-bold text-sm text-slate-900 line-clamp-2':'font-bold text-sm text-slate-900 truncate';
 title.textContent=g.name;title.title=g.name;info.append(title);
 const sub=document.createElement('div');sub.className=grid?'text-[10px] text-slate-500 mt-1 line-clamp-3':'text-xs text-slate-500';sub.textContent=displayMetadata(g);info.append(sub);el.append(info);
 return el
}
function addThumb(container,url){
 const img=document.createElement('img');img.src=url;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.alt='';
 img.className='relative w-full h-full object-contain bg-white';
 img.onerror=()=>{if(!img.dataset.proxyTried){img.dataset.proxyTried='yes';img.src=getProxyImageUrl(url)}else img.remove()};
 container.append(img)
}
renderGameList=function(){
 const el=$('gameList'),games=visible(),subset=games.slice(0,shown);el.replaceChildren();
 el.className=view==='grid'?'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3 max-h-[70vh] overflow-y-auto content-start':'flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto';
 const fragment=document.createDocumentFragment();subset.forEach(g=>fragment.append(makeCard(g)));
 if(!games.length){const p=document.createElement('p');p.className='text-sm text-slate-500 text-center p-8';p.textContent=collectionGames.length?'No matching games':'Fetch a collection or upload a CSV to begin';fragment.append(p)}
 el.append(fragment);$('shownCount').textContent=`Showing ${subset.length.toLocaleString()} of ${games.length.toLocaleString()} games`;
 $('moreGames').classList.toggle('hidden',subset.length>=games.length);updateSelectedCount();
 void fetchArt(subset.filter(g=>!g.thumb))
};
async function fetchArt(games){
 if(typeof fetchThingBatch!=='function')return;
 const ids=games.map(g=>String(g.objectid)).filter(id=>/^\d+$/.test(id)&&!loadingImages.has(id));
 ids.forEach(id=>loadingImages.add(id));
 for(let i=0;i<ids.length;i+=20){
 const batch=ids.slice(i,i+20);
 try{
 const xml=await fetchThingBatch(batch);let changed=false;
 xml.querySelectorAll('item[id]').forEach(item=>{
 const id=item.getAttribute('id'),url=item.querySelector('thumbnail')?.textContent?.trim()||item.querySelector('image')?.textContent?.trim();
 if(!id||!url)return;art[id]=url;changed=true;
 for(const game of collectionGames)if(String(game.objectid)===id)game.thumb=url;
 for(const game of base)if(String(game.objectid)===id)game.thumb=url;
 const card=[...$('gameList').children].find(e=>e.dataset.gameId===id);
 if(card&&!card.querySelector('img'))addThumb(card.querySelector('.thumb-clickable'),url)
 });
 if(changed)void put('art',art)
 }catch(e){console.warn('BGG thumbnail request failed',e)}
 }
}
function setView(mode){
 view=mode==='grid'?'grid':'list';shown=120;
 for(const m of ['list','grid']){const button=$('mode-'+m),yes=m===view;button.classList.toggle('bg-indigo-600',yes);button.classList.toggle('text-white',yes);button.classList.toggle('bg-slate-100',!yes);button.classList.toggle('text-slate-600',!yes);button.setAttribute('aria-pressed',String(yes))}
 renderGameList();savePrefs()
}
const oldSortRender=sortAndRender;sortAndRender=function(){shown=120;oldSortRender();savePrefs()};
filterGames=function(){shown=120;renderGameList()};
$('selectionFilter').addEventListener('change',()=>{shown=120;savePrefs()});
// Batch actions use the same search/CSV metadata filter as the displayed cards.
selectAll=function(){for(const g of visible())g.selected=true;renderGameList();saveSelected()};
deselectAll=function(){for(const g of visible())g.selected=false;renderGameList();saveSelected()};
const oldFilterRealtime=filterCollectionRealtime;filterCollectionRealtime=function(){oldFilterRealtime();savePrefs()};
proceedToReview=function(){
 const ids=new Set(activeGames.map(g=>String(g.objectid)));
 selectedGames=activeGames.filter(g=>g.selected).concat(collectionGames.filter(g=>g.selected&&!ids.has(String(g.objectid))));
 if(!selectedGames.length){alert('Please select at least one game!');return}
 $('tab-2').disabled=false;switchTab(2)
};
const originalFetch=fetchCollection;
fetchCollection=async function(){
 const next=currentUser(),previous=collectionGames,same=!owner||owner===next,priorSelected=same?new Set(selected):new Set();
 await originalFetch();
 if(collectionGames===previous)return;
 base=collectionGames.map(({csv,selected,...fields})=>fields);owner=next;selected=priorSelected;
 if(!same)collectionGames=[];rebuild();
 await put('bgg',{user:owner,games:base});await put('selected',{user:owner,ids:[...selected]});
 savePrefs();switchTab(1)
};
async function clearAll(){
 if(!confirm('Clear the collection, CSV, selections and preferences stored in this browser?'))return;
 clearTimeout(saveTimer);const d=await db();
 if(d)await new Promise(done=>{try{const t=d.transaction(STORE,'readwrite');t.objectStore(STORE).clear();t.oncomplete=done;t.onerror=done;t.onabort=done}catch{done()}});
 base=[];csv=[];fields=[];csvUser='';art={};owner=currentUser();selected.clear();collectionGames=[];activeGames=[];selectedGames=[];shown=120;loadingImages.clear();lastXmlResponse='';
 $('csvFeedback').textContent='Local data cleared';$('viewXmlBtn').classList.add('hidden');$('tab-1').disabled=true;$('tab-2').disabled=true;
 updateCsvSorts();switchTab(0);renderGameList();status(!!d)
}
function controls(){
 const box=document.createElement('section');box.className='p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-2';
 box.innerHTML='<div class="flex items-center justify-between gap-2"><b class="text-sm text-slate-800">Import BGG CSV</b><span class="text-[10px] text-slate-500">CSV only or merge by BGG ID</span></div><input id="csvUpload" type="file" accept=".csv,text/csv" aria-label="Import BGG collection CSV" class="block w-full text-xs file:mr-2 file:bg-indigo-600 file:text-white file:border-0 file:px-3 file:py-2 file:rounded-lg"><p id="csvFeedback" class="text-xs text-slate-600" role="status">Upload your BGG collection export to sort by wishlist, price, date, storage location and more. Data stays in this browser.</p><div class="flex items-center justify-between border-t border-indigo-100 pt-2 gap-2"><span id="cacheStatus" class="text-[11px] text-slate-500">Checking local storage…</span><button id="clearCache" type="button" class="text-[11px] text-red-600 font-semibold hover:underline">Clear saved data</button></div>';
 $('viewXmlBtn').before(box);$('csvUpload').addEventListener('change',e=>void upload(e.target.files?.[0]));$('clearCache').onclick=()=>void clearAll();
 const controls=document.createElement('div');controls.className='flex flex-wrap gap-2 items-center pt-1';
 controls.innerHTML='<span class="text-xs font-bold text-slate-500 uppercase">View</span><div role="group" aria-label="Selection layout" class="flex gap-1"><button id="mode-list" type="button" class="text-xs font-bold px-3 py-2 rounded-lg" aria-pressed="true">☰ List</button><button id="mode-grid" type="button" class="text-xs font-bold px-3 py-2 rounded-lg" aria-pressed="false">▦ Thumbnail grid</button></div><label class="text-xs font-bold text-slate-500 uppercase ml-auto" for="sortDir">Order</label><select id="sortDir" class="px-2 py-2 rounded-lg border border-slate-200 bg-white text-xs"><option value="default">Default</option><option value="asc">Ascending</option><option value="desc">Descending</option></select>';
 $('gameList').before(controls);
 const paging=document.createElement('div');paging.className='flex flex-col items-center gap-2 py-3';
 paging.innerHTML='<span id="shownCount" class="text-xs text-slate-500" aria-live="polite"></span><button id="moreGames" type="button" class="hidden bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-bold px-4 py-2">Load 120 more</button>';
 $('gameList').after(paging);
 $('mode-list').onclick=()=>setView('list');$('mode-grid').onclick=()=>setView('grid');
 $('sortDir').onchange=e=>{direction=e.target.value;sortAndRender()};
 $('moreGames').onclick=()=>{shown+=120;renderGameList()};
}
async function init(){
 controls();const [prefs,saved,imported,sel,images]=await Promise.all([get('prefs'),get('bgg'),get('csv'),get('selected'),get('art')]);
 restoring=true;
 if(prefs){$('username').value=prefs.username||'sportomax';if(prefs.filters)for(const k of KEYS)if(typeof prefs.filters[k]==='boolean')$('filter-'+k).checked=prefs.filters[k];
 direction=prefs.direction||'default';view=prefs.view==='grid'?'grid':'list';
 $('sortSelect').dataset.restoreSort=prefs.sort||'rating';$('selectionFilter').value=prefs.selection||'all'}
 $('sortDir').value=direction;restoring=false;owner=currentUser();
 if(saved?.user===owner&&Array.isArray(saved.games))base=saved.games;
 if(imported?.user===owner&&Array.isArray(imported.rows)){csv=imported.rows;fields=imported.headers||[];csvUser=owner;$('csvFeedback').textContent=`Restored ${csv.length.toLocaleString()} CSV games from local storage`}
 if(sel?.user===owner&&Array.isArray(sel.ids))selected=new Set(sel.ids.map(String));
 if(images&&typeof images==='object')art=images;
 if(base.length||csv.length){rebuild();switchTab(1)}else{updateCsvSorts();status(!!await db())}
 setView(view)
}
void init().catch(e=>{console.error('Recommend Pro enhancements failed',e);status(false)})
})();
