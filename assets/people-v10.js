(()=>{
  const root=document.querySelector('main.shell');
  if(!root||root.dataset.peopleV10Ready)return;
  root.dataset.peopleV10Ready='1';
  const $=id=>document.getElementById(id);
  const formatter=new Intl.NumberFormat('en-US');
  const parseNum=value=>{
    const n=Number(String(value??'').replace(/[^0-9.-]/g,''));
    return Number.isFinite(n)?n:0;
  };
  const main=root.querySelector('.p9Main');
  const summary=$('summary');
  const rows=$('rows');
  const rankHeader=$('rankingView')?.querySelector('.rankHeader');
  const sectionHead=rankHeader?.querySelector('.sectionHead');
  const resultCount=$('resultCount');
  const status=$('status');
  const cacheState=$('cacheState');
  const refreshBtn=$('loadBtn')||root.querySelector('.p9Command .primary');
  const side=root.querySelector('.p9Side');
  const conCard=side?.querySelector('.p9ConCard');
  const highlights=side?.querySelector('.p9Highlights');

  // One-line brand + shorter navigation labels.
  const brand=root.querySelector('.p9Brand');
  if(brand){
    const mark=brand.querySelector('.p9Mark');
    brand.innerHTML='';
    if(mark)brand.append(mark);
    const label=document.createElement('span');
    label.textContent='People Analyzer';
    brand.append(label);
  }
  const tabs=[...root.querySelectorAll('.p9Nav .tab')];
  const navLabels=[['Ranking','Ranking'],['Insights','Visual Insights'],['Matrix','Cross-Analysis Matrix']];
  tabs.forEach((tab,i)=>{
    if(!navLabels[i])return;
    tab.textContent=navLabels[i][0];
    tab.title=navLabels[i][1];
  });

  // Add compact power-user controls without cluttering the filter/search toolbar.
  if(sectionHead&&!sectionHead.querySelector('.p10HeaderActions')){
    const actions=document.createElement('span');
    actions.className='p10HeaderActions';

    const density=document.createElement('button');
    density.type='button';
    density.className='p10HeaderBtn';
    density.title='Toggle ranking row density';
    const comfortable=localStorage.getItem('peopleDensity')==='comfortable';
    document.documentElement.classList.toggle('p10Comfortable',comfortable);
    density.textContent=comfortable?'Comfortable':'Compact';
    density.setAttribute('aria-pressed',String(comfortable));
    density.onclick=()=>{
      const next=!document.documentElement.classList.contains('p10Comfortable');
      document.documentElement.classList.toggle('p10Comfortable',next);
      density.textContent=next?'Comfortable':'Compact';
      density.setAttribute('aria-pressed',String(next));
      localStorage.setItem('peopleDensity',next?'comfortable':'compact');
    };

    const rail=document.createElement('button');
    rail.type='button';
    rail.className='p10HeaderBtn';
    rail.title='Show or hide the analytical side panel';
    const railHidden=localStorage.getItem('peopleInsightsRail')==='hidden';
    root.classList.toggle('p10RailCollapsed',railHidden);
    rail.textContent=railHidden?'Show insights':'Hide insights';
    rail.setAttribute('aria-pressed',String(!railHidden));
    rail.onclick=()=>{
      const hidden=!root.classList.contains('p10RailCollapsed');
      root.classList.toggle('p10RailCollapsed',hidden);
      rail.textContent=hidden?'Show insights':'Hide insights';
      rail.setAttribute('aria-pressed',String(!hidden));
      localStorage.setItem('peopleInsightsRail',hidden?'hidden':'shown');
    };

    actions.append(density,rail);
    sectionHead.append(actions);
  }

  // Replace redundant donut/quick-stat treatment with one compact, meaningful concentration bar.
  if(conCard){
    const old=conCard.querySelector('.p9Concentration');
    if(old)old.style.display='none';
    if(!conCard.querySelector('.p10Concentration')){
      const block=document.createElement('div');
      block.className='p10Concentration';
      block.innerHTML=`
        <div class="p10ConTop"><span>Top 10 share of counted credits</span><b class="p10ConPct">—</b></div>
        <div class="p10StackedBar" aria-label="Top 10 publisher concentration"><i style="width:0%"></i></div>
        <div class="p10ConLegend">
          <div><small>Top 10 publishers</small><b class="p10ConTopCount">—</b></div>
          <div><small>All other publishers</small><b class="p10ConOtherCount">—</b></div>
        </div>`;
      conCard.append(block);
    }
  }

  const metricValues=()=>[...summary?.querySelectorAll('.metric b')||[]].map(el=>parseNum(el.textContent));
  const currentRows=()=>[...document.querySelectorAll('#rows .person')].map(row=>({
    name:row.querySelector('.personName')?.textContent?.trim()||'',
    count:parseNum(row.querySelector('.gameCount b')?.textContent)
  })).filter(x=>x.name);

  const formatResultCount=()=>{
    if(!resultCount)return;
    const n=parseNum(resultCount.textContent);
    if(n||/\b0\b/.test(resultCount.textContent))resultCount.textContent=`${formatter.format(n)} results`;
  };

  const syncCacheState=()=>{
    if(!main)return;
    const text=(cacheState?.textContent||'').trim();
    const cached=/cached/i.test(text)&&!/not loaded/i.test(text);
    main.classList.toggle('p10CachedData',cached);
    if(refreshBtn&&cached){
      refreshBtn.textContent='Refresh BGG Data';
      refreshBtn.title='Refresh the locally cached BGG dataset';
    }
  };

  const syncStatus=()=>{
    if(!status)return;
    const text=(status.textContent||'').trim();
    const duplicate=/games in current view|ready\. load once|ready\. load bgg data/i.test(text);
    status.classList.toggle('p10DuplicateStatus',duplicate);
  };

  const updateAnalytics=()=>{
    formatResultCount();
    syncCacheState();
    syncStatus();

    const metrics=metricValues();
    const games=metrics[0]||0;
    const matches=metrics[2]||games||0;
    const repeat=metrics[3]||0;
    const data=currentRows();
    if(!data.length)return;

    const counts=data.map(x=>x.count).filter(Number.isFinite).sort((a,b)=>a-b);
    const leader=data[0];
    const runner=data[1];
    const top10=data.slice(0,10).reduce((sum,x)=>sum+x.count,0);
    const denominator=matches||data.reduce((sum,x)=>sum+x.count,0)||1;
    const topPct=Math.min(100,top10/denominator*100);
    const other=Math.max(0,denominator-top10);
    const singles=data.filter(x=>x.count===1).length;
    const median=counts.length?(counts.length%2?counts[(counts.length-1)/2]:(counts[counts.length/2-1]+counts[counts.length/2])/2):0;
    const repeatRate=games?repeat/games*100:0;

    const pct=conCard?.querySelector('.p10ConPct');
    const bar=conCard?.querySelector('.p10StackedBar i');
    const topCount=conCard?.querySelector('.p10ConTopCount');
    const otherCount=conCard?.querySelector('.p10ConOtherCount');
    if(pct)pct.textContent=`${topPct.toFixed(1)}%`;
    if(bar)bar.style.width=`${topPct}%`;
    if(topCount)topCount.textContent=`${formatter.format(top10)} credits`;
    if(otherCount)otherCount.textContent=`${formatter.format(other)} credits`;

    if(highlights){
      const leadBy=runner?Math.max(0,leader.count-runner.count):0;
      highlights.innerHTML=`
        <div class="p9Highlight"><span class="p9HiIcon">1</span><span><b>${leader.name} leads${runner?` by ${formatter.format(leadBy)} credit${leadBy===1?'':'s'}`:''}</b><small>${formatter.format(leader.count)} counted credit${leader.count===1?'':'s'}</small></span></div>
        <div class="p9Highlight"><span class="p9HiIcon">10</span><span><b>Top 10 represent ${topPct.toFixed(1)}% of counted credits</b><small>${formatter.format(top10)} of ${formatter.format(denominator)} credits</small></span></div>
        <div class="p9Highlight"><span class="p9HiIcon">≈</span><span><b>Median publisher appears on ${Number.isInteger(median)?formatter.format(median):median.toFixed(1)} game${median===1?'':'s'}</b><small>${formatter.format(singles)} publisher group${singles===1?'':'s'} appear once · repeat-credit rate ${repeatRate.toFixed(1)}%</small></span></div>`;
    }
  };

  let raf=0;
  const schedule=()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(updateAnalytics);
  };
  if(rows)new MutationObserver(schedule).observe(rows,{childList:true,subtree:true,characterData:true});
  if(summary)new MutationObserver(schedule).observe(summary,{childList:true,subtree:true,characterData:true});
  if(resultCount)new MutationObserver(schedule).observe(resultCount,{childList:true,subtree:true,characterData:true});
  if(status)new MutationObserver(schedule).observe(status,{childList:true,subtree:true,characterData:true});
  if(cacheState)new MutationObserver(schedule).observe(cacheState,{childList:true,subtree:true,characterData:true});

  // Clarify high-impact mode controls.
  const scope=$('scope');
  if(scope){
    scope.title='Controls how multiple credits on a game are counted in the analysis.';
  }
  const domain=$('domain');
  if(domain)domain.title='Choose whether to analyze publishers, designers, or artists.';
  const filterToggle=$('filterCollapse');
  if(filterToggle){
    filterToggle.textContent='Filters';
    filterToggle.title='Show or hide collection filters';
    const observer=new MutationObserver(()=>{
      const expanded=filterToggle.getAttribute('aria-expanded')==='true';
      filterToggle.textContent=expanded?'Hide filters':'Filters';
    });
    observer.observe(filterToggle,{attributes:true,attributeFilter:['aria-expanded']});
  }

  schedule();
})();
