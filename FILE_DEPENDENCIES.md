# File Dependencies & Relationships Map

## 📋 Overview

This document maps which files reference which other files and APIs, showing:
- **Standalone Files**: Can run independently without external dependencies
- **API-Dependent Files**: Call backend API endpoints
- **Cross-Referenced Files**: Files that reference other local files
- **Library Files**: Support libraries used by multiple files

---

## 🔌 Backend API Files (`/api/`)

These are Vercel serverless functions that provide data to frontend apps.

| API File | Purpose | Used By | Endpoints |
|----------|---------|---------|-----------|
| **bgg-helper.js** | Main BGG API proxy with all endpoints | 70+ files | `collection`, `thing`, `user`, `hot`, `geeklist`, `plays`, `search`, `browse`, `family`, `forumlist`, `thread`, `suggested`, `marketplace`, `videos`, `versions` |
| **firebase-config.js** | Firebase credentials provider | `matchup.html`, `checkout.html` | Returns Firebase config from env vars |
| **get-password.js** | Password/credential management | `checkout.html` | Authentication |
| **image-proxy.js** | Image proxy for CORS bypass | 10+ files | Image URL proxying |

---

## 📚 Shared Library Files

These files provide utilities used by other applications.

| Library File | Type | Purpose | Used By |
|--------------|------|---------|---------|
| **bgg-api-client.js** | JavaScript | BGG API client wrapper (not currently used by any files) | Created for future use, legacy support |
| **style.css** | CSS | Global/shared styling | Optional - most apps use Tailwind |
| **welcome.js** | JavaScript | Welcome page utilities | `draft/welcome.html` |
| **welcome2.js** | JavaScript | Enhanced welcome utilities | `draft/welcome.html` |
| **app.js** | JavaScript | General app utilities | `draft/all-in-one.html` |

---

## 🎮 Interactive Games (Standalone)

These are self-contained game applications that don't require user data.

| File | Type | Purpose | Dependencies |
|------|------|---------|--------------|
| **games.html** | Game Suite | 5 two-player games (Connect Four, Checkers, Tic Tac Toe, Ultimate TTT, Gomoku) | ✅ Standalone (uses BGG API for box art) |
| **cards.html** | Card Game | Deck building/card game | ✅ Standalone (JSON import) |
| **dice.html** | Dice Roller | Multi-dice roller | ✅ Standalone |
| **timer.html** | Timer | Game timer utility | ✅ Standalone |
| **firstplayer.html** | Utility | First player selector | ✅ Standalone |
| **bracket.html** | Tournament | Tournament bracket generator | ✅ Standalone (with optional collection API) |

---

## 🔍 Data Analysis Apps (Collection-Based)

These apps load a user's BGG collection and analyze/visualize it.

### Heavy API Users (10+ API calls during session)

| File | API Calls | Purpose |
|------|-----------|---------|
| **library.html** | 30+ | Full collection viewer with lazy-loading API for individual game details |
| **matchup.html** | 20+ | Game tournament simulator + Firebase integration |
| **checkout.html** | 20+ | Game checkout system with Firebase + bulk imports |
| **vfm.html** | 15+ | VFM (Virtually Flip Meeple) marketplace viewer |
| **toptier.html** | 12+ | Tier ranking system with game ratings |
| **stats.html** | 15+ | Collection statistics dashboard |
| **marketplace.html** | 12+ | Marketplace explorer with filtering |
| **forums.html** | 15+ | Game forum browser |

**Collection API Pattern** (all use):
```javascript
fetch(`/api/bgg-helper?endpoint=collection&username=${username}&own=1&stats=1`)
```

### Medium API Users (3-10 API calls)

