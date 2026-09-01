from pathlib import Path

path = Path('bgg-contacts.html')
text = path.read_text(encoding='utf-8')
marker = 'bgg-contacts-modern.css?v=20260901v3'

if marker in text:
    print('Modern BGG contacts UI already applied.')
    raise SystemExit(0)

css_tag = '<link rel="stylesheet" href="/assets/bgg-contacts-modern.css?v=20260901v3">'
js_tag = '<script src="/assets/bgg-contacts-modern.js?v=20260901v3"></script>'

if '</head>' not in text or '</body>' not in text:
    raise SystemExit('Could not locate outer document head/body closing tags.')

text = text.replace('</head>', css_tag + '</head>', 1)

# Defer the large embedded BGA application until the BGA tab is actually opened.
if 'id="bgaEmbeddedApp"' in text and ' data-srcdoc="' not in text:
    idx = text.find('id="bgaEmbeddedApp"')
    src_idx = text.find(' srcdoc="', idx)
    if src_idx != -1:
        text = text[:src_idx] + ' data-srcdoc="' + text[src_idx + len(' srcdoc="'):]

text = text.replace('</body>', js_tag + '</body>', 1)
path.write_text(text, encoding='utf-8')
print('Applied modern BGG contacts frontend while preserving existing data/backend logic.')
