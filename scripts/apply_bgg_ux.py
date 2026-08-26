from pathlib import Path
import re, html
TARGET=Path('bgg-contacts.html'); SOURCE=Path('bga.html'); s=TARGET.read_text(); b=SOURCE.read_text()
s=s.replace('.contactTable th,.pipelineTable th{top:49px;z-index:5}', '.contactTable th,.pipelineTable th{top:0;z-index:5}')
if 'data-tab="bga"' not in s:s=s.replace('data-tab="pipeline">Games <span id="gamesTabCount" class="tabCount">—</span></button>','data-tab="pipeline">Games <span id="gamesTabCount" class="tabCount">—</span></button><button class="btn" data-tab="bga">BGA</button>',1)
# Remove the standalone auto-start block before embedding.
b=re.sub(r'//\s*Auto-start loading\s*window\.addEventListener\(\s*[\'\"]load[\'\"]\s*,\s*\(\)\s*=>\s*\{\s*fetchCollection\(\);\s*\}\s*\);?','',b,flags=re.S)
# HARD GUARD: even if bga.html later regains an auto-start or another function calls
# fetchCollection during initialization, API execution is impossible until the user presses Refresh.
# Rename the real function and expose a guarded wrapper under the original name.
b=b.replace('async function fetchCollection() {','async function bgaFetchCollectionReal() {',1)
guard=r'''
<script>
let BGA_MANUAL_API_ALLOWED=false;
async function fetchCollection(){
  if(!BGA_MANUAL_API_ALLOWED){console.info('BGA API blocked: manual Refresh BGA Data required.');return false;}
  return await bgaFetchCollectionReal();
}
</script>
'''
b=b.replace('</head>',guard+'''<style>html,body{background:#07111f!important;color:#f4f7fb!important}body{padding-bottom:24px}.bg-white,.bg-slate-50{background:#0d1929!important}.bg-slate-100{background:#13243a!important}.bg-slate-200{background:#1a304b!important}.text-slate-900,.text-slate-800,.text-slate-700,.text-slate-600{color:#f4f7fb!important}.text-slate-500,.text-slate-400{color:#91a0b5!important}.border-slate-100,.border-slate-200,.border-slate-300{border-color:#29415f!important}input,select{background:#101e30!important;color:#fff!important;border-color:#30445f!important}.game-card{background:#0d1929!important;border-color:#203149!important}header{display:none!important}main{padding-top:12px!important}.bga-manual{background:#0d1929;border:1px solid #29415f;border-radius:12px;padding:12px;margin-bottom:12px}.bga-manual-row{display:flex;gap:10px;align-items:center;justify-content:space-between}.bga-manual-actions{display:flex;gap:8px}.bga-manual button{border:1px solid #3b8cff;border-radius:8px;background:#1677ff;color:#fff;font-weight:700;padding:9px 12px}.bga-manual button.secondary{background:#101e30;border-color:#30445f}.bga-status{color:#91a0b5;font-size:12px}@media(max-width:640px){.bga-manual-row{align-items:stretch;flex-direction:column}.bga-manual-actions{display:grid;grid-template-columns:1fr 1fr}}</style></head>''',1)
manual='''<div class="bga-manual"><div class="bga-manual-row"><div><strong>BGA Games</strong><div id="bgaCacheStatus" class="bga-status">API is idle. Use Load Saved or manually press Refresh BGA Data.</div></div><div class="bga-manual-actions"><button class="secondary" onclick="bgaLoadSaved()">Load Saved</button><button id="bgaRefreshButton" onclick="bgaRefreshManual()">Refresh BGA Data</button></div></div></div>'''
b=re.sub(r'(<main\b[^>]*>)',r'\1'+manual,b,count=1,flags=re.I)
cache_js=r'''<script>
const BGA_IDB_DB='BGGContactFinderBGA',BGA_IDB_STORE='datasets',BGA_IDB_KEY='family-70360-v3';
function bgaDb(){return new Promise((ok,no)=>{const r=indexedDB.open(BGA_IDB_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(BGA_IDB_STORE))r.result.createObjectStore(BGA_IDB_STORE)};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
async function bgaRead(){try{const db=await bgaDb();return await new Promise((ok,no)=>{const tx=db.transaction(BGA_IDB_STORE,'readonly'),r=tx.objectStore(BGA_IDB_STORE).get(BGA_IDB_KEY);r.onsuccess=()=>ok(r.result||null);r.onerror=()=>no(r.error)})}catch(e){return null}}
async function bgaWrite(){const db=await bgaDb();await new Promise((ok,no)=>{const tx=db.transaction(BGA_IDB_STORE,'readwrite');tx.objectStore(BGA_IDB_STORE).put({savedAt:Date.now(),games:allGames,geeklist:[...bgaGeeklistMap.entries()]},BGA_IDB_KEY);tx.oncomplete=ok;tx.onerror=()=>no(tx.error)})}
function bgaRestoreUi(){displayedGames=[...allGames];const gc=document.getElementById('gameCount');if(gc)gc.textContent=allGames.length;document.getElementById('loadingSection')?.classList.add('hidden');document.getElementById('controlsSection')?.classList.remove('hidden');document.getElementById('gamesSection')?.classList.remove('hidden');document.getElementById('statsSection')?.classList.remove('hidden');updateStats();sortGames()}
async function bgaLoadSaved(){const st=document.getElementById('bgaCacheStatus'),d=await bgaRead();if(!d?.games?.length){st.textContent='No saved BGA dataset yet.';return}allGames=d.games;bgaGeeklistMap=new Map(d.geeklist||[]);isLoading=false;bgaRestoreUi();st.textContent=`Loaded ${allGames.length} saved games • ${new Date(d.savedAt).toLocaleString()}`}
async function bgaRefreshManual(){const st=document.getElementById('bgaCacheStatus'),btn=document.getElementById('bgaRefreshButton');btn.disabled=true;btn.textContent='Refreshing…';st.textContent='Fetching BGA/BGG data…';BGA_MANUAL_API_ALLOWED=true;try{await bgaFetchCollectionReal();await bgaWrite();st.textContent=`Loaded ${allGames.length} BGA games • saved in IndexedDB`}catch(e){console.error(e);st.textContent='Refresh failed: '+(e?.message||e)}finally{BGA_MANUAL_API_ALLOWED=false;btn.disabled=false;btn.textContent='Refresh BGA Data'}}
</script>'''
b=b.replace('</body>',cache_js+'</body>',1)
# Assert the original unguarded function no longer exists.
if 'async function fetchCollection() {' in b:raise RuntimeError('Unguarded BGA fetchCollection still exists')
srcdoc=html.escape(b,quote=True); section=f'''<section id="bga" class="hidden"><div class="bgaHost"><iframe id="bgaEmbeddedApp" class="bgaEmbeddedApp" title="BGA Games" loading="lazy" srcdoc="{srcdoc}"></iframe></div></section>'''
if '<section id="bga"' in s:
 start=s.index('<section id="bga"');end=s.find('</main>',start);s=s[:start]+section+s[end:]
