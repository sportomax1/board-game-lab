# Game Matchup Tracker - Complete Documentation

## Overview

**matchup.html** is an advanced tournament and matchup simulator for board games. It allows users to run multiple types of tournament formats, track game performance using ELO ratings, and generate exciting bracket-based competitions directly from their BGG collection.

**URL**: `/matchup.html`  
**Version**: v1.4 (Swiss format, average rating fix, upset images)  
**Auth**: Password-protected (env: `PASSWORD`)  
**Dependencies**: Firebase (Firestore), BGG API, Canvas Confetti

---

## 🎮 Core Features

### 1. Password Authentication
- **Requirement**: Password stored in Vercel `PASSWORD` environment variable
- **Persistence**: Password saved in browser localStorage
- **BGG Username**: Required input, also saved in localStorage
- **Session**: Must enter password on each visit (can be remembered)

### 2. Collection Loading
- **Source**: BGG Collection API v2 with authenticated proxy (`/api/bgg-helper?endpoint=collection`)
- **Filters**:
  - Own ✓ (default checked)
  - Previously Owned
  - Want to Play
  - Want to Buy
  - Exclude Expansions (default checked)
- **Data Loaded**:
  - Game ID, Name, Rating, Weight
  - BGG Rank, User Collection Status
  - Play statistics (if stats=1 parameter)

### 3. Tournament Types

#### 🎲 FREEPLAY (Non-Tournament)
- Random game selection from eligible pool
- Games picked from randomized matchup queue
- Runs before tournament modes (prerequisite)
- **Matchup Modes** (How games are selected):
  - **Random Selection**: Full random pool, Top ELO, Bottom ELO
  - **Divided Buckets**: Games grouped by stat (appearances/ELO), random within group
  - **Ordered Sequence**: Deterministic order (lowest apps → most apps → most wins, etc.)

#### 🏆 SINGLE ELIMINATION BRACKET
- **Structure**: Power-of-2 bracket (2, 4, 8, 16, 32 participants)
- **Pairings**: Generated from randomized game pool
- **Advancement**: Winner advances, loser eliminated
- **Results**: Visual bracket display with winner highlighted
- **Finals**: Confetti celebration on tournament completion
- **H-Index Calculation**: Games with H-index rank (winner and finalists highlighted)

#### 🎲 ROUND ROBIN
- **Structure**: Every game plays every other game once (N choose 2 matchups)
- **Rounds**: Automatically progresses through all pairings
- **Standings**: Win-Loss records, head-to-head results
- **Scoring**: Win = 1 point, Loss = 0 points
- **Winner**: Game with most wins (ties possible)

#### 🏊 POOL PLAY + BRACKET
- **Phase 1 (Pool Play)**:
  - Games divided into pools (configurable size: 3-6 games per pool)
  - Multiple pools (2-10 pools)
  - Round-robin within each pool
  - Top teams advance to bracket
  - Configurable advancement (Top 1, 2, or 3 per pool)
  
- **Phase 2 (Bracket)**:
  - Advancing teams form elimination bracket
  - Standard bracket progression
  - Bracket size auto-calculated from advancing teams

#### 📊 SWISS SYSTEM
- **Structure**: Fixed 10 rounds maximum, score-based pairing
- **Scoring**: Win = 3 points, Loss = 0 points
- **Pairing**: Games paired with similar records (score-based matching)
- **Auto-Progression**: Continues until unique winner or max rounds reached
- **Advantages**: Optimal for ~16 games, all teams play meaningful rounds

---

## 🛠️ Advanced Tournament Settings

### Bracket Configuration
- **Bracket Size**: 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20 participants
- **Auto-Seed**: Games can be seeded by ELO or random

### Pool Play Configuration
- **Pool Size**: 3, 4, 5, or 6 games per pool
- **Number of Pools**: 2-10 pools
- **Pool Info Display**: Shows total matchups and distribution
- **Advancement Options**: Top 1, 2, or 3 per pool

### Matchup Modes (Random Selection)

