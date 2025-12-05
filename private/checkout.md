# Game Checkout Tracker - Complete Documentation

## Overview

**checkout.html** is a comprehensive game loan/checkout management system for board game collections. It tracks which games have been checked out, to whom, when, and provides detailed analytics about checkout patterns, game popularity, and lending history.

**URL**: `/checkout.html`  
**Auth**: Password-protected (env: `PASSWORD`)  
**Dependencies**: Firebase (Firestore), BGG API, Tailwind CSS  
**Data**: Real-time sync with Firestore database

---

## 🎯 Core Features

### 1. Password Authentication
- **Requirement**: Password from Vercel `PASSWORD` environment variable
- **Persistence**: Stored in browser localStorage
- **BGG Username**: Configurable input (default: sportomax)
- **Plays Data Option**: Checkbox to load play history during login (affects performance)
- **Session**: Password remembered in localStorage for convenience

### 2. Collection Loading
- **Source**: BGG Collection API v2 with authenticated proxy
- **Filters**:
  - Own (default checked)
  - Previously Owned (optional during Retro Mode)
  - Exclude Expansions
- **Data Retrieved**:
  - Game ID, Name, Year Published
  - BGG Rank, Average Rating, Weight
  - User collection status

### 3. Checkout Management

#### Adding Checkouts
- **Quick Add**: Click game card to mark as checked out
- **Flash Animation**: Green flash confirms successful checkout
- **Auto-Timestamp**: Automatic timestamp recorded
- **Retro Mode**: Add past checkouts with custom date
- **Date Format**: ISO 8601 (YYYY-MM-DD)

#### Retro Mode
- **Purpose**: Add historical checkout records with past dates
- **Activation**: Toggle "⏰ Retro Mode (Past Date)" on Checkout tab
- **Date Selector**: Calendar picker for past dates
- **Previously Owned Option**: Include previously owned games when enabled
- **Use Case**: Backfill data from previous tracking systems

#### Check-In Management
- **Swipe to Delete**: Swipe right on checkout record to remove
- **Undo Available**: Immediate undo after deletion
- **Deletion Confirmation**: Prevents accidental data loss
- **Record Preservation**: Checkout still visible in History tab

### 4. Sorting Options

| Sort Mode | Description | Use Case |
|-----------|-------------|----------|
| **A-Z** | Alphabetical order | Quick lookup |
| **Checked Out Recently** | Most recent checkouts first | Find current loans |
| **Played Recently** | Most recent plays first | See active games |
| **Year Published** | Newest games first | New release focus |
| **Not CO'd (Oldest)** | Longest since checkout | Forgotten loans |
| **Not Played (Oldest)** | Longest since play | Stagnant collection |

### 5. Data Views

#### 📦 Checkout Tab
- **Current Status**: All checked-out games displayed
- **Search**: Real-time filter by game name
- **Sort Controls**: 6 sorting options
- **Quick Actions**: Tap to check in, swipe to delete
- **Status Indicator**: Green border = checked in, Red border = checked out

#### 📋 History Tab
- **Checkout History**: Complete record of all checkouts
- **Timestamps**: Exact check-in/check-out dates
- **Search**: Filter history by game name
- **Sort Options**: Most recent or oldest first
- **CSV Export**: Download entire history as CSV file

#### 📊 Dashboard Tab
- **H-Index Calculation**: Largest N where game has N checkouts or N appearances
- **Checkout Statistics**: Total checkouts, games checked out, active loans
- **Timeline Analysis**: Grouped by day/week/month/quarter/year
- **Daily Records**: Customizable time period grouping
- **Top Games**: Most frequently checked-out games ranked

#### 🎲 Random Tab
- **Random Selection**: Pick N games randomly from collection
- **Filters**:
  - Exclude expansions
  - Player count range (min/max)
  - Number of games to select
- **Sharing**: Export selection as text for sharing
- **Copy Function**: One-click clipboard copy

#### ⚙️ Settings Tab
- **User Info**: Display current BGG username
- **Logout**: Clear session and return to login
- **Date Management**: Batch update checkout dates
- **Bulk Import**: Import checkout records from JSON/CSV
- **Resync Missing Data**: Fetch missing game details from BGG

---

## 📊 Advanced Features

### H-Index Analytics
- **Definition**: Largest N where game has ≥N checkouts OR ≥N total appearances
- **Calculation**: `max(N where checkouts[game] >= N OR appearances[game] >= N)`
- **Example**: Game with 5 checkouts and 3 appearances = H-Index of 3
- **Display**: Shows games at each H-Index level
- **Use Case**: Quick metric for game relevance and activity

