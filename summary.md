# BoardGameGeek App Collection - Complete Summary

## 🎮 Game Apps (Recently Added)

### 🔤 hangman.html - BGG Hangman
Word guessing game using game names from your collection. Features include expansion filtering, auto-reveal special characters/numbers options, visual hangman display, and keyboard input. Perfect for testing knowledge of your collection in a fun, interactive way.

**Settings:** Username, Include Expansions, Auto-provide Special Chars, Auto-provide Numbers  
**API:** Collection API v2 with stats

### 🔀 scramble.html - Name & Image Scrambler
Two game modes: scramble the letters of a game name (text input guess) or reassemble a scrambled 3x3 image puzzle from the box cover. Includes rescramble and skip options for continuous play.

**Settings:** Username, Include Expansions, Mode Selection (Name/Image)  
**API:** Collection API v2

### 🧩 puzzle.html - Jigsaw Puzzle
Create jigsaw puzzles from game box cover images with configurable piece counts (4, 9, 16, or 25 pieces). Drag-and-drop gameplay with snap-to-grid positioning, reference image toggle, and win detection.

**Settings:** Username, Include Expansions, Piece Count (4/9/16/25)  
**API:** Collection API v2

### 📝 wordle.html - BGG Wordle
Wordle-style word guessing for game names. Customizable word length (4-8 letters) and max guess count (3-8). Features color-coded keyboard feedback, strips spaces/special chars while preserving numbers.

**Settings:** Username, Include Expansions, Word Length, Max Guesses  
**API:** Collection API v2

### ❓ questions.html - 20 Questions
AI picks a mystery game from your collection and you ask yes/no questions to identify it. Question types include average rating ranges, player counts, playtime, publication year, weight, and game families. Limited to 20 questions.

**Settings:** Username, Include Expansions  
**API:** Collection API v2 with stats

### 🏅 rankup.html - Sporcle Ranking Quiz
Type game names to fill in a ranking list sorted by BGG rank or average rating. Filter by rank category (boardgame, abstracts, family games, etc.). Timer tracks completion speed and shows percentage progress.

**Settings:** Username, Include Expansions, Rank Category, Sort By (Rank/Average)  
**API:** Collection API v2 with stats, Browse API for rankings

### 🎯 startbenchcut.html - Start/Bench/Cut
Categorize collection games into three tiers using drag-and-drop. Customize how many games per category (1-5 each for Start/Bench/Cut). Validates selections before submission.

**Settings:** Username, Include Expansions, Games Per Category (1-5 each)  
**API:** Collection API v2

### 👤 user.html - BGG User Profile
Display comprehensive BGG user information including avatar, join date, location, buddies list, guilds, top games, hot games, trade count, and marketplace stats. Card-based layout with all profile data.

**Settings:** Username  
**API:** User API v2

### 📊 metermaster.html - Stat Range Sorter
Sort collection games into rating zones based on selected metric (weight 1-5, average rating 0-10, user rating, or BGG rank ranges). Click games to place them in zones, then check accuracy.

**Settings:** Username, Sort Category (Weight/Average/Rank/User Rating)  
**API:** Collection API v2 with stats

### 💰 rostercap.html - Budget Roster Builder
Build a game roster on a budget by selecting one game per rank category. Games cost $1-5 based on average rating (0-2=$1, 2-4=$2, etc.). Track spending vs budget across multiple rank types.

**Settings:** Username, Total Budget ($15-30)  
**API:** Collection API v2 with stats

### 🎊 wrapped.html - BGG Wrapped
Annual play statistics and highlights in "Spotify Wrapped" style. Loads all plays for a specified year with multi-page API support. Displays top games, total plays, unique games, and other yearly stats.

**Settings:** Username, Year Selection  
**API:** Plays API v2 with pagination

## 📊 Collection & Stats Apps

### 📚 collection.html / collectionapi.html - Collection Browser
Rich interface for browsing BGG collections with filters (Own, Want to Play, etc.), sorting (Name, Year, Rating), and aggregate statistics. Central hub for visualizing your library.

**API:** Collection API v2

### 🏆 ranks.html - Top Games Rankings
Browse BGG top-ranked games with optional collection integration. Shows ownership badges (📦 Owned, 🏷️ Prev-Owned) and filtering by ownership status.

**Settings:** Optional Username for collection overlay  
**API:** Browse API for rankings, Collection API v2 for ownership

### 📊 stats.html - Collection Statistics
Detailed analytics dashboard for collection data including distribution charts, averages, and collection insights.

**API:** Collection API v2 with stats

### 📊 plays.html - Play Statistics
Analytics dashboard for visualizing play history with trends, most played games, and session statistics.

**API:** Plays API v2

### 📦 inventory.html - Inventory Management
Comprehensive inventory tracking with status indicators, location tracking, and search/filter capabilities.

**API:** Collection API v2

## 🎲 Interactive & Game Tools

### ⏱️ timer.html - Player Timer
Track turn times for all players with pause/resume, turn history, and exportable text results. iPhone-optimized with share functionality.

**Features:** Share results to clipboard, turn-by-turn tracking

### ⏱️ hunt.html - Scavenger Hunt
Solo or Competition mode scavenger hunt through your collection. Find specific games within configurable time limits (10-300 seconds).

**Settings:** Mode, Time Limit  
**API:** Collection API v2

### 🏆 bracket.html - Tournament Bracket
Run single or double-elimination tournaments with games from your collection to determine favorites.

**API:** Collection API v2

