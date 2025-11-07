# Game Matchup Tracker - Feature List

## ✅ Implemented Features

### Core Matchup Functionality
- **Swipe/Tap Selection**: Choose winners by swiping or tapping on game cards
- **Double-Tap Prevention**: Prevents duplicate saves when tapping quickly
- **Matchup Notes**: Add optional notes to each matchup
- **Skip Matchup**: Skip current pairing and get a new one
- **Session Tracking**: Track matchups completed in current session
- **Session Checkpoints**: Warning prompt every 10 matchups

### Authentication & Security
- **Password Protection**: App requires password (stored in Vercel PASSWORD env var)
- **Remember Password**: Password saved in browser localStorage
- **BGG Username**: Saved in localStorage for convenience

### Collection Management
- **BGG Integration**: Load games from BoardGameGeek collection via authenticated API
- **Collection Filters**: Filter by owned, previously owned, want to play, want to buy
- **Expansion Filter**: Option to exclude expansions from matchups
- **Matchup Modes**:
  - **All**: All games in collection
  - **Used Only**: Only games that have been in matchups
  - **New Only**: Only games never used in matchups
  - **Hybrid**: Mix of used and new games

### Auto-Pairing Modes
- **Random** (default): Completely random pairings
- **Rating Bracket**: Pair games in same rating range (0-6, 6-7, 7-8, 8+)
- **Weight Class**: (Requires additional API data - playtime)
- **Theme-Based**: (Requires additional API data - categories)
- **Auto Toggle**: Enable/disable auto-pairing mode

### Dashboard & Analytics

#### Matchups Tab
- View all matchup history
- Search matchups by game name or notes
- Sort by recent or oldest
- Edit matchup notes
- Delete individual matchups
- Click to view raw Firebase data

#### Standings Tab
- **Game Rankings**: Overall win-loss records
- **Win Percentage**: Calculated for each game
- **Search**: Filter standings by game name
- **Click Game**: View all matchups for that specific game
- **Game History Modal**: See wins/losses with timestamps

#### Streaks Tab
- **Current Streaks**: Games on hot (winning) or cold (losing) streaks
- **Longest Win Streak**: Best winning streak per game
- **Longest Lose Streak**: Worst losing streak per game
- **Visual Indicators**: 🔥 for hot streaks, ❄️ for cold streaks

