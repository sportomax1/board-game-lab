from pathlib import Path
import json,re,subprocess

ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets'


def text(p): return p.read_text(encoding='utf-8')
def write(p,s): p.write_text(s,encoding='utf-8')

# People Analyzer is a loader around people-core.txt. Embed the core directly first.
p=ROOT/'people.html'
if p.exists() and (ASSETS/'people-core.txt').exists():
    s=text(p); core=text(ASSETS/'people-core.txt')
    pat=r"\s*const CORE=['\"]\.\/assets\/people-core\.txt[^'\"]*['\"];\s*const response=await fetch\(CORE,\{cache:'default'\}\);\s*if\(!response\.ok\)throw new Error\(`Could not load analyzer core \(\$\{response\.status\}\)`\);\s*let html=await response\.text\(\);"
    repl='\n    let html='+json.dumps(core)+';'
    s,n=re.subn(pat,repl,s,count=1)
    if n!=1: raise RuntimeError('people.html core loader pattern not found')
    write(p,s)

# Inline every local frontend CSS/JS dependency referenced by an HTML app.
# External CDNs and /api calls intentionally remain external.
link_re=re.compile(r'<link\b[^>]*href=["\']([^"\']+)["\'][^>]*>',re.I)
script_re=re.compile(r'<script\b[^>]*src=["\']([^"\']+)["\'][^>]*>\s*</script>',re.I)

def local_asset(url):
    clean=url.split('?',1)[0].split('#',1)[0]
    clean=clean.lstrip('./').lstrip('/')
    if not clean.startswith('assets/'): return None
    path=ROOT/clean
    return path if path.exists() and path.suffix.lower() in {'.css','.js'} else None

changed=[]
for hp in list(ROOT.glob('*.html'))+list((ROOT/'games').glob('*.html')):
    s=text(hp); original=s; seen_css=set(); seen_js=set()
    def css(m):
        ap=local_asset(m.group(1))
        if not ap: return m.group(0)
        key=str(ap.resolve())
        if key in seen_css: return ''
        seen_css.add(key)
        return '<style data-inlined-from="'+ap.relative_to(ROOT).as_posix()+'">\n'+text(ap)+'\n</style>'
    def js(m):
        ap=local_asset(m.group(1))
        if not ap: return m.group(0)
        key=str(ap.resolve())
        if key in seen_js: return ''
        seen_js.add(key)
        body=text(ap).replace('</script>','<\\/script>')
        return '<script data-inlined-from="'+ap.relative_to(ROOT).as_posix()+'">\n'+body+'\n</script>'
    s=link_re.sub(css,s)
    s=script_re.sub(js,s)
    if s!=original:
        write(hp,s); changed.append(hp.relative_to(ROOT).as_posix())

# Verify no app still runtime-loads the old People core.
if 'people-core.txt' in text(ROOT/'people.html'):
    raise RuntimeError('people.html still references people-core.txt')

# Remove obsolete frontend fragments only when no HTML runtime reference remains.
all_html='\n'.join(text(x) for x in list(ROOT.glob('*.html'))+list((ROOT/'games').glob('*.html')))
removed=[]
for ap in ASSETS.iterdir() if ASSETS.exists() else []:
    if not ap.is_file(): continue
    if ap.name=='people-core.txt' or ap.suffix.lower() in {'.css','.js'} or ap.suffix.lower() in {'.trigger','.version'} or ap.name in {'.scroll-fix-trigger','scroll-qa-run-v2'}:
        rel=ap.relative_to(ROOT).as_posix()
        # data-inlined-from is provenance, not a runtime reference.
        runtime=all_html.replace('data-inlined-from="'+rel+'"','')
        if rel not in runtime and ('/'+rel) not in runtime and ('./'+rel) not in runtime:
            ap.unlink(); removed.append(rel)

# Remove obsolete one-off patch workflows/scripts that existed only to mutate these apps.
obsolete=[
'.github/people-v7-trigger.txt',
'.github/workflows/apply-bgg-ux.yml',
'.github/workflows/apply-mobile-scroll-state-fix.yml',
'.github/workflows/apply-scroll-qa-fix-v2.yml',
'.github/workflows/apply-scroll-qa-fix.yml',
'.github/workflows/bgg-contact-tristate-filters.yml',
'.github/workflows/fix-people-links.yml',
'.github/workflows/install-bgg-email-tab.yml',
'.github/workflows/install-mobile-scroll-state-fix.yml',
'.github/workflows/mobile-bgg-contacts-fix.yml',
'scripts/apply_bgg_ux.py','scripts/install_bgg_email_tab.py']
for rel in obsolete:
    q=ROOT/rel
    if q.exists(): q.unlink(); removed.append(rel)

# Refresh generated file index so deleted implementation fragments disappear from the UI.
try:
    if (ROOT/'generate_index.py').exists(): subprocess.run(['python','generate_index.py'],cwd=ROOT,check=True)
except Exception as e:
    print('Index regeneration skipped:',e)

# Remove this one-time migration and its workflow from the resulting production tree.
for rel in ['scripts/consolidate_spas_once.py','.github/workflows/consolidate-spas-once.yml']:
    q=ROOT/rel
    if q.exists(): q.unlink()

print('Consolidated:',changed)
print('Removed:',removed)
