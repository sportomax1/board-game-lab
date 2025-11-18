# Board Game Suite - Master Application Guide

A comprehensive collection of board game utilities and interactive tools built around BoardGameGeek (BGG) data. All apps are deployed on Vercel and support responsive mobile/desktop experiences.

---

## 🎮 Core Game Interaction Apps

### **Hunt** (`hunt.html`) - 🔍 Find Games in Collection
**Purpose**: Competitive/solo game discovery challenge with timer modes.

**Features**:
- Find games in your BGG collection through blind challenges
- **Timer Modes**:
  - Countdown: Race against time (30-900 seconds) to find games
  - Stopwatch: Complete X games (1-100) in any time
- **Modes**: Solo or 2-4 player competition
- **Scoring**: Track time-per-game or session totals
- **Sort Options**: By name, rating, year, playtime

**Technical**:
- Fetches collection from BGG API
- Real-time timer logic
- Per-game and session time tracking
- P1/P2 side-by-side display

---

### **Blur** (`blur.html`) - 👁️ Progressive Image Reveal Guessing Game
**Purpose**: Guess board games by progressively revealed images.

**Features**:
- **Timed Blur Mode**: Reduce blur over time to guess games
- **Mystery Mode**: Progressively expand the visible area (clip-path reveal) without changing blur
- Manual correct/wrong buttons for verification
- Collection filtering (Own, Prev Owned, Want to Play, etc.)
- Score calculation based on reveal percentage
- Session results tracking

**Technical**:
- CSS blur filter for progressive difficulty
- Clip-path animations for clip-reveal mode
- BGG integration for game data
- Dynamic scoring based on blur/reveal levels

---

### **Swipe** (`swipe.html`) - 💘 Card Swiper for Wishlist Building
**Purpose**: Build a wishlist by swiping through collection.

**Features**:
- Swipe left (pass) / right (save) card mechanics
- Session length control (5-100 games)
- Collection filtering by status
- **Session Controls**:
  - Exit button: Stop mid-session with progress saved
  - Results preview: View stats and recent saves
  - Undo button: Take back last decision
- Real-time save rate tracking
- Export wishlist to clipboard

**Technical**:
- Touch/mouse drag detection for swipe
- CSS animations (swiped-left, swiped-right)
- Session history for undo functionality
- Card stack rendering

---

### **Quiz** (`quiz.html`) - 🧠 BGG Collection Knowledge Test
**Purpose**: Test your knowledge of your game collection.

**Features**:
- Multiple-choice or entry mode questions
- Random game questions from your collection
- Score tracking
- Collection filtering options
- Real-time feedback on answers

**Technical**:
- BGG collection fetching
- Question randomization
- Mode selection (MC vs text entry)

---

### **Credits** (`credits.html`) - 🎬 Arcade-Style Game Rolls
**Purpose**: Display game collection with visual flair and entertainment.

**Features**:
- **Classic Mode**: Scrolling credits roll (1-492 games)
- **Fireworks Mode**: Tap to launch game images with animations
- **Rain Mode**: Animated falling game cards
- **Action Mode**: Random animations cycling through games
- Real-time speed control (0.5x - 3.0x)
- Sort by name, rating, year, playtime, or random
- Keyboard/mouse exit controls (ESC or X button)

**Technical**:
- CSS keyframe animations
- Dynamic animation duration based on speed multiplier
- Canvas for fireworks effects
- Multiple animation styles (slide, zoom, fade, bounce, rotate)
- 6+ animation directions

---

## 📚 Collection & Library Browsers

### **Collection Browser** (`collectionapi.html`) - 🎲 Full Collection View
**Purpose**: Browse your complete BGG collection with filtering and pagination.

**Features**:
- Full collection pagination (20 games per page)
- Collection status filtering (own, prev owned, want to play, etc.)
- Sort by: name, rating, year, plays, recently added
- Game detail cards with stats
- Search across collection
- BGG links for each game

**Technical**:
- BGG API collection endpoint
- XML parsing
- Lazy image loading
- Filter state management

---

