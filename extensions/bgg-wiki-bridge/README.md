# BGG Community Wiki Bridge for Board Game Lab

This Chrome/Edge Manifest V3 extension lets the Board Game Lab Community Wiki SPA read the rendered Community Wiki using the BGG session already active in the same browser profile.

## Install
1. Download **bgg-wiki-bridge.zip** from the Board Game Lab Community Wiki app.
2. Extract the ZIP to a permanent folder.
3. Open \`chrome://extensions\` (or \`edge://extensions\`), enable **Developer mode**, select **Load unpacked**, and select the extracted folder containing \`manifest.json\`.
4. Sign in normally at boardgamegeek.com in the same browser profile.
5. Refresh the Board Game Lab Community Wiki page and select a game.

## How it works
- The app sends a game ID to a content script running only on approved Board Game Lab domains.
- The extension checks for an existing BGG Community Wiki tab for that ID. If none exists, it opens a temporary **inactive** BGG tab and closes it after reading the page. It never switches your active tab.
- A BGG content script extracts the rendered Community Wiki DOM and returns only article HTML to the app; the SPA sanitizes and displays it and stores it in IndexedDB.
- **No passwords, cookies, tokens, or localStorage data are read or sent to the app.**
- It does not bypass access restrictions, CAPTCHAs, 403s, or login requirements. BGG may still restrict access or change its markup.
- Extension access is limited to the BGG site and the three explicit Board Game Lab deployment hosts in \`manifest.json\`.

### Troubleshooting
- The extension must be installed in the **same browser profile** used for the BGG session.
- Reload Board Game Lab after installation so the content script is injected.
- A BGG login in Incognito or another Chrome profile does not carry into your current profile.
- If the page is blocked even in a regular BGG tab, the extension cannot retrieve it.
- When the UI says no article was recognized, use the Import tab; you can also provide the HTML capture for an extractor update.
