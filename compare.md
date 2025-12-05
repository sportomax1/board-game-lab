# BGG App Technical Comparison Chart

## Mobile & Settings Comparison

| App | iPhone Optimized | Settings Modal | Default Username | Primary Settings |
|-----|-----------------|----------------|------------------|------------------|
| **hangman.html** | ✅ | ✅ | sportomax | Username, Include Expansions, Auto-provide Special Chars, Auto-provide Numbers |
| **scramble.html** | ✅ | ✅ | sportomax | Username, Include Expansions, Mode (Name/Image) |
| **puzzle.html** | ✅ | ✅ | sportomax | Username, Include Expansions, Piece Count (4/9/16/25) |
| **wordle.html** | ✅ | ✅ | sportomax | Username, Include Expansions, Word Length (4-8), Max Guesses (3-8) |
| **questions.html** | ✅ | ✅ | sportomax | Username, Include Expansions |
| **rankup.html** | ✅ | ✅ | sportomax | Username, Include Expansions, Rank Category, Sort By |
| **startbenchcut.html** | ✅ | ✅ | sportomax | Username, Include Expansions, Games Per Category (1-5) |
| **user.html** | ✅ | ✅ | sportomax | Username |
| **metermaster.html** | ✅ | ✅ | sportomax | Username, Sort Category (Weight/Average/Rank/User Rating) |
| **rostercap.html** | ✅ | ✅ | sportomax | Username, Budget ($15-30) |
| **wrapped.html** | ✅ | ✅ | sportomax | Username, Year |
| **timer.html** | ✅ | ⚠️ (Setup) | N/A | Player Count, Player Names, Time Limit |
| **ranks.html** | ✅ | ⚠️ (Setup) | None (optional) | Category, Optional Username |
| **hunt.html** | ✅ | ✅ | None | Username, Mode (Solo/Competition), Time Limit |
| **bracket.html** | ✅ | ✅ | None | Username, Bracket Size, Type |
| **collection.html** | ✅ | ⚠️ (Inline) | None | Username, Filters, Sort |
| **videos.html** | ✅ | ✅ | None | Username |
| **forums.html** | ✅ | ✅ | None | Username |
| **marketplace.html** | ✅ | ✅ | None | Search Filters, Price Range |

## API Integration Comparison

| App | Collection API v2 | Stats API | Plays API | User API | Browse API | Thing API | Other APIs |
|-----|-------------------|-----------|-----------|----------|------------|-----------|------------|
| **hangman.html** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | - |
| **scramble.html** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | - |
| **puzzle.html** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | - |
| **wordle.html** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | - |
| **questions.html** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | - |
| **rankup.html** | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | - |
| **startbenchcut.html** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | - |
| **user.html** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | - |
| **metermaster.html** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | - |
| **rostercap.html** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | - |
| **wrapped.html** | ✅ | ❌ | ✅ (paginated) | ❌ | ❌ | ❌ | - |
| **timer.html** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | - |
| **ranks.html** | ⚠️ (optional) | ⚠️ (optional) | ❌ | ❌ | ✅ | ❌ | - |
| **hunt.html** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | - |
| **bracket.html** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | - |
| **collection.html** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | - |
| **videos.html** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Videos API |
| **forums.html** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | Forums API |
| **marketplace.html** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | Marketplace API |

## iPhone Optimization Features

| Feature | Implementation | Apps Using |
|---------|----------------|------------|
| **viewport-fit=cover** | `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no">` | All new game apps |
| **Safe Area Insets** | `padding: max(env(safe-area-inset-top), 0) ...` in body CSS | All new game apps |
| **16px Font Inputs** | `input, select, button { font-size: 16px; }` prevents zoom | All new game apps |
| **44x44px Touch Targets** | Buttons/interactive elements minimum size | All new game apps |
| **Apple Web App Meta** | `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` | All new game apps |
| **No User Scaling** | `user-scalable=no` in viewport | All new game apps |
| **Sticky Headers** | `position: sticky; top: 0` for navigation | Most apps |

## Technical Architecture Patterns

### Pattern 1: Full Settings Modal → API → App Flow
**Apps:** hangman, scramble, puzzle, wordle, questions, rankup, startbenchcut, user, metermaster, rostercap, wrapped

**Structure:**
1. Fixed fullscreen settings modal (z-50) with gradient background
2. Settings form with Tailwind-styled inputs
3. "Start Game" button triggers API load
4. Hide modal, show main app div
5. Header with Info/Settings buttons for re-access
6. Main content area with game-specific UI

**Code Example:**
```html
<div id="settingsModal" class="fixed inset-0 bg-gradient-to-br from-purple-900 to-blue-900 z-50">
  <!-- Settings form -->
  <button onclick="startGame()" class="w-full bg-purple-600 text-white py-4">Start Game</button>
</div>
<div id="app" class="hidden flex-1 flex flex-col">
  <header class="sticky top-0"><!-- Info/Settings buttons --></header>
  <main><!-- Game content --></main>
</div>
```

### Pattern 2: Inline Settings with Live Updates
**Apps:** collection, ranks (hybrid), marketplace

