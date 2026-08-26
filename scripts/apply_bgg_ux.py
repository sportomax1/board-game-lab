from pathlib import Path
import re

p=Path('bgg-contacts.html')
bga=Path('bga.html')
s=p.read_text()
b=bga.read_text()

s=s.replace('.contactTable th,.pipelineTable th{top:49px;z-index:5}', '.contactTable th,.pipelineTable th{top:0;z-index:5}')

if 'data-tab="bga"' not in s:
    s=s.replace('data-tab="pipeline">Games <span id="gamesTabCount" class="tabCount">—</span></button>', 'data-tab="pipeline">Games <span id="gamesTabCount" class="tabCount">—</span></button><button class="btn" data-tab="bga">BGA</button>', 1)

# bga.html is Tailwind based. Load the same UI dependencies in the combined SPA.
if 'cdn.tailwindcss.com' not in s:
    s=s.replace('<style>', '<script src="https://cdn.tailwindcss.com"></script><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"><style>', 1)

body_match=re.search(r'<body[^>]*>(.*?)</body>',b,re.S|re.I)
body=body_match.group(1) if body_match else b
inline_scripts=re.findall(r'<script(?![^>]*\b(?:src|type)\s*=)[^>]*>(.*?)</script>',body,re.S|re.I)
bga_js='\n'.join(inline_scripts)
bga_ui=re.sub(r'<script\b[^>]*>.*?</script>','',body,flags=re.S|re.I)
bga_ui=re.sub(r'<header\b.*?</header>','',bga_ui,count=1,flags=re.S|re.I)

# Prefix BGA DOM ids so they cannot collide with Collection/Contacts/Games.
id_map={old:'bga_'+old for old in set(re.findall(r'id="([^"]+)"',bga_ui))}
for old,new in sorted(id_map.items(),key=lambda x:-len(x[0])):
    bga_ui=bga_ui.replace(f'id="{old}"',f'id="{new}"')
    bga_js=bga_js.replace(f"getElementById('{old}')",f"getElementById('{new}')")
    bga_js=bga_js.replace(f'getElementById("{old}")',f'getElementById("{new}")')

# IMPORTANT: keep the migrated BGA functions global. bga.html uses inline onclick/onchange
# handlers, so wrapping this code in an IIFE makes those handlers invisible and leaves the
# tab looking blank/non-functional.
section='<section id="bga" class="hidden"><div class="bgaIntegrated">'+bga_ui+'</div></section>'
if '<section id="bga"' in s:
    s=re.sub(r'<section id="bga".*?</section>',section,s,count=1,flags=re.S)
else:
    s=s.replace('</main>',section+'</main>',1)

css='''
/* Integrated BGA dark theme */
.bgaIntegrated{margin-top:10px;color:#f4f7fb}.bgaIntegrated main{max-width:100%!important;padding:0!important}.bgaIntegrated .bg-white,.bgaIntegrated [class*="bg-white/"]{background:#0d1929!important}.bgaIntegrated .bg-slate-50,.bgaIntegrated [class*="bg-slate-50/"]{background:#081524!important}.bgaIntegrated .bg-slate-100{background:#13243a!important}.bgaIntegrated .bg-slate-200{background:#1a304b!important}.bgaIntegrated .text-slate-900,.bgaIntegrated .text-slate-800,.bgaIntegrated .text-slate-700,.bgaIntegrated .text-slate-600{color:#f4f7fb!important}.bgaIntegrated .text-slate-500,.bgaIntegrated .text-slate-400{color:#91a0b5!important}.bgaIntegrated .border,.bgaIntegrated [class*="border-slate-"]{border-color:#29415f!important}.bgaIntegrated input,.bgaIntegrated select{background:#101e30!important;color:#fff!important;border-color:#30445f!important}.bgaIntegrated .bg-blue-600{background:#1677ff!important}.bgaIntegrated .text-blue-600{color:#63a8ff!important}.bgaIntegrated .hover\\:bg-blue-700:hover{background:#0b63d1!important}.bgaIntegrated .game-card{background:#0d1929!important;border-color:#203149!important}.bgaIntegrated .game-card:hover{box-shadow:0 8px 18px #0006!important}.bgaIntegrated [class*="shadow"]{--tw-shadow-color:#000!important}.bgaIntegrated #bga_collectionModal>div:nth-child(2){background:#0d1929!important}.bgaIntegrated .rank-badge{border-color:#315276!important}.bgaIntegrated a{color:#63a8ff}.bgaIntegrated button{touch-action:manipulation}.bgaIntegrated #bga_loadingSection{display:block}.bgaIntegrated #bga_gamesSection.space-y-3>*+*{margin-top:.75rem}@media(max-width:800px){.tabs{grid-template-columns:repeat(4,1fr)!important}.bgaIntegrated{margin:0 -2px}.bgaIntegrated main{padding-bottom:10px!important}}
'''
# Replace old dark-theme block so fixes are repeatable.
s=re.sub(r'/\* Integrated BGA dark theme \*/.*?(?=</style>)',css,s,flags=re.S) if '/* Integrated BGA dark theme */' in s else s.replace('</style>',css+'</style>',1)

marker='/* MIGRATED BGA APP */'
block=marker+'\n'+bga_js+'\n/* END MIGRATED BGA APP */'
if marker in s:
    start=s.index(marker)
    end=s.find('/* END MIGRATED BGA APP */',start)
    if end!=-1:
        end+=len('/* END MIGRATED BGA APP */')
        s=s[:start]+s[end:]
    else:
        s=s[:start]
        if not s.rstrip().endswith('</script>'):
            s=s.rstrip()+'\n</script></body></html>'

body_close=s.lower().rfind('</body>')
pos=s.rfind('</script>',0,body_close if body_close!=-1 else len(s))
if pos==-1:
    raise RuntimeError('Parent closing script not found')
s=s[:pos]+'\n'+block+'\n'+s[pos:]

p.write_text(s)
