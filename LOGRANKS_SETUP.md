# Game Rank Logger - Setup Guide

## Overview

**Game Rank Logger** (`/private/logranks.html`) is a Firebase-based application that logs your BoardGameGeek collection's ranking data daily and stores historical trends.

**Key Features:**
- Manual rank snapshots (on-demand via web interface)
- Automatic daily rank logging (1 AM daily via Vercel Cron)
- Historical trend tracking with visualization support
- Comprehensive rating metrics (Bayes average, user count, standard deviation)
- Multiple rank types (Board Game, Strategy, Family, etc.)

---

## Backend Architecture

### Files Created/Modified

| File | Purpose |
|------|---------|
| `/api/log-ranks.js` | Main endpoint for logging ranks (called daily or on-demand) |
| `/vercel.json` | Updated with cron schedule configuration |
| `/.github/workflows/log-ranks.yml` | GitHub Actions backup automation workflow |
| `/private/logranks.html` | Frontend web interface for manual & viewing historical data |

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTOMATED DAILY FLOW                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Vercel Cron (1 AM)  OR  GitHub Actions  OR  Manual Trigger │
│           ↓                                                  │
│    /api/log-ranks.js                                        │
│           ↓                                                  │
│  Fetch BGG Collection API (stats=1)                         │
│           ↓                                                  │
│  Parse XML Response (ratings, ranks, players, etc.)         │
│           ↓                                                  │
│  Save to Firestore Collection: game_ranks                   │
│           ↓                                                  │
│  Return Success Response                                    │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                   MANUAL WEB INTERFACE FLOW                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  logranks.html (User clicks "Select Game & Log")            │
│           ↓                                                  │
│  Load BGG Collection (client-side filter)                   │
│           ↓                                                  │
│  User selects game                                          │
│           ↓                                                  │
│  Display current ratings & ranks                            │
│           ↓                                                  │
│  User clicks "Save Snapshot"                                │
│           ↓                                                  │
│  Firestore SDK saves to game_ranks collection               │
│           ↓                                                  │
│  Historical tab displays all snapshots                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Required Environment Variables

Set these in your **Vercel Project Settings** (Settings → Environment Variables):

### Firebase Admin SDK (Required for /api/log-ranks.js)

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
```

**How to get these:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → Project Settings (⚙️) → Service Accounts
3. Click "Generate New Private Key"
4. Download JSON file
5. Copy values from JSON to Vercel environment variables
6. **Important:** For `FIREBASE_PRIVATE_KEY`, the JSON has literal `\n` - keep them as `\n` (not actual newlines)

### BGG API Token (Required)

```
BGG_API_TOKEN=your-bgg-api-token
```

**How to get:**
1. Visit [BGG API Docs](https://boardgamegeek.com/geeklist/305992/boardgamegeek-api)
2. Or use public BGG API (token optional but recommended)

### Automation Configuration (Optional)

```
BGG_USERNAME=sportomax
CRON_SECRET=your-secret-token-for-authorization
```

---

## Setup Instructions

### Step 1: Firebase Admin SDK Configuration

#### 1A: Get Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Settings** (⚙️ icon) → **Service Accounts**
4. Click **Generate New Private Key**
5. A JSON file downloads - open it

#### 1B: Add to Vercel Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add each field from the service account JSON:
   - `FIREBASE_PROJECT_ID` = `project_id`
   - `FIREBASE_PRIVATE_KEY_ID` = `private_key_id`
   - `FIREBASE_PRIVATE_KEY` = `private_key` (keep `\n` as literal text, not newlines)
   - `FIREBASE_CLIENT_EMAIL` = `client_email`
   - `FIREBASE_CLIENT_ID` = `client_id`

3. Set scope: **Production & Preview** (for scheduled runs)

#### Example (from JSON file):
```json
{
  "project_id": "my-bgg-tracker",
  "private_key_id": "abc123def456",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7...",
  "client_email": "firebase-adminsdk-xxxxxxxx@my-bgg-tracker.iam.gserviceaccount.com",
  "client_id": "123456789"
}
```

### Step 2: BGG API Token

1. Visit [BGG API Documentation](https://boardgamegeek.com/geeklist/305992/boardgamegeek-api)
2. Or request API access if needed
3. Add to Vercel: **Settings** → **Environment Variables**
   - `BGG_API_TOKEN` = your token (or leave blank for public API)

### Step 3: Verify Setup

#### Test the Endpoint Locally

```bash
# Dry run (doesn't save to Firestore)
curl "https://your-site.com/api/log-ranks?dryRun=true&username=sportomax"