**Structure:**
1. Settings visible in sidebar or top bar
2. Changes immediately re-filter/re-sort data
3. No modal overlay required
4. Good for browse-heavy apps

### Pattern 3: Setup Screen → Single Page
**Apps:** timer, bracket

**Structure:**
1. Initial setup screen collects all info
2. Transitions to single-page app
3. Back to settings via button (sometimes)

## API Call Patterns

### Collection API v2 Standard Call
```javascript
const res = await fetch(`/api/bgg-helper?endpoint=collection&username=${encodeURIComponent(username)}&own=1&subtype=boardgame&stats=1`);
const xml = await res.text();
const parser = new DOMParser().parseFromString(xml, 'text/xml');
const items = Array.from(parser.querySelectorAll('item'));
```

**Used by:** hangman, scramble, puzzle, wordle, questions, rankup, startbenchcut, metermaster, rostercap, collection, hunt, bracket

**Data Extracted:**
- `objectid` - Game BGG ID
- `name` - Game title
- `thumbnail/image` - Cover art URLs
- `stats > rating > average` - Average rating
- `stats > rating > averageweight` - Complexity weight
- `stats > rating > rank` - BGG rankings by type
- `stats > rating > usersrated` - Number of ratings

### Plays API with Pagination
```javascript
let page = 1;
let allPlays = [];
while (page === 1 || playsXml.querySelector('plays').getAttribute('page') < totalPages) {
  const res = await fetch(`/api/bgg-helper?endpoint=plays&username=${username}&mindate=${year}-01-01&maxdate=${year}-12-31&page=${page}`);
  const xml = await res.text();
  const playsXml = new DOMParser().parseFromString(xml, 'text/xml');
  // Process plays...
  page++;
}
```

**Used by:** wrapped.html

### User API Call
```javascript
const res = await fetch(`/api/bgg-helper?endpoint=user&name=${username}`);
const xml = await res.text();
const parser = new DOMParser().parseFromString(xml, 'text/xml');
const user = parser.querySelector('user');
```

**Used by:** user.html

**Data Extracted:**
- Avatar URL, firstname, lastname
- Join date (yearregistered, stateorprovince, country)
- Buddies list (buddy tags)
- Guilds (guild tags)
- Top/Hot games lists
- Trade/marketplace stats

### Browse/Hot API
```javascript
const res = await fetch(`/api/bgg-helper?endpoint=hot&type=boardgame`);
// OR
const res = await fetch('/api/bgg-helper?endpoint=browse&type=boardgame&sortby=rank');
```

**Used by:** ranks.html, hotgames.html

## Data Processing Patterns

### Random Game Selection
```javascript
// Filter collection first
const eligibleGames = collection.filter(game => {
  if (!includeExpansions && game.type === 'expansion') return false;
  return true;
});
// Pick random
const randomGame = eligibleGames[Math.floor(Math.random() * eligibleGames.length)];
```

### Sorting by Stats
```javascript
// Sort by rank value (ascending - lower is better)
games.sort((a, b) => a.rank - b.rank);

// Sort by average rating (descending - higher is better)
games.sort((a, b) => b.average - a.average);

// Sort by weight/complexity
games.sort((a, b) => b.weight - a.weight);
```

### Filtering by Ownership Status
```javascript
// ranks.html pattern
const collectionData = {}; // { gameId: { owned: true, prevowned: false } }

// Load collection
const items = parser.querySelectorAll('item[subtype="boardgame"]');
items.forEach(item => {
  const id = item.getAttribute('objectid');
  const status = item.querySelector('status');
  collectionData[id] = {
    owned: status?.getAttribute('own') === '1',
    prevowned: status?.getAttribute('prevowned') === '1'
  };
});

// Filter display
function filterByStatus(status) {
  const filtered = allGames.filter(game => {
    if (status === 'owned') return collectionData[game.id]?.owned;
    if (status === 'prevowned') return collectionData[game.id]?.prevowned;
    return true; // 'all'
  });
}
```

## Game Mechanics Implemented

| Mechanic | Apps | Implementation |
|----------|------|----------------|
| **Word Guessing** | hangman, wordle | Letter-by-letter reveal with keyboard input |
| **Puzzle Assembly** | puzzle, scramble (image mode) | Drag-and-drop with snap-to-grid positioning |
| **Text Scrambling** | scramble (name mode) | Array shuffle with preserved special chars |
| **Yes/No Questions** | questions | Question type buttons, answer validation |
| **Type-to-Fill Ranking** | rankup | Text input matching against ranked list |
| **Drag Categorization** | startbenchcut | Drag-and-drop zones with count validation |
| **Budget Management** | rostercap | Cost calculation with running total |
| **Range Sorting** | metermaster | Click-to-place in stat ranges |
| **Timer Tracking** | timer, hunt | Countdown/countup with turn history |
| **Profile Display** | user | Data extraction and card layout |

## UI Component Patterns