### Checkout Timeline
- **Grouping Options**: Day, Week, Month, Quarter, Year
- **Visual Layout**: Timeline showing checkout volume per period
- **Statistics**: Count per period, trends over time
- **Insights**: Identify high-activity periods and seasonal patterns

### Play History Integration
- **Optional Loading**: Checkbox during login ("Load Plays Data from API")
- **Performance**: Slower load but enables play-based sorting
- **Data Used**: Last play date, total play count per game
- **Sorting Integration**: "Played Recently" sort uses play history
- **Display**: Play dates shown on game cards

### Batch Operations

#### Batch Date Update
- **Purpose**: Update multiple checkout dates at once
- **Format**: One record per line: `gameId,newDate`
- **Example**:
  ```
  13,2025-01-15
  9209,2025-01-14
  22181,2025-01-13
  ```
- **Validation**: Checks BGG ID exists before update
- **Feedback**: Shows update status for each record

#### Quick Update Recent Records
- **Purpose**: Rapid-fire date updates for recent checkouts
- **Display**: List of 10 most recent checkout records
- **Input**: Inline date picker for each record
- **Batch Action**: Update all at once

#### Bulk Import (JSON)
- **Format**: JSON array of checkout objects
- **Minimal**: Only `gameId` required (pulls name/image from BGG)
- **Optional**: `checkoutDate`, `gameName`, `gameImage`
- **Example**:
  ```json
  [
    {"gameId":"13","checkoutDate":"2025-01-15"},
    {"gameId":"9209","checkoutDate":"2025-01-14"}
  ]
  ```
- **Auto-Fetch**: Game names and images fetched from BGG automatically

#### Bulk Import (CSV)
- **Format**: Comma-separated values
- **Headers**: `gameId,checkoutDate`
- **Example**:
  ```
  13,2025-01-15
  9209,2025-01-14
  ```
- **Parsing**: Auto-detects CSV format and converts
- **Flexible**: Works with or without header row

### Resync Missing Data
- **Purpose**: Find incomplete records and fetch missing details
- **Detection**: Records with "Game XXX" placeholder names
- **Action**: BGG API lookup for real game names
- **Image Fix**: Fetches correct game images from BGG
- **Batch Operation**: Processes all missing records at once
- **Status**: Shows progress and count of updated records

---

## 💾 Firebase Data Structure

### Collections

#### `checkouts` Collection
```
{
  gameId: "13" (BGG object ID)
  gameName: "Carcassonne" (string)
  gameImage: "https://..." (image URL)
  checkoutDate: Timestamp
  checkoutDateString: "2025-01-15" (ISO format)
  username: "sportomax" (BGG username)
  id: auto-generated Firestore ID
}
```

### Data Persistence
- **Real-time**: Changes sync immediately to Firestore
- **Load**: All records fetched on app startup
- **Offline**: Updates queue and sync when online
- **Deletion**: Soft delete with undo capability
- **Archival**: History maintained even after check-in

---

## 🎨 UI Components

### Game Card
- **Layout**: Image + name + stats
- **Image Aspect**: 1:1 square with gray background
- **Image Fit**: `contain` (no crop/zoom)
- **Badges**: Checkout status (red/green border)
- **Interactions**: Tap = check out, Swipe = delete
- **Animation**: Hover = slight lift effect

### Checkout Flash Animation
- **Trigger**: After successful checkout
- **Duration**: 1 second animation
- **Effect**:
  - 0%: Green background + green shadow
  - 100%: White background + normal shadow
- **Feedback**: Visual confirmation of action

### Tab Navigation
- **Active Tab**: Blue underline + text
- **Inactive Tab**: Gray text
- **Sticky**: Stays visible while scrolling
- **Responsive**: Horizontal scroll on small screens
- **Tabs**: Checkout, History, Dashboard, Random, Settings

### Search & Filter
- **Real-time**: Filters as user types
- **Case-Insensitive**: Matches partial names
- **Clear Button**: One-click reset
- **Placeholder**: Hints about search capability
- **Results**: Shows filtered count

### Timeline Display
- **Grouped Entries**: By selected time period
- **Bar Chart**: Visual representation of volume
- **Expandable**: Shows details on click
- **Date Range**: Shows period start/end dates
- **Count**: Number of checkouts in period

---

## 🔄 Data Flow

1. **User Login**
   - Enters password + username
   - Selects plays data option (optional)
   - Firebase initializes
   - Collection loaded from BGG API
   - Existing checkouts loaded from Firestore

