(() => {
  'use strict';

  const MODERN_VERSION = '2026.09.01-modern-crm-v3';
  const tabMeta = {
    collection: { title: 'Collection', subtitle: 'Browse your BGG library and turn game credits into outreach contacts.', icon: 'fa-layer-group' },
    contacts: { title: 'Contacts', subtitle: 'Manage publishers, designers, artists and every outreach detail in one place.', icon: 'fa-address-book' },
    pipeline: { title: 'Games', subtitle: 'Track BGA projects from Studio through Premium.', icon: 'fa-diagram-project' },
    bga: { title: 'BGA Library', subtitle: 'Explore Board Game Arena coverage and your collection overlap.', icon: 'fa-gamepad' }
  };

  let selectedContactId = null;
  let collectionRenderLimit = 120;
  let bgaHydrated = false;
  const legacyRenderTable = renderTable;
  const legacyOpenContact = openContact;
  const legacyLoad = load;

  function icon(name) { const family = name === 'fa-discord' ? 'fa-brands' : 'fa-solid'; return `<i class="${family} ${name}" aria-hidden="true"></i>`; }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0,2).map(x => x[0] || '').join('').toUpperCase() || '?';
  }
  function typeLabel(type) {
    return ({boardgamepublisher:'Publisher',boardgamedesigner:'Designer',boardgameartist:'Artist'})[type] || cap(String(type || '').replace('boardgame',''));
  }
  function typeIcon(type) {
    return ({boardgamepublisher:'fa-building',boardgamedesigner:'fa-pen-ruler',boardgameartist:'fa-palette'})[type] || 'fa-user';
  }
  function bggEntityUrl(c) {
    const kind = ({boardgamepublisher:'boardgamepublisher',boardgamedesigner:'boardgamedesigner',boardgameartist:'boardgameartist'})[c.bgg_type];
    return kind && c.bgg_id ? `https://boardgamegeek.com/${kind}/${c.bgg_id}` : '';
  }
  function formatDate(value) {
    if (!value) return '—';
    const d = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    return Number.isNaN(d.getTime()) ? e(value) : d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  }
  function debounce(fn, delay=180) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
  }
  function toast(message, tone='ok') {
    let host = document.getElementById('modernToasts');
    if (!host) {
      host = document.createElement('div'); host.id = 'modernToasts'; host.className = 'modernToasts'; document.body.appendChild(host);
    }
    const el = document.createElement('div'); el.className = `modernToast ${tone}`;
    el.innerHTML = `<span>${tone === 'bad' ? icon('fa-triangle-exclamation') : icon('fa-circle-check')}</span><span>${e(message)}</span>`;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(),220); }, 2200);
  }
  async function copyText(value, label) {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); toast(`${label} copied`); }
    catch { window.prompt(`Copy ${label}`, value); }
  }

  function buildShell() {
    const app = document.getElementById('dashboardApp');
    if (!app || document.getElementById('modernShell')) return;
    app.dataset.uiVersion = MODERN_VERSION;

    const oldTitle = app.querySelector(':scope > h1');
    const tabs = app.querySelector(':scope > .tabs');
    const sections = ['collection','contacts','pipeline','bga'].map(id => document.getElementById(id)).filter(Boolean);
    if (!tabs || sections.length < 4) return;

    const shell = document.createElement('div'); shell.id = 'modernShell'; shell.className = 'modernShell';
    const side = document.createElement('aside'); side.className = 'modernSide';
    const brand = document.createElement('div'); brand.className = 'modernBrand';
    brand.innerHTML = `<div class="brandMark">${icon('fa-flask-vial')}</div><div><strong>Board Game Lab</strong><span>BGG Outreach Hub</span></div>`;
    const sideNavLabel = document.createElement('div'); sideNavLabel.className = 'sideLabel'; sideNavLabel.textContent = 'Workspace';
    const stats = document.createElement('div'); stats.id = 'modernQuickStats'; stats.className = 'modernQuickStats';
    stats.innerHTML = `<div class="sideLabel">Contact pulse</div><div class="quickStatGrid">
      <div><span id="qsTotal">—</span><small>Total</small></div><div><span id="qsReply">—</span><small>Replied</small></div>
      <div><span id="qsNoReply">—</span><small>No reply</small></div><div><span id="qsMissing">—</span><small>Missing info</small></div>
    </div>`;
    const footer = document.createElement('div'); footer.className = 'sideFooter'; footer.innerHTML = `<span class="liveDot"></span><span>Supabase connected</span>`;
    side.append(brand, sideNavLabel, tabs, stats, footer);

    const main = document.createElement('div'); main.className = 'modernMain';
    const top = document.createElement('header'); top.className = 'modernTopbar';
    top.innerHTML = `<div class="topTitle"><h1 id="modernPageTitle">Collection</h1><p id="modernPageSubtitle"></p></div>
      <div class="topActions"><button id="modernRefresh" class="modernButton secondary">${icon('fa-arrows-rotate')}<span>Refresh BGG</span></button></div>`;
    const scroll = document.createElement('div'); scroll.className = 'modernScroll';
    sections.forEach(section => scroll.appendChild(section));
    main.append(top, scroll);
    shell.append(side, main);
    if (oldTitle) oldTitle.remove();
    app.appendChild(shell);

    const navInfo = {
      collection:['fa-layer-group','Collection'],
      contacts:['fa-address-book','Contacts'],
      pipeline:['fa-diagram-project','Games'],
      bga:['fa-gamepad','BGA']
    };
    tabs.querySelectorAll('[data-tab]').forEach(btn => {
      const [ic,label] = navInfo[btn.dataset.tab] || ['fa-circle', btn.textContent.trim()];
      const count = btn.querySelector('.tabCount');
      btn.innerHTML = `<span class="navIcon">${icon(ic)}</span><span class="navText">${label}</span>`;
      if (count) btn.appendChild(count);
    });

    document.getElementById('modernRefresh').onclick = () => document.getElementById('load')?.click();
    updateTopbar('collection');
  }

  function buildContactsWorkspace() {
    const section = document.getElementById('contacts');
    if (!section || document.getElementById('modernContactDetail')) return;
    const panel = section.querySelector(':scope > .panel');
    const list = document.getElementById('clist');
    if (!panel || !list) return;
    const shell = document.createElement('div'); shell.className = 'modernCRM'; shell.id = 'modernCRM';
    const left = document.createElement('div'); left.className = 'crmListPane';
    const detail = document.createElement('aside'); detail.id = 'modernContactDetail'; detail.className = 'crmDetailPane';
    left.append(panel, list); shell.append(left, detail); section.appendChild(shell);
    renderContactEmpty();
  }

  function updateTopbar(tab) {
    const meta = tabMeta[tab] || tabMeta.collection;
    const title = document.getElementById('modernPageTitle');
    const sub = document.getElementById('modernPageSubtitle');
    if (title) title.textContent = meta.title;
    if (sub) sub.textContent = meta.subtitle;
    document.body.dataset.activeTab = tab;
    if (tab === 'bga') hydrateBga();
  }

  function hydrateBga() {
    if (bgaHydrated) return;
    const iframe = document.getElementById('bgaEmbeddedApp');
    if (!iframe) return;
    const deferred = iframe.getAttribute('data-srcdoc');
    if (deferred && !iframe.getAttribute('srcdoc')) {
      iframe.setAttribute('srcdoc', deferred);
      iframe.removeAttribute('data-srcdoc');
    }
    bgaHydrated = true;
  }

  function updateQuickStats() {
    const total = contacts.length;
    const replied = contacts.filter(c => c.heard_back).length;
    const noReply = total - replied;
    const missing = contacts.filter(c => !String(c.email||'').trim() || !String(c.bgg_username||'').trim() || !String(c.discord_username||'').trim()).length;
    const set = (id,val) => { const n=document.getElementById(id); if(n)n.textContent=val; };
    set('qsTotal',total); set('qsReply',replied); set('qsNoReply',noReply); set('qsMissing',missing);
  }

  function renderContactEmpty() {
    const pane = document.getElementById('modernContactDetail');
    if (!pane) return;
    pane.classList.remove('open');
    pane.innerHTML = `<div class="detailEmpty"><div class="detailEmptyIcon">${icon('fa-address-card')}</div><h2>Select a contact</h2><p>Choose someone from the list to see contact methods, outreach details, notes and quick actions without leaving the page.</p></div>`;
  }

  function contactMethodIcons(c) {
    const out=[];
    if(c.email) out.push(`<span title="Email">${icon('fa-envelope')}</span>`);
    if(c.bgg_username) out.push(`<span class="bggMini" title="BGG">BGG</span>`);
    if(c.discord_username) out.push(`<span title="Discord">${icon('fa-discord')}</span>`);
    return out.join('');
  }

  function renderContactDetail(id) {
    const c = contacts.find(x => +x.id === +id);
    const pane = document.getElementById('modernContactDetail');
    if (!c || !pane) return renderContactEmpty();
    selectedContactId = +id;
    pane.classList.add('open');
    const preferred = c.preferred_contact_method ? cap(c.preferred_contact_method) : 'Not set';
    const profileUrl = bggEntityUrl(c);
    const sourceUrl = c.source_game_id ? `https://boardgamegeek.com/boardgame/${c.source_game_id}` : '';
    pane.innerHTML = `
      <div class="detailHead">
        <button class="mobileDetailClose" id="mobileDetailClose" aria-label="Close">${icon('fa-arrow-left')}</button>
        <div class="avatar lg">${e(initials(c.name))}</div>
        <div class="detailIdentity"><div class="detailNameLine"><h2>${e(c.name)}</h2><span class="replyStatus ${c.heard_back?'yes':'no'}">${c.heard_back?'Replied':'No reply'}</span></div>
          <p>${e(typeLabel(c.bgg_type))}${c.organization ? ` at ${e(c.organization)}` : ''}</p>
          ${c.source_game_name ? `<a class="sourceLink" ${sourceUrl?`href="${sourceUrl}" target="_blank"`:''}>${icon('fa-cube')} ${e(c.source_game_name)}</a>`:''}
        </div>
        <button class="modernButton secondary iconOnly" id="detailEdit" title="Edit contact">${icon('fa-pen')}</button>
      </div>
      <div class="detailActions">
        ${c.email?`<a class="modernButton secondary" href="mailto:${e(c.email)}">${icon('fa-envelope')} Email</a><button class="modernButton secondary" data-copy-email>${icon('fa-copy')} Copy email</button>`:''}
        ${profileUrl?`<a class="modernButton secondary" href="${profileUrl}" target="_blank"><span class="bggMini">BGG</span> Profile</a>`:''}
        ${c.discord_username?`<button class="modernButton secondary" data-copy-discord>${icon('fa-discord')} Copy Discord</button>`:''}
      </div>
      <div class="detailGrid">
        <section class="detailCard"><h3>Contact information</h3><dl>
          <div><dt>Email</dt><dd>${c.email?`<a href="mailto:${e(c.email)}">${e(c.email)}</a>`:'—'}</dd></div>
          <div><dt>BGG username</dt><dd>${e(c.bgg_username||'—')}</dd></div>
          <div><dt>Discord</dt><dd>${e(c.discord_username||'—')}</dd></div>
          <div><dt>Preferred</dt><dd><span class="methodTag">${e(preferred)}</span></dd></div>
          <div><dt>Organization</dt><dd>${e(c.organization||'—')}</dd></div>
          <div><dt>BGG role</dt><dd>${icon(typeIcon(c.bgg_type))} ${e(typeLabel(c.bgg_type))}</dd></div>
        </dl></section>
        <section class="detailCard"><h3>Outreach</h3><dl>
          <div><dt>First contact</dt><dd>${formatDate(c.first_contact_date)}</dd></div>
          <div><dt>Heard back</dt><dd><span class="replyStatus ${c.heard_back?'yes':'no'}">${c.heard_back?'Yes':'No'}</span></dd></div>
          <div><dt>Source game</dt><dd>${c.source_game_name?e(c.source_game_name):'—'}</dd></div>
          <div><dt>Created</dt><dd>${formatDate(c.created_at)}</dd></div>
          <div><dt>Last updated</dt><dd>${formatDate(c.updated_at)}</dd></div>
        </dl></section>
        <section class="detailCard notesCard"><h3>Notes</h3><p>${c.notes?e(c.notes):'<span class="muted">No notes yet.</span>'}</p></section>
      </div>
      <div class="detailQuick"><button class="modernButton ${c.heard_back?'warning':'success'}" id="toggleReply">${icon(c.heard_back?'fa-clock-rotate-left':'fa-circle-check')} ${c.heard_back?'Mark no reply':'Mark replied'}</button><button class="modernButton secondary" id="quickEdit">${icon('fa-pen-to-square')} Edit details</button></div>`;
    document.getElementById('detailEdit').onclick = () => legacyOpenContact(c.id);
    document.getElementById('quickEdit').onclick = () => legacyOpenContact(c.id);
    document.getElementById('mobileDetailClose').onclick = () => pane.classList.remove('open');
    pane.querySelector('[data-copy-email]')?.addEventListener('click',()=>copyText(c.email,'Email'));
    pane.querySelector('[data-copy-discord]')?.addEventListener('click',()=>copyText(c.discord_username,'Discord username'));
    document.getElementById('toggleReply').onclick = async () => {
      try {
        const next = !c.heard_back;
        await dbApi('bg_contact','UPDATE',{filters:{id:c.id},data:{heard_back:next,updated_at:new Date().toISOString()}});
        c.heard_back = next; c.updated_at = new Date().toISOString();
        renderContacts(); renderContactDetail(c.id); toast(next?'Marked as replied':'Marked as no reply');
      } catch(err) { toast(err.message || 'Could not update contact','bad'); }
    };
    document.querySelectorAll('[data-contact-id]').forEach(row=>row.classList.toggle('selected',+row.dataset.contactId===+id));
  }

  renderContacts = function() {
    if (document.getElementById('contactsTabCount')) document.getElementById('contactsTabCount').textContent = contacts.length;
    updateQuickStats();
    const a = filteredContacts();
    const filtered = contactType !== 'any' || contactReply !== 'any' || contactMissing.size || document.getElementById('csearch').value.trim();
    const n = t => a.filter(c=>c.bgg_type===t).length;
    const replied = a.filter(c=>c.heard_back).length;
    document.getElementById('contactCounts').innerHTML = `<span class="count strong">${a.length}${filtered?' / '+contacts.length:''} Contacts</span><span class="count">${replied} Replied</span><span class="count">${a.length-replied} No reply</span><span class="count hideSmall">${n('boardgamepublisher')} Publishers</span><span class="count hideSmall">${n('boardgamedesigner')} Designers</span>`;
    document.getElementById('tableView').classList.toggle('active',contactView==='table');
    document.getElementById('cardView').classList.toggle('active',contactView==='cards');
    const crm = document.getElementById('modernCRM');
    crm?.classList.toggle('tableMode',contactView==='table');
    if(contactView==='table') {
      legacyRenderTable(a);
    } else {
      renderCards(a);
      if (selectedContactId && contacts.some(c=>+c.id===+selectedContactId)) renderContactDetail(selectedContactId);
      else if(a.length) renderContactDetail(a[0].id);
      else renderContactEmpty();
    }
  };

  renderCards = function(a) {
    const list = document.getElementById('clist');
    list.className = 'modernContactList';
    if (!a.length) {
      list.innerHTML = `<div class="emptyState">${icon('fa-magnifying-glass')}<h3>No contacts found</h3><p>Try clearing a filter or searching another name.</p></div>`;
      return;
    }
    list.innerHTML = a.map(c => `<article class="contactRow ${+c.id===+selectedContactId?'selected':''}" data-contact-id="${c.id}" tabindex="0">
      <div class="avatar">${e(initials(c.name))}</div>
      <div class="contactRowMain"><div class="contactRowTop"><strong>${e(c.name)}</strong><span class="replyStatus ${c.heard_back?'yes':'no'}">${c.heard_back?'Replied':'No reply'}</span></div>
        <div class="contactOrg">${e(c.organization || typeLabel(c.bgg_type))}${c.organization?` · ${e(typeLabel(c.bgg_type))}`:''}</div>
        <div class="contactSource">${c.source_game_name?`${icon('fa-cube')} ${e(c.source_game_name)}`:'No source game'}</div>
      </div>
      <div class="contactMethods">${contactMethodIcons(c)}</div>
      <span class="rowChevron">${icon('fa-chevron-right')}</span>
    </article>`).join('');
    list.querySelectorAll('[data-contact-id]').forEach(row => {
      const go = () => renderContactDetail(+row.dataset.contactId);
      row.onclick=go; row.onkeydown=ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();go();}};
    });
  };

  openContact = function(id) { const section=document.getElementById('contacts'); if(section?.classList.contains('hidden')) return legacyOpenContact(id); renderContactDetail(id); };

  render = function() {
    if(document.getElementById('collectionTabCount')) document.getElementById('collectionTabCount').textContent=games.length;
    const q = document.getElementById('search').value.toLowerCase();
    const all = games.filter(g=>sts.every(x=>sf[x]==='any'||sf[x]==='yes'&&!!g.status[x]||sf[x]==='no'&&!g.status[x])&&(!q||[g.title,...people(g).map(x=>x.name)].join(' ').toLowerCase().includes(q)));
    const shown = all.slice(0, collectionRenderLimit);
    const host = document.getElementById('games');
    host.className = 'modernGames';
    host.innerHTML = shown.map(g => {
      const savedPeople = people(g).filter(saved).length;
      return `<article class="modernGameCard" data-g="${g.id}">
        <div class="gameCover">${g.image?`<img loading="lazy" src="${e(g.image)}" alt="">`:`<div class="coverFallback">${icon('fa-dice-d20')}</div>`}<span class="gameYear">${e(g.year||'—')}</span></div>
        <div class="gameCardBody"><div class="gameTitleRow"><h3>${e(g.title)}</h3>${inPipeline(g.id)?`<span class="pipelineBadge">In Games</span>`:''}</div>
          <p><span>Publisher</span>${e(g.publishers[0]?.name||'—')}</p><p><span>Designer</span>${e(g.designers[0]?.name||'—')}</p>
          <div class="gameStats"><span>${icon('fa-star')} ${g.rating?Number(g.rating).toFixed(1):'—'}</span><span>${icon('fa-ranking-star')} ${g.rank&&g.rank!=='Not Ranked'?'#'+e(g.rank):'—'}</span>${savedPeople?`<span class="savedPeople">${icon('fa-address-book')} ${savedPeople} saved</span>`:''}</div>
        </div><button class="gameOpen" aria-label="Open game">${icon('fa-chevron-right')}</button>
      </article>`;
    }).join('') + (all.length>shown.length?`<button id="showMoreGames" class="showMore">Show ${Math.min(120,all.length-shown.length)} more <span>${shown.length} of ${all.length}</span></button>`:'');
    host.querySelectorAll('[data-g]').forEach(x=>x.onclick=()=>openGame(x.dataset.g));
    document.getElementById('showMoreGames')?.addEventListener('click',()=>{collectionRenderLimit+=120;render();});
  };

  load = async function() {
    const host = document.getElementById('games');
    if (host) {
      host.className='modernGames loadingGrid';
      host.innerHTML=Array.from({length:8},()=>`<div class="gameSkeleton"><i></i><div><b></b><span></span><span></span></div></div>`).join('');
    }
    const btn=document.getElementById('load');
    const modern=document.getElementById('modernRefresh');
    if(modern){modern.disabled=true;modern.innerHTML=`${icon('fa-spinner fa-spin')}<span>Refreshing…</span>`;}
    try { await legacyLoad(); toast('BGG collection refreshed'); }
    catch(err) { toast(err.message || 'Refresh failed','bad'); throw err; }
    finally { if(modern){modern.disabled=false;modern.innerHTML=`${icon('fa-arrows-rotate')}<span>Refresh BGG</span>`;} if(btn)btn.disabled=false; }
  };

  function improveFilters() {
    const cs = document.getElementById('csearch');
    const ps = document.getElementById('psearch');
    const gs = document.getElementById('search');
    if(cs) cs.oninput=debounce(()=>renderContacts(),130);
    if(ps) ps.oninput=debounce(()=>renderPipeline(),130);
    if(gs) gs.oninput=debounce(()=>{collectionRenderLimit=120;render();},130);
    const loadBtn=document.getElementById('load'); if(loadBtn) loadBtn.onclick=load;
  }

  function enhanceContactPanel() {
    const panel = document.querySelector('#contacts .panel');
    if(!panel || panel.querySelector('.contactPanelHeading')) return;
    const heading=document.createElement('div'); heading.className='contactPanelHeading';
    heading.innerHTML=`<div><h2>Outreach contacts</h2><p>Publishers, designers and artists connected to your BGG research.</p></div>`;
    panel.prepend(heading);
    const search=document.getElementById('csearch'); if(search){const wrap=document.createElement('div');wrap.className='searchWrap';search.parentNode.insertBefore(wrap,search);wrap.appendChild(search);wrap.insertAdjacentHTML('afterbegin',icon('fa-magnifying-glass'));}
    const psearch=document.getElementById('psearch'); if(psearch){const wrap=document.createElement('div');wrap.className='searchWrap';psearch.parentNode.insertBefore(wrap,psearch);wrap.appendChild(psearch);wrap.insertAdjacentHTML('afterbegin',icon('fa-magnifying-glass'));}
    const searchGame=document.getElementById('search'); if(searchGame){const wrap=document.createElement('div');wrap.className='searchWrap';searchGame.parentNode.insertBefore(wrap,searchGame);wrap.appendChild(searchGame);wrap.insertAdjacentHTML('afterbegin',icon('fa-magnifying-glass'));}
  }

  function styleCollectionPanel() {
    const panel=document.querySelector('#collection .panel'); if(!panel||panel.querySelector('.collectionHeading'))return;
    const h=document.createElement('div'); h.className='collectionHeading';
    h.innerHTML=`<div><h2>BGG collection</h2><p>Search games and jump directly into publisher, designer and artist contacts.</p></div>`;
    panel.prepend(h);
    const loadArea=panel.querySelector('.load'); if(loadArea) loadArea.classList.add('collectionLoad');
  }

  function stylePipelinePanel() {
    const panel=document.querySelector('#pipeline .panel'); if(!panel||panel.querySelector('.pipelineHeading'))return;
    const h=document.createElement('div');h.className='pipelineHeading';h.innerHTML=`<div><h2>BGA game pipeline</h2><p>Move projects from Studio to Premium without changing the underlying workflow.</p></div>`;panel.prepend(h);
  }

  function bindTabUX() {
    document.querySelectorAll('.tabs [data-tab]').forEach(btn=>btn.addEventListener('click',()=>updateTopbar(btn.dataset.tab)));
    document.addEventListener('click',ev=>{
      const close=ev.target.closest('[data-close="contactModal"]');
      if(close && selectedContactId) setTimeout(()=>renderContactDetail(selectedContactId),0);
    });
  }

  function modernizeGate() {
    const gate=document.getElementById('gate'); if(!gate)return;
    const box=gate.querySelector('.box'); if(!box)return;
    box.classList.add('modernGateBox');
    const h=box.querySelector('h2'); if(h)h.innerHTML=`<span class="gateLogo">${icon('fa-flask-vial')}</span> Board Game Lab`;
    const err=document.getElementById('pwerr'); if(err)err.classList.add('gateError');
  }

  function boot() {
    if(!localStorage.getItem('contact_view')) { contactView='cards'; localStorage.setItem('contact_view','cards'); }
    buildShell();
    buildContactsWorkspace();
    enhanceContactPanel();
    styleCollectionPanel();
    stylePipelinePanel();
    improveFilters();
    bindTabUX();
    modernizeGate();
    if (document.getElementById('dashboardApp') && !document.getElementById('dashboardApp').classList.contains('hidden')) {
      render(); renderContacts(); renderPipeline();
    }
    const unlock=document.getElementById('unlock');
    if(unlock) unlock.addEventListener('click',()=>setTimeout(()=>{render();renderContacts();renderPipeline();},50));
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
