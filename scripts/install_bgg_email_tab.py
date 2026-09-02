from pathlib import Path
import re

p = Path('bgg-contacts.html')
s = p.read_text(encoding='utf-8')
css = '<link rel="stylesheet" href="/assets/bgg-email-dashboard.css?v=20260902email3">'
js = '<script src="/assets/bgg-email-dashboard.js?v=20260902email3"></script>'

# Keep exactly one current Email dashboard asset reference and force a cache bust.
s = re.sub(r'<link rel="stylesheet" href="/assets/bgg-email-dashboard\.css\?v=[^"]+">', '', s)
s = re.sub(r'<script src="/assets/bgg-email-dashboard\.js\?v=[^"]+"></script>', '', s)
s = s.replace('</head>', css + '</head>', 1)
s = s.replace('</body>', js + '</body>', 1)

# The Email tab is dynamically injected at runtime. Older generated navigation only
# toggled the four original sections, so Email stayed visible when Games was clicked.
# Expand the visibility set in the generated page itself so Games and Email are always
# independent, even before the Email helper script runs.
s = s.replace(
    "['collection','contacts','pipeline','bga'].forEach(id=>document.getElementById(id)?.classList.toggle('hidden',id!==t));",
    "['collection','contacts','pipeline','bga','email'].forEach(id=>document.getElementById(id)?.classList.toggle('hidden',id!==t));"
)

p.write_text(s, encoding='utf-8')
print('Installed Email dashboard with independent Games/Pipeline navigation')
