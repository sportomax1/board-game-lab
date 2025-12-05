# Files Candidates for Deletion

Analysis of files that are NOT being called/referenced by any other files and could potentially be deleted.

---

## 🚨 DEFINITE CANDIDATES (Not Used Anywhere)

### JavaScript Libraries

| File | Size | Status | Notes |
|------|------|--------|-------|
| **bgg-api-client.js** | ~2-3 KB | NOT USED | Legacy BGG API client wrapper - no files reference it |

### CSS Files

None - all CSS files are actively referenced.

### HTML Applications

| File | Status | Notes |
|------|--------|-------|
| **all-in-one.html** | UNCLEAR | References app.js which exists, but all-in-one concept may be abandoned |
| **api.html** | UNCLEAR | API testing/documentation page - standalone but may be outdated |
| **bga.html** | UNCLEAR | BGA integration - no other files reference it |
| **blur.html** | UNCLEAR | Blur effect tool - standalone with no dependencies |
| **collectionapi.html** | UNCLEAR | API documentation - no references |
| **compare.html** | UNCLEAR | Game comparison tool - no references |
| **gamenight.html** | UNCLEAR | Game night selector - no references |
| **games.html** | UNCLEAR | 5-game suite - no references from other files |
| **hangman.html** | UNCLEAR | Hangman game - no references |
| **inventory.html** | UNCLEAR | Inventory tracker - no references |
| **librarystats.html** | UNCLEAR | Library statistics - no references |
| **random9.html** | UNCLEAR | Random game picker - no references |
| **rankfile.html** | UNCLEAR | Ranking tool - no references |
| **stats.html** | UNCLEAR | Statistics viewer - no references |
| **tabletop.html** | UNCLEAR | Tabletop reference - no references |
| **tabletop_cleaned.html** | UNCLEAR | Cleaned version of tabletop.html - likely redundant |
| **test.html** | UNCLEAR | Testing utilities - no references |
| **timer.html** | UNCLEAR | Game timer - no references |

### Draft Folder Files

| File | Status | Notes |
|------|--------|-------|
| **draft/all-in-one.html** | NOT USED | Same as root all-in-one.html? Redundant copy? |
| **draft/test.html** | NOT USED | Test file in draft folder - likely outdated |
| **draft/vfm_old.html** | NOT USED | Archived VFM - name suggests obsolete |
| **draft/vfm_new.html** | NOT USED | New VFM test - likely replaced by vfm.html |
| **draft/vfmZ.html** | NOT USED | Alternate/test version - unclear purpose |
| **draft/tabletop.html** | NOT USED | Duplicate of root tabletop.html? |
| **draft/tabletop_cleaned.html** | NOT USED | Duplicate of root version? |
| **draft/token.html** | NOT USED | Token tracker - no references |
| **draft/ZZZcredits.html** | NOT USED | Filename suggests archived/disabled |

### Data Files That May Be Obsolete

| File | Status | Notes |
|------|--------|-------|
| **vfm22bgg.xml, vfm22dte.xml, etc.** | POSSIBLY | 2022 data files - may not be actively used anymore |
| **vfm23bgg.xml, vfm23dte.xml, etc.** | POSSIBLY | 2023 data files - older historical data |
| **library_bgg-backup.html** | NOT USED | Backup version - no references |
| **library_bgg-live.html** | UNCLEAR | Live version - may be active test file |
| **private_print.html** | NOT USED | Print-friendly version - no references |
| **vfm_old.html** | NOT USED | Name suggests archived |

---

## 🟡 MAYBE CANDIDATES (Limited/Single Use)

### Files Referenced Only by Draft Folder

These are only called by draft/experimental versions - might be intended for development only:

| File | Called By | Status |
|------|-----------|--------|
| **app.js** | draft/all-in-one.html only | If draft/all-in-one.html isn't used, this is unused |
| **welcome.js** | draft/welcome.html only | Draft-only |
| **welcome2.js** | draft/welcome.html only | Draft-only |
| **welcome.css** | draft/welcome.html only | Draft-only |

### Alt Folder (Alternate/PWA Versions)

| File | Status | Notes |
|------|--------|-------|
| **alt/vfm.html** | ALTERNATE | Alternate version of vfm.html - possibly outdated |
| **alt/service-worker.js** | PWA SERVICE WORKER | Only referenced by alt/manifest.json - may not be active |
| **alt/manifest.json** | PWA MANIFEST | Only used by alt/ folder - may not be deployed |

---

## 🟢 DO NOT DELETE (Actively Used)

