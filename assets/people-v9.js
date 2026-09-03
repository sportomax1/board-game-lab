(()=>{
  const $=id=>document.getElementById(id);
  const root=document.querySelector('main.shell');
  if(!root||root.dataset.peopleV9Ready)return;
  root.dataset.peopleV9Ready='1';
  document.documentElement.classList.remove('peopleLayoutV7','peopleV8','peopleUxV6');
  document.documentElement.classList.add('peopleV9');

  const top=root.querySelector('.top');
  const titleBlock=top?.querySelector('.title');
  const logBtn=$('logBtn');
  const setup=root.querySelector('.setup');
  const setupGrid=top?.querySelector(':scope > .grid')||setup?.querySelector('.grid')||root.querySelector('.paCommandFields');
  const filterPanel=$('filterPanel')||setup?.nextElementSibling;
  const filterBody=$('filterBody');
  const summary=$('summary');
  const workspace=$('workspace');
  const resultsStrip=root.querySelector('.resultsStrip');
  const tabs=resultsStrip?.querySelector('.tabs')||workspace?.querySelector('.tabs');
  const rankingView=$('rankingView');
  const rankHeader=rankingView?.querySelector('.rankHeader');
  const toolbar=rankingView?.querySelector('.toolbar');
  const drawerBackdrop=$('drawerBackdrop');
  const drawerContent=$('drawerContent');
  const modal=$('logModal')||document.querySelector('.modal');
  const status=$('status');
  const cacheState=$('cacheState');
  const progressTrack=setup?.querySelector('.progress');
  if(!setupGrid||!summary||!workspace||!tabs)return;

  setupGrid.classList.remove('grid','paCommandFields');
  setupGrid.classList.add('p9Command');
  setup?.classList.remove('statusBar','mobileDataCollapsed');
  if(filterPanel)filterPanel.id='filterPanel';

  const app=document.createElement('div');
  app.className='p9App';
  const sidebar=document.createElement('aside');
  sidebar.className='p9Sidebar';
  const main=document.createElement('main');
  main.className='p9Main';
  app.append(sidebar,main);
  root.insertBefore(app,root.firstChild);

  const brand=document.createElement('div');
  brand.className='p9Brand';
  brand.innerHTML='<span class="p9Mark">P</span><span>People<br>Analyzer</span>';
  sidebar.append(brand);

  const nav=document.createElement('nav');
  nav.className='p9Nav';
  nav.setAttribute('aria-label','Analyzer views');
  nav.append(tabs);
  sidebar.append(nav);

  const sideFoot=document.createElement('div');
  sideFoot.className='p9SidebarFoot';
  sideFoot.innerHTML='<div><span class="p9CacheDot"></span><strong>Data cached</strong></div><span class="p9SideCache">IndexedDB</span>';
  sidebar.append(sideFoot);

  const topbar=document.createElement('header');
  topbar.className='p9Topbar';
  const heading=document.createElement('h1');
  heading.className='p9Title';
  heading.textContent='People Analyzer';
  const topMeta=document.createElement('div');
  topMeta.className='p9TopMeta';
  const topCache=document.createElement('span');
  topCache.className='cache p9TopCache';
  topMeta.append(topCache);
  if(logBtn){
    logBtn.textContent='Log';
    logBtn.title='View API and debug log';
    topMeta.append(logBtn);
  }
  topbar.append(heading,topMeta);
  main.append(topbar);

  const commandWrap=document.createElement('section');
  commandWrap.className='p9CommandWrap';
  commandWrap.append(setupGrid);

  const statusLine=document.createElement('div');
  statusLine.className='p9StatusLine';
  if(status)statusLine.append(status);
  if(cacheState)statusLine.append(cacheState);
  if(progressTrack)statusLine.append(progressTrack);

  const oldToggle=$('filterCollapse');
  let filterToggle;
  if(oldToggle){
    filterToggle=oldToggle.cloneNode(true);
    oldToggle.replaceWith(filterToggle);
  }else{
    filterToggle=document.createElement('button');
    filterToggle.id='filterCollapse';
    filterToggle.className='tiny';
  }
  filterToggle.classList.add('p9FilterButton');
  const oldBadge=root.querySelector('.filterActiveBadge');
  const badge=oldBadge||document.createElement('span');
  badge.className='filterActiveBadge';
  const filterWrap=document.createElement('span');
  filterWrap.style.display='inline-flex';
  filterWrap.style.alignItems='center';
  filterWrap.style.gap='5px';
  filterWrap.append(filterToggle,badge);
  statusLine.append(filterWrap);
  commandWrap.append(statusLine);
  main.append(commandWrap);

  if(filterPanel){
    main.append(filterPanel);
    const setFiltersOpen=open=>{
      filterPanel.classList.toggle('filterClosed',!open);
      filterBody?.classList.toggle('hidden',!open);
      filterToggle.textContent=open?'Hide filters':'Show filters';
      filterToggle.setAttribute('aria-expanded',String(open));
    };
    setFiltersOpen(false);
    filterToggle.addEventListener('click',()=>setFiltersOpen(filterPanel.classList.contains('filterClosed')));
  }

  const syncBadge=()=>{
    const checked=[...document.querySelectorAll('#filters input:checked')].length;
    const advanced=[...document.querySelectorAll('.advanced .af')].filter(el=>String(el.value||'').trim()).length;
    const count=checked+advanced;
    badge.textContent=count?String(count):'';
    badge.title=count?`${count} active filter${count===1?'':'s'}`:'';
  };
  document.querySelectorAll('#filters input,.advanced .af').forEach(el=>{
    el.addEventListener('change',syncBadge);
    el.addEventListener('input',syncBadge);
  });
  syncBadge();

  const overview=document.createElement('section');
  overview.className='p9Overview';
  overview.append(summary);
  main.append(overview);

  const content=document.createElement('section');
  content.className='p9Content';
  const workspaceWrap=document.createElement('div');
  workspaceWrap.className='p9Workspace';
  workspaceWrap.append(workspace);
  const side=document.createElement('aside');
  side.className='p9Side';
  side.innerHTML=`
    <section class="p9Card p9ConCard">
      <h3>Publisher concentration</h3>
      <div class="p9Concentration">
        <div class="p9Donut"><div class="p9DonutText"><span class="p9DonutTotal">—</span><small>Total games</small></div></div>
        <div class="p9Legend">
          <div class="p9LegendRow"><span class="p9Dot" style="background:#0aa5a9"></span><span><b>Top publishers</b><br><span class="p9TopShare">—</span></span></div>
          <div class="p9LegendRow"><span class="p9Dot" style="background:#7b61e8"></span><span><b>Remaining groups</b><br><span class="p9OtherShare">—</span></span></div>
        </div>
      </div>
    </section>
    <section class="p9Card">
      <h3>Highlights</h3>
      <div class="p9Highlights"></div>
    </section>
    <section class="p9Card">
      <h3>Quick stats</h3>
      <div class="p9Quick">
        <div><small>Games shown</small><b class="p9QGames">—</b></div>
        <div><small>Publisher groups</small><b class="p9QGroups">—</b></div>
        <div><small>Matches counted</small><b class="p9QMatches">—</b></div>
        <div><small>Repeat credits</small><b class="p9QRepeat">—</b></div>
      </div>
    </section>`;
  content.append(workspaceWrap,side);
  main.append(content);

  if(rankHeader&&toolbar&&toolbar.parentElement!==rankHeader)rankHeader.append(toolbar);
  if(resultsStrip&&resultsStrip.isConnected)resultsStrip.remove();
  if(top){top.hidden=true;top.style.display='none'}
  if(setup){setup.hidden=true;setup.style.display='none'}

  if(drawerBackdrop)document.body.append(drawerBackdrop);
  if(modal)document.body.append(modal);

  const formatter=new Intl.NumberFormat('en-US');
  const parseNum=text=>{
    const n=Number(String(text||'').replace(/[^0-9.-]/g,''));
    return Number.isFinite(n)?n:0;
  };
  const metricNodes=()=>[...summary.querySelectorAll('.metric b')];
  const formatNumbers=()=>{
    metricNodes().forEach(el=>{
      const n=parseNum(el.textContent);
      if(n||String(el.textContent).trim()==='0')el.textContent=formatter.format(n);
    });
    document.querySelectorAll('.gameCount b').forEach(el=>{
      const n=parseNum(el.textContent);
      if(n>=1000)el.textContent=formatter.format(n);
    });
  };

  const syncCacheText=()=>{
    const text=cacheState?.textContent?.trim()||'IndexedDB';
    const clean=text.replace(/^IndexedDB\s*[•·-]?\s*/i,'');
    topCache.textContent=`✓ IndexedDB${clean&&clean!=='Not loaded'?` • ${clean}`:''}`;
    const sideCache=sideFoot.querySelector('.p9SideCache');
    if(sideCache)sideCache.textContent='IndexedDB';
  };

  const metricValue=i=>parseNum(metricNodes()[i]?.textContent);
  const updateSide=()=>{
    formatNumbers();
    syncCacheText();
    const games=metricValue(0),groups=metricValue(1),matches=metricValue(2),repeat=metricValue(3);
    side.querySelector('.p9DonutTotal').textContent=formatter.format(games||0);
    side.querySelector('.p9QGames').textContent=formatter.format(games||0);
    side.querySelector('.p9QGroups').textContent=formatter.format(groups||0);
    side.querySelector('.p9QMatches').textContent=formatter.format(matches||0);
    side.querySelector('.p9QRepeat').textContent=formatter.format(repeat||0);

    const rowData=[...document.querySelectorAll('#rows .person')].slice(0,10).map(row=>({
      name:row.querySelector('.personName')?.textContent?.trim()||'',
      count:parseNum(row.querySelector('.gameCount b')?.textContent)
    })).filter(x=>x.count>0);
    const topSum=rowData.reduce((a,b)=>a+b.count,0);
    const pct=games?Math.min(100,topSum/games*100):0;
    const donut=side.querySelector('.p9Donut');
    donut?.style.setProperty('--p9Pct',`${pct.toFixed(1)}%`);
    side.querySelector('.p9TopShare').textContent=games?`${formatter.format(topSum)} (${pct.toFixed(1)}%)`:'—';
    side.querySelector('.p9OtherShare').textContent=games?`${formatter.format(Math.max(0,games-topSum))} (${Math.max(0,100-pct).toFixed(1)}%)`:'—';

    const leader=rowData[0];
    const over300=[...document.querySelectorAll('#rows .person .gameCount b')].map(x=>parseNum(x.textContent)).filter(x=>x>=300).length;
    const hi=side.querySelector('.p9Highlights');
    hi.innerHTML=`
      <div class="p9Highlight"><span class="p9HiIcon">★</span><span><b>${leader?`${leader.name} leads with ${formatter.format(leader.count)} games`:'Ranking ready'}</b><small>${leader&&games?`${(leader.count/games*100).toFixed(2)}% of games shown`:''}</small></span></div>
      <div class="p9Highlight"><span class="p9HiIcon">↗</span><span><b>${over300} groups have 300+ games</b><small>Fast view of collection concentration</small></span></div>
      <div class="p9Highlight"><span class="p9HiIcon">↻</span><span><b>${formatter.format(repeat||0)} repeat credits found</b><small>Across multiple analyzed groups</small></span></div>`;
  };

  const syncSideVisibility=()=>{
    const rankingVisible=rankingView&&!rankingView.hidden&&getComputedStyle(rankingView).display!=='none';
    side.hidden=!rankingVisible;
    content.style.gridTemplateColumns=rankingVisible?'minmax(0,1fr) 330px':'1fr';
  };

  const rows=$('rows');
  if(rows)new MutationObserver(()=>requestAnimationFrame(updateSide)).observe(rows,{childList:true,subtree:true,characterData:true});
  new MutationObserver(()=>requestAnimationFrame(updateSide)).observe(summary,{childList:true,subtree:true,characterData:true});
  if(cacheState)new MutationObserver(syncCacheText).observe(cacheState,{childList:true,subtree:true,characterData:true});
  [rankingView,$('insightsView'),$('matrixView')].filter(Boolean).forEach(v=>new MutationObserver(syncSideVisibility).observe(v,{attributes:true,attributeFilter:['hidden','class','style']}));
  [...tabs.querySelectorAll('.tab')].forEach(btn=>btn.addEventListener('click',()=>requestAnimationFrame(syncSideVisibility)));

  const search=$('search');
  if(search){
    search.placeholder='Search publishers or games…';
    search.setAttribute('aria-label','Search people or games');
  }

  const enhanceDrawer=()=>{
    if(!drawerContent)return;
    drawerContent.querySelector('.p9DrawerSearch')?.remove();
    const games=drawerContent.querySelector('.drawerGames');
    if(!games)return;
    const cards=[...games.querySelectorAll('.drawerGame')];
    if(!cards.length)return;
    const wrap=document.createElement('div');
    wrap.className='p9DrawerSearch';
    const input=document.createElement('input');
    input.type='search';
    input.placeholder='Search games in this list…';
    input.setAttribute('aria-label','Search games in detail panel');
    const count=document.createElement('span');
    count.textContent=`${cards.length} games`;
    wrap.append(input,count);
    games.before(wrap);
    let timer;
    input.addEventListener('input',()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        const q=input.value.trim().toLowerCase();
        let shown=0;
        cards.forEach(card=>{
          const hit=!q||card.textContent.toLowerCase().includes(q);
          card.classList.toggle('p9Hidden',!hit);
          if(hit)shown++;
        });
        count.textContent=q?`${shown} / ${cards.length}`:`${cards.length} games`;
      },60);
    });
  };
  if(drawerContent)new MutationObserver(enhanceDrawer).observe(drawerContent,{childList:true,subtree:false});
  enhanceDrawer();

  const restoreCommand=()=>{
    if(setupGrid.parentElement!==commandWrap)commandWrap.insertBefore(setupGrid,statusLine);
  };
  window.addEventListener('resize',()=>requestAnimationFrame(restoreCommand),{passive:true});
  requestAnimationFrame(()=>{restoreCommand();formatNumbers();updateSide();syncSideVisibility();syncCacheText()});
})();
