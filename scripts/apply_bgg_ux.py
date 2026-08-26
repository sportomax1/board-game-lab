from pathlib import Path
import re

p=Path('bgg-contacts.html')
bga=Path('bga.html')
s=p.read_text()
b=bga.read_text()

# Preserve prior sticky header correction.
s=s.replace('.contactTable th,.pipelineTable th{top:49px;z-index:5}', '.contactTable th,.pipelineTable th{top:0;z-index:5}')

# Ensure BGA nav tab exists.
if 'data-tab="bga"' not in s:
    s=s.replace('data-tab="pipeline">Games <span id="gamesTabCount" class="tabCount">—</span></button>', 'data-tab="pipeline">Games <span id="gamesTabCount" class="tabCount">—</span></button><button class="btn" data-tab="bga">BGA</button>', 1)

# Pull the actual standalone BGA body UI and script into this SPA instead of iframe embedding.
body=re.search(r'<body[^>]*>(.*)</body>',b,re.S).group(1)
script_match=re.search(r'<script>(.*)</script>\s*$',body,re.S)
bga_js=script_match.group(1) if script_match else ''
bga_ui=body[:script_match.start()] if script_match else body

# Remove standalone header because the parent app already has navigation/title.
bga_ui=re.sub(r'<header\b.*?</header>','',bga_ui,count=1,flags=re.S)
# Prefix IDs to avoid collisions with the Collection/Contacts/Games SPA.
id_map={}
for old in set(re.findall(r'id="([^"]+)"',bga_ui)):
    id_map[old]='bga_'+old
for old,new in sorted(id_map.items(),key=lambda x:-len(x[0])):
    bga_ui=bga_ui.replace(f'id="{old}"',f'id="{new}"')
    bga_js=bga_js.replace(f"getElementById('{old}')",f"getElementById('{new}')")
    bga_js=bga_js.replace(f'getElementById("{old}")',f'getElementById("{new}")')

# Namespace globally-declared BGA functions/variables by running them in an isolated closure.
bga_js='(()=>{\n'+bga_js+'\n})();'

# Replace old iframe shell with real migrated content.
section='<section id="bga" class="hidden"><div class="bgaIntegrated">'+bga_ui+'</div></section>'
if '<section id="bga"' in s:
    s=re.sub(r'<section id="bga".*?</section>',section,s,count=1,flags=re.S)
else:
    s=s.replace('</main>',section+'</main>',1)

# Dark-theme translation for the migrated Tailwind-based BGA UI. !important is deliberate
# because bga.html uses utility classes designed for its old light standalone page.
css='''
/* Integrated BGA dark theme */
.bgaIntegrated{margin-top:10px;color:#f4f7fb}.bgaIntegrated main{max-width:100%!important;padding:0!important}.bgaIntegrated .bg-white,.bgaIntegrated [class*="bg-white/"]{background:#0d1929!important}.bgaIntegrated .bg-slate-50,.bgaIntegrated [class*="bg-slate-50/"]{background:#081524!important}.bgaIntegrated .bg-slate-100{background:#13243a!important}.bgaIntegrated .bg-slate-200{background:#1a304b!important}.bgaIntegrated .text-slate-900,.bgaIntegrated .text-slate-800,.bgaIntegrated .text-slate-700,.bgaIntegrated .text-slate-600{color:#f4f7fb!important}.bgaIntegrated .text-slate-500,.bgaIntegrated .text-slate-400{color:#91a0b5!important}.bgaIntegrated .border,.bgaIntegrated [class*="border-slate-"]{border-color:#29415f!important}.bgaIntegrated input,.bgaIntegrated select{background:#101e30!important;color:#fff!important;border-color:#30445f!important}.bgaIntegrated .bg-blue-600{background:#1677ff!important}.bgaIntegrated .text-blue-600{color:#63a8ff!important}.bgaIntegrated .hover\\:bg-blue-700:hover{background:#0b63d1!important}.bgaIntegrated .game-card{background:#0d1929!important;border-color:#203149!important}.bgaIntegrated .game-card:hover{box-shadow:0 8px 18px #0006!important}.bgaIntegrated [class*="shadow"]{--tw-shadow-color:#000!important}.bgaIntegrated #bga_collectionModal>div:nth-child(2){background:#0d1929!important}.bgaIntegrated .rank-badge{border-color:#315276!important}.bgaIntegrated a{color:#63a8ff}.bgaIntegrated button{touch-action:manipulation}@media(max-width:800px){.tabs{grid-template-columns:repeat(4,1fr)!important}.bgaIntegrated{margin:0 -2px}.bgaIntegrated main{padding-bottom:10px!important}}
'''
if '/* Integrated BGA dark theme */' not in s:
    s=s.replace('</style>',css+'</style>',1)

# Inject migrated BGA behavior before the parent's closing script. The BGA code continues
# using the same /api/bgg-helper proxy as the standalone implementation.
marker='/* MIGRATED BGA APP */'
if marker in s:
    s=re.sub(r'/\* MIGRATED BGA APP \*/.*?/\* END MIGRATED BGA APP \*/',marker+'\n'+bga_js+'\n/* END MIGRATED BGA APP */',s,flags=re.S)
else:
    pos=s.rfind('</script>')
    s=s[:pos]+'\n'+marker+'\n'+bga_js+'\n/* END MIGRATED BGA APP */\n'+s[pos:]

p.write_text(s)
