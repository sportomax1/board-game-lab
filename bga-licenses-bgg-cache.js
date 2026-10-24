/* Persistent IndexedDB cache for BGG XML API2 parsed responses.
   Search results are keyed by normalized query; thing details are keyed by BGG ID.
   Separate from the imported BGA license snapshot so CSV replacement never erases
   API results. API errors/throttled responses are never cached. */
(function(){
  'use strict';
  const DB_NAME='board-game-lab-bgg-api-cache', DB_VERSION=1;
  const SEARCH_STORE='search', THING_STORE='things';
  const DAYS=24*60*60*1000;
  const SEARCH_TTL=30*DAYS, EMPTY_SEARCH_TTL=7*DAYS, THING_TTL=30*DAYS;
  let databasePromise=null;
  let accessible=null;
  function open(){
    if(databasePromise)return databasePromise;
    databasePromise=new Promise(resolve=>{
      if(!('indexedDB' in window)){accessible=false;resolve(null);return;}
      let request;
      try{request=indexedDB.open(DB_NAME,DB_VERSION);}
      catch{accessible=false;resolve(null);return;}
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(SEARCH_STORE))db.createObjectStore(SEARCH_STORE,{keyPath:'key'});
        if(!db.objectStoreNames.contains(THING_STORE))db.createObjectStore(THING_STORE,{keyPath:'id'});
      };
      request.onsuccess=()=>{
        accessible=true;
        const db=request.result;
        db.onversionchange=()=>{db.close();databasePromise=null;accessible=null;};
        resolve(db);
      };
      request.onerror=()=>{accessible=false;resolve(null);};
      request.onblocked=()=>{accessible=false;resolve(null);};
    });
    return databasePromise;
  }
  async function getSearch(key){
    const db=await open();
    if(!db)return null;
    return new Promise(resolve=>{
      let tx;
      try{tx=db.transaction(SEARCH_STORE,'readonly');}
      catch{return resolve(null);}
      let value=null;
      const req=tx.objectStore(SEARCH_STORE).get(key);
      req.onsuccess=()=>{
        const record=req.result;
        if(record && Number(record.expiresAt)>Date.now() && Array.isArray(record.results))
          value=record.results;
      };
      tx.oncomplete=()=>resolve(value);
      tx.onerror=()=>resolve(null);
      tx.onabort=()=>resolve(null);
    });
  }
  async function putSearch(key,results){
    const db=await open();
    if(!db || !Array.isArray(results))return false;
    return new Promise(resolve=>{
      let tx;
      try{tx=db.transaction(SEARCH_STORE,'readwrite');}
      catch{return resolve(false);}
      const ttl=results.length?SEARCH_TTL:EMPTY_SEARCH_TTL;
      tx.objectStore(SEARCH_STORE).put({key,results,savedAt:Date.now(),expiresAt:Date.now()+ttl});
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>resolve(false);
      tx.onabort=()=>resolve(false);
    });
  }
  async function getThings(ids){
    const found=new Map(),db=await open();
    if(!db||!ids.length)return found;
    return new Promise(resolve=>{
      let tx;
      try{tx=db.transaction(THING_STORE,'readonly');}
      catch{return resolve(found);}
      const store=tx.objectStore(THING_STORE);
      for(const id of ids){
        const key=String(id);
        const req=store.get(key);
        req.onsuccess=()=>{
          const record=req.result;
          if(record && Number(record.expiresAt)>Date.now() && record.detail)
            found.set(key,record.detail);
        };
      }
      tx.oncomplete=()=>resolve(found);
      tx.onerror=()=>resolve(new Map());
      tx.onabort=()=>resolve(new Map());
    });
  }
  async function putThings(details){
    const db=await open();
    if(!db||!details.length)return false;
    return new Promise(resolve=>{
      let tx;
      try{tx=db.transaction(THING_STORE,'readwrite');}
      catch{return resolve(false);}
      const store=tx.objectStore(THING_STORE);
      const time=Date.now();
      for(const detail of details){
        if(/^\d+$/.test(String(detail.id||'')))
          store.put({id:String(detail.id),detail,savedAt:time,expiresAt:time+THING_TTL});
      }
      tx.oncomplete=()=>resolve(true);
      tx.onerror=()=>resolve(false);
      tx.onabort=()=>resolve(false);
    });
  }
  async function stats(){
    const db=await open();
    if(!db)return {available:false,search:0,things:0};
    return new Promise(resolve=>{
      let tx,s=0,t=0;
      try{tx=db.transaction([SEARCH_STORE,THING_STORE],'readonly');}
      catch{return resolve({available:false,search:0,things:0});}
      const searches=tx.objectStore(SEARCH_STORE).count();
      const things=tx.objectStore(THING_STORE).count();
      searches.onsuccess=()=>{s=searches.result;};
      things.onsuccess=()=>{t=things.result;};
      tx.oncomplete=()=>resolve({available:true,search:s,things:t});
      tx.onerror=()=>resolve({available:false,search:0,things:0});
      tx.onabort=()=>resolve({available:false,search:0,things:0});
    });
  }
  async function clear(){
    const db=await open();
    if(!db)throw new Error('IndexedDB API cache is unavailable.');
    return new Promise((resolve,reject)=>{
      let tx;
      try{tx=db.transaction([SEARCH_STORE,THING_STORE],'readwrite');}
      catch(e){reject(e);return;}
      tx.objectStore(SEARCH_STORE).clear();
      tx.objectStore(THING_STORE).clear();
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('Cache clear failed.'));
      tx.onabort=()=>reject(tx.error||new Error('Cache clear was aborted.'));
    });
  }
  window.BGGApiCache={open,getSearch,putSearch,getThings,putThings,stats,clear,isAvailable:()=>accessible};
})();
