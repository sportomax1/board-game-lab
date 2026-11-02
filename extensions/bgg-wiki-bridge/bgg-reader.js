/* BGG Community Wiki Bridge v1.1
 * Reads the rendered wiki article from a BGG browser tab in the user's session.
 * It does not access cookies, tokens, passwords, or localStorage.
 */
(() => {
  'use strict';
  const MAX_HTML=450000, MIN_ARTICLE_TEXT=25;
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const ARTICLE_SELECTORS=[
    '#wikiPageContent','#wiki-content','#wikicontent','#wiki_content',
    '.wiki-page-content','.wiki-content','.wikipage-content','.wiki-page-body',
    '.wikiPageContent','.wiki-content-body','.wikipage','.wiki-page','.wikiPage',
    '[data-testid="wiki-content"]','[data-testid="community-wiki"]',
    '[itemprop="articleBody"]','article.wiki','article[role="article"]',
    '#maincontent article','#maincontent .content','#mainbody .content',
    '#wiki article','section[aria-label="Community Wiki"]',
    '#wiki','[id*="wiki-content"]','[class*="wiki-content"]'
  ];
  const PAGE_SELECTORS=[
    '#maincontent','#mainbody','#main','main','[role="main"]',
    'article','.main-content','#content'
  ];
  function matchPath(gameId) {
    try{
      const path=decodeURIComponent(location.pathname);
      return new RegExp('^/wiki/page/thing:'+gameId+':moreinfo/?$','i').test(path) ||
        new RegExp('^/boardgame/'+gameId+'(?:/[^/]+)?/wiki/?$','i').test(path);
    }catch(_){return false;}
  }
  function cloneSafe(node){
    const clone=node.cloneNode(true);
    for(const bad of clone.querySelectorAll('script,style,noscript,template,nav,header,footer,aside,form,button,input,select,textarea,iframe,object,embed,svg,canvas'))bad.remove();
    for(const el of clone.querySelectorAll('*')){
      for(const attr of [...el.attributes]){
        if(/^on/i.test(attr.name)||['srcdoc','contenteditable'].includes(attr.name))el.removeAttribute(attr.name);
      }
      for(const attr of ['href','src']){
        if(!el.hasAttribute(attr))continue;
        try{
          const u=new URL(el.getAttribute(attr),location.href);
          if(!['http:','https:'].includes(u.protocol))el.removeAttribute(attr);
          else el.setAttribute(attr,u.href);
        }catch(_){el.removeAttribute(attr);}
      }
    }
    return clone;
  }
  function textOf(node){return String(node.innerText||node.textContent||'').trim();}
  function acceptable(source,kind){
    const before=textOf(source);
    if(before.length<MIN_ARTICLE_TEXT)return null;
    const clean=cloneSafe(source),html=clean.outerHTML||'',text=textOf(clean);
    if(text.length<MIN_ARTICLE_TEXT||html.length>MAX_HTML)return null;
    const linkText=[...clean.querySelectorAll('a')].reduce((n,a)=>n+textOf(a).length,0);
    const density=linkText/Math.max(1,text.length);
    // A giant navigation list does not qualify as an article.
    if(density>0.68 && text.length>250)return null;
    if(kind==='page'){
      // Accept this generic container only on an exact wiki URL. Reject
      // obvious site chrome, empty app shells, or purely navigational views.
      if(text.length>90000 || density>0.48)return null;
      if(/^(?:sign in|login|enable javascript|access denied)$/i.test(text))return null;
    }
    return {ok:true,html,sourceUrl:location.href,title:document.title,
      textLength:text.length,extractor:kind};
  }
  function pickArticle(){
    for(const css of ARTICLE_SELECTORS){
      let matches=[];
      try{matches=[...document.querySelectorAll(css)];}catch(_){continue;}
      for(const node of matches){
        const result=acceptable(node,'article:'+css);
        if(result)return result;
      }
    }
    if(!decodeURIComponent(location.pathname).includes('/wiki/page/'))return null;
    for(const css of PAGE_SELECTORS){
      const node=document.querySelector(css);
      if(!node)continue;
      const result=acceptable(node,'page:'+css);
      if(result)return result;
    }
    return null;
  }
  function blocked(){
    const title=document.title||'',body=String(document.body?.innerText||'').slice(0,1500);
    return /access denied|just a moment|verify you are human|enable javascript and cookies|captcha/i.test(title) ||
      (/cloudflare|request blocked/i.test(body)&&body.length<700);
  }
  function fallbackText(){
    // Public wiki pages occasionally use nonstandard BGG templates. Read the
    // visible article text in that case; never substitute XML game descriptions.
    if(!decodeURIComponent(location.pathname).includes('/wiki/page/'))return null;
    const body=String(document.body?.innerText||'');
    if(body.length<MIN_ARTICLE_TEXT||body.length>160000)return null;
    const markers=[
      /\bMicrobadges\s*:/i,/\bComponents\s*:/i,
      /\bCommunity Wiki\s*\n/i,/\bOnline Play\s*\n/i,
      /\b(?:Article|Edit)\s*\|\s*History\b/i
    ];
    let start=-1;
    for(const regex of markers){const m=regex.exec(body);if(m){start=m.index;break;}}
    if(start<0)return null;
    let article=body.slice(start);
    const ending=/\n(?:What Links Here|Recently Viewed|Advertise Here|Privacy Policy|Cookie Policy)\b/i.exec(article);
    if(ending&&ending.index>MIN_ARTICLE_TEXT)article=article.slice(0,ending.index);
    article=article.trim();
    if(article.length<MIN_ARTICLE_TEXT||article.length>50000)return null;
    const escaped=article.replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
    return {ok:true,html:'<pre>'+escaped+'</pre>',sourceUrl:location.href,
      title:document.title,textLength:article.length,extractor:'visible-text-fallback'};
  }
  async function extract(gameId){
    if(!matchPath(gameId))return {ok:false,code:'WRONG_PAGE',
      error:'The BGG tab is not displaying the Community Wiki for game #'+gameId+'.'};
    for(let i=0;i<8;i++){
      if(blocked())return {ok:false,code:'BGG_RESTRICTED',restricted:true,
        error:'BGG displayed a login requirement, access restriction, or challenge. Please check the BGG tab; the extension will not bypass it.'};
      const article=pickArticle()||(i===7?fallbackText():null);
      if(article)return article;
      await sleep(650);
    }
    return {ok:false,code:'ARTICLE_NOT_FOUND',
      error:'BGG loaded a page but the Community Wiki article was not recognized (page: '+(document.title||'untitled')+').',
      url:location.href};
  }
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message?.type!=='EXTRACT_WIKI')return;
    const id=String(message.gameId||'');
    if(!/^[1-9]\d{0,8}$/.test(id)){reply({ok:false,code:'INVALID_ID',error:'Invalid BGG game ID.'});return;}
    extract(id).then(reply).catch(err=>reply({ok:false,code:'EXTRACT_ERROR',error:'Reader failed: '+(err.message||err)}));
    return true;
  });
})();
