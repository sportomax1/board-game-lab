/* BGA License Explorer: BGG XML API2 enrichment.
   Uses the existing authenticated /api/bgg-helper Vercel route.
   Up to 100 concurrent search and thing HTTP calls, independently configurable.
   Automatically reduces concurrency and backs off when BGG throttles. */
'use strict';
const BGG_WORKERS=100, BGG_BATCH=20, BGG_MAX_CONCURRENCY=100, BGG_TTL_DAYS=30;
let bggActiveRequests=0, bggBackoffUntil=0, bggAdaptiveCeiling=100;
let bggSuccesses=0, bggThrottleEvents=0, bggRequestRetries=0, bggLastThrottleAt=0, bggLastSave=0;
let bggPhaseStart=0, bggPhaseStartDone=0;
let bggCurrent=null, bggSaveChain=Promise.resolve(), bggLookupBusy=false, bggFatalError='';
window.bggScanActive=false;
const bggWait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const bggNormalized=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,' ').trim();
const bggGameUrl=(id,type='boardgame')=>'https://boardgamegeek.com/'+(type==='boardgameexpansion'?'boardgameexpansion':'boardgame')+'/'+encodeURIComponent(String(id));
const bggStatusOf=row=>row.bgg?.status||'unchecked';
const bggNumber=value=>{const v=Number(value);return Number.isFinite(v)&&v>0?v:null;};

/* Persistent IndexedDB API cache. This stores the parsed XML API2 search
   results and individual thing records, independent of the BGA CSV snapshot.
   Memory maps coalesce simultaneous lookups; failures are never cached. */
const bggCacheMemorySearch=new Map();
const bggCacheMemoryThing=new Map();
const bggPendingSearch=new Map();
const bggPendingThing=new Map();
const BGG_SEARCH_TTL=30*86400000, BGG_EMPTY_TTL=7*86400000, BGG_THING_TTL=30*86400000;
let bggSearchCacheHits=0, bggThingCacheHits=0, bggCacheNetworkSearches=0, bggCacheNetworkThings=0;
const bggCacheApi=window.BGGApiCache;
function bggCachedMemory(map,key){
  const record=map.get(key);
  if(record && record.expiresAt>Date.now())return record.data;
  if(record)map.delete(key);
  return null;
}
function bggStoreMemory(map,key,data,ttl){
  map.set(key,{data,expiresAt:Date.now()+ttl});
}
async function bggCacheRefreshStats(){
  if(!$('bggCacheStats'))return;
  const stats=bggCacheApi ? await bggCacheApi.stats() : {available:false,search:0,things:0};
  $('bggCacheStats').textContent=stats.available
    ?'IndexedDB: '+number(stats.search)+' title searches · '+number(stats.things)+' game details saved'
    :'IndexedDB cache unavailable (requests still work without it)';
  $('bggClearCache').disabled=!stats.available||window.bggScanActive||bggLookupBusy;
}
function bggCacheProgressLabel(){
  return ' · cache '+number(bggSearchCacheHits)+' searches / '+number(bggThingCacheHits)+' details';
}
function bggCacheExpireAndClearMemory(){
  bggCacheMemorySearch.clear();
  bggCacheMemoryThing.clear();
}
async function bggClearCachedApi(){
  if(window.bggScanActive||bggLookupBusy){
    showNotice('Stop the BGG scan and finish any catalog lookup before clearing the API cache.',true);return;
  }
  if(!confirm('Clear cached BGG search and thing API results? Your imported licenses and matched game rows will remain saved.'))return;
  try{
    await bggCacheApi.clear();
    bggCacheExpireAndClearMemory();
    bggSearchCacheHits=bggThingCacheHits=0;
    await bggCacheRefreshStats();
    showNotice('BGG API response cache cleared. Imported licenses and saved matches were not deleted.');
  }catch(e){showNotice('Could not clear API cache: '+e.message,true);}
}

