from pathlib import Path
import re

p = Path('bgg-contacts.html')
bga_path = Path('bga.html')
s = p.read_text()
b = bga_path.read_text()

# Keep existing responsive table correction.
s = s.replace('.contactTable th,.pipelineTable th{top:49px;z-index:5}', '.contactTable th,.pipelineTable th{top:0;z-index:5}')

# Ensure fourth tab exists.
if 'data-tab="bga"' not in s:
    s = s.replace(
        'data-tab="pipeline">Games <span id="gamesTabCount" class="tabCount">—</span></button>',
        'data-tab="pipeline">Games <span id="gamesTabCount" class="tabCount">—</span></button><button class="btn" data-tab="bga">BGA</button>',
        1,
    )

# bga.html uses Tailwind + Font Awesome. Load them once in the parent page.
if 'cdn.tailwindcss.com' not in s:
    s = s.replace('<style>', '<script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><style>', 1)

# Read the COMPLETE standalone BGA body. Do NOT rename its IDs. The old namespace
# transformation was the source of the null DOM references. The BGA IDs are already
# distinct from the Contact Finder IDs.
body_match = re.search(r'<body[^>]*>(.*?)</body>', b, re.S | re.I)
body = body_match.group(1) if body_match else b
script_matches = re.findall(r'<script(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>', body, re.S | re.I)
bga_js = '\n'.join(script_matches)
bga_ui = re.sub(r'<script\b[^>]*>.*?</script>', '', body, flags=re.S | re.I)
bga_ui = re.sub(r'<header\b.*?</header>', '', bga_ui, count=1, flags=re.S | re.I)

# Remove standalone automatic API load. BGA only refreshes on explicit button click.
bga_js = re.sub(
    r'// Auto-start loading\s*window\.addEventListener\(\s*[\'\"]load[\'\"]\s*,\s*\(\)\s*=>\s*\{\s*fetchCollection\(\);\s*\}\s*\);?',
    '', bga_js, flags=re.S,
)

# IndexedDB cache for BGA family/thing/geeklist results. It restores only when the user
# presses Load Saved; opening the page or tab never calls BGG.
cache_js = r'''
const BGA_CACHE_DB='BGGContactFinderBGA';
const BGA_CACHE_STORE='datasets';
const BGA_CACHE_KEY='family-70360-v2';
function bgaDbOpen(){return new Promise((resolve,reject)=>{const r=indexedDB.open(BGA_CACHE_DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(BGA_CACHE_STORE))r.result.createObjectStore(BGA_CACHE_STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function bgaCacheRead(){try{const db=await bgaDbOpen();return await new Promise((resolve,reject)=>{const tx=db.transaction(BGA_CACHE_STORE,'readonly');const r=tx.objectStore(BGA_CACHE_STORE).get(BGA_CACHE_KEY);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error)})}catch(e){console.warn('BGA cache read failed',e);return null}}
async function bgaCacheWrite(){try{const db=await bgaDbOpen();await new Promise((resolve,reject)=>{const tx=db.transaction(BGA_CACHE_STORE,'readwrite');tx.objectStore(BGA_CACHE_STORE).put({savedAt:Date.now(),games:allGames,geeklist:[...bgaGeeklistMap.entries()]},BGA_CACHE_KEY);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});return true}catch(e){console.warn('BGA cache write failed',e);return false}}
function bgaShowDataset(){displayedGames=[...allGames];document.getElementById('gameCount').textContent=allGames.length;document.getElementById('loadingSection')?.classList.add('hidden');document.getElementById('controlsSection')?.classList.remove('hidden');document.getElementById('gamesSection')?.classList.remove('hidden');document.getElementById('statsSection')?.classList.remove('hidden');updateStats();sortGames()}
async function bgaLoadSaved(){const status=document.getElementById('bgaManualStatus');const data=await bgaCacheRead();if(!data?.games?.length){status.textContent='No saved BGA data yet. Press Refresh BGA Data.';return}allGames=data.games;bgaGeeklistMap=new Map(data.geeklist||[]);isLoading=false;bgaShowDataset();status.textContent=`Loaded ${allGames.length} saved BGA games • ${new Date(data.savedAt).toLocaleString()}`}
async function bgaRefresh(){const btn=document.getElementById('bgaRefreshBtn'),status=document.getElementById('bgaManualStatus');btn.disabled=true;btn.textContent='Refreshing…';status.textContent='Fetching BGA family and game details…';try{await fetchCollection();const ok=await bgaCacheWrite();status.textContent=`${allGames.length} BGA games loaded${ok?' and saved to this device':''}`}catch(e){console.error(e);status.textContent='BGA refresh failed: '+(e?.message||e)}finally{btn.disabled=false;btn.textContent='Refresh BGA Data'}}
'''