### **Library Views** (`library_bgg.html`, `library_dte.html`, `library_dtw.html`) - 📖 Convention/Event Libraries
**Purpose**: Browse games from specific collections (BGG, DTE, DTW conventions/trips).

**Features**:
- Filter by collection status
- Sort and search capabilities
- Image display with fallbacks
- Pagination
- Statistics dashboards

**Technical**:
- XML file loading from local storage
- Dynamic filtering
- Fallback XML files for backup data

---

### **Hot Games** (`hotgames.html`) - 🔥 Currently Trending Games
**Purpose**: View trending games from BoardGameGeek.

**Features**:
- Real-time trending games
- User collection status indicators
- Sorting options
- Rating display

---

### **GeekList Viewer** (`geeklist.html`) - 📋 GeekList Browser
**Purpose**: View specific BGG geeklists (curated game lists).

**Features**:
- Fetch any BGG geeklist by ID
- Display all items with descriptions
- User collection status overlays
- Comment viewing

**Technical**:
- BGG geeklist API integration
- Item-by-item parsing
- Collection status comparison

---

## 🎯 Game Selection & Randomization

### **Random 9** (`random9.html`) - 🎲 9-Game Random Picker
**Purpose**: Build a visual grid of 9 random games with sort/filter options.

**Features**:
- Generate 9-game grids
- Drag to reorder (desktop & mobile)
- Sort before/after selection
- Player count filtering
- Weight filtering
- Playtime filtering
- Share as canvas image
- Re-sort and regenerate

**Technical**:
- Canvas rendering for image export
- Touch drag handling
- Image proxy for CORS issues
- Array shuffling and reordering

---

### **Checkout** (`checkout.html`) - 🛒 Multi-View Game Browser
**Purpose**: Browse collection with multiple view options (table, collage, random).

**Features**:
- **Table View**: Full sortable/filterable collection table
- **Collage View**: Visual grid of game images
- **Random View**: Single random picker with filters
- Player count filtering
- Search functionality

**Technical**:
- DOM manipulation for view switching
- HTML table generation
- Image grid layout

---

### **Tabletop** (`tabletop.html`) - 🎲 Airtable Integration Browser
**Purpose**: Browse games from Airtable with BGG collection status overlay.

**Features**:
- Connect to Airtable API
- BGG collection status indicators
- Search and filter
- Emoji status display

**Technical**:
- Airtable API fetching
- BGG collection cross-reference
- Custom field mapping

---

### **PubMeeple** (`pubmeeple.html`) - 🍺 Pub Game Finder
**Purpose**: Find games at local pub venues with play tracking.

**Features**:
- Browse games at various pub locations
- Play count tracking
- Session history

---

## 🛠️ Utility & API Tools

### **API Reference** (`api.html`) - 📖 BGG API Documentation
**Purpose**: Interactive documentation and testing interface for BGG API endpoints.

**Features**:
- All BGG API endpoints listed with parameters
- Endpoint filtering/searching
- Example requests
- Parameter documentation
- Real-time test capability (view XML responses)
- Card-based results display

**Endpoints Documented**:
- Collection, Thing, User, Hot, GeekList, Plays, Families, Publishers, Categories, Mechanics

**Technical**:
- Live API testing
- XML response parsing and display
- Parameter validation

---

### **BGG Helper API** (`api/bgg-helper.js`) - 🔗 Serverless Proxy
**Purpose**: Vercel serverless function for BGG API calls (bypasses CORS).

**Features**:
- Proxy for all BGG API endpoints
- Retries with exponential backoff
- CORS-friendly XML responses
- Parameter passing and validation

**Endpoints**: collection, thing, user, hot, geeklist, plays, family, etc.

---

### **Token Tester** (`token.html`) - 🔐 API Authentication Tester
**Purpose**: Test BGG API calls with manual tokens or environment secrets.

**Features**:
- Fetch individual game data by ID
- Manual token input
- Environment variable support
- Response display

---

### **Thing API** (`thing.html`, `thingapi.html`) - 🎮 Individual Game Lookup
**Purpose**: Fetch detailed game information from BGG by ID.