function bggProgress(label,current,total){
  $('bggProgress').hidden=false;
  $('bggProgressText').textContent=label;
  $('bggProgressFill').style.width=(total?Math.min(100,100*current/total):0)+'%';
}
function bggMarkup(xml){
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror') || doc.documentElement?.tagName?.toLowerCase()!=='items')
    throw new Error('BGG returned an invalid XML response.');
  return doc;
}
const bggAttr=(node,key)=>node?.getAttribute(key)||'';
const bggName=node=>bggAttr(node.querySelector('name[type="primary"]')||node.querySelector('name'),'value');
function parseBggSearch(xml){
  return [...bggMarkup(xml).querySelectorAll('items > item')]
    .filter(item=>['boardgame','boardgameexpansion'].includes(bggAttr(item,'type')))
    .map(item=>({id:bggAttr(item,'id'),type:bggAttr(item,'type'),name:bggName(item),year:bggAttr(item.querySelector('yearpublished'),'value')}))
    .filter(game=>/^\d+$/.test(game.id)&&game.name);
}
function parseBggThings(xml){
  return [...bggMarkup(xml).querySelectorAll('items > item')].map(item=>{
    const val=selector=>bggNumber(bggAttr(item.querySelector(selector),'value'))||0;
    const ranks=[...item.querySelectorAll('statistics ratings ranks rank')];
    const rank=ranks.find(r=>bggAttr(r,'name')==='boardgame')||ranks[0];
    const linked=type=>[...item.querySelectorAll('link')].filter(el=>bggAttr(el,'type')===type)
      .map(el=>bggAttr(el,'value')).filter(Boolean).join('; ');
    const id=bggAttr(item,'id');
    return {
      id,type:bggAttr(item,'type'),name:bggName(item),year:val('yearpublished'),rating:val('statistics ratings average'),
      weight:val('statistics ratings averageweight'),rank:bggNumber(bggAttr(rank,'value'))||0,
      minPlayers:val('minplayers'),maxPlayers:val('maxplayers'),playTime:val('playingtime'),
      minPlayTime:val('minplaytime'),maxPlayTime:val('maxplaytime'),
      image:safeImage(item.querySelector('thumbnail')?.textContent||item.querySelector('image')?.textContent||''),
      designers:linked('boardgamedesigner'),publishers:linked('boardgamepublisher'),url:bggGameUrl(id,bggAttr(item,'type'))
    };
  }).filter(game=>/^\d+$/.test(game.id));
}

/* No fixed request gap: the browser fills available slots immediately.
   BGG may impose a much lower effective limit than the selected ceiling;
   HTTP 202/429/503 automatically reduce the adaptive window. */
function bggConfiguredConcurrency(endpoint){
  const control=$(endpoint==='thing'?'bggThingConcurrency':'bggSearchConcurrency');
  const n=Number(control?.value);
  return Number.isInteger(n)&&n>=1?Math.min(n,BGG_MAX_CONCURRENCY):BGG_MAX_CONCURRENCY;
}
function bggEffectiveConcurrency(endpoint){
  return Math.max(1,Math.min(bggConfiguredConcurrency(endpoint),bggAdaptiveCeiling));
}

