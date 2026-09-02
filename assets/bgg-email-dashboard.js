(() => {
  'use strict';
  const TABLE='bga_emails';
  let emails=[], loaded=false, selected=null, direction='all', query='';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=n=>`<i class="fa-solid ${n}" aria-hidden="true"></i>`;
  const when=r=>r.received_at||r.sent_at||r.created_at||r.imported_at;
  const fmt=v=>{if(!v)return '—';const d=new Date(v);return Number.isNaN(+d)?esc(v):d.toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});};
  const age=v=>{if(!v)return '—';const n=Math.max(0,Math.floor((Date.now()-new Date(v))/86400000));return n===0?'Today':n===1?'1 day ago':`${n} days ago`;};
  const addr=v=>Array.isArray(v)?v.map(x=>typeof x==='string'?x:(x.address||x.email||x.name||'')).filter(Boolean).join(', '):String(v||'');
  const sender=r=>r.from_email||r.sender_email||r.from_address||r.from||'';
  const recipients=r=>addr(r.to_emails||r.to_recipients||r.to_email||r.to||'');
  const dir=r=>String(r.direction||'').toLowerCase() || (sender(r).toLowerCase().includes('keegank@hotmail.com')?'sent':'received');
  const body=r=>r.body||r.body_text||r.body_html||'';
  async function api(){const res=await fetch('/api/supabase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'READ',table:TABLE,limit:5000,offset:0})});const j=await res.json();if(!res.ok||!j.ok)throw new Error(j.error||'Could not load email data');return j.rows||[];}
  function inject(){
    const app=document.getElementById('dashboardApp'), tabs=app?.querySelector(':scope > .tabs, .modernSide .tabs'); if(!app||!tabs||document.getElementById('email'))return;
    const b=document.createElement('button');b.className='btn';b.dataset.tab='email';b.innerHTML=`<span class="navIcon">${icon('fa-envelope')}</span><span class="navText">Email</span><span id="emailTabCount" class="tabCount">—</span>`;tabs.appendChild(b);
    const s=document.createElement('section');s.id='email';s.className='hidden emailWorkspace';s.innerHTML=`<div id="emailDashboard"><div class="emailLoading">${icon('fa-spinner fa-spin')} Loading email archive…</div></div>`;
    const scroll=document.querySelector('.modernScroll');(scroll||app).appendChild(s);
  }
  function activate(){
    ['collection','contacts','pipeline','bga','email'].forEach(id=>document.getElementById(id)?.classList.toggle('hidden',id!=='email'));
    document.querySelectorAll('.tabs [data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab==='email'));
    const t=document.getElementById('modernPageTitle'),sub=document.getElementById('modernPageSubtitle');if(t)t.textContent='Email';if(sub)sub.textContent='Review BGA correspondence, communication volume, contacts and follow-up timing.';
    document.body.dataset.activeTab='email'; if(!loaded)load();
  }
  function deactivate(){
    const s=document.getElementById('email');
    if(s)s.classList.add('hidden');
  }
  async function load(){const host=document.getElementById('emailDashboard');try{emails=await api();emails.sort((a,b)=>new Date(when(b)||0)-new Date(when(a)||0));loaded=true;document.getElementById('emailTabCount').textContent=emails.length;render();}catch(e){host.innerHTML=`<div class="emailError"><strong>Email data unavailable</strong><span>${esc(e.message)}</span><button class="modernButton secondary" id="emailRetry">Retry</button></div>`;document.getElementById('emailRetry').onclick=load;}}
  function filtered(){const q=query.trim().toLowerCase();return emails.filter(r=>(direction==='all'||dir(r)===direction)&&(!q||[r.subject,sender(r),recipients(r),body(r)].some(v=>String(v||'').toLowerCase().includes(q))));}
  function stats(){const incoming=emails.filter(r=>dir(r)==='received'),outgoing=emails.filter(r=>dir(r)==='sent');const people=new Set(emails.flatMap(r=>[sender(r),...recipients(r).split(',')]).map(x=>x.trim().toLowerCase()).filter(x=>x&&!x.includes('keegank@hotmail.com')));const latest=emails[0]&&when(emails[0]);return {incoming:incoming.length,outgoing:outgoing.length,people:people.size,latest};}
  function render(){const host=document.getElementById('emailDashboard'),s=stats(),rows=filtered();host.innerHTML=`
    <div class="emailStats">
      <div><span>Total messages</span><strong>${emails.length}</strong><small>Archived BGA correspondence</small></div>
      <div><span>Received</span><strong>${s.incoming}</strong><small>${emails.length?Math.round(s.incoming/emails.length*100):0}% of communication</small></div>
      <div><span>Sent</span><strong>${s.outgoing}</strong><small>${emails.length?Math.round(s.outgoing/emails.length*100):0}% of communication</small></div>
      <div><span>People</span><strong>${s.people}</strong><small>Unique external addresses</small></div>
      <div><span>Latest activity</span><strong class="emailStatDate">${age(s.latest)}</strong><small>${fmt(s.latest)}</small></div>
    </div>
    <div class="emailAnalytics">
      <section class="emailPanel"><div class="emailPanelHead"><div><h3>Communication flow</h3><p>Sent versus received volume</p></div></div><div class="emailBars">${bar('Received',s.incoming,emails.length,'in')}${bar('Sent',s.outgoing,emails.length,'out')}</div></section>
      <section class="emailPanel"><div class="emailPanelHead"><div><h3>Top correspondents</h3><p>Most active external email addresses</p></div></div><div class="emailPeople">${topPeople().map((x,i)=>`<div><span><b>${i+1}</b>${esc(x[0])}</span><strong>${x[1]}</strong></div>`).join('')||'<span class="muted">No correspondence yet.</span>'}</div></section>
    </div>
    <div class="emailToolbar"><div class="emailSearch">${icon('fa-magnifying-glass')}<input id="emailSearch" value="${esc(query)}" placeholder="Search subject, sender, recipient or body"></div><div class="emailFilters"><button data-dir="all">All</button><button data-dir="received">Received</button><button data-dir="sent">Sent</button></div><span class="emailResultCount">${rows.length} message${rows.length===1?'':'s'}</span></div>
    <div class="emailSplit"><div class="emailList">${rows.map(row).join('')||'<div class="emailEmpty">No messages match these filters.</div>'}</div><aside id="emailDetail" class="emailDetail">${selected?detail(selected):emptyDetail()}</aside></div>`;
    host.querySelectorAll('[data-dir]').forEach(b=>{b.classList.toggle('active',b.dataset.dir===direction);b.onclick=()=>{direction=b.dataset.dir;render();};});
    document.getElementById('emailSearch').oninput=e=>{query=e.target.value;clearTimeout(window.__emailSearchT);window.__emailSearchT=setTimeout(render,140);};
    host.querySelectorAll('[data-email-id]').forEach(el=>el.onclick=()=>{selected=emails.find(x=>String(x.id||x.outlook_message_id||x.message_id)===el.dataset.emailId);render();});
  }
  function bar(label,n,total,cls){const pct=total?Math.round(n/total*100):0;return `<div class="emailBarRow"><div><span>${label}</span><strong>${n}</strong></div><div class="emailBarTrack"><i class="${cls}" style="width:${pct}%"></i></div><small>${pct}%</small></div>`;}
  function topPeople(){const m=new Map();emails.forEach(r=>{const all=[sender(r),...recipients(r).split(',')];all.forEach(v=>{const x=v.trim().toLowerCase();if(x&&!x.includes('keegank@hotmail.com'))m.set(x,(m.get(x)||0)+1);});});return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);}
  function row(r){const id=String(r.id||r.outlook_message_id||r.message_id||Math.random()),d=dir(r),other=d==='sent'?recipients(r):sender(r);return `<article class="emailRow ${selected&&String(selected.id||selected.outlook_message_id||selected.message_id)===id?'selected':''}" data-email-id="${esc(id)}"><div class="emailDirection ${d}">${icon(d==='sent'?'fa-arrow-up-right-from-square':'fa-arrow-down')}</div><div class="emailRowMain"><div class="emailRowTop"><strong>${esc(other||'Unknown')}</strong><time>${fmt(when(r))}</time></div><h4>${esc(r.subject||'(No subject)')}</h4><p>${esc(String(body(r)).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,180)||'No body available')}</p></div></article>`;}
  function emptyDetail(){return `<div class="emailDetailEmpty">${icon('fa-envelope-open-text')}<h3>Select a message</h3><p>Open an email to inspect its sender, recipients, timestamp and full archived body.</p></div>`;}
  function detail(r){const d=dir(r);return `<div class="emailDetailHead"><span class="emailDirection ${d}">${icon(d==='sent'?'fa-arrow-up-right-from-square':'fa-arrow-down')}</span><div><span>${d==='sent'?'Sent':'Received'} · ${fmt(when(r))}</span><h2>${esc(r.subject||'(No subject)')}</h2></div></div><dl class="emailMeta"><div><dt>From</dt><dd>${esc(sender(r)||'—')}</dd></div><div><dt>To</dt><dd>${esc(recipients(r)||'—')}</dd></div>${r.cc_emails||r.cc_recipients?`<div><dt>CC</dt><dd>${esc(addr(r.cc_emails||r.cc_recipients))}</dd></div>`:''}<div><dt>Activity</dt><dd>${age(when(r))}</dd></div></dl><div class="emailBody">${renderBody(r)}</div>`;}
  function renderBody(r){const raw=String(body(r)||'');if(!raw)return '<span class="muted">No archived body available.</span>';return `<pre>${esc(raw.replace(/<br\s*\/?>/gi,'\n').replace(/<\/p>/gi,'\n\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' '))}</pre>`;}
  function boot(){
    inject();
    document.addEventListener('click',e=>{
      const b=e.target.closest('.tabs [data-tab]');
      if(!b)return;
      if(b.dataset.tab==='email') activate();
      else deactivate();
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,0));else setTimeout(boot,0);
})();