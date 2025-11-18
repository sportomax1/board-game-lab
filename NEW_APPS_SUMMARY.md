# New Apps Summary

## ✅ Three New Apps Created and Deployed

### 1. **collectionapi.html** - Collection Browser
- **Purpose**: Browse and manage your BoardGameGeek collection
- **Features**:
  - Filter by collection status (Own, Previously Owned, Want to Play, Want to Buy)
  - Sort by Name, Year, Rating, or Player Count
  - Statistics display (Total Games, Avg Rating, Avg Players, Avg Playtime)
  - No password authentication required
  - Default username: `sportomax`
- **API Endpoint**: `/api/bgg-helper?endpoint=collection&username={username}`

---

### 2. **hunt.html** - Board Game Hunt / Scavenger Hunt
- **Purpose**: Find specific games from your collection with a timer
- **Features**:
  - **Solo Mode**: Practice finding games in your collection
  - **Competition Mode**: Track scores for multiplayer play
  - **Configurable Timer**: 10-300 seconds per round
  - **Game Card Display**: Shows game info (players, playtime, year, rating)
  - **Random Selection**: Pulls games from your "Own" collection only
  - **Scoring System**: Points based on finding games + time remaining (10 + timeLeft)
  - **Results Screen**: Shows found games, skip count, and total score
  - **No Password Authentication**: Uses default username `sportomax` or custom input
  - **Auto-skip**: Game automatically skips when timer runs out
- **API Endpoint**: `/api/bgg-helper?endpoint=collection&username={username}&own=1&stats=1`

---

### 3. **thingapi.html** - BGG Thing API Lookup (renamed from thing.html)
- **Purpose**: Query individual board games by BGG Thing ID
- **Features**:
  - Look up any board game by its BoardGameGeek ID
  - View complete XML API response from BGG
  - Examples: 144733 (Dead of Winter), 167791 (Terraforming Mars), 224517 (Brass: Birmingham)
  - Error handling and validation
  - Copy-paste ready XML output
- **API Endpoint**: `/api/bgg-thing?id={thingId}`

---

## 📝 Updated App

### 4. **credits.html** - Arcade Credits Roller (Enhanced)
- **Purpose**: Display game covers in arcade-style rolling credits
- **New Features Added**:
  - **BGG Collection Support**: Optional - enter BGG username to use your collection
  - **Collection Filters** (shown when BGG username is entered):
    - Own Games ✓
    - Previously Owned
    - Want to Play
    - Want to Buy
  - **Dual Data Source**:
    - Default: RAWG API (video games)
    - Optional: BGG Collection (board games)
- **Existing Features Preserved**:
  - Classic Roll (Bottom to Top)
  - Fireworks Launch (Tap to Launch)
  - Image Rain (Passive Drop)
  - Speed Control
  - Sort Options (Random, Title, Rating, Year)
- **UI/UX**: Leave BGG username empty to use RAWG API; enter username to use collection

---

## 🔗 API Integration Pattern

All new apps use the same API pattern:
```javascript
fetch(`/api/bgg-helper?endpoint=collection&username=${username}&filters&stats=1`)
```

**Available Parameters**:
- `own=1` - User's owned games
- `prevowned=1` - Previously owned games
- `wanttoplay=1` - Want to play games
- `wanttobuy=1` - Want to buy games
- `includeexpansions=1` - Include expansion packs
- `stats=1` - Include game statistics (ratings, players, playtime)

---

## 🎨 UI Framework

All apps use:
- **Tailwind CSS** for responsive design
- **Modal Screens**: Setup → Loading → Game/Display
- **Dark/Light Themes**: Adaptive styling
- **Mobile Responsive**: Works on all screen sizes

---

## 🚀 How to Use Each App

### CollectionAPI
1. Open `collectionapi.html`
2. Enter BGG username (default: "sportomax")
3. Select collection filters (Own, Previously Owned, etc.)
4. Click "Load Collection"
5. Search, sort, and browse games

### Hunt
1. Open `hunt.html`
2. Enter BGG username (default: "sportomax")
3. Set round time (10-300 seconds)
4. Choose Solo or Competition mode
5. Click "Start Hunt"
6. Find the games displayed before time runs out!

### ThingAPI
1. Open `thingapi.html`
2. Enter a BoardGameGeek ID (e.g., 144733)
3. Click "Fetch Thing Data"
4. View complete XML response

### Credits (Enhanced)
1. Open `credits.html`
2. **For RAWG API**: Leave username blank → Select mode → Click "START CREDITS"
3. **For BGG Collection**: Enter BGG username → Select filters → Select mode → Click "START CREDITS"

---

## 📦 Files Modified/Created

✅ **Created**:
- `collectionapi.html` (372 lines)
- `hunt.html` (401 lines)
- `thingapi.html` (254 lines - renamed from `thing.html`)

✅ **Updated**:
- `credits.html` - Added BGG collection support with filters

✅ **Git Status**:
- All files committed: `9e306db`
- All files pushed to GitHub: `e0dbf05`

---

## 🔐 Authentication

- ✅ **No Password Required**: All new apps use optional username input
- ✅ **Default Usernames**: Hunt and CollectionAPI default to "sportomax"
- ✅ **Flexible**: Users can enter their own BGG username

---

## ⚡ Performance Optimizations

1. **Duplicate Removal**: Collection data is deduplicated by game name
2. **Lazy Loading**: Images load on demand
3. **Efficient Sorting**: Games are sorted client-side for instant filtering
4. **Error Handling**: Graceful fallbacks for missing images or API failures