### Info Modal
```javascript
<div id="infoModal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50">
  <div class="bg-white rounded-2xl p-6 max-w-md">
    <h2>ℹ️ How to Play</h2>
    <div class="space-y-3 text-gray-700">
      <p>• Instruction 1</p>
      <p>• Instruction 2</p>
    </div>
    <button onclick="closeInfo()">Got it!</button>
  </div>
</div>

function showInfo() { document.getElementById('infoModal').classList.remove('hidden'); }
function closeInfo() { document.getElementById('infoModal').classList.add('hidden'); }
```

### Stats Header Cards
```javascript
<div class="bg-white rounded-xl shadow-sm p-4 mb-4">
  <div class="flex justify-between items-center">
    <div>
      <p class="text-sm text-gray-600">Label</p>
      <p class="text-3xl font-bold text-blue-600">Value</p>
    </div>
    <div class="text-right">
      <p class="text-sm text-gray-600">Label 2</p>
      <p class="text-3xl font-bold text-green-600">Value 2</p>
    </div>
  </div>
</div>
```

### Game Card Display
```javascript
<div class="bg-white rounded-lg shadow p-3 hover:shadow-lg transition">
  <img src="${game.image}" class="w-full h-32 object-cover rounded mb-2">
  <h3 class="font-bold text-sm">${game.name}</h3>
  <p class="text-xs text-gray-600">⭐ ${game.average}</p>
  <p class="text-xs text-gray-600">⚖️ ${game.weight}</p>
</div>
```

### Header with Action Buttons
```javascript
<header class="bg-white shadow-sm sticky top-0 z-30 px-4 py-3">
  <div class="max-w-6xl mx-auto flex items-center justify-between">
    <h1 class="font-bold text-xl">🎮 App Name</h1>
    <div class="flex gap-2">
      <button onclick="showInfo()" class="p-2 text-blue-500 hover:bg-blue-50 rounded-lg">
        <!-- Info SVG icon -->
      </button>
      <button onclick="showSettings()" class="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
        <!-- Settings SVG gear icon -->
      </button>
    </div>
  </div>
</header>
```

## Styling Conventions

### Tailwind CDN
All apps use: `<script src="https://cdn.tailwindcss.com"></script>`

### Color Schemes by App
- **hangman** - Purple/Indigo gradient (`from-purple-900 to-indigo-900`)
- **scramble** - Blue/Purple gradient (`from-blue-900 to-purple-900`)
- **puzzle** - Green/Teal gradient (`from-green-900 to-teal-900`)
- **wordle** - Teal/Cyan gradient (`from-teal-900 to-cyan-900`)
- **questions** - Purple/Pink gradient (`from-purple-900 to-pink-900`)
- **rankup** - Blue/Indigo gradient (`from-blue-900 to-indigo-900`)
- **startbenchcut** - Amber/Orange gradient (`from-amber-900 to-orange-900`)
- **user** - Indigo/Purple gradient (`from-indigo-900 to-purple-900`)
- **metermaster** - Orange/Red gradient (`from-orange-900 to-red-900`)
- **rostercap** - Teal/Green gradient (`from-teal-900 to-green-900`)

### Common Class Patterns
- Cards: `bg-white rounded-xl shadow-sm p-4`
- Buttons: `bg-{color}-600 text-white py-3 rounded-lg font-bold hover:bg-{color}-700`
- Inputs: `w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-{color}-500 outline-none`
- Grids: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`

## Error Handling Patterns

### Standard Try-Catch
```javascript
try {
  const res = await fetch(`/api/bgg-helper?endpoint=collection...`);
  const xml = await res.text();
  const parser = new DOMParser().parseFromString(xml, 'text/xml');
  // Process data...
} catch (error) {
  alert('Error: ' + error.message);
  location.reload();
}
```

### Loading States
```javascript
document.getElementById('settingsModal').innerHTML = '<div class="text-white text-center">Loading...</div>';
// OR
const loadingDiv = document.createElement('div');
loadingDiv.textContent = 'Loading collection...';
```

## Performance Optimizations

| Optimization | Implementation | Apps |
|--------------|----------------|------|
| **Limit Collection Size** | `.slice(0, 20)` or `.slice(0, 50)` | questions, metermaster, startbenchcut |
| **Batch API Calls** | Loop through games in chunks | forums, videos |
| **Pagination Support** | Handle multi-page API responses | wrapped |
| **Lazy Image Loading** | `loading="lazy"` attribute | collection, videos |
| **Debounced Search** | setTimeout on input events | collection, marketplace |

## Summary: App Architecture Tiers

### Tier 1: Complete Game Apps (Modern Standard)
Settings modal → Collection API v2 → Stats integration → Game mechanics → iPhone optimized → Info modal
- hangman, scramble, puzzle, wordle, questions, rankup, startbenchcut, metermaster, rostercap

### Tier 2: Specialized Apps
Focused purpose, may skip some standard patterns but fully functional
- user (User API instead of Collection), wrapped (Plays API with pagination), timer (no API)

### Tier 3: Browse & Discovery
Inline settings, continuous browsing experience
- collection, ranks, marketplace, videos, forums

### Tier 4: Utility & Tools
Simple purpose-built tools without full app framework
- thingapi, dice, firstplayer, scorepad