**Features**:
- Game stats, mechanics, categories
- Player count info
- Playtime details
- BGG rating and metadata

---

## 📊 Analytics & Stats

### **Stats** (`stats.html`) - 📈 Collection Statistics
**Purpose**: Display analytics about your game collection.

**Features**:
- Collection size
- Average ratings
- Playtime statistics
- Player count distributions
- Trending metrics

---

### **Draft** (`draft.html`) - 📝 Game Draft Simulator
**Purpose**: Simulate draft picks from your collection.

**Features**:
- Round-by-round drafting
- Player turn management
- Draft history tracking

---

## 🎨 Specialized Viewers & Converters

### **Cover** (`cover.html`) - 📷 Game Cover Gallery
**Purpose**: Beautiful gallery view of game cover images.

**Features**:
- Large cover image display
- Lazy loading
- Responsive grid layout

---

### **Collage** (`collage.html`) - 🖼️ Game Image Collage Creator
**Purpose**: Generate visual collages from game images.

**Features**:
- Grid layout options
- Image arrangement
- Download as image

---

### **Collection CSV** (`collection.csv`, `collection.html`) - 📊 CSV Import/Export
**Purpose**: Import/export collection data in CSV format.

**Features**:
- CSV parsing
- Bulk data import
- Export current state

---

### **Convert** (`convert.html`) - 🔄 Game Data Format Converter
**Purpose**: Convert between different game data formats (XML, CSV, JSON).

**Features**:
- Format detection
- Bidirectional conversion
- Data validation

---

### **Cards** (`cards.html`) - 🃏 Playing Card Generator
**Purpose**: Generate printable game cards from collection data.

**Features**:
- Card template selection
- Batch printing
- Custom formatting

---

### **Menu** (`menu.html`, `menu-print.html`) - 📋 Game Selection Menu Generator
**Purpose**: Generate printable menus for game selection.

**Features**:
- Menu layout options
- Print-friendly formatting
- Customizable styling

---

### **Playing Cards** (`playingcards.html`) - 🃏 Card Printing
**Purpose**: Print playing cards from collection.

---

### **First Player** (`firstplayer.html`) - 🎲 First Player Selector
**Purpose**: Randomly select who goes first.

**Features**:
- Player name input
- Random selection animation
- Multiple selection methods

---

### **Dice** (`dice.html`) - 🎲 Digital Dice Roller
**Purpose**: Roll dice for games (d6, d20, custom).

**Features**:
- Multiple dice types
- Roll history
- Sound effects

---

### **Matchup** (`matchup.html`) - ⚔️ 1v1 Game Matchup Tracker
**Purpose**: Track head-to-head game results between players.

**Features**:
- Game selection
- Win tracking
- Statistics

---

### **Freshplays** (`freshplays.html`, `freshplaysdownload.html`) - 📝 Play Log
**Purpose**: Log and track game plays.

**Features**:
- Play date entry
- Player tracking
- Winner recording
- Download play history

---

## 🎯 Hub & Navigation

### **Index** (`index.html`) - 🏠 Main Hub
**Purpose**: Landing page linking to all apps.

**Features**:
- Category-organized app links
- App descriptions
- Quick navigation

---

### **Master Index** (`master_index.html`) - 📑 Detailed Hub
**Purpose**: Comprehensive app directory with descriptions.

**Features**:
- Full app catalog
- Search functionality
- Feature descriptions

---

### **Welcome** (`welcome.html`, `welcome.js`, `welcome.css`) - 👋 Intro Screen
**Purpose**: Welcome/onboarding experience.

**Features**:
- Setup wizard
- BGG username configuration
- Feature overview

---

## 🗂️ Data Management

### **XML Files** - Collection Backups
- `library_bgg.xml` - BGG collection export
- `library_dte.xml` - DTE (cruise) collection
- `library_dtw.xml` - DTW collection
- `vfm*.xml` - Vacation/trip collections
- `private_*.xml` - Private collection backups
- `plays.xml` - Play history

### **CSV Files** - Data Exports
- `collection.csv` - Collection in CSV format
- `pubmeeple.csv` - Pub games list