### ⚔️ matchup.html - Head-to-Head Matchups
Pairwise game comparisons for ranking and decision-making.

**API:** Collection API v2

### 📝 draft.html - Game Draft
Simulate draft process for distributing games among players or creating fantasy collections.

**API:** Collection API v2

### 🎲 menu.html - Player Count Menu
Find best games for specific player counts using BGG community voting data (Best/Recommended/Supported).

**Settings:** Username, Player Count  
**API:** Collection API v2

### 🎲 firstplayer.html - First Player Chooser
Interactive utility to determine who goes first with various selection methods.

### 🎲 dice.html - Dice Roller
Virtual dice roller with multiple die types and quantities.

### 🃏 playingcards.html - Playing Cards
Digital playing card utilities and games.

### 🎯 scorepad.html - Score Tracker
Universal scoring utility for tracking game scores across players and rounds.

## 🔍 Discovery & Browse Apps

### 🎬 videos.html - Game Video Browser
Discover video content (reviews, tutorials, previews) for games in your collection with search, sort, and category filtering.

**API:** Collection API v2, Videos API

### 💬 forums.html - Forums Explorer
Browse discussion threads for collection games with batch processing, search, and thread details.

**API:** Collection API v2, Forums API

### 🏪 marketplace.html - Virtual Marketplace
Browse games for sale or trade with filters and detailed listings.

**API:** Marketplace API

### 🎮 hotgames.html - Hot Games
View trending and popular games from BGG's hot lists.

**API:** Hot Items API

### 🔍 thingapi.html - BGG Thing Lookup
Developer utility for querying BGG API directly by Thing ID with raw XML response.

**API:** Thing API v2

### 🗂️ geeklist.html - GeekList Viewer
Browse and explore BGG GeekLists with game collections and themed lists.

**API:** GeekList API

### 📋 suggested.html - Suggested Games
Discover game recommendations based on collection and preferences.

**API:** Recommendations API

## 🏛️ Library & Event Apps

### 🏛️ library.html - Library Management
Manage lending libraries with check-in/check-out, availability tracking, and organization by location.

**Variants:** library_bgg.html, library_dte.html, library_dtw.html for different data sources

### 🏷️ vfm.html - Virtual Flea Market
Manage VFM data for conventions with pricing, availability, and vendor information.

**Variants:** vfm_new.html, vfm_old.html, metaVFM.html  
**Data:** vfm22-25 XML files for BGG, DTE, DTW, SPR events

### 🎮 gamenight.html - Game Night Planner
Plan and organize game night events with game selection and scheduling.

**API:** Collection API v2

### 🎯 gameninja.html - Game Ninja
Quick game lookup and information utility.

**API:** Thing API v2

## 🎨 Visual & Media Apps

### 🎥 credits.html - Arcade Credits Roller
Animated arcade-style rolling credits display with game covers. Supports RAWG and BGG data sources with animation styles (Classic Roll, Fireworks, Image Rain).

**Settings:** Data Source, Animation Style

### 📸 shelfie.html - Shelf Photo Generator
Create and share shelfie photos of your collection.

**API:** Collection API v2

### 🖼️ collage.html - Collection Collage
Generate visual collages from game box covers.

**API:** Collection API v2

### 🎴 cards.html - Game Cards
Display collection as printable/shareable game cards.

**API:** Collection API v2

### 🖼️ cover.html - Cover Art Viewer
Browse and display game cover art in high resolution.

**API:** Collection API v2

### 🌫️ blur.html - Blur Guessing Game
Guess games from progressively less blurred cover images.

**API:** Collection API v2

## 🔧 Utility Apps

### 🛒 checkout.html - Checkout Helper
Shopping cart and purchase tracking for game acquisitions.

### 🔍 quiz.html - Collection Quiz
Test knowledge of your collection with various quiz formats.

**API:** Collection API v2

### 🎲 random9.html - Random 9 Selector
Select 9 random games from collection for quick game night choices.

**API:** Collection API v2

### 🃏 token.html - Token Tracker
Manage game tokens and components.

### 🛡️ sleeve.html - Sleeve Reference
Card sleeve size reference and shopping list generator.

### 📦 expansion.html - Expansion Tracker
Track owned vs available expansions for base games.

**API:** Collection API v2, Family API

### 🎯 toptier.html - Top Tier Games
Highlight top-rated games from collection.

**API:** Collection API v2 with stats

### 📊 ratings.html - Ratings Manager
Manage and visualize your BGG ratings.

**API:** Collection API v2

### 📈 versions.html - Game Versions
Compare different editions and versions of owned games.

**API:** Versions API

### 🎲 boardgametype.html - Game Type Browser
Filter and browse by board game categories and types.

**API:** Browse API

### 📋 rankfile.html - Rank File Viewer
View and analyze BGG ranking files and data.

### 🏢 pubmeeple.html - Publisher Meeple
Browse games by publisher with collection integration.

**API:** Collection API v2, Search API

### 🎲 thing.html - Thing Viewer
General purpose BGG Thing viewer and browser.

**API:** Thing API v2

### 🎮 tabletop.html - Tabletop Simulator
Integration with Tabletop Simulator for virtual play.

### 💱 convert.html - Data Converter
Convert between various BGG data formats.

### 🌐 api.html - API Explorer
General BGG API exploration and testing tool.

### 🎴 swipe.html - Swipe Interface
Tinder-style swiping interface for game selection.

**API:** Collection API v2

### 📱 welcome.html - Welcome Page
Landing page and navigation hub for all apps.

### ℹ️ index.html - Main Index
Primary navigation and app directory.