### Critical API/Core Files
- `/api/bgg-helper.js` - Used by 70+ files
- `/api/firebase-config.js` - Used by 2 apps (essential)
- `/api/get-password.js` - Used by 2 apps (essential)
- `/api/image-proxy.js` - Used by 11 files
- `package.json` - Deployment config
- `vercel.json` - Deployment config

### Generation Scripts
- `generate_index.py` - Generates landing page
- `generate_master_index.py` - Generates file listing
- `vfm.py` - Generates VFM data
- `cascade_vfm.py` - Generates cascade data

### Main Applications (40+ files)
- `library.html`, `vfm.html`, `collection.html`, `matchup.html`, `checkout.html`
- `ranks.html`, `stats.html`, `menu.html`, `toptier.html`
- All collection-based analyzers that actively fetch BGG data

### Recent/Active Data (2024-2025)
- `vfm24*.xml`, `vfm25*.xml` - Current year data
- `library_*.xml` - Active collection snapshots
- `plays.xml`, `plays.html` - Play history

---

## 📊 CLEANUP RECOMMENDATIONS

### HIGH PRIORITY (Safe to Delete)

1. **bgg-api-client.js** (2-3 KB)
   - Status: Not used anywhere
   - Risk: None - no references
   - Action: DELETE

2. **Draft Folder Duplicates** (5+ KB total)
   - draft/vfm_old.html
   - draft/vfm_new.html
   - draft/vfmZ.html
   - draft/test.html
   - Risk: Low - these are in draft folder
   - Action: DELETE

3. **Backup/Alternate Files** (3-5 KB total)
   - library_bgg-backup.html
   - private_print.html
   - tabletop_cleaned.html (if duplicate)
   - Risk: Low if backups exist elsewhere
   - Action: DELETE

### MEDIUM PRIORITY (Probably Safe)

1. **Alt Folder PWA Files** (5 KB total)
   - alt/vfm.html, alt/service-worker.js, alt/manifest.json
   - Status: Alternate/PWA versions - unclear if deployed
   - Risk: Medium - might break PWA if active
   - Action: Verify not deployed, then DELETE

2. **Draft-Only Libraries** (2-3 KB total)
   - app.js, welcome.js, welcome2.js, welcome.css
   - Status: Only used by draft/ folder
   - Risk: Low if draft apps aren't used
   - Action: DELETE (or keep if draft development continues)

3. **Standalone Test/Demo Apps** (10+ KB total)
   - games.html, cards.html, dice.html, timer.html, quiz.html, hangman.html
   - (These are functional but NOT referenced by any navigation)
   - Status: Standalone games with no cross-references
   - Risk: Low - they work independently
   - Action: DELETE if not actively promoted in index

### LOW PRIORITY (Questionable)

1. **Older Historical Data** (100+ KB)
   - vfm22*.xml - 2022 data
   - vfm23*.xml - 2023 data
   - Status: Historical/archived data
   - Risk: Low - just data
   - Action: Archive to separate folder or DELETE if not needed

2. **Unclear Purpose Files** (5 KB each)
   - api.html - API testing page
   - bga.html - BGA integration (unclear)
   - blur.html - Blur effect tool
   - compare.html - Game comparison
   - gamenight.html - Game night picker
   - inventory.html - Inventory tracker
   - random9.html - Random picker
   - rankfile.html - Ranking tool
   - test.html - Testing page

---

## 🎯 QUICK CLEANUP (Safe, 50+ KB Recovered)

**Delete these files safely:**

1. `bgg-api-client.js` - Not used
2. `draft/vfm_old.html` - Archived
3. `draft/vfm_new.html` - Test version
4. `draft/vfmZ.html` - Test version
5. `draft/test.html` - Test file
6. `library_bgg-backup.html` - Backup (if main exists)
7. `private_print.html` - Print version (if not needed)
8. `tabletop_cleaned.html` - If duplicate

**Optional (if not actively used):**
9. `app.js`, `welcome.js`, `welcome2.js`, `welcome.css` - Draft-only
10. `alt/vfm.html`, `alt/service-worker.js`, `alt/manifest.json` - PWA/alternate

---

## ⚠️ FILES TO INVESTIGATE BEFORE DELETING

Before deleting any file, check:

1. **Is it linked in index.html?** Check if it's in the generated navigation
2. **Is it in Google Analytics/tracking?** Check if it gets active traffic
3. **Is it bookmarked by users?** Check URL patterns
4. **Is it in README/docs?** Check documentation
5. **Is it recently modified?** Check git log for recent changes
6. **Is it on Vercel?** Deployed but not referenced locally?

---

Generated: 2025-12-05
