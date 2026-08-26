from pathlib import Path
import re

p=Path('bgg-contacts.html')
bga=Path('bga.html')
s=p.read_text()
b=bga.read_text()

s=s.replace('.contactTable th,.pipelineTable th{top:49px;z-index:5}', '.contactTable th,.pipelineTable th{top:0;z-index:5}')

if 'data-tab="bga"' not in s:
    s=s.replace('data-tab="pipeline">Games <span id="gamesTabCount" class="tabCount">—</span></button>', 'data-tab="pipeline">Games <span id="gamesTabCount" class="tabCount">—</span></button><button class="btn" data-tab="bga">BGA</button>', 1)

if 'cdn.tailwindcss.com' not in s:
    s=s.replace('<style>', '<script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><style>', 1)

body_match=re.search(r'<body[^>]*>(.*?)</body>',b,re.S|re.I)
body=body_match.group(1) if body_match else b
inline_scripts=re.findall(r'<script(?![^>]*\b(?:src|type)\s*=)[^>]*>(.*?)</script>',body,re.S|re.I)
bga_js='\n'.join(inline_scripts)
bga_ui=re.sub(r'<script\b[^>]*>.*?</script>','',body,flags=re.S|re.I)
bga_ui=re.sub(r'<header\b.*?</header>','',bga_ui,count=1,flags=re.S|re.I)

id_map={old:'bga_'+old for old in set(re.findall(r'id="([^"]+)"',bga_ui))}
for old,new in sorted(id_map.items(),key=lambda x:-len(x[0])):
    bga_ui=bga_ui.replace(f'id="{old}"',f'id="{new}"')
    bga_js=bga_js.replace(f"getElementById('{old}')",f"getElementById('{new}')")
    bga_js=bga_js.replace(f'getElementById("{old}")',f'getElementById("{new}")')

# Remove standalone auto-start. API work must only happen after explicit user action.
bga_js=re.sub(r'// Auto-start loading\s*window\.addEventListener\([\s\S]*?fetchCollection\(\);\s*\}\);','',bga_js)

# IndexedDB cache for the expensive BGA family + Thing API result.
cache_js=r'''
const BGA_CACHE_DB='bggContactsBgaCache';
const BGA_CACHE_STORE='cache';
const BGA_CACHE_KEY='bga-family-v1';
function bgaOpenDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(BGA_CACHE_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(BGA_CACHE_STORE))r.result.createObjectStore(BGA_CACHE_STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function bgaCacheGet(){try{const db=await bgaOpenDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(BGA_CACHE_STORE,'readonly');const r=tx.objectStore(BGA_CACHE_STORE).get(BGA_CACHE_KEY);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}catch(e){console.warn('BGA IndexedDB read failed',e);return null}}
async function bgaCacheSet(value){try{const db=await bgaOpenDb();await new Promise((resolve,reject)=>{const tx=db.transaction(BGA_CACHE_STORE,'readwrite');tx.objectStore(BGA_CACHE_STORE).put(value,BGA_CACHE_KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch(e){console.warn('BGA IndexedDB save failed',e)}}
function bgaApplyCached(data){if(!data||!Array.isArray(data.games))return false;allGames=data.games;displayedGames=[...allGames];bgaGeeklistMap=new Map(data.geeklist||[]);const count=document.getElementById('bga_gameCount');if(count)count.textContent=allGames.length;document.getElementById('bga_loadingSection')?.classList.add('hidden');document.getElementById('bga_controlsSection')?.classList.remove('hidden');document.getElementById('bga_gamesSection')?.classList.remove('hidden');document.getElementById('bga_statsSection')?.classList.remove('hidden');updateStats();sortGames();return true}
async function bgaLoadSaved(){const data=await bgaCacheGet();if(bgaApplyCached(data)){const st=document.getElementById('bga_manualStatus');if(st)st.textContent=`Loaded ${data.games.length} cached BGA games${data.savedAt?' • '+new Date(data.savedAt).toLocaleString():''}`;return true}return false}
async function bgaGenerate(){const btn=document.getElementById('bga_generateBtn');if(btn){btn.disabled=true;btn.textContent='Loading…'}const st=document.getElementById('bga_manualStatus');if(st)st.textContent='Running BGA/BGG API calls…';try{await fetchCollection();await bgaCacheSet({games:allGames,geeklist:[...bgaGeeklistMap.entries()],savedAt:Date.now()});if(st)st.textContent=`Saved ${allGames.length} BGA games to this device`;}finally{if(btn){btn.disabled=false;btn.textContent='Refresh BGA Data'}}}
'''
bga_js=cache_js+'\n'+bga_js

