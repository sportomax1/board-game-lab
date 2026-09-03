(()=>{
  const $=id=>document.getElementById(id);
  const root=document.querySelector('main.shell');
  if(!root||root.dataset.v7Ready)return;
  root.dataset.v7Ready='1';
  document.documentElement.classList.add('peopleLayoutV7');
  root.classList.add('peopleShell');

  const top=root.querySelector('.top');
  const setup=root.querySelector('.setup');
  const setupGrid=top?.querySelector(':scope > .grid')||setup?.querySelector('.grid');
  const filterPanel=$('filterPanel')||setup?.nextElementSibling;
  const resultsStrip=root.querySelector('.resultsStrip');
  const summary=$('summary');
  const workspace=$('workspace');
  const drawerBackdrop=$('drawerBackdrop');
  const drawerContent=$('drawerContent');
  if(!setup||!workspace||!drawerBackdrop)return;

  // V6 moves setup controls into the header on desktop. Put them back in a dedicated rail.
  if(setupGrid&&setupGrid.parentElement!==setup)setup.insertBefore(setupGrid,setup.firstChild);
  if(filterPanel)filterPanel.id='filterPanel';

  const appGrid=document.createElement('div');
  appGrid.className='appGrid';
  const leftRail=document.createElement('aside');
  leftRail.className='leftRail';
  leftRail.setAttribute('aria-label','Analyzer controls');
  const centerStage=document.createElement('section');
  centerStage.className='centerStage';

  const anchor=resultsStrip||summary||workspace;
  anchor.parentNode.insertBefore(appGrid,anchor);
  appGrid.append(leftRail,centerStage,drawerBackdrop);
  leftRail.append(setup);
  if(filterPanel)leftRail.append(filterPanel);
  if(resultsStrip)centerStage.append(resultsStrip);
  else if(summary)centerStage.append(summary);
  centerStage.append(workspace);

  // The existing drawer remains the same content, but becomes a docked inspector on wide screens.
  const syncDetail=()=>root.classList.toggle('detail-open',drawerBackdrop.classList.contains('open'));
  new MutationObserver(syncDetail).observe(drawerBackdrop,{attributes:true,attributeFilter:['class']});
  syncDetail();

  // Search inside very large publisher/designer game lists instead of forcing long scrolling.
  const enhanceDrawer=()=>{
    if(!drawerContent)return;
    const games=drawerContent.querySelector('.drawerGames');
    if(!games||drawerContent.querySelector('.drawerSearchWrap'))return;
    const cards=[...games.querySelectorAll('.drawerGame')];
    const wrap=document.createElement('div');
    wrap.className='drawerSearchWrap';
    const input=document.createElement('input');
    input.className='drawerSearch';
    input.type='search';
    input.placeholder='Search games in this list…';
    input.setAttribute('aria-label','Search games in detail panel');
    const count=document.createElement('span');
    count.className='drawerSearchCount';
    count.textContent=`${cards.length} games`;
    wrap.append(input,count);
    games.parentNode.insertBefore(wrap,games);
    let timer;
    input.addEventListener('input',()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        const q=input.value.trim().toLowerCase();
        let shown=0;
        cards.forEach(card=>{
          const match=!q||card.textContent.toLowerCase().includes(q);
          card.classList.toggle('drawerHidden',!match);
          if(match)shown++;
        });
        count.textContent=q?`${shown} / ${cards.length}`:`${cards.length} games`;
      },70);
    });
  };
  if(drawerContent)new MutationObserver(enhanceDrawer).observe(drawerContent,{childList:true,subtree:false});
  enhanceDrawer();

  const search=$('search');
  if(search)search.setAttribute('aria-label','Search people or games');

  // Make the tiny status/filter controls read naturally in the new rail.
  const statusTools=setup.querySelector('.statusTools');
  const filterToggle=$('filterCollapse');
  const filterBadge=setup.querySelector('.filterActiveBadge')||filterPanel?.querySelector('.filterActiveBadge');
  if(statusTools&&filterToggle&&filterToggle.parentElement!==statusTools){
    if(filterBadge)statusTools.append(filterBadge);
    statusTools.append(filterToggle);
  }

  // On desktop, the inspector should not dim/disable the list. Narrow screens keep modal semantics.
  const desktopInspector=window.matchMedia('(min-width:1451px)');
  const syncInspectorMode=()=>{
    drawerBackdrop.setAttribute('aria-modal',desktopInspector.matches?'false':'true');
  };
  syncInspectorMode();
  desktopInspector.addEventListener?.('change',syncInspectorMode);
})();