# Expected response:
{
  "success": true,
  "dryRun": true,
  "message": "Dry run complete. Would have saved 123 games",
  "gamesProcessed": 123,
  "sampleGames": [
    {"name": "Agricola", "id": "31260", "mainRank": 12},
    ...
  ]
}
```

#### Test Manual Logging

1. Open `/private/logranks.html`
2. Click "Add New Snapshot"
3. Click "📚 Select Game & Log Snapshot"
4. Search for a game and select it
5. Review rating data
6. Click "✅ Save Snapshot"
7. Go to "View History" tab to see saved snapshot

---

## Automation Options

### Option 1: Vercel Cron (Recommended) ⭐

**Automatically runs at 1 AM UTC daily**

**Setup:**
1. Deploy latest code (includes `vercel.json` with cron config)
2. Vercel automatically schedules: `GET /api/log-ranks` at 1 AM UTC daily
3. No additional setup required!

**Status:**
- View cron runs in **Vercel Dashboard** → **Functions** → **Logs**
- Check Firestore collection `game_ranks` for new documents each morning

**Advantages:**
- ✅ Built-in to Vercel
- ✅ Automatic retries on failure
- ✅ Works even if your local machine is off
- ✅ Timezone-aware (1 AM UTC = 8 PM EST)

---

### Option 2: GitHub Actions (Backup)

**Scheduled runs + manual trigger support**

**Setup:**
1. Code is already in `.github/workflows/log-ranks.yml`
2. Push to GitHub repo
3. Go to **Actions** tab → **Log Game Ranks Daily**
4. Runs automatically at 1 AM UTC daily
5. Can manually trigger anytime

**Add Secrets to GitHub:**

Go to **Settings** → **Secrets and variables** → **Actions**

```
VERCEL_DOMAIN = your-site.com
CRON_SECRET = your-secret-token
```

**Manual Trigger:**
```bash
gh workflow run log-ranks.yml -f username=sportomax -f dryRun=false
```

---

### Option 3: External Scheduler (EasyCron, IFTTT, etc.)

**Manual URL-based trigger**

**Setup:**
1. Register at [EasyCron](https://www.easycron.com/) or [IFTTT](https://ifttt.com/)
2. Create new cron job
3. Set schedule: Daily at 1 AM (your timezone)
4. URL: `https://your-site.com/api/log-ranks?username=sportomax`
5. Headers: `Authorization: Bearer YOUR_CRON_SECRET`

**Test the URL:**
```bash
curl -H "Authorization: Bearer your-secret" \
  "https://your-site.com/api/log-ranks?username=sportomax&dryRun=true"
```

---

### Option 4: Local Node.js Script

**Run on your computer using node-cron**

**Setup:**
```bash
npm install axios node-cron dotenv
```

Create `cron-runner.js`:
```javascript
const cron = require('node-cron');
const axios = require('axios');
require('dotenv').config();

// Run daily at 1 AM
cron.schedule('0 1 * * *', async () => {
    console.log(`⏰ Running rank logger at ${new Date().toISOString()}`);
    try {
        const response = await axios.get(
            'https://your-site.com/api/log-ranks',
            {
                params: { username: 'sportomax' },
                headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
            }
        );
        console.log('✅ Rank logging complete:', response.data);
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
});

console.log('🚀 Cron runner started. Will run daily at 1 AM');
```

Run:
```bash
node cron-runner.js
```

---

## Firestore Collection Structure

### Collection: `game_ranks`

**Document Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `gameId` | string | BGG Game ID (e.g., "31260") |
| `gameName` | string | Game name (e.g., "Agricola") |
| `thumbnail` | string | URL to game box art |
| `year` | string | Year published |
| `rating.value` | number | BGG rating (0-10) |
| `rating.usersrated` | number | Number of user ratings |
| `rating.average` | number | Average user rating |
| `rating.bayesaverage` | number | Bayes-smoothed average |
| `rating.stddev` | number | Standard deviation |
| `rating.median` | number | Median rating |
| `ranks` | array | Multiple rank types |
| `ranks[].type` | string | Rank category (e.g., "subtype", "family") |
| `ranks[].id` | string | Rank ID |
| `ranks[].name` | string | Rank name (e.g., "boardgame") |
| `ranks[].friendlyname` | string | Display name (e.g., "Board Game Rank") |
| `ranks[].value` | number | Current rank position |
| `ranks[].bayesaverage` | number | Bayes average for this rank |
| `timestamp` | Timestamp | Server timestamp of snapshot |
| `dateCaptured` | string | ISO date (YYYY-MM-DD) |
| `source` | string | "automated-daily", "manual", etc. |

**Example Document:**
```json
{
  "gameId": "31260",
  "gameName": "Agricola",
  "thumbnail": "https://...",
  "year": "2007",
  "rating": {
    "value": 8.03,
    "usersrated": 89432,
    "average": 8.51,
    "bayesaverage": 8.42,
    "stddev": 1.38,
    "median": 9
  },
  "ranks": [
    {
      "type": "subtype",
      "id": "1",
      "name": "boardgame",
      "friendlyname": "Board Game Rank",
      "value": 23,
      "bayesaverage": 8.42
    },
    {
      "type": "family",
      "id": "5497",
      "name": "strategygames",
      "friendlyname": "Strategy Game Rank",
      "value": 8,
      "bayesaverage": 8.45
    }
  ],
  "timestamp": {"_seconds": 1702684800},
  "dateCaptured": "2023-12-16",
  "source": "automated-daily"
}
```

