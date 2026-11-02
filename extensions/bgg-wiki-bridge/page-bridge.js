/* Runs only on approved Board Game Lab Vercel origins. */
(() => {
  'use strict';
  const CHANNEL = 'BGL_COMMUNITY_WIKI_BRIDGE_V1';

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.channel !== CHANNEL || data.direction !== 'page-to-extension') return;
    if (data.type === 'PING') {
      window.postMessage({channel:CHANNEL,direction:'extension-to-page',
        type:'PONG',requestId:String(data.requestId || ''),
        version:chrome.runtime.getManifest().version},location.origin);
      return;
    }
    if (data.type !== 'FETCH_WIKI') return;
    const id = String(data.gameId || '');
    const requestId = String(data.requestId || '');
    if (!/^[1-9]\d{0,8}$/.test(id) || requestId.length < 5 || requestId.length > 128) return;
    try {
      chrome.runtime.sendMessage({type:'FETCH_WIKI',gameId:id},response=>{
        const error=chrome.runtime.lastError?.message;
        window.postMessage({
          channel:CHANNEL,direction:'extension-to-page',type:'WIKI_RESULT',
          requestId,gameId:id,
          payload:error?{ok:false,error:'Browser extension error: '+error}:
            (response || {ok:false,error:'The extension did not return a response.'})
        },location.origin);
      });
    } catch (error) {
      window.postMessage({channel:CHANNEL,direction:'extension-to-page',
        type:'WIKI_RESULT',requestId,gameId:id,
        payload:{ok:false,error:String(error.message || error)}},location.origin);
    }
  });
})();