| Mode | Selection Method | Use Case |
|------|------------------|----------|
| **All Games** | Completely random from full pool | Default, balanced matchups |
| **Top ELO** | Random from top-rated games | Test strongest games |
| **Bottom ELO** | Random from lowest-rated games | Challenge weakest games |

### Matchup Modes (Bucket Division)

| Mode | Selection Method | Use Case |
|------|------------------|----------|
| **Top Half by Appearances** | Random from most-played games | Feature popular games |
| **Bottom Half by Appearances** | Random from least-played games | Promote underplayed games |
| **Middle Half by Appearances** | Random from mid-frequency games | Balanced experience |
| **Top/Bottom/Middle Half by ELO** | Random from rating-based tiers | Skill-based selection |

### Matchup Modes (Ordered Sequence)

| Mode | Selection Method | Use Case |
|------|------------------|----------|
| **Lowest Appearances** | 0→1→2... (ascending) | Fair play guarantees |
| **Most Appearances** | Descending by play count | Spotlight popular games |
| **Most Wins** | Ranked by wins (descending) | Feature champions |
| **Least Wins** | Ranked by wins (ascending) | Help underperformers |
| **Most Losses** | Ranked by losses (descending) | Challenge failed games |
| **Least Losses** | Ranked by losses (ascending) | Showcase winners |

---

## 📊 Rating System (ELO + Custom)

### ELO Calculation
```
Base ELO = 50 * (Win% - 0.5)
  where Win% = wins / (wins + losses)
```

### ELO Modifiers
1. **BGG Rating Boost** (+5 per point above 5.0)
   - Example: 7.5 rating = +12.5 ELO bonus
   
2. **Appearance Penalty** (-0.5 per 5 appearances)
   - Encourages underplayed games
   - Formula: -0.1 * floor(appearances / 5)

3. **Game Name Bonus** (+1 for certain keywords)
   - "Expansion" keyword: 0 bonus
   - Otherwise: +1 ELO
   
4. **Opponent Quality** (+0.2 per unique opponent)
   - Games playing varied opponents rated higher
   - Formula: +0.2 * unique_opponents

**Final ELO** = Base + BGG Boost + Appearance Penalty + Name Bonus + Opponent Quality

### Appearance Tracking
- Every matchup increments appearance counter
- Used in "Appearances" matchup modes
- Displayed in standings and game cards

---

## 🎯 Results & Statistics

### Live Statistics Display
- **Appearances**: How many matchups game has played
- **Record**: Wins-Losses
- **Win Rate**: Percentage (wins / total appearances)
- **ELO Rating**: Calculated based on formula above
- **BGG Rating**: Original BoardGameGeek rating

### Achievement System
- **Milestones**:
  - 1st Appearance: "First Blood" 🎯
  - Undefeated: "Perfect Record" 🏆
  - 10th Appearance: "Veteran" 📊
  - 25th Appearance: "Legend" 👑
  - First Tournament Win: "Champion" 🥇

### H-Index Calculation
- **Definition**: Largest N where game has N wins OR N appearances
- **Example**: 5 wins + 7 appearances = H-Index of 5
- **Display**: "H-Index: 5" in statistics
- **Achievement Modal**: Shows all games with target H-Index

### Tournament Results View
- **Bracket Display**: Visual representation of all rounds
- **Standings**: Final rankings with records
- **Path to Victory**: Game progression through bracket
- **Statistics**: Win rates, opponent analysis

---

## 💾 Data Persistence (Firebase)

### Firestore Structure
```
matchups/
  [sessionId]/
    gameMatchups (array)
    tournamentResults (array)
    startTime
    endTime
    mode
    format
```

### Saved Data
1. **Game Matchups**: Each comparison result
   - `{ winner, loser, timestamp, notes }`
2. **Tournament Results**: Final standings
   - `{ winner, finalists, bracketTree, rounds }`
3. **Session Info**: Metadata
   - Start time, end time, mode used, total matchups

