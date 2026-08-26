from pathlib import Path
p=Path('bgg-contacts.html')
s=p.read_text()
changed=False

# Keep sticky table headers inside their scroll containers.
fixed=s.replace('.contactTable th,.pipelineTable th{top:49px;z-index:5}', '.contactTable th,.pipelineTable th{top:0;z-index:5}')
if fixed != s:
    s=fixed; changed=True

# Add integrated BGA tab. The existing bga.html app is embedded so its full BGA
# family/geeklist/collection functionality stays in one maintained implementation.
if 'data-tab="bga"' not in s:
    s=s.replace('data-tab="pipeline">Games <span id="gamesTabCount" class="tabCount">—</span></button>', 'data-tab="pipeline">Games <span id="gamesTabCount" class="tabCount">—</span></button><button class="btn" data-tab="bga">BGA</button>', 1)
    s=s.replace('</section></main><div id="gameModal"', '</section><section id="bga" class="hidden"><div class="bgaShell"><div class="bgaShellHead"><div><b>Board Game Arena</b><span>BGA collection browser</span></div><a class="btn bgaOpen" href="bga.html" target="_blank">Open Full Page ↗</a></div><iframe id="bgaFrame" class="bgaFrame" src="bga.html" title="Board Game Arena browser"></iframe></div></section></main><div id="gameModal"', 1)
    # Existing tab handler already handles arbitrary section IDs from data-tab.
    s=s.replace('</style>', '.bgaShell{margin-top:10px;background:#081524;border:1px solid #203149;border-radius:14px;overflow:hidden}.bgaShellHead{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;background:#0d1929;border-bottom:1px solid #203149}.bgaShellHead b{display:block;font-size:15px}.bgaShellHead span{display:block;margin-top:2px;color:#91a0b5;font-size:10px}.bgaOpen{font-size:10px;padding:6px 8px;text-decoration:none}.bgaFrame{display:block;width:100%;height:calc(100vh - 150px);min-height:650px;border:0;background:#07111f;color-scheme:dark}@media(max-width:800px){.tabs{grid-template-columns:repeat(4,1fr)!important}.bgaShell{margin:0 -10px;border-left:0;border-right:0;border-radius:0}.bgaShellHead{padding:8px 10px}.bgaFrame{height:calc(100vh - 125px);min-height:600px}}\n</style>',1)
    changed=True

if changed:
    p.write_text(s)
