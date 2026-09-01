from pathlib import Path

js_path = Path('assets/bgg-contacts-modern.js')
css_path = Path('assets/bgg-contacts-modern.css')
js = js_path.read_text(encoding='utf-8')
css = css_path.read_text(encoding='utf-8')

replacements = [
    (
        'function icon(name) { return `<i class="fa-solid ${name}" aria-hidden="true"></i>`; }',
        'function icon(name) { const family = name === \'fa-discord\' ? \'fa-brands\' : \'fa-solid\'; return `<i class="${family} ${name}" aria-hidden="true"></i>`; }'
    ),
    (
        '  openContact = function(id) { renderContactDetail(id); };',
        "  openContact = function(id) { const section=document.getElementById('contacts'); if(section?.classList.contains('hidden')) return legacyOpenContact(id); renderContactDetail(id); };"
    ),
    (
        '  function boot() {\n    buildShell();',
        "  function boot() {\n    if(!localStorage.getItem('contact_view')) { contactView='cards'; localStorage.setItem('contact_view','cards'); }\n    buildShell();"
    ),
]
for old, new in replacements:
    if old not in js and new not in js:
        raise SystemExit(f'Missing expected JS pattern: {old[:80]}')
    js = js.replace(old, new, 1)

old_css = '.modernSide .tabs .btn{width:100%;height:42px;'
new_css = '.modernSide .tabs .btn{position:relative;width:100%;height:42px;'
if old_css in css:
    css = css.replace(old_css, new_css, 1)
elif new_css not in css:
    raise SystemExit('Missing expected mobile nav CSS pattern')

js_path.write_text(js, encoding='utf-8')
css_path.write_text(css, encoding='utf-8')
print('Applied BGG modern UI edge-case fixes.')