### Data Sync
- Real-time saving to Firestore on each matchup
- Loading historical data on app start
- Manual session loading via history tab

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Q` | Quick select winner (left game) |
| `P` | Quick select winner (right game) |
| `S` | Skip matchup |
| `N` | New matchup |
| `H` | Show help/shortcuts |
| `T` | Toggle tournament mode |
| `R` | Reset session |
| `Ctrl+Enter` | Confirm selection |

---

## 🎨 UI Components

### Password Screen
- Gradient background (blue → purple)
- Password input field
- BGG username input (required)
- "Enter App" button
- Error message display

### Main Matchup Screen
- **Left Panel**: Game card with image, name, stats
- **Right Panel**: Opponent game card
- **Center**: Action buttons (Select Winner, Skip, Notes)
- **Tabs**: Matchups, History, Tournament, Settings

### Matchup Card Display
- **Aspect Ratio**: 1:1 (square images)
- **Image Object-Fit**: Contain (no crop/zoom)
- **Background**: Gray (#f3f4f6)
- **Stats Display**:
  - Appearances + Record
  - ELO Rating + BGG Rating
  - H-Index

### Tournament Visualization
- **Bracket Tree**: Rounds displayed horizontally
- **Game Cards**: Clickable results
- **Progression Arrows**: Show advancement
- **Winner Highlight**: Confetti + gold styling

---

## 🔄 Data Flow

1. **User Login**
   - Enters password + BGG username
   - Firebase initializes
   - Collection loaded from BGG API
   - Historical matchups loaded from Firestore

2. **Game Selection**
   - Queue rebuilt based on matchup mode
   - Next pairing selected from queue
   - Game stats refreshed from history

3. **Matchup Recording**
   - User selects winner
   - ELO calculations executed
   - Firestore saves result
   - Live stats updated
   - Achievement checks run
   - Confetti (if celebration triggered)

4. **Tournament Progression**
   - Bracket/pool structure initialized
   - Matches generated per format
   - Results recorded per match
   - Advancement calculated
   - Next round generated automatically

---

## 🐛 Error Handling

### Tailwind CSS Error Suppression
- Aggressive error suppression for dataset errors
- Null element access prevention
- Promise rejection handling

### BGG API Retry Logic
- **Retries**: Up to 5 attempts
- **Backoff**: Exponential (1s, 2s, 4s, 8s, 16s)
- **Status 202**: Queued response, retry after delay
- **Status 429**: Rate limited, backoff applied
- **Timeout**: 30 seconds per request

### Data Validation
- Required fields checked before save
- Opponent pairs validated (no self-matchups)
- ELO calculations verified (no NaN)

---

## 📱 Mobile Optimization

- **Viewport**: No zoom allowed (user-scalable=no)
- **Touch**: Tap-to-select supported
- **Double-Tap Prevention**: Prevents duplicate records
- **Responsive Layout**: Adapts to screen size
- **Landscape**: Horizontal card layout
- **Portrait**: Vertical card stack

---

## 🔐 Security Notes

- **Password**: Hashed in Firestore (not stored client-side)
- **BGG Username**: Public (used for API calls)
- **Firebase Auth**: Required for data access
- **CORS**: Image proxy used for external images
- **localStorage**: Stores session data only (no sensitive data)

---

## 🚀 Deployment

### Environment Variables Required
```
FIREBASE_PROJECT_ID=...
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
PASSWORD=... (for app access)
```

### Vercel Functions Used
- `/api/bgg-helper` - BGG API proxy (collection, thing endpoints)
- `/api/firebase-config` - Firebase credentials
- `/api/image-proxy` - CORS bypass for game images

### Performance Considerations
- Collection loading: ~2-5 seconds for 200+ games
- Tournament initialization: ~1 second for 16+ participants
- Bracket rendering: ~500ms for 32-game bracket
- Live statistics: Real-time updates (<100ms)

---

## 📚 Related Documentation

- **checkout.html**: Game checkout/loan tracking
- **FILE_DEPENDENCIES.md**: API and file dependencies
- **compare.md**: Technical comparison of all apps

---

Generated: 2025-12-05