---

## Monitoring & Debugging

### Check Vercel Cron Runs

1. **Vercel Dashboard** → **Functions** → **Logs**
2. Filter by `/api/log-ranks`
3. View execution times and responses

### Check Firestore Documents

1. **Firebase Console** → **Firestore Database**
2. Collection: `game_ranks`
3. Sort by `timestamp` descending
4. Verify documents saved after cron runs

### View Endpoint Logs

**Local testing:**
```bash
# Test endpoint
curl -X GET "http://localhost:3000/api/log-ranks?dryRun=true&username=sportomax" \
  -H "Authorization: Bearer test-token"
```

**Production Vercel logs:**
- CLI: `vercel logs <project>`
- Dashboard: Functions section, search `log-ranks`

### Common Issues

| Issue | Solution |
|-------|----------|
| "FIREBASE_PRIVATE_KEY not configured" | Check Vercel env vars - ensure `FIREBASE_PRIVATE_KEY` is set (use literal `\n`) |
| "BGG API error" | Verify `BGG_API_TOKEN` is set; BGG API may be throttling (retry in 5s) |
| "No games found" | Check username exists on BGG; collection may be private |
| "Firestore permission denied" | Service account email needs Firestore Editor role in Firebase |
| Cron not running | Check `vercel.json` has crons section; redeploy after changes |

---

## Frontend Usage (logranks.html)

### Tabs Overview

#### 1. **Add New Snapshot**
- Click "📚 Select Game & Log Snapshot"
- Search/filter collection
- Select game
- Review rating data and all rank types
- Click "✅ Save Snapshot"

#### 2. **View History**
- Shows all saved snapshots grouped by game
- Displays trend indicator (↓ Climbed / ↑ Dropped / → Stable)
- Last 5 snapshots per game
- Delete option for individual snapshots

#### 3. **Trends & Analytics** (Future)
- Coming soon: Line graphs, trend analysis
- Ready for Chart.js integration

#### 4. **Settings**
- BGG username configuration
- Test BGG connection
- Automation documentation
- Clear all data button

---

## API Endpoint Details

### GET /api/log-ranks

**Purpose:** Fetch BGG collection and save rank snapshots to Firestore

**Parameters:**
```
?username=sportomax        (optional, defaults to env var)
&dryRun=true              (optional, test without saving)
```

**Headers:**
```
Authorization: Bearer YOUR_CRON_SECRET   (if configured)
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Rank logging complete for sportomax",
  "gamesProcessed": 4990,
  "successCount": 4990,
  "failCount": 0,
  "timestamp": "2024-01-01T01:00:00.000Z",
  "sample": [
    {
      "name": "Agricola",
      "id": "31260",
      "mainRank": 23,
      "bayesAverage": "8.42"
    }
  ]
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Missing Firebase configuration",
  "timestamp": "2024-01-01T01:00:00.000Z",
  "hint": "Check FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, etc."
}
```

---

## Testing Checklist

- [ ] Set all Firebase Admin SDK env vars in Vercel
- [ ] Set BGG_API_TOKEN in Vercel
- [ ] Test endpoint: `GET /api/log-ranks?dryRun=true`
- [ ] Deploy to Vercel
- [ ] Open `/private/logranks.html`
- [ ] Test "Select Game & Log" feature
- [ ] Verify document saved in Firestore
- [ ] Check Vercel cron logs after 1 AM
- [ ] Verify `game_ranks` collection has new documents

---

## FAQ

**Q: Can I use a different BGG username?**
A: Yes! In logranks.html, change username in Settings tab. For cron: add `?username=yourname` to endpoint URL.

**Q: How often do ranks update?**
A: BGG updates rankings continuously; cron captures at 1 AM UTC daily. Manual snapshots capture current state immediately.

**Q: Can I see trends/graphs?**
A: Trends tab is ready for visualization library. Sample logic for trend calculation included in history view.

**Q: What if cron fails?**
A: Check Vercel logs. Firestore doesn't auto-retry, but next day's run should succeed if issue is fixed.

**Q: Is the data secure?**
A: Yes - Firebase admin SDK uses service account key (never exposed in frontend). Firestore rules can restrict access.

---

## Next Steps

1. ✅ Set up Firebase Admin SDK environment variables
2. ✅ Test `/api/log-ranks` endpoint with `?dryRun=true`
3. ✅ Deploy changes to Vercel
4. ✅ Verify cron runs in Vercel logs
5. 🎯 Add Firestore security rules (optional)
6. 🎯 Implement trend visualization in "Trends & Analytics" tab
7. 🎯 Create dashboard with charts (Chart.js or similar)

---

## Support

For issues:
1. Check Vercel function logs
2. Review Firebase service account permissions
3. Verify BGG API connectivity
4. Check browser console (for frontend errors)
5. Test endpoint directly with curl