| File | API Calls | Purpose |
|------|-----------|---------|
| **ratings.html** | 5+ | Game ratings analyzer |
| **ranks.html** | 8+ | Ranking system with BGG rank comparison |
| **versions.html** | 6+ | Game version tracker |
| **videos.html** | 6+ | Game videos catalog |
| **suggested.html** | 5+ | Game recommendations |
| **playingcards.html** | 5+ | Playing card game collection |
| **plays.html** | 4+ | Play history viewer |
| **fresh.html** | 4+ | Fresh plays tracker |
| **menu.html** | 4+ | Menu/collection navigator |
| **hunt.html** | 3+ | Scavenger hunt generator |
| **collection.html** | 4+ | Collection browser |
| **collage.html** | 5+ | Image collage generator |
| **rostercap.html** | 3+ | Roster capping utility |
| **startbenchcut.html** | 3+ | Starting/bench/cut game |
| **questions.html** | 3+ | Game questions generator |
| **puzzle.html** | 3+ | Puzzle generator |
| **hangman.html** | 3+ | Hangman game |
| **scramble.html** | 3+ | Word scramble |
| **wordle.html** | 3+ | Wordle-style game |

### Light API Users (1-3 API calls)

| File | API Calls | Purpose |
|------|-----------|---------|
| **hotgames.html** | 1 | Shows currently hot games (no username needed) |
| **user.html** | 1 | User profile viewer (endpoint: `user`) |
| **geeklist.html** | 7 | Geeklist explorer |
| **typerank.html** | 2 | Game type ranking |
| **gamenight.html** | 1 | Game night selector |
| **gameninja.html** | 1 | Game ninja selector |
| **shelfie.html** | 1 | Shelf display |
| **expansion.html** | 2 | Expansion finder |
| **dtw.html** | 2 | DTW app |
| **draft.html** | 1 | Draft picker |
| **test.html** | 1 | Test utilities |
| **private.html** | 1 | Private collection (draft folder) |
| **compare.html** | 1 | Collection comparison |
| **sleep.html** | 1 | Sleep tracker |
| **year.html** | 1 | Year in games |
| **random9.html** | 1 | Random game picker |
| **pubmeeple.html** | 1 | Pub meeple tracker |
| **idea.md** | N/A | Ideas document |
| **credits.html** | 3 | Credits system |
| **cover.html** | 1 | Cover collector |

---

## 🎨 Firebase-Dependent Apps

These apps store user data in Firebase (real-time database/Firestore).

| File | Firebase Features | Purpose |
|------|-------------------|---------|
| **matchup.html** | Firestore (tournament data) | Tournament brackets with saved results |
| **checkout.html** | Firestore (checkout list) | Track games to checkout at events |

**Firebase Setup**:
- Config loaded from `/api/firebase-config` endpoint
- Uses Firebase v10.7.1 modules
- Requires environment variables: `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`

---

## 📊 Data File Dependencies

These files depend on XML/data files in the repo.

| Data File | Used By | Purpose |
|-----------|---------|---------|
| **vfm25bgg.xml** | alt/vfm.html | VFM marketplace geeklist for BGG (auto-generated) |
| **vfm25dte.xml** | N/A | VFM for DTE convention (auto-generated) |
| **vfm25dtw.xml** | N/A | VFM for DTW convention (auto-generated) |
| **vfm25spr.xml** | N/A | VFM for Spring convention (auto-generated) |
| **library_bgg.xml** | library_bgg.html | BGG collection snapshot |
| **library_dte.xml** | library_dte.html | DTE collection snapshot |
| **library_dtw.xml** | library_dtw.html | DTW collection snapshot |
| **collection.csv** | Various | CSV export of collection |
| **pubmeeple.csv** | pubmeeple.html | PubMeeple venue list |

---

## 🐍 Python Scripts

Backend utilities for data generation and management.

| Script | Purpose | Output |
|--------|---------|--------|
| **vfm.py** | Fetch VFM geeklist from BGG | `vfm25bgg.xml` (manually or via cron) |
| **cascade_vfm.py** | Cascade VFM data across events | Multi-event VFM XMLs |
| **generate_index.py** | Generate file index with filtering | `index.html` (with folder visibility controls) |
| **generate_master_index.py** | Generate master index of repos | `master_index.html` |

