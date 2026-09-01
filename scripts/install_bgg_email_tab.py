from pathlib import Path

p = Path('bgg-contacts.html')
s = p.read_text(encoding='utf-8')
css = '<link rel="stylesheet" href="/assets/bgg-email-dashboard.css?v=20260901email1">'
js = '<script src="/assets/bgg-email-dashboard.js?v=20260901email1"></script>'
if css not in s:
    s = s.replace('</head>', css + '</head>', 1)
if js not in s:
    s = s.replace('</body>', js + '</body>', 1)
p.write_text(s, encoding='utf-8')
print('Installed BGA email dashboard assets')