function bggOnThrottle(status, retryAfterMs){
  const now=Date.now();
  bggThrottleEvents++;
  bggSuccesses=0;
  // A burst of 100 simultaneous requests can return many 429/503 responses at once.
  // Treat that wave as ONE congestion event, rather than halving the limit on
  // every response until the scan crawls at 2-10 concurrent requests.
  if(now-bggLastThrottleAt>=3000){
    bggAdaptiveCeiling=Math.max(4,Math.floor(bggAdaptiveCeiling*.8));
    bggLastThrottleAt=now;
  }
  // Only an explicit rate limit/queued response deserves a longer shared
  // cooldown. A single temporary 500/502/503 should not freeze all workers.
  const globalDelay=(status===429||status===202) ? Math.min(12000,retryAfterMs)
                    : Math.min(900,retryAfterMs);
  bggBackoffUntil=Math.max(bggBackoffUntil,now+globalDelay);
}
function bggOnSuccess(){
  bggSuccesses++;
  // Recover with small additive steps; 100 is the user-selected ceiling,
  // not a guaranteed rate accepted by the API.
  if(bggSuccesses>=12 && Date.now()-bggLastThrottleAt>2200){
    bggSuccesses=0;
    bggAdaptiveCeiling=Math.min(BGG_MAX_CONCURRENCY,bggAdaptiveCeiling+5);
  }
}
async function bggAcquire(endpoint,signal){
  while(true){
    if(signal?.aborted)throw new DOMException('Stopped','AbortError');
    const wait=Math.max(0,bggBackoffUntil-Date.now());
    if(!wait && bggActiveRequests<bggEffectiveConcurrency(endpoint)){
      bggActiveRequests++;return;
    }
    await bggWait(Math.min(200,Math.max(35,wait||60)));
  }
}
async function bggRequest(endpoint,params,signal){
  // Fast mode returns upstream 202/429/503 to this adaptive limiter directly
  // instead of nesting the proxy's five long retries inside these four retries.
  const url='/api/bgg-helper?'+new URLSearchParams({endpoint,fast:'1',...params});
  for(let attempt=0;attempt<4;attempt++){
    await bggAcquire(endpoint,signal);
    try{
      const response=await fetch(url,{signal,headers:{Accept:'application/xml,text/xml'}});
      if(response.ok){
        const xml=await response.text();
        if(!/^\s*(?:<\?xml[^>]*>\s*)?<items[\s>]/i.test(xml)){
          const error=new Error('BGG did not return an items XML document.');
          error.permanent=true;
          throw error;
        }
        bggOnSuccess();
        return xml;
      }
      let reason='';
      if([401,403,500,502].includes(response.status)){
        try{reason=String((await response.clone().json()).message||'');}catch{}
      }
      if([401,403].includes(response.status)||/BGG_API_TOKEN|not configured|authentication failed/i.test(reason)){
        bggFatalError=reason||('BGG authentication failed (HTTP '+response.status+')');
        if(bggCurrent?.controller)bggCurrent.controller.abort();
        const error=new Error(bggFatalError);error.permanent=true;throw error;
      }
      const status=response.status;
      const retryable=[202,429,500,502,503,504].includes(status);
      if(!retryable||attempt===3){
        const error=new Error(reason||('BGG '+endpoint+' HTTP '+status));
        error.permanent=true;throw error;
      }
      const retryHeader=Number(response.headers.get('retry-after'));
      const delay=Number.isFinite(retryHeader)&&retryHeader>0
        ?retryHeader*1000:Math.min(7000,800*2**attempt);
      bggRequestRetries++;
      bggOnThrottle(status,delay);
      continue; // finally releases this slot; next attempt waits for room again.
    }catch(error){
      if(signal?.aborted||error?.name==='AbortError'||error?.permanent)throw error;
      if(attempt===3)throw error;
      bggRequestRetries++;
      bggOnThrottle(503,Math.min(5000,750*2**attempt));
    }finally{
      bggActiveRequests=Math.max(0,bggActiveRequests-1);
    }
  }
  throw new Error('BGG '+endpoint+' failed after retries.');
}
function bggProgressStats(phase,done,total,failed,endpoint){
  const elapsed=Math.max(1,(Date.now()-bggPhaseStart)/1000);
  const rate=(Math.max(0,done-bggPhaseStartDone)/elapsed).toFixed(1);
  bggProgress(phase+': '+done+' / '+total+' · '+bggActiveRequests+' active · cap '+
    bggEffectiveConcurrency(endpoint)+' / '+bggConfiguredConcurrency(endpoint)+
    ' · '+rate+'/s · '+bggThrottleEvents+' throttles · '+bggRequestRetries+
    ' retries'+bggCacheProgressLabel()+' · '+failed+' errors',done,total);
}
async function bggSearch(title,signal,exact=false){
  const key='v2:'+bggNormalized(title)+(exact?':exact':':partial');
  const memory=bggCachedMemory(bggCacheMemorySearch,key);
  if(memory!==null){bggSearchCacheHits++;return memory;}
  const pending=bggPendingSearch.get(key);
  if(pending)return pending;
  const job=(async()=>{
    const stored=bggCacheApi ? await bggCacheApi.getSearch(key) : null;
    if(stored!==null){
      bggSearchCacheHits++;
      bggStoreMemory(bggCacheMemorySearch,key,stored,stored.length?BGG_SEARCH_TTL:BGG_EMPTY_TTL);
      return stored;
    }
    if(signal?.aborted)throw new DOMException('Stopped','AbortError');
    const xml=await bggRequest('search',{query:title,type:'boardgame,boardgameexpansion',...(exact?{exact:'1'}:{})},signal);
    const results=parseBggSearch(xml);
    bggCacheNetworkSearches++;
    bggStoreMemory(bggCacheMemorySearch,key,results,results.length?BGG_SEARCH_TTL:BGG_EMPTY_TTL);
    if(bggCacheApi)await bggCacheApi.putSearch(key,results);
    return results;
  })();
  bggPendingSearch.set(key,job);
  try{return await job;}
  finally{if(bggPendingSearch.get(key)===job)bggPendingSearch.delete(key);}
}
async function bggThing(ids,signal){
  const valid=[...new Set(ids.map(String))].filter(id=>/^\d+$/.test(id));
  if(valid.length>BGG_BATCH)throw new Error('BGG thing supports a maximum of 20 IDs/request.');
  if(!valid.length)return [];
  const found=new Map();
  const uncached=[];
  for(const id of valid){
    const memory=bggCachedMemory(bggCacheMemoryThing,id);
    if(memory!==null){found.set(id,memory);bggThingCacheHits++;}
    else uncached.push(id);
  }
  const fromDb=bggCacheApi?await bggCacheApi.getThings(uncached):new Map();
  for(const [id,detail] of fromDb){
    found.set(String(id),detail);
    bggThingCacheHits++;
    bggStoreMemory(bggCacheMemoryThing,String(id),detail,BGG_THING_TTL);
  }
  const outstanding=valid.filter(id=>!found.has(id));
  const requests=[];
  const fetchIds=[];
  for(const id of outstanding){
    if(bggPendingThing.has(id))requests.push(bggPendingThing.get(id));
    else fetchIds.push(id);
  }
  if(fetchIds.length){
    if(signal?.aborted)throw new DOMException('Stopped','AbortError');
    const group=(async()=>{
      const xml=await bggRequest('thing',{id:fetchIds.join(','),stats:'1'},signal);
      const details=parseBggThings(xml);
      bggCacheNetworkThings++;
      for(const detail of details)
        bggStoreMemory(bggCacheMemoryThing,String(detail.id),detail,BGG_THING_TTL);
      if(bggCacheApi && details.length)await bggCacheApi.putThings(details);
      return details;
    })();
    for(const id of fetchIds){
      const promise=group.then(details=>details.find(detail=>String(detail.id)===id)||null);
      bggPendingThing.set(id,promise);
      requests.push(promise.then(detail=>{if(detail)found.set(id,detail);}));
      // Swallow rejections of the cleanup branch; callers still receive errors.
      promise.then(()=>{if(bggPendingThing.get(id)===promise)bggPendingThing.delete(id);},
                   ()=>{if(bggPendingThing.get(id)===promise)bggPendingThing.delete(id);});
    }
  }
  // In-flight IDs may have been started by another concurrent batch.
  for(const id of outstanding.filter(x=>!fetchIds.includes(x))){
    const p=bggPendingThing.get(id);
    if(p)requests.push(p.then(detail=>{if(detail)found.set(id,detail);}));
  }
  if(requests.length)await Promise.all(requests);
  return valid.map(id=>found.get(id)).filter(Boolean);
}
async function bggWorkerPool(jobs,callback,signal,progress){
  let cursor=0,finished=0;
  const workers=Math.min(BGG_WORKERS,jobs.length);
  await Promise.all(Array.from({length:workers},async()=>{
    while(cursor<jobs.length&&!signal?.aborted){
      const job=jobs[cursor++];
      try{await callback(job);}
      catch(error){
        if(signal?.aborted)break;
        if(job && typeof job==='object')job._bggError=String(error.message||error);
      }finally{
        finished++;
        if(progress && (finished%4===0||finished===jobs.length))progress(finished,jobs.length);
      }
    }
  }));
}
function bggRecentlyChecked(row){
  if(!['matched','missing','review'].includes(bggStatusOf(row)))return false;
  const time=Date.parse(row.bgg?.checkedAt||'');
  return Number.isFinite(time)&&Date.now()-time<BGG_TTL_DAYS*86400000;
}
function chooseCandidates(title,results){
  const exact=results.filter(result=>bggNormalized(result.name)===bggNormalized(title));
  if(exact.length===1)return {status:'matched',id:exact[0].id,choice:exact[0],candidates:exact};
  if(exact.length>1)return {status:'review',candidates:exact.slice(0,20)};
  return results.length?{status:'review',candidates:results.slice(0,20)}:{status:'missing',candidates:[]};
}
function bggSaveSnapshot(snapshotDate,force=false){
  // Avoid cloning 2,280 rows and writing IndexedDB on every twentieth fast response.
  if(!force && Date.now()-bggLastSave<3000)return bggSaveChain;
  bggLastSave=Date.now();
  const rows=state.rows.map(row=>({...row,bgg:row.bgg?{...row.bgg}:undefined}));
  bggSaveChain=bggSaveChain.catch(()=>{}).then(async()=>{
    if(database && !window.bggImportPending && state.date===snapshotDate)
      await transaction('readwrite',store=>store.put({id:'current',date:snapshotDate,rows}));
  });
  return bggSaveChain;
}
function cancelBggJobs(){
  if(bggCurrent?.controller&&!bggCurrent.controller.signal.aborted)bggCurrent.controller.abort();
}
function bggScanButtons(active){
  window.bggScanActive=active;
  $('bggMatchBtn').disabled=active||!state.rows.length;
  $('bggStopBtn').disabled=!active;
}
async function runBggAll(){
  if(window.bggScanActive)return;
  if(!state.rows.length){showNotice('Import your BGA license CSV before matching all games.');return;}
  const snapshotDate=state.date;
  const all=state.rows.filter(row=>!bggRecentlyChecked(row));
  const outstandingDetails=state.rows.some(row=>row.bgg?.status==='matched'&&row.bgg.id&&!row.bgg.detail);
  if(!all.length&&!outstandingDetails){
    showNotice('All titles already have recent saved BGG searches and details. Older results will be refreshed after 30 days.');
    return;
  }
  const controller=new AbortController(),signal=controller.signal;
  bggFatalError='';bggThrottleEvents=0;bggRequestRetries=0;bggSuccesses=0;
  bggLastThrottleAt=0;bggBackoffUntil=0;bggAdaptiveCeiling=BGG_MAX_CONCURRENCY;
  bggCurrent={controller};bggScanButtons(true);
  let searched=0,failed=0,detailFailures=0;
  try{
    bggPhaseStart=Date.now();bggPhaseStartDone=0;
    bggProgress(all.length?'Searching: 0 / '+all.length:'Reusing cached title matches; loading missing game details',0,all.length||1);
    // Every API result is cached as soon as its request succeeds, not only
    // when the entire 2,000+ title scan finishes.
    const memo=new Map();
    await bggWorkerPool(all,async row=>{
      try{
        // Exactly one non-exact XMLAPI2 search per distinct normalized title.
        // Choose exact local name matches from its results; otherwise flag review.
        const key=bggNormalized(row.game);
        if(!memo.has(key))memo.set(key,bggSearch(row.game,signal,false));
        const candidates=await memo.get(key);
        if(signal.aborted)return;
        row.bgg={...chooseCandidates(row.game,candidates),checkedAt:new Date().toISOString(),detail:null};
      }catch(error){
        if(signal.aborted)return;
        failed++;row.bgg={status:'error',error:String(error.message||error),checkedAt:new Date().toISOString()};
      }finally{
        searched++;
        if(searched%20===0)bggSaveSnapshot(snapshotDate);
      }
    },signal,(done,total)=>bggProgressStats('Search',done,total,failed,'search'));
    await bggSaveSnapshot(snapshotDate,true);
    if(signal.aborted||state.date!==snapshotDate)return;
    // Existing saved matches with details remain intact. Search results are batch-enriched.
    const need=state.rows.filter(row=>row.bgg?.status==='matched'&&row.bgg.id&&!row.bgg.detail);
    const ids=[...new Set(need.map(row=>row.bgg.id))],groups=[];
    for(let i=0;i<ids.length;i+=BGG_BATCH)groups.push(ids.slice(i,i+BGG_BATCH));
    const rowsById=new Map();
    for(const row of need){
      const id=String(row.bgg.id);
      if(!rowsById.has(id))rowsById.set(id,[]);
      rowsById.get(id).push(row);
    }
    bggPhaseStart=Date.now();bggPhaseStartDone=0;
    bggProgress('Thing: 0 / '+groups.length+' batches (20 IDs each)',0,groups.length||1);
    await bggWorkerPool(groups,async ids=>{
      try{
        const details=await bggThing(ids,signal);
        if(signal.aborted||state.date!==snapshotDate)return;
        for(const detail of details){
          for(const row of rowsById.get(String(detail.id))||[])row.bgg.detail=detail;
        }
        bggSaveSnapshot(snapshotDate);
      }catch(error){if(!signal.aborted)detailFailures++;}
    },signal,(done,total)=>bggProgressStats('Thing batches',done,total,detailFailures,'thing'));
    if(signal.aborted||state.date!==snapshotDate)return;
    await bggSaveSnapshot(snapshotDate,true);
    await bggCacheRefreshStats();
    showNotice('BGG matching finished: '+searched+' title searches, '+groups.length+' thing batches (up to 20 IDs each), '+(failed+detailFailures)+' request failures. Ambiguous matches remain available for manual review.');
  }catch(error){
    if(!signal.aborted)showNotice('BGG matching interrupted: '+error.message,true);
  }finally{
    await bggSaveSnapshot(snapshotDate,true).catch(()=>{});
    const stopped=signal.aborted;
    bggCurrent=null;bggScanButtons(false);
    bggCacheRefreshStats();
    drawStats();render();
    bggProgress(stopped?'BGG matching stopped; progress saved':'BGG matching complete',1,1);
    if(bggFatalError)showNotice('BGG API configuration/authentication issue: '+bggFatalError,true);
    else if(stopped)showNotice('BGG matching stopped; completed matches are saved to IndexedDB.');
  }
}
async function chooseBggGame(row,id){
  if(!row?.bgg)return;
  const choice=row.bgg.candidates?.find(candidate=>candidate.id===id);
  if(!choice)return;
  row.bgg={...row.bgg,status:'matched',id,choice,detail:null,checkedAt:new Date().toISOString()};
  const snapshotDate=state.date;
  try{
    const results=await bggThing([id],null);
    if(state.date===snapshotDate)row.bgg.detail=results.find(d=>d.id===id)||null;
  }catch(error){showNotice('Match selected, but BGG details failed: '+error.message,true);}
  await bggSaveSnapshot(snapshotDate);
  render();
}
function appendBggCells(tr,row){
  const record=row.bgg||{},status=bggStatusOf(row);
  const cell=document.createElement('td');cell.className='bgg-match';
  if(status==='matched'&&record.id){
    const link=document.createElement('a');link.href=bggGameUrl(record.id,record.detail?.type||record.choice?.type);
    link.target='_blank';link.rel='noopener noreferrer';
    link.textContent=record.detail?.name||record.choice?.name||('#'+record.id);
    cell.append(link);cell.append(textNode('small','BGG #'+record.id));
  }else if(status==='review'){
    cell.append(textNode('small','Select a BGG match'));
    const select=document.createElement('select');select.className='bgg-select';
    select.setAttribute('aria-label','Match BGG game for '+row.game);
    select.append(new Option('Review candidates',''));
    for(const option of record.candidates||[])
      select.append(new Option(option.name+' ('+(option.year||'?')+') #'+option.id,option.id));
    select.addEventListener('change',async()=>{
      select.disabled=true;
      try{await chooseBggGame(row,select.value);}finally{select.disabled=false;}
    });
    cell.append(select);
  }else cell.append(textNode('span',status==='missing'?'Not found':status==='error'?'API error':'Not checked','muted'));
  tr.append(cell);
  const detail=record.detail||{},numeric=value=>bggNumber(value);
  const rating=numeric(detail.rating),weight=numeric(detail.weight),rank=numeric(detail.rank);
  const lo=numeric(detail.minPlayers),hi=numeric(detail.maxPlayers),time=numeric(detail.playTime);
  for(const val of [detail.year||'—',rating?rating.toFixed(2):'—',weight?weight.toFixed(2):'—',
    rank?number(rank):'—',lo?(lo===hi?String(lo):lo+'–'+(hi||'?')):'—',time?time+'m':'—'])
    tr.append(textNode('td',val,'bgg-value'));
}
async function lookupBggCatalog(){
  if(bggLookupBusy)return;
  const query=$('bggLookupInput').value.trim();if(!query)return;
  bggLookupBusy=true;$('bggLookupSearch').disabled=true;
  $('bggLookupResults').replaceChildren();$('bggLookupStatus').textContent='Searching all BGG game titles…';
  try{
    const found=await bggSearch(query,null,false);
    const subset=found.slice(0,100),groups=[],details=new Map();
    for(let i=0;i<subset.length;i+=BGG_BATCH)groups.push(subset.slice(i,i+BGG_BATCH).map(x=>x.id));
    await bggWorkerPool(groups,async group=>{
      const result=await bggThing(group,null);
      for(const item of result)details.set(item.id,item);
    },null,null);
    const fragment=document.createDocumentFragment();
    for(const result of subset){
      const detail=details.get(result.id);
      const card=document.createElement('div');card.className='lookup-card';
      if(detail?.image){
        const image=document.createElement('img');image.src=detail.image;image.loading='lazy';
        image.referrerPolicy='no-referrer';image.alt='';card.append(image);
      }
      const body=document.createElement('div'),link=document.createElement('a');
      link.href=bggGameUrl(result.id,detail?.type||result.type);link.target='_blank';link.rel='noopener noreferrer';
      link.textContent=result.name;body.append(link);
      body.append(textNode('small','BGG #'+result.id+' · '+(result.year||'Year ?')+
        (detail?' · Rating '+(detail.rating||'—')+' · Weight '+(detail.weight||'—')+
        ' · '+(detail.minPlayers||'?')+'–'+(detail.maxPlayers||'?')+' players':' · Details unavailable')));
      card.append(body);fragment.append(card);
    }
    $('bggLookupResults').replaceChildren(fragment);
    bggCacheRefreshStats();
    $('bggLookupStatus').textContent=found.length+' BGG search hits; showing '+subset.length+
      ' results enriched via thing (max 20 IDs/request). Refine the title to narrow results.';
  }catch(error){$('bggLookupStatus').textContent='BGG lookup failed: '+error.message;}
  finally{bggLookupBusy=false;$('bggLookupSearch').disabled=false;}
}
$('bggClearCache').addEventListener('click',bggClearCachedApi);
bggCacheRefreshStats();
$('bggMatchBtn').addEventListener('click',()=>runBggAll());
$('bggStopBtn').addEventListener('click',cancelBggJobs);
$('bggLookupBtn').addEventListener('click',()=>{
  $('bggLookupPanel').hidden=!$('bggLookupPanel').hidden;
  if(!$('bggLookupPanel').hidden)$('bggLookupInput').focus();
});
$('bggLookupClose').addEventListener('click',()=>{$('bggLookupPanel').hidden=true;});
$('bggLookupSearch').addEventListener('click',lookupBggCatalog);
$('bggLookupInput').addEventListener('keydown',event=>{if(event.key==='Enter')lookupBggCatalog();});
bggScanButtons(false);