manual = '''<div class="bgaManual panel"><div class="bgaManualRow"><div><b>BGA Games</b><div id="bgaManualStatus" class="meta">No API calls run automatically. Load the last saved dataset or refresh manually.</div></div><div class="actions"><button class="btn" onclick="bgaLoadSaved()">Load Saved</button><button id="bgaRefreshBtn" class="btn primary" onclick="bgaRefresh()">Refresh BGA Data</button></div></div></div>'''
section = '<section id="bga" class="hidden"><div class="bgaIntegrated">' + manual + bga_ui + '</div></section>'

# Replace existing integrated BGA section wholesale.
if '<section id="bga"' in s:
    s = re.sub(r'<section id="bga".*?</section>', section, s, count=1, flags=re.S)
else:
    s = s.replace('</main>', section + '</main>', 1)

css = r'''
/* Integrated BGA dark theme */
.bgaIntegrated{display:block!important;margin-top:10px;color:#f4f7fb;min-height:280px}.bgaManual{display:block!important;margin-bottom:12px}.bgaManualRow{display:flex;justify-content:space-between;align-items:center;gap:12px}.bgaIntegrated main{display:block!important;max-width:100%!important;padding:0!important}.bgaIntegrated .bg-white,.bgaIntegrated [class*="bg-white/"]{background:#0d1929!important}.bgaIntegrated .bg-slate-50,.bgaIntegrated [class*="bg-slate-50/"]{background:#081524!important}.bgaIntegrated .bg-slate-100{background:#13243a!important}.bgaIntegrated .bg-slate-200{background:#1a304b!important}.bgaIntegrated .text-slate-900,.bgaIntegrated .text-slate-800,.bgaIntegrated .text-slate-700,.bgaIntegrated .text-slate-600{color:#f4f7fb!important}.bgaIntegrated .text-slate-500,.bgaIntegrated .text-slate-400{color:#91a0b5!important}.bgaIntegrated .border,.bgaIntegrated [class*="border-slate-"]{border-color:#29415f!important}.bgaIntegrated input,.bgaIntegrated select{background:#101e30!important;color:#fff!important;border-color:#30445f!important}.bgaIntegrated .bg-blue-600{background:#1677ff!important}.bgaIntegrated .text-blue-600{color:#63a8ff!important}.bgaIntegrated .game-card{background:#0d1929!important;border-color:#203149!important}.bgaIntegrated .game-card:hover{box-shadow:0 8px 18px #0006!important}.bgaIntegrated #collectionModal>div:nth-child(2){background:#0d1929!important}.bgaIntegrated a{color:#63a8ff}.bgaIntegrated #loadingSection{display:none!important}@media(max-width:800px){.tabs{grid-template-columns:repeat(4,1fr)!important}.bgaManualRow{align-items:stretch;flex-direction:column}.bgaManualRow .actions{display:grid;grid-template-columns:1fr 1fr}}
'''
if '/* Integrated BGA dark theme */' in s:
    s = re.sub(r'/\* Integrated BGA dark theme \*/.*?(?=</style>)', css, s, flags=re.S)
else:
    s = s.replace('</style>', css + '</style>', 1)

# Remove prior migrated BGA JS block, then inject a clean copy of the COMPLETE source JS.
marker = '/* MIGRATED BGA APP */'
end_marker = '/* END MIGRATED BGA APP */'
if marker in s:
    start = s.index(marker)
    end = s.find(end_marker, start)
    if end != -1:
        s = s[:start] + s[end + len(end_marker):]
    else:
        raise RuntimeError('Malformed previous BGA migration block')

# Parent tab handler originally only handled three sections. This explicit fourth-tab handler
# guarantees the BGA section is visible without triggering API calls.
tab_js = r'''
document.addEventListener('click',ev=>{const btn=ev.target.closest('.tabs [data-tab]');if(!btn)return;const tab=btn.dataset.tab;['collection','contacts','pipeline','bga'].forEach(id=>document.getElementById(id)?.classList.toggle('hidden',id!==tab));document.querySelectorAll('.tabs [data-tab]').forEach(x=>x.classList.toggle('active',x===btn));});
'''
block = marker + '\n' + cache_js + '\n' + bga_js + '\n' + tab_js + '\n' + end_marker
body_close = s.lower().rfind('</body>')
pos = s.rfind('</script>', 0, body_close if body_close != -1 else len(s))
if pos == -1:
    raise RuntimeError('Parent closing script not found')
s = s[:pos] + '\n' + block + '\n' + s[pos:]

p.write_text(s)
