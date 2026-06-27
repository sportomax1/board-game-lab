let games=[];
let prices={};
let sortKey='name';
let sortDir=1;
const $=id=>document.getElementById(id);
const status=s=>$('status').textContent=s||'';
const money=(n,c='USD')=>n==null?'':new Intl.NumberFormat('en-US',{style:'currency',currency:c}).format(n);
const esc=s=>String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function text(n,t){return n.querySelector(t)?.textContent?.trim()||'';}
function parseCollection(xml){
  const doc=new DOMParser().parseFromString(xml,'text/xml');
  return [...doc.querySelectorAll('item')].map(i=>({
    id:i.getAttribute('objectid'),
    name:text(i,'name'),
    year:text(i,'yearpublished'),
    thumb:text(i,'thumbnail'),
    average:Number(i.querySelector('average')?.getAttribute('value'))||null,
    plays:Number(text(i,'numplays'))||0
  }));
}
function activeStatuses(){return [...document.querySelectorAll('.checks input:checked')].map(x=>x.value);}
async function loadCollection(){
  status('Loading collection...');
  const params=new URLSearchParams({endpoint:'collection',username:$('user').value||'sportomax',stats:'1'});
  activeStatuses().forEach(s=>params.set(s,'1'));
  const res=await fetch('/api/bgg-helper.js?'+params.toString());
  const txt=await res.text();
  if(!res.ok) throw new Error(txt.slice(0,200));
  games=parseCollection(txt).sort((a,b)=>a.name.localeCompare(b.name));
  prices={};
  status('Loaded '+games.length+' games');
  render();
}
async function priceOne(id){
  const res=await fetch('/api/bgg-prices.js?objectid='+encodeURIComponent(id));
  const json=await res.json();
  if(!res.ok) throw new Error(json.error||'Price lookup failed');
  prices[id]=json;
  render();
}
function metric(g){
  const p=prices[g.id]||{};
  if(sortKey==='best') return p.bestOverall?.price??999999;
  if(sortKey==='amazon') return p.amazon?.price??999999;
  if(sortKey==='vendors') return p.vendors?.min??999999;
  if(sortKey==='ebay') return p.ebay?.min??999999;
  if(sortKey==='geekmarket') return p.geekmarket?.min??999999;
  return g[sortKey]??'';
}
function filtered(){
  const q=$('q').value.toLowerCase();
  const max=Number($('max').value);
  return games.filter(g=>g.name.toLowerCase().includes(q))
    .filter(g=>!max||(((prices[g.id]||{}).bestOverall||{}).price||999999)<=max)
    .sort((a,b)=>{const av=metric(a),bv=metric(b);return(av>bv?1:av<bv?-1:0)*sortDir;});
}
function summary(s){
  if(!s) return '';
  return '<b>'+money(s.min,s.currency)+'</b><div class="muted">'+money(s.avg,s.currency)+' / '+money(s.max,s.currency)+' · '+(s.count||0)+' rows</div>';
}
function render(){
  const rows=filtered();
  $('count').textContent='Showing '+rows.length+' of '+games.length+' games. Priced '+Object.keys(prices).length+'.';
  $('body').innerHTML=rows.map(g=>{
    const p=prices[g.id]||{};
    const best=p.bestOverall;
    return '<tr>'+
      '<td><div class="game">'+(g.thumb?'<img src="'+esc(g.thumb)+'">':'')+'<div><a target="_blank" href="https://boardgamegeek.com/boardgame/'+g.id+'">'+esc(g.name)+'</a><div class="muted">'+esc(g.year)+' #'+g.id+'</div></div></div></td>'+
      '<td>'+(g.average?g.average.toFixed(1):'')+'</td>'+
      '<td>'+g.plays+'</td>'+
      '<td class="good">'+(best?'<a target="_blank" href="'+esc(best.url)+'">'+money(best.price,best.currency)+'</a><div class="muted">'+esc(best.source)+' · '+esc(best.label||'')+'</div>':'')+'</td>'+
      '<td>'+(p.amazon?'<a target="_blank" href="'+esc(p.amazon.url)+'">'+money(p.amazon.price,p.amazon.currency)+'</a>':'')+'</td>'+
      '<td>'+summary(p.vendors)+'</td>'+
      '<td>'+summary(p.ebay)+'</td>'+
      '<td>'+summary(p.geekmarket)+'</td>'+
      '<td><button data-id="'+g.id+'">Price</button></td>'+
    '</tr>';
  }).join('');
  document.querySelectorAll('button[data-id]').forEach(b=>b.onclick=()=>priceOne(b.dataset.id).catch(e=>status('ERROR '+e.message)));
}
async function priceVisible(){
  const rows=filtered();
  for(let i=0;i<rows.length;i++){
    status('Pricing '+(i+1)+'/'+rows.length+' '+rows[i].name);
    await priceOne(rows[i].id);
    await new Promise(r=>setTimeout(r,150));
  }
  status('Done');
}
document.querySelectorAll('th[data-s]').forEach(th=>th.onclick=()=>{if(sortKey===th.dataset.s)sortDir*=-1;else{sortKey=th.dataset.s;sortDir=1;}render();});
$('load').onclick=()=>loadCollection().catch(e=>status('ERROR '+e.message));
$('price').onclick=()=>priceVisible().catch(e=>status('ERROR '+e.message));
$('clear').onclick=()=>{prices={};render();status('Prices cleared');};
$('q').oninput=render;
$('max').oninput=render;
loadCollection().catch(e=>status('ERROR '+e.message));
