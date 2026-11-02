/* Reads ONLY the rendered public Community Wiki article from a BGG tab.
 * No cookie, token, localStorage or account data is read.
 */
(() => {
  'use strict';
  const wait = ms => new Promise(r => setTimeout(r,ms));
  const LIMITED = 450000;
  const SELECTORS = [
    '.wiki-page-content','.wiki-content','.wikipage-content',
    '#wiki-content','#wikiPageContent','#wikipage',
    '.wikipage','.wiki-page','.wikiPage','[data-testid="wiki-content"]',
    'article.wiki','#maincontent .content','#maincontent article',
    'article[role="article"]'
  ];
  function pageMatches(id) {
    try {
      const path=decodeURIComponent(location.pathname);
      return path.includes('/wiki/page/thing:'+id+':moreinfo') ||
        new RegExp('^/boardgame/'+id+'(?:/[^/]+)?/wiki/?$','i').test(path);
    } catch (_) {return false;}
  }
  function cleanClone(source) {
    const clone=source.cloneNode(true);
    for(const bad of clone.querySelectorAll(
      'script,style,noscript,template,nav,header,footer,aside,form,button,input,select,textarea,iframe,object,embed,svg,canvas'
    ))bad.remove();
    for(const el of clone.querySelectorAll('*')) {
      for(const attr of [...el.attributes]) {
        if(/^on/i.test(attr.name) || attr.name==='srcdoc')el.removeAttribute(attr.name);
      }
      for(const attr of ['href','src']) {
        if(!el.hasAttribute(attr))continue;
        try {
          const value=new URL(el.getAttribute(attr),location.href);
          if(value.protocol==='https:' || value.protocol==='http:')el.setAttribute(attr,value.href);
          else el.removeAttribute(attr);
        }catch(_){el.removeAttribute(attr);}
      }
    }
    return clone;
  }
  function findArticle() {
    const pageIsWiki=decodeURIComponent(location.pathname).includes('/wiki/page/');
    const candidates=SELECTORS.map(s=>[...document.querySelectorAll(s)]).flat();
    if(pageIsWiki)candidates.push(...[
      document.querySelector('main'),document.querySelector('#maincontent'),
      document.querySelector('[role="main"]')
    ].filter(Boolean));
    for(const source of candidates){
      const text=(source.innerText||source.textContent||'').trim();
      if(text.length < 60)continue;
      // Generic game metadata and the BGG navigation are NOT Community Wiki text.
      if(!/\b(?:Microbadges|Components|Online Play|Additional Information|Suggested Background Music|What Links Here|Board Game Wiki|Community Wiki)\b/i.test(text))continue;
      const clean=cleanClone(source),html=clean.outerHTML||'';
      const body=(clean.textContent||'').trim();
      if(body.length < 60 || html.length > LIMITED)continue;
      return {ok:true,html,sourceUrl:location.href,title:document.title,
        textLength:body.length};
    }
    return null;
  }
  function isBlocked(){
    const title=document.title||'',body=(document.body?.innerText||'').slice(0,1200);
    return /access denied|just a moment|verify you are human|enable javascript and cookies|captcha/i.test(title) ||
      (/cloudflare|request blocked/i.test(body) && body.length<600);
  }
  async function extract(id){
    if(!pageMatches(id))return {ok:false,error:'BGG tab does not show the selected Community Wiki.'};
    for(let attempt=0;attempt<7;attempt++){
      if(isBlocked())return {ok:false,restricted:true,error:'BGG displayed an access restriction or browser challenge. The extension will not bypass it.'};
      const article=findArticle();if(article)return article;
      await wait(650);
    }
    return {ok:false,error:'The wiki page loaded, but no readable article was found. BGG may have changed its page layout or not rendered the article.'};
  }
  chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
    if(message?.type!=='EXTRACT_WIKI')return;
    const id=String(message.gameId||'');
    if(!/^[1-9]\d{0,8}$/.test(id)){sendResponse({ok:false,error:'Invalid game ID.'});return;}
    extract(id).then(sendResponse).catch(err=>sendResponse({ok:false,error:'Wiki extraction failed: '+err.message}));
    return true;
  });
})();
