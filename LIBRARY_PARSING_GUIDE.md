# Library.html Parsing & Sorting Guide

## XML File Structures & ID Fields

### Sportomax & DTW
- **ID Format**: `objectid="NUMBER"` (attribute on `<item>` tag)
- **Example**: `<item objecttype="thing" objectid="5867" subtype="boardgame">`
- **Location Tag**: 🎲 for DTW, none for sportomax primary
- **Desire Score**: From `<status>` element attributes: `wanttoplay`, `wishlist`, `wishlistpriority`

### BGG & DTE  
- **ID Format**: `<bgg_id>NUMBER</bgg_id>` (element inside `<game>` tag)
- **Example**: `<game> <bgg_id>167791</bgg_id> <name>...</name>`
- **Location Tag**: ⭐ for BGG, 🚢 for DTE
- **Desire Score**: N/A (BGG/DTE libraries don't have want/wishlist data)

## Sorting Logic

Games are sorted **PRIMARY by desire score (DESC)**, then **SECONDARY by avg rating (DESC)**:

```
sort((a, b) => {
  if (b.desireScore !== a.desireScore) {
    return b.desireScore - a.desireScore;  // PRIMARY: higher desire first
  }
  return parseFloat(b.rating) - parseFloat(a.rating);  // TIEBREAKER: higher rating first
})
```

**Result**: 
- Games with desire=8 appear before desire=7
- Games with same desire=5 are then sorted by rating (8.5 before 8.0)

## Console Logging - Expected Output

When you load library.html and open browser console (F12), you'll see:

```
[LIBRARY] Starting to load XML files...
[LIBRARY] Fetching library_sportomax.xml...
[LIBRARY] ✅ library_sportomax.xml loaded: 1523 games
[LIBRARY] Fetching library_dtw.xml...
[LIBRARY] ✅ library_dtw.xml loaded: 892 games
[LIBRARY] All XML files loaded, processing...
[LIBRARY] Processing 1523 games from sportomax...
[LIBRARY] ✅ Sportomax: 1523 games added
[LIBRARY] Processing 892 games from DTW...
[LIBRARY] DTW: Catan - added location tag
[LIBRARY] ✅ DTW: 45 new games, 847 already in map
[LIBRARY] Total games in map: 1568
[LIBRARY] Processing 12427 games from BGG...
[LIBRARY] BGG: Catan (ID: 13) - added location tag
[LIBRARY] ✅ BGG: 8934 new games added
[LIBRARY] Processing 2364 games from DTE...
[LIBRARY] DTE: Catan (ID: 13) - added location tag
[LIBRARY] ✅ DTE: 156 new games added
[LIBRARY] 🎉 Total unique games: 10658
[LIBRARY] Games with desire > 0: 1523
[LIBRARY] TOP 10 GAMES (sorted by desire DESC, then rating DESC):
[LIBRARY] #1: "Catan" | ID:13 | Desire:8 | Rating:7.34 | 🎲dtw 🚢dte ⭐bgg
[LIBRARY] #2: "Ticket to Ride" | ID:9 | Desire:8 | Rating:7.21 | 🎲dtw
[LIBRARY] #3: "Agricola" | ID:31260 | Desire:7 | Rating:8.02 | 🎲dtw ⭐bgg
[LIBRARY] #4: "Puerto Rico" | ID:3076 | Desire:7 | Rating:8.10 | 🎲dtw ⭐bgg 🚢dte
...
```

## What Each Field Means

| Field | Meaning |
|-------|---------|
| `ID:13` | Game's BGG ID (unique identifier) |
| `Desire:8` | Desire to play score (0-11, only from sportomax/dtw with wanttoplay/wishlist marked) |
| `Rating:7.34` | Average BGG rating (0-10) |
| `🎲dtw 🚢dte ⭐bgg` | Location tags - which conventions/collections have this game |

## Location Tag Meanings

| Emoji | Collection | Source |
|-------|-----------|--------|
| 🎲 | DTW (Vegas) | library_dtw.xml |
| 🚢 | DTE (Cruise) | library_dte.xml |
| ⭐ | BGG (Dallas) | library_bgg.xml |
| (none) | Sportomax Only | Only in library_sportomax.xml |

## Desire Score Calculation

**Only applies to sportomax & DTW** (these have wanttoplay/wishlist in XML):

```
desireScore = (wanttoplay ? 5 : 0) + (wishlist ? 6-priority : 0)
```

- **Want to Play (✓)**: +5 points
- **Wishlist (✓)**:
  - Priority 1: +5 points (6-1)
  - Priority 2: +4 points (6-2)
  - Priority 3: +3 points (6-3)
  - Priority 4: +2 points (6-4)
  - Priority 5: +1 point (6-5)
  - Priority 6: 0 points (6-6)

**Examples**:
- Want to Play (✓) + Wishlist Priority 1 = 5+5 = **10**
- Want to Play (✓) + Wishlist Priority 3 = 5+3 = **8**
- Want to Play (✓) only = **5**
- Wishlist Priority 3 only = **3**
- Not marked = **0** (sorted last)

## Card Display

Each game card shows:

```
Game Name (linked to BGG page) 🎲 🚢 ⭐
⭐ 7.34    🏆 #2952
👥 2-4      📅 2003
```

Where:
- `7.34` = Desire badge (green/blue/yellow/gray based on score)
- `⭐ 7.34` = Average rating 
- `🏆 #2952` = BGG rank
- `👥 2-4` = Player count range
- `📅 2003` = Year published

## Troubleshooting

**Problem**: All games showing but no desire scores
- **Cause**: Maybe sportomax/DTW XML files are empty
- **Check**: Browser console → look for `library_sportomax.xml loaded: 0 games`

**Problem**: Games not sorted correctly
- **Check**: Open browser console, search for `TOP 10 GAMES`
- **Verify**: Desire scores descend (8, 8, 7, 7, 5...) then ratings within each desire tier

**Problem**: Location tags missing or wrong emoji
- **Check**: Console output shows location emoji for each game added (e.g., `🎲dtw ⭐bgg`)
- **Verify**: Location tags should appear to right of game name on card

**Problem**: Duplicate games appearing
- **Cause**: Map key mismatch (sportomax using objectid=13 but BGG using bgg_id=13)
- **Should be fixed**: By this update's parsing logic
- **Check**: Total games should be < sum of all XML files (deduped)