#### Upsets Tab
- **Upset Detection**: Lower-ranked game beating higher-ranked
- **Upset Magnitude**: Shows rank difference (e.g., #10 beats #3 = magnitude 7)
- **Sorted by Impact**: Biggest upsets shown first
- **No Upsets Message**: Shows when no upsets have occurred

### Utility Features
- **Undo Last Matchup**: Delete most recent matchup and restore session count
- **CSV Export**: Download all matchups as CSV file with date, winner, loser, notes
- **Today's Count**: Track matchups completed today
- **Total Games**: Display total games loaded from collection
- **Reset Session**: Manually reset session counter

### Gamification
- **Achievement System**: Unlock achievements for milestones
- **Achievement Banner**: Auto-displays new achievements for 5 seconds
- **Achievements**:
  - 🎉 First Matchup
  - 🔟 Ten Matchups
  - 🎯 Half Century (50)
  - 💯 Century (100)
  - 🏆 Master (500)

### Data Storage
- **Firebase Firestore**: Persistent cloud storage for all matchups
- **localStorage**: Stores username, password hint, achievements
- **Real-time Sync**: Dashboard updates reflect Firebase data

### UI/UX
- **Responsive Design**: Mobile-first with Tailwind CSS
- **Dark Cards**: Stylish game cards with gradients
- **Loading States**: Shows loading spinner during API calls
- **Animations**: Card swipe animations on winner selection
- **Modals**: Continue prompt, game history, raw data viewer
- **Image Display**: object-fit: contain (no zoom on thumbnails)

## 🔄 Partial Implementations

### Auto-Pairing Modes (Limited)
- **Rating Bracket**: ✅ Fully working
- **Weight Class**: ⚠️ Requires additional BGG API calls for playtime data
- **Theme-Based**: ⚠️ Requires additional BGG API calls for category/mechanic data

**Note**: To implement weight-class and theme-based pairing, the `loadGames` function would need to make additional API calls to get game details (playtime, categories, mechanics) for each game. This would significantly slow down the initial load.

## 📝 Implementation Notes

### Rating Bracket Pairing
When auto-pairing mode is set to "rating-bracket" and the Auto toggle is enabled:
- Games are grouped into rating ranges: 0-6, 6-7, 7-8, 8+
- System finds a bracket with at least 2 games
- Randomly selects 2 games from the same bracket
- Ensures fair matchups between similarly-rated games

### Undo Functionality
- Stores the document ID of the last saved matchup
- Deletes from Firebase and removes from local cache
- Decrements session count and today's count
- Hides undo button after use
- Refreshes dashboard if currently viewing it

### CSV Export
- Generates standard CSV format with headers
- Escapes quotes in notes field
- Includes all matchup data (date, winner, loser, notes)
- Downloads with timestamp in filename

### Streak Calculation
- Tracks win/loss history for each game
- Calculates current streak (positive for wins, negative for losses)
- Finds longest winning and losing streaks
- Sorts by current streak magnitude

### Upset Detection
- Builds rankings based on total wins
- Compares winner rank vs loser rank for each matchup
- Only counts as upset if lower-ranked (higher number) beats higher-ranked
- Calculates magnitude as rank difference
- Sorts upsets by magnitude (biggest first)

### Achievement System
- Stored in localStorage as JSON
- Checked after each matchup save
- Auto-displays banner for 5 seconds
- Prevents duplicate achievement notifications

## 🚀 Future Enhancement Ideas

### Enhanced Auto-Pairing (Requires BGG API Changes)
To implement weight-class and theme-based pairing, you would need to:

1. **Modify loadGames function** to fetch game details:
```javascript
// After loading collection, fetch details for each game
for (const game of allGames) {
    const details = await fetchBGG('thing', { id: game.id });
    // Parse XML to extract:
    // - playtime (minplaytime, maxplaytime)
    // - categories (boardgamecategory)
    // - mechanics (boardgamemechanic)
    game.playtime = parsePlaytime(details);
    game.categories = parseCategories(details);
    game.mechanics = parseMechanics(details);
}
```

2. **Update getSmartPair function** with new logic:
```javascript
// Weight-class pairing
const brackets = {
    'quick': games.filter(g => g.playtime < 60),
    'medium': games.filter(g => g.playtime >= 60 && g.playtime < 120),
    'long': games.filter(g => g.playtime >= 120 && g.playtime < 180),
    'epic': games.filter(g => g.playtime >= 180)
};

// Theme-based pairing
const game1 = games[Math.floor(Math.random() * games.length)];
const similarGames = games.filter(g => 
    g.categories.some(cat => game1.categories.includes(cat)) ||
    g.mechanics.some(mech => game1.mechanics.includes(mech))
);
```

**Warning**: This would make initial load very slow (one API call per game).

### Additional Features
- **Head-to-Head Records**: Show all matchups between any two specific games
- **Player Stats**: Track which user made selections
- **Multiplayer Mode**: Allow multiple users to vote on matchups
- **Tournament Mode**: Run brackets/Swiss rounds
- **Data Backup**: Export/import all Firebase data
- **Chart Visualizations**: Win rate trends over time
- **Game Details**: Show BGG rank, complexity, player count on cards
- **Custom Filters**: Filter by year, player count, playtime before loading
- **Image Gallery**: Full-size game images in lightbox
- **Mobile App**: PWA or native app version

## 🔧 Technical Stack
- **Frontend**: HTML, CSS (Tailwind), JavaScript (ES6)
- **Backend**: Vercel Serverless Functions
- **Database**: Firebase Firestore
- **API**: BoardGameGeek XMLapi2 (via authenticated proxy)
- **Storage**: localStorage for client-side data
- **Hosting**: Vercel

## 📊 Data Model

### Matchup Document (Firebase)
```javascript
{
    winnerId: "12345",
    winnerName: "Gloomhaven",
    winnerImage: "https://...",
    loserId: "67890",
    loserName: "Wingspan",
    loserImage: "https://...",
    notes: "Optional notes",
    timestamp: Firestore.Timestamp
}
```

### Game Object (Runtime)
```javascript
{
    id: "12345",
    name: "Gloomhaven",
    year: "2017",
    image: "https://...",
    rating: 8.8,
    isExpansion: false
}
```

### Achievement Object (localStorage)
```javascript
{
    firstMatchup: true,
    tenMatchups: true,
    fiftyMatchups: false,
    hundredMatchups: false,
    fiveHundredMatchups: false
}
```
