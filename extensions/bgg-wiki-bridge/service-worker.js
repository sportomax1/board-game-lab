/* Chrome MV3 service worker.
 * Reads wiki pages from a first-party BGG tab, never from a credential-forwarding
 * server or private API. Temporary tabs are created inactive and then closed.
 */
'use strict';
const APP_HOSTS=new Set([
  'board-game-lab-one-phi-42.vercel.app',
  'vercel-one-phi-42.vercel.app',
  'board-game-lab-kevins-projects-3ccf05a5.vercel.app'
]);
const WIKI_PREFIX='https://boardgamegeek.com/wiki/page/';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function trustedSender(sender){
  try{
    const url=new URL(sender.url||sender.tab?.url||'');
    return url.protocol==='https:' && APP_HOSTS.has(url.hostname) &&
      sender.tab && typeof sender.tab.id==='number' && sender.frameId===0;
  }catch(_){return false;}
}
function matchesWiki(url,id){
  try{
    const u=new URL(url);
    if(!['boardgamegeek.com','www.boardgamegeek.com'].includes(u.hostname))return false;
    const path=decodeURIComponent(u.pathname);
    return path.includes('/wiki/page/thing:'+id+':moreinfo') ||
      new RegExp('^/boardgame/'+id+'(?:/[^/]+)?/wiki/?$','i').test(path);
  }catch(_){return false;}
}
function waitLoaded(tabId,limit=17000){
  return new Promise((resolve,reject)=>{
    let finished=false;
    const finish=(err)=>{if(finished)return;finished=true;
      clearTimeout(timer);chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      err?reject(err):resolve();
    };
    const onUpdated=(id,info)=>{if(id===tabId&&info.status==='complete')finish();};
    const onRemoved=id=>{if(id===tabId)finish(new Error('Temporary BGG tab closed before loading.'));};
    const timer=setTimeout(()=>finish(new Error('BGG did not finish loading the wiki tab.')),limit);
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    chrome.tabs.get(tabId).then(tab=>{
      if(tab?.status==='complete')finish();
    }).catch(err=>finish(err));
  });
}
async function readTab(tabId,id){
  let lastFailure={ok:false,code:'NO_READER_RESPONSE',error:'The BGG reader did not respond.'};
  for(let tries=0;tries<3;tries++){
    try{
      const data=await chrome.tabs.sendMessage(tabId,{type:'EXTRACT_WIKI',gameId:id});
      if(data?.ok && typeof data.html==='string' && data.html.length>50)return data;
      if(data?.restricted)return data;
      lastFailure={ok:false,code:data?.code||'ARTICLE_NOT_FOUND',
        error:data?.error||'BGG returned no readable Community Wiki article.'};
      if(data?.code==='WRONG_PAGE')return lastFailure;
    }catch(err){
      lastFailure={ok:false,code:'READER_NOT_AVAILABLE',
        error:'Could not communicate with the BGG content reader: '+(err.message||err)};
    }
    if(tries<2)await delay(700);
  }
  return lastFailure;
}
async function loadWiki(id){
  const tabs=await chrome.tabs.query({url:['https://boardgamegeek.com/*','https://www.boardgamegeek.com/*']});
  for(const tab of tabs){
    if(tab.id!=null && matchesWiki(tab.url||'',id)){
      const result=await readTab(tab.id,id);
      if(result.ok||result.restricted)return result;
    }
  }
  // The user stays on Board Game Lab. Chrome opens an INACTIVE first-party
  // BGG tab to use the browser's session, then closes that tab in finally.
  let tab;
  try{
    tab=await chrome.tabs.create({url:WIKI_PREFIX+encodeURIComponent('thing:'+id+':moreinfo'),active:false});
    await waitLoaded(tab.id);
    const loaded=await chrome.tabs.get(tab.id);
    if(!matchesWiki(loaded.url||'',id)){
      const path=(()=>{try{return new URL(loaded.url||'').pathname;}catch(_){return '';}})();
      return {ok:false,code:'BGG_REDIRECTED',
        error:/login|signin|sign-in|auth/i.test(path)
          ?'BGG redirected the wiki page to its sign-in screen. Sign into BGG in the same Chrome profile and retry.'
          :'BGG redirected to a different page instead of the Community Wiki. The article was not retrieved.'};
    }
    return await readTab(tab.id,id);
  }catch(err){
    return {ok:false,error:'Unable to load BGG Community Wiki in an inactive tab: '+(err.message||err)};
  }finally{
    if(tab?.id!=null)try{await chrome.tabs.remove(tab.id);}catch(_){}
  }
}
chrome.runtime.onMessage.addListener((request,sender,sendResponse)=>{
  if(request?.type!=='FETCH_WIKI')return;
  const id=String(request.gameId||'');
  if(!trustedSender(sender)||!/^[1-9]\d{0,8}$/.test(id)){
    sendResponse({ok:false,error:'Request not authorized for this extension.'});return;
  }
  loadWiki(id).then(sendResponse).catch(err=>sendResponse({ok:false,error:err.message||'Unknown extension error'}));
  return true;
});