---

## 📑 Standalone Documentation Files

These files don't call other files but document the system.

| File | Purpose |
|------|---------|
| **README.md** | Project overview |
| **master.md** | Complete system documentation |
| **compare.md** | API comparison chart |
| **FEATURES.md** | Feature list |
| **NEW_APPS_SUMMARY.md** | New applications summary |
| **BGG-MIGRATION-GUIDE.md** | BGG API migration guide |
| **LIBRARY_PARSING_GUIDE.md** | XML parsing guide |
| **VFM_CURRENT_ARCHITECTURE.md** | VFM system architecture |
| **MATCHUP_SETUP.md** | Matchup game setup guide |
| **DOUBLE_ELIM_TOURNAMENT_GUIDE.md** | Tournament setup |
| **WORKFLOW_UPDATES.md** | Workflow changes |

---

## 🔗 File Reference Map (Alphabetical)

### A Files
- **all-in-one.html** (draft) - References: `app.js` ❌ (not working), uses Tailwind
- **api.html** - Standalone API explorer ✅
- **app.js** - Utility library for `all-in-one.html`
- **api/** - See Backend API section above

### B Files
- **bga.html** - Standalone
- **bgg-api-client.js** - Utility library (legacy, not currently used)
- **BGG-MIGRATION-GUIDE.md** - Documentation
- **blur.html** - Collection-based (light API)
- **board.html** - ✅ Standalone
- **boardgametype.html** - Collection-based
- **bracket.html** - Standalone/Optional API

### C Files
- **cards.html** - ✅ Standalone card game
- **cascade_vfm.py** - Data script
- **checkout.html** - Firebase + API
- **collage.html** - Collection-based (5+ API)
- **collectionapi.html** - Collection analyzer
- **collection.html** - Collection browser
- **collectionapi.html** - Collection API viewer
- **compare.html** - Collection comparison
- **compare.md** - Documentation
- **convert.html** - ✅ Standalone (uses PapaParse)
- **cover.html** - Collection-based (1 API)
- **credits.html** - Collection-based (3 API)

### D Files
- **dice.html** - ✅ Standalone dice roller
- **draft.html** - Collection-based (1 API)
- **dtw.html** - Collection-based (2 API)
- **DOUBLE_ELIM_TOURNAMENT_GUIDE.md** - Documentation

### E Files
- **expansion.html** - Collection-based (2 API)

### F Files
- **forums.html** - Collection-based (15+ API)
- **freshplaysdownload.html** - Collection-based (4 API)
- **firstplayer.html** - ✅ Standalone selector

### G Files
- **gamenight.html** - Collection-based (1 API)
- **gameninja.html** - Collection-based (1 API)
- **games.html** - ✅ Standalone (5-game suite)
- **geeklist.html** - Collection-based (7 API)
- **generate_index.py** - Generates `index.html`
- **generate_master_index.py** - Generates `master_index.html`

### H Files
- **hangman.html** - Collection-based (3 API)
- **hotgames.html** - Collection-based (1 API, no username)
- **hunt.html** - Collection-based (3+ API)

### I Files
- **index.html** - File index (generated by `generate_index.py`)
- **inventory.html** - ✅ Standalone

### L Files
- **library.html** - Collection-based (30+ API - heaviest)
- **library_bgg.html** - Collection browser (uses XML file)
- **library_dte.html** - DTE collection browser
- **library_dtw.html** - DTW collection browser
- **librarystats.html** - Collection statistics
- **library_bgg-live.html** - Live collection updater

### M Files
- **marketplace.html** - Collection-based (12+ API)
- **master.md** - Complete documentation
- **master_index.html** - Master repo index (generated)
- **matchup.html** - Firebase + 20+ API calls
- **menu.html** - Collection-based (4 API)
- **metermaster.html** - Collection-based (3 API)
- **metaVFM.html** - VFM metadata explorer

### P Files
- **package.json** - Project config (main: `api/bgg-proxy.js`)
- **plays.html** - Collection-based (4+ API)
- **playingcards.html** - Collection-based (5 API)
- **private.html** - Collection-based (1 API)
- **pubmeeple.html** - Collection-based (1 API)
- **puzzle.html** - Collection-based (3 API)

### Q Files
- **questions.html** - Collection-based (3 API)
- **quiz.html** - ✅ Standalone quiz

### R Files
- **random9.html** - Collection-based (1 API)
- **rankfile.html** - Collection-based (3 API)
- **rankup.html** - Collection-based
- **ranks.html** - Collection-based (8+ API)
- **ratings.html** - Collection-based (5+ API)
- **rostercap.html** - Collection-based (3 API)

### S Files
- **scorepad.html** - ✅ Standalone scorepad
- **scramble.html** - Collection-based (3 API)
- **search.html** - ✅ Standalone BGG search
- **shelfie.html** - Collection-based (1 API)
- **sleep.html** - Collection-based (1 API)
- **sleeve.html** - Collection-based (1 API)
- **stats.html** - Collection-based (15+ API)
- **startbenchcut.html** - Collection-based (3 API)
- **suggested.html** - Collection-based (5+ API)
- **summary.md** - Summary document
- **swipe.html** - Collection-based (variable API)

### T Files
- **test.html** - Testing utilities
- **timer.html** - ✅ Standalone timer
- **token.html** (draft) - Token tracker
- **toptier.html** - Collection-based (12+ API)
- **typerank.html** - Collection-based (2 API)

### V Files
- **versions.html** - Collection-based (6 API)
- **vfm.html** - Collection-based (15+ API)
- **vfm.py** - Generates VFM XML
- **videos.html** - Collection-based (6 API)
- **vercel.json** - Vercel configuration

### W Files
- **welcome.css** (draft) - Styling
- **welcome.html** (draft) - Welcome page
- **welcome.js** (draft) - Welcome utilities
- **welcome2.js** (draft) - Enhanced welcome
- **wrapped.html** - Collection-based (plays + collection API)

### Y Files
- **year.html** - Collection-based (1 API)

### Z Files
- **ZZZcredits.html** (draft) - Credits system

---

## 📈 API Usage Statistics

### By Endpoint

| Endpoint | Usage Count | Primary Files |
|----------|------------|----------------|
| `collection` | 70+ | library, games, ranks, stats, etc. |
| `thing` | 60+ | Library detail views, previews |
| `search` | 5+ | collage, games, search utilities |
| `plays` | 8+ | wrapped, play history, stats |
| `user` | 8+ | user.html, profile views |
| `geeklist` | 4+ | geeklist, vfm |
| `hot` | 2+ | hotgames.html, trending |
| `browse` | 2+ | ranks.html |
| `family` | 2+ | Thing variants |
| `forumlist` | 2+ | forums.html |
| `thread` | 2+ | forums.html |
| `suggested` | 1+ | suggested.html |
| `marketplace` | 1+ | marketplace.html |
| `videos` | 1+ | videos.html |
| `versions` | 1+ | versions.html |

### By File Type

| Category | Count | Notes |
|----------|-------|-------|
| **Standalone Games** | 6 | ✅ No API needed |
| **Heavy API Apps** | 8 | 10+ API calls |
| **Medium API Apps** | 20+ | 3-10 API calls |
| **Light API Apps** | 30+ | 1-3 API calls |
| **Firebase Apps** | 2 | matchup, checkout |
| **Data Files** | 8+ | XML/CSV |
| **Documentation** | 12+ | .md files |
| **Python Scripts** | 4 | Data generation |
| **API Functions** | 4 | Consolidated from 8 |

---

## 🎯 Quick Reference: Which Files Use Which APIs?

### Files Using `/api/bgg-helper` (Consolidated)
**70+ files** including: library.html, games.html, vfm.html, ranks.html, stats.html, collection.html, collage.html, thing.html, thingapi.html, etc.

- Now includes `endpoint=thing` support (previously in separate bgg-thing.js)

### Files Using `/api/firebase-config`
- matchup.html
- checkout.html

### Files Using `/api/get-password`
- checkout.html

### Files NOT Using Any API
**✅ Standalone (18 files)**:
- games.html, cards.html, dice.html, timer.html, firstplayer.html, bracket.html
- convert.html, search.html, scorepad.html, quiz.html
- api.html (API explorer, not a consumer)
- All documentation .md files
- All Python scripts (data generators)

---

## 🔄 Cross-File References

### HTML Files Referencing JavaScript
| HTML File | JS File | Type |
|-----------|---------|------|
| welcome.html (draft) | welcome.js | ✅ External |
| welcome.html (draft) | welcome2.js | ✅ External |
| all-in-one.html (draft) | app.js | ✅ External |
| xml-parse.html (github-actions) | xml-parse.js | ✅ External |

### HTML Files with External Library Imports
| Library | Usage Count | Used By |
|---------|------------|---------|
| Tailwind CSS CDN | 50+ | Most modern apps |
| Firebase App JS | 2 | matchup, checkout |
| Firebase Firestore | 2 | matchup, checkout |
| PapaParse (CSV) | 2 | convert.html, others |
| html2canvas | 2 | bracket.html, all-in-one.html |
| canvas-confetti | 2 | bracket.html, matchup.html |

---

## 🗂️ Folder Organization

### Root Level
- **HTML Files** (55+): Main applications
- **CSS**: style.css
- **JavaScript**: bgg-api-client.js, welcome.js, app.js
- **Python**: vfm.py, cascade_vfm.py, generate_index.py, generate_master_index.py
- **Data**: XML and CSV files (auto-generated)
- **Documentation**: .md files

### `/api/`
- **Backend Functions**: bgg-helper.js (consolidated), firebase-config.js, image-proxy.js, get-password.js

### `/alt/`
- **Alternative Versions**: vfm.html (alternate), service-worker.js, manifest.json

### `/draft/`
- **Work in Progress**: welcome.html, welcome.js, welcome2.js, all-in-one.html, various HTML tests

### `/github-actions/`
- **CI/CD Tools**: xml-parse.html, xml-parse.js, xml-parse.css

### `/cascade_vfm/`
- **VFM System**: Supporting cascade data files

---

## 🚀 Deployment Notes

### Vercel Serverless Functions
Located in `/api/` directory - automatically deployed as serverless functions at `https://your-domain.vercel.app/api/[filename]`

### Environment Variables Needed
- `FIREBASE_PROJECT_ID`
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_DATABASE_URL`
- `CRON_SECRET` (for scheduled functions)

### Static Files
All HTML, CSS, JS, and data files served as static assets from root

---

## 📝 Summary

- **Total Files**: 200+
- **Standalone HTML Apps**: 18 ✅
- **API-Dependent Apps**: 60+
- **Backend APIs**: 4 functions (consolidated from 8)
- **Shared Libraries**: 3 files (bgg-api-client.js, style.css, welcome.js)
- **Data Files**: 8+ (XML/CSV)
- **Documentation**: 12+ markdown files
- **Python Utilities**: 4 scripts

**Most Connected File**: `/api/bgg-helper.js` - Used by 70+ files  
**Most Connected Frontend**: `library.html` - Makes 30+ API calls  
**Most Standalone**: `games.html`, `cards.html`, `dice.html`, `timer.html`  
**Most Firebase-Dependent**: `matchup.html`, `checkout.html`

**API Reduction**: 50% (8 → 4 functions) ✅ Consolidated bgg-thing.js into bgg-helper.js
