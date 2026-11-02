# BGG Community Wiki Bridge (Chrome / Edge) — v1.1

Reads the BoardGameGeek Community Wiki page for a selected game into the Board Game Lab Community Wiki Explorer, using the same browser profile as your BGG login.

## Install or update

1. Download `bgg-wiki-bridge.zip` from the Community Wiki Explorer.
2. Extract it. The extracted folder must directly contain **manifest.json**, **service-worker.js**, **page-bridge.js** and **bgg-reader.js**.
3. Go to `chrome://extensions` (or `edge://extensions`) and enable **Developer mode**.
4. Click **Load unpacked** and select that folder.
5. If you already have an earlier version installed, replace the old extracted files with the new ones and click **Reload** on its extension card. Avoid installing two copies.
6. Sign in at boardgamegeek.com in the **same browser profile**, then refresh the Board Game Lab Community Wiki Explorer.
7. The app should display **Connected (v1.1.0)**. Choose a game, or click **Reload from BGG session**.

The app uses a normal BGG wiki tab, or creates a temporary **inactive** BGG tab, reads its rendered article, and closes it. Your active Board Game Lab tab does not change.

### Troubleshooting

- **Extension not detected:** reload the extension and the app; verify the extracted folder contains manifest.json at its top level and the app is on https://board-game-lab-one-phi-42.vercel.app.
- **Outdated extension:** reinstall/update the extracted files and click Reload in chrome://extensions.
- **BGG redirected:** check whether BGG is signed in within this Chrome profile, not a separate Incognito session.
- **BGG restricted:** visit the wiki normally and see whether BGG presents an access challenge. The extension will not defeat an access restriction.
- **Article not found:** BGG's markup may have changed or the wiki may be blank. The app reports the extension's extraction code; use the Import tab if necessary.
- **Response timeout:** see `chrome://extensions` > BGG Community Wiki Bridge > Service worker > Inspect for worker errors.

The extension does not read or transmit cookies, login tokens, passwords or localStorage data. Only article markup is sent to the current app tab, which sanitizes the content and stores a local copy in IndexedDB. No BGG data is transmitted to an additional server by the extension.

This is not an official BGG API integration and may stop working if BGG changes access controls or page structure. Respect BGG and contributor permissions.
