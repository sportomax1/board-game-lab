from pathlib import Path
import re

p = Path('bgg-contacts.html')
s = p.read_text(encoding='utf-8')
css = '<link rel="stylesheet" href="/assets/bgg-email-dashboard.css?v=20260901email2">'
js = '<script src="/assets/bgg-email-dashboard.js?v=20260901email2"></script>'

# Keep exactly one current Email dashboard asset reference and force a cache bust.
s = re.sub(r'<link rel="stylesheet" href="/assets/bgg-email-dashboard\.css\?v=[^"]+">', '', s)
s = re.sub(r'<script src="/assets/bgg-email-dashboard\.js\?v=[^"]+"></script>', '', s)
s = s.replace('</head>', css + '</head>', 1)
s = s.replace('</body>', js + '</body>', 1)

p.write_text(s, encoding='utf-8')
print('Installed fixed BGA email dashboard assets; Games remains an independent tab')
