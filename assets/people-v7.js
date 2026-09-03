(()=>{
  const $=id=>document.getElementById(id);
  const root=document.querySelector('main.shell');
  if(!root||root.dataset.peopleV8Ready)return;
  root.dataset.peopleV8Ready='1';
  document.documentElement.classList.remove('peopleLayoutV7');
  document.documentElement.classList.add('peopleV8');

  const top=root.querySelector('.top');
  const title=top?.querySelector('.title');
  const logBtn=$('logBtn');
  const setup=root.querySelector('.setup');
  const setupGrid=top?.querySelector(':scope > .grid')||setup?.querySelector('.grid');
  let filterPanel=$('filterPanel')||setup?.nextElementSibling;
  const filterBody=$('filterBody');
  const summary=$('summary');
  const workspace=$('workspace');
  const resultsStrip=root.querySelector('.resultsStrip');
  const tabs=resultsStrip?.querySelector('.tabs')||workspace?.querySelector('.tabs');
  const drawerBackdrop=$('drawerBackdrop');
  const drawerContent=$('drawerContent');
  const status=$('status');
  const cacheState=$('cacheState');
  const progressTrack=setup?.querySelector('.progress');
  const rankHeader=$('rankingView')?.querySelector('.rankHeader');
  const toolbar=$('rankingView')?.querySelector('.toolbar');

  if(!setupGrid||!summary||!workspace)return;
  if(filterPanel)filterPanel.id='filterPanel';

  /* Remove old responsive layout side-effects without touching app/data logic. */
  setupGrid.classList.remove('grid');
  setupGrid.classList.add('paCommandFields');
  setup.classList.remove('statusBar','mobileDataCollapsed');

  const app=document.createElement('div');
  app.className='paApp';
  root.insertBefore(app,root.firstChild);

  /* Masthead */
  const mast=document.createElement('header');
  mast.className='paMasthead';
  const brand=document.createElement('div');
  brand.className='paBrand';
  if(title)brand.append(title);
  const mastActions=document.createElement('div');
  mastActions.className='paMastActions';
  if(logBtn){logBtn.textContent='Log';logBtn.title='View API and debug log';mastActions.append(logBtn)}
  mast.append(brand,mastActions);
  app.append(mast);

  /* Compact full-width command dock */
  const command=document.createElement('section');
  command.className='paCommandDock panel';
  command.append(setupGrid);

  const meta=document.createElement('div');
  meta.className='paCommandMeta';
  if(status)meta.append(status);
  if(cacheState)meta.append(cacheState);
  if(progressTrack)meta.append(progressTrack);

  /* Replace the old filter button so old v6 DOM listeners cannot fight this layout. */
  const oldToggle=$('filterCollapse');
  let filterToggle=null;
  if(oldToggle){
    filterToggle=oldToggle.cloneNode(true);
    oldToggle.replaceWith(filterToggle);
  }else{
    filterToggle=document.createElement('button');
    filterToggle.className='tiny';
    filterToggle.id='filterCollapse';
  }
  const oldBadge=root.querySelector('.filterActiveBadge');
  const badge=oldBadge||document.createElement('span');
  badge.className='filterActiveBadge';
  const toggleWrap=document.createElement('div');
  toggleWrap.className='paFilterToggleWrap';
  toggleWrap.append(filterToggle,badge);
  meta.append(toggleWrap);
  command.append(meta);
  app.append(command);

  /* Filters are a tray under the command dock, not a permanent rail. */
  if(filterPanel){
    app.append(filterPanel);
    const initialOpen=!filterPanel.classList.contains('filterClosed')&&!filterBody?.classList.contains('hidden');
    const setFiltersOpen=open=>{
      filterPanel.classList.toggle('filterClosed',!open);
      filterBody?.classList.toggle('hidden',!open);
      filterToggle.textContent=open?'Hide filters':'Filters';
      filterToggle.setAttribute('aria-expanded',String(open));
    };
    setFiltersOpen(initialOpen);
    filterToggle.addEventListener('click',()=>setFiltersOpen(filterPanel.classList.contains('filterClosed')));
  }

  const syncBadge=()=>{
    const checked=[...document.querySelectorAll('#filters input:checked')].length;
    const advanced=[...document.querySelectorAll('.advanced .af')].filter(el=>String(el.value||'').trim()!=='').length;
    const count=checked+advanced;
    badge.textContent=count?String(count):'';
    badge.title=count?`${count} active filter${count===1?'':'s'}`:'';
  };
  document.querySelectorAll('#filters input,.advanced .af').forEach(el=>{
    el.addEventListener('change',syncBadge);
    el.addEventListener('input',syncBadge);
  });
  syncBadge();

  /* Stats and view switching form one thin dashboard strip. */
  const overview=document.createElement('section');
  overview.className='paOverview';
  overview.append(summary);
  const viewTabs=document.createElement('div');
  viewTabs.className='paViewTabs';
  if(tabs)viewTabs.append(tabs);
  overview.append(viewTabs);
  app.append(overview);

  /* Results keep full width. Detail never steals a column. */
  app.append(workspace);
  if(rankHeader&&toolbar&&toolbar.parentElement!==rankHeader)rankHeader.append(toolbar);

  if(resultsStrip&&resultsStrip.isConnected)resultsStrip.remove();
  if(top){top.hidden=true;top.style.display='none'}
  if(setup){setup.hidden=true;setup.style.display='none'}

  /* v6 registered a breakpoint listener before this file. Restore our command fields after it runs. */
  const restoreCommandFields=()=>{
    if(setupGrid.parentElement!==command){
      command.insertBefore(setupGrid,meta);
    }
  };
  window.addEventListener('resize',()=>requestAnimationFrame(restoreCommandFields),{passive:true});

  /* Better search wording. */
  const search=$('search');
  if(search){
    search.placeholder='Search people or games…';
    search.setAttribute('aria-label','Search people or games');
  }

  /* Search within large detail lists. Rebuild whenever the existing drawer content changes. */
  const enhanceDrawer=()=>{
    if(!drawerContent)return;
    drawerContent.querySelector('.paDrawerSearch')?.remove();
    const games=drawerContent.querySelector('.drawerGames');
    if(!games)return;
    const cards=[...games.querySelectorAll('.drawerGame')];
    if(!cards.length)return;

    const wrap=document.createElement('div');
    wrap.className='paDrawerSearch';
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
          const match=!q||card.textContent.toLowerCase().includes(q);
          card.classList.toggle('paHidden',!match);
          if(match)shown++;
        });
        count.textContent=q?`${shown} / ${cards.length}`:`${cards.length} games`;
      },60);
    });
  };
  if(drawerContent)new MutationObserver(enhanceDrawer).observe(drawerContent,{childList:true,subtree:false});
  enhanceDrawer();

  /* Desktop detail is a floating inspector; mobile retains modal semantics. */
  const syncDrawerMode=()=>{
    if(!drawerBackdrop)return;
    drawerBackdrop.setAttribute('aria-modal',window.innerWidth<=820?'true':'false');
  };
  syncDrawerMode();
  window.addEventListener('resize',syncDrawerMode,{passive:true});

  /* Keep the active workspace visible when views or data state change. */
  const syncOverview=()=>{
    overview.hidden=summary.hidden&&workspace.hidden;
  };
  new MutationObserver(syncOverview).observe(summary,{attributes:true,attributeFilter:['hidden']});
  new MutationObserver(syncOverview).observe(workspace,{attributes:true,attributeFilter:['hidden']});
  syncOverview();
})();