else:s=s.replace('</main>',section+'</main>',1)
marker='/* MIGRATED BGA APP */';endmarker='/* END MIGRATED BGA APP */'
while marker in s:
 a=s.index(marker);z=s.find(endmarker,a);s=s[:a]+s[z+len(endmarker):]
s=re.sub(r'/\* BGA tab: complete isolated bga\.html embedded directly in this file \*/.*?(?=</style>)','',s,flags=re.S)
host='''/* BGA tab: complete isolated bga.html embedded directly in this file */.bgaHost{margin-top:10px;border:1px solid #203149;border-radius:14px;overflow:hidden;background:#07111f}.bgaEmbeddedApp{display:block;width:100%;height:calc(100vh - 130px);min-height:720px;border:0;background:#07111f}@media(max-width:800px){.tabs{grid-template-columns:repeat(4,1fr)!important}.bgaHost{margin:0 -10px;border-left:0;border-right:0;border-radius:0}.bgaEmbeddedApp{height:calc(100vh - 92px)}}''';s=s.replace('</style>',host+'</style>',1)
nav="""document.addEventListener('click',ev=>{const b=ev.target.closest('.tabs [data-tab]');if(!b)return;const t=b.dataset.tab;['collection','contacts','pipeline','bga'].forEach(id=>document.getElementById(id)?.classList.toggle('hidden',id!==t));document.querySelectorAll('.tabs [data-tab]').forEach(x=>x.classList.toggle('active',x===b));});"""
if nav not in s:
 body_end=s.lower().rfind('</body>');script_end=s.rfind('</script>',0,body_end);s=s[:script_end]+'\n'+nav+'\n'+s[script_end:]
TARGET.write_text(s)