---

## 🔌 Backend Infrastructure

### **Vercel Serverless Functions** (`/api/`)

#### **bgg-helper.js** - BGG API Proxy
```
Endpoints: collection, thing, user, hot, geeklist, plays, family, etc.
Features: CORS bypass, retries, parameter validation
```

#### **bgg-proxy.js** - Proxy for BGG direct calls

#### **bgg-thing.js** - Thing endpoint handler

#### **firebase-config.js** - Firebase configuration

#### **cron-fetch-geeklist.js** - Scheduled geeklist updates

#### **trigger-geeklist.js** - Manual geeklist trigger

#### **get-password.js** - Credential management

---

## 📱 Shared Utilities

### **bgg-api-client.js** - BGG API Client Library
Universal client for BGG API calls with methods:
- `getCollection(username, options)` - Fetch user collection
- `getThing(id, options)` - Fetch game details
- `getUser(username)` - Fetch user info
- `getHot(type)` - Fetch trending games
- `getGeeklist(id, options)` - Fetch geeklist
- `getPlays(username, options)` - Fetch play history

### **app.js** - Shared App Logic
Random game picker, popup management, filtering utilities

### **style.css** - Global Styles
Tailwind CSS customizations, shared component styles

---

## 🎨 Design System

- **Color Scheme**: Indigo/purple primary, tailored to BGG branding
- **Responsive**: Mobile-first, desktop-optimized
- **Typography**: System fonts (Inter, segoe UI)
- **Icons**: Emoji-based for quick recognition
- **Animations**: CSS transitions, keyframes for visual polish
- **Accessibility**: Semantic HTML, focus states, keyboard support

---

## 🚀 Deployment & Configuration

- **Platform**: Vercel (Next.js hosting)
- **Rate Limiting**: Hobby account with deployment limits
- **CORS**: Handled via serverless proxy functions
- **Caching**: Browser cache + server-side XML files
- **Performance**: Optimized image loading, lazy rendering

---

## 📊 Key Features Summary

| Feature | Apps | Status |
|---------|------|--------|
| BGG Collection Fetching | Most | ✅ Active |
| Timer Modes | Hunt | ✅ Countdown/Stopwatch |
| Image Reveal Games | Blur | ✅ Timed/Mystery |
| Card Swiping | Swipe | ✅ With Undo |
| Arcade Animations | Credits | ✅ 4 Modes |
| CSV/XML Import-Export | Multiple | ✅ Active |
| Real-time Filtering | All Browsers | ✅ Instant |
| Mobile Support | All | ✅ Responsive |
| Keyboard Controls | Most | ✅ ESC Exit |
| Serverless Backend | API Apps | ✅ Vercel |

---

## 🔄 Recent Updates (Current Session)

### Hunt.html
- ✅ Timer slider dual-purpose: mode-aware (time vs game count)
- ✅ Stopwatch starts at 0 min, counts up
- ✅ Countdown timer properly initialized

### Blur.html
- ✅ Fixed wrong button: now correctly marks as incorrect
- ✅ Mystery mode show more: expands clip-path reveal without blur change

### Swipe.html
- ✅ Added exit button with confirmation
- ✅ Added results preview popup during session
- ✅ Added undo button to revert last decision

### Credits.html
- ✅ Fixed action mode black UI (now shows with gradient background)
- ✅ Fixed classic mode to show ALL items (#1-492), not just last
- ✅ Fixed pace slider sync between home and runtime
- ✅ Classic and rain modes now respect speed changes (restart with new duration)

---

## 💡 Usage Tips

1. **Getting Started**: Visit `index.html` to explore all apps
2. **BGG Username**: Most apps default to "sportomax" - update with your username
3. **Collection Filtering**: Use checkboxes to filter collection status
4. **Speed Control**: Runtime slider available during playback (top-right)
5. **Keyboard Shortcuts**: ESC to exit any running mode
6. **Mobile**: All apps support touch and responsive design

---

*Last Updated: November 18, 2025*
*Total Apps: 40+*
*Primary Data Source: BoardGameGeek (BGG) API*