2. **Add Checkout**
   - User selects game
   - Timestamp generated automatically (or custom via Retro Mode)
   - Record saved to Firestore
   - UI updates with flash animation
   - Game moves to "Checked Out" section

3. **Remove Checkout**
   - User swipes right on record
   - Undo option appears
   - After timeout (5 seconds), permanently deleted
   - Firestore record removed
   - Game moves back to "Available" section

4. **View Analytics**
   - Dashboard loads all checkout records
   - H-Index calculated from frequencies
   - Timeline built from timestamps
   - Statistics aggregated by game
   - Charts generated from grouped data

5. **Bulk Operations**
   - User pastes JSON/CSV data
   - Format validated
   - Records created in Firestore
   - Progress shown in real-time
   - Status updated after completion

---

## 📱 Mobile Optimization

- **Viewport**: No zoom allowed (user-scalable=no)
- **Touch**: Full swipe/tap support
- **Responsive**: Single-column layout
- **Performance**: Lazy loading for images
- **Landscape**: Adjusted card layout
- **Bottom Spacing**: Tab navigation at bottom for reachability

### Gestures
- **Tap**: Select/expand item
- **Swipe Right**: Delete checkout
- **Double-Tap**: Not used (no special meaning)
- **Long-Press**: Not used (tap to interact)

---

## 🔐 Security

- **Password**: Hashed in Firestore (not visible client-side)
- **BGG Username**: Used for API calls (public)
- **localStorage**: Session data only (no sensitive info)
- **Firebase**: Requires authentication for data access
- **CORS**: Image proxy for external image sources
- **API Proxy**: All BGG calls routed through `/api/bgg-helper`

---

## ⚡ Performance Considerations

### Loading Times
- **Collection Load**: 2-5 seconds (depends on collection size)
- **Checkout Load**: <1 second (Firebase query)
- **Dashboard Calculations**: 1-2 seconds (large collections)
- **Plays Data**: +3-5 seconds if enabled (extra BGG API call)

### Optimization
- **Lazy Images**: Load on demand
- **Caching**: BGG data cached in memory
- **Indexing**: Firestore indexed on username + date
- **Debouncing**: Search input debounced 300ms
- **Pagination**: History supports pagination (optional future)

### Storage
- **Per Checkout Record**: ~200 bytes (Firestore)
- **Collection**: 1-5 MB cache (all games)
- **Image Cache**: Browser managed (CDN)
- **History Limit**: No current limit (scalable to thousands)

---

## 🚀 Deployment

### Environment Variables Required
```
PASSWORD=... (app access password)
FIREBASE_PROJECT_ID=...
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
```

### Vercel Functions Used
- `/api/bgg-helper` - BGG API proxy (collection, thing endpoints)
- `/api/firebase-config` - Firebase credentials provider
- `/api/get-password` - Password authentication helper

### Configuration
- **Firestore Rules**: Allow read/write for authenticated sessions
- **Cloud Storage**: Not required (uses CDN for images)
- **Functions**: All operations on Firestore client-side

---

## 🐛 Error Handling

### User Errors
- **Invalid Password**: Shows error message, allows retry
- **Missing Username**: Defaults to 'sportomax'
- **Network Error**: Shows loading error, allows retry
- **Malformed Import**: Shows line number of error

### Data Errors
- **Missing Game Data**: Falls back to "Game [ID]" placeholder
- **Invalid BGG ID**: Skips in import, shows warning
- **Timestamp Issues**: Uses current time as fallback
- **Firestore Offline**: Queues writes for later sync

### Recovery
- **Reload Collection**: Force refresh from BGG API
- **Resync Missing Data**: Fetch missing details
- **Clear Cache**: Refresh browser to clear localStorage
- **Manual Entry**: Add games one-by-one if import fails

---

## 📚 Related Documentation

- **matchup.md**: Tournament and game ranking system
- **FILE_DEPENDENCIES.md**: API and file dependencies
- **compare.md**: Technical comparison of all apps

---

## 🎯 Use Cases

### Personal Lending Library
- Track which friends have borrowed games
- Know when games were lent (checkout date)
- Identify overdue games (Retro Mode for check-in dates)
- Export list for reminder messages

### Convention Inventory
- Checkout games to demo area
- Check in when returned
- Track wear and tear
- Identify frequently loaned titles

### Play Testing
- Log each test session
- Track which games tested most
- Identify play patterns
- Export for analysis reports

### Collection Analytics
- See which games get borrowed most
- Identify unused games
- Plan storage based on checkout frequency
- Decide what to keep/sell

---

Generated: 2025-12-05