# Add explicit controls above migrated standalone UI.
manual='''<div class="bgaManual panel"><div class="bgaManualRow"><div><b>BGA Games</b><div id="bga_manualStatus" class="meta">No API calls run automatically. Load saved data or refresh when you choose.</div></div><div class="actions"><button id="bga_loadSavedBtn" class="btn" onclick="bgaLoadSaved()">Load Saved</button><button id="bga_generateBtn" class="btn primary" onclick="bgaGenerate()">Refresh BGA Data</button></div></div></div>'''
section='<section id="bga" class="hidden"><div class="bgaIntegrated">'+manual+bga_ui+'</div></section>'
if '<section id="bga"' in s:
    s=re.sub(r'<section id="bga".*?</section>',section,s,count=1,flags=re.S)
else:
    s=s.replace('</main>',section+'</main>',1)

css='''
/* Integrated BGA dark theme */
.bgaIntegrated{margin-top:10px;color:#f4f7fb}.bgaManual{margin-bottom:10px}.bgaManualRow{display:flex;justify-content:space-between;gap:12px;align-items:center}.bgaIntegrated main{max-width:100%!important;padding:0!important}.bgaIntegrated .bg-white,.bgaIntegrated [class*="bg-white/"]{background:#0d1929!important}.bgaIntegrated .bg-slate-50,.bgaIntegrated [class*="bg-slate-50/"]{background:#081524!important}.bgaIntegrated .bg-slate-100{background:#13243a!important}.bgaIntegrated .bg-slate-200{background:#1a304b!important}.bgaIntegrated .text-slate-900,.bgaIntegrated .text-slate-800,.bgaIntegrated .text-slate-700,.bgaIntegrated .text-slate-600{color:#f4f7fb!important}.bgaIntegrated .text-slate-500,.bgaIntegrated .text-slate-400{color:#91a0b5!important}.bgaIntegrated .border,.bgaIntegrated [class*="border-slate-"]{border-color:#29415f!important}.bgaIntegrated input,.bgaIntegrated select{background:#101e30!important;color:#fff!important;border-color:#30445f!important}.bgaIntegrated .bg-blue-600{background:#1677ff!important}.bgaIntegrated .text-blue-600{color:#63a8ff!important}.bgaIntegrated .hover\\:bg-blue-700:hover{background:#0b63d1!important}.bgaIntegrated .game-card{background:#0d1929!important;border-color:#203149!important}.bgaIntegrated .game-card:hover{box-shadow:0 8px 18px #0006!important}.bgaIntegrated [class*="shadow"]{--tw-shadow-color:#000!important}.bgaIntegrated #bga_collectionModal>div:nth-child(2){background:#0d1929!important}.bgaIntegrated .rank-badge{border-color:#315276!important}.bgaIntegrated a{color:#63a8ff}.bgaIntegrated button{touch-action:manipulation}.bgaIntegrated #bga_loadingSection{display:none!important}.bgaIntegrated #bga_gamesSection.space-y-3>*+*{margin-top:.75rem}@media(max-width:800px){.tabs{grid-template-columns:repeat(4,1fr)!important}.bgaIntegrated{margin:0 -2px}.bgaIntegrated main{padding-bottom:10px!important}.bgaManualRow{align-items:stretch;flex-direction:column}.bgaManualRow .actions{display:grid;grid-template-columns:1fr 1fr}}
'''
s=re.sub(r'/\* Integrated BGA dark theme \*/.*?(?=</style>)',css,s,flags=re.S) if '/* Integrated BGA dark theme */' in s else s.replace('</style>',css+'</style>',1)

marker='/* MIGRATED BGA APP */'
block=marker+'\n'+bga_js+'\n/* END MIGRATED BGA APP */'
if marker in s:
    start=s.index(marker);end=s.find('/* END MIGRATED BGA APP */',start)
    if end!=-1:s=s[:start]+s[end+len('/* END MIGRATED BGA APP */'):]
    else:
        s=s[:start]
        if not s.rstrip().endswith('</script>'):s=s.rstrip()+'\n</script></body></html>'
body_close=s.lower().rfind('</body>');pos=s.rfind('</script>',0,body_close if body_close!=-1 else len(s))
if pos==-1:raise RuntimeError('Parent closing script not found')
s=s[:pos]+'\n'+block+'\n'+s[pos:]
p.write_text(s)
