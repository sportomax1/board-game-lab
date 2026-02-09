# RankStore.html - BGG Rank History Tracker

## Overview
`rankstore.html` fetches your BGG collection with stats, extracts Board Game Rank data, and stores historical rank snapshots in Supabase for trend tracking.

---

## 1. Supabase Database Setup

### Create the `rank_history` table

```sql
-- Create rank_history table
CREATE TABLE rank_history (
  id BIGSERIAL PRIMARY KEY,
  bgg_id INTEGER NOT NULL,
  game_name TEXT NOT NULL,
  bgg_rank INTEGER,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(bgg_id, snapshot_date)
);

-- Create indexes for faster queries
CREATE INDEX idx_rank_history_bgg_id ON rank_history(bgg_id);
CREATE INDEX idx_rank_history_snapshot_date ON rank_history(snapshot_date);
CREATE INDEX idx_rank_history_bgg_rank ON rank_history(bgg_rank) WHERE bgg_rank IS NOT NULL;

-- Add comment
COMMENT ON TABLE rank_history IS 'Historical BGG rank data for collection games';
```

### Set up Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE rank_history ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous inserts (for storing rank data)
CREATE POLICY "Allow public inserts"
  ON rank_history
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Allow public reads (for viewing rank history)
CREATE POLICY "Allow public reads"
  ON rank_history
  FOR SELECT
  TO anon
  USING (true);

-- Optional: Policy for authenticated users to update/delete their own data
CREATE POLICY "Allow authenticated updates"
  ON rank_history
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

### Get your Supabase credentials

1. Go to your Supabase project dashboard
2. Click **Settings** → **API**
3. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** API key

---

## 2. Create `rankstore.html`

Create a new file `rankstore.html` in your project root:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BGG Rank Store</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
</head>
<body class="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
    <div class="max-w-4xl mx-auto">
        <div class="bg-white rounded-2xl shadow-xl p-8">
            <h1 class="text-3xl font-bold text-gray-900 mb-2">BGG Rank Store</h1>
            <p class="text-gray-600 mb-6">Fetch collection and store rank history to Supabase</p>

            <!-- Username Input -->
            <div class="mb-6">
                <label class="block text-sm font-semibold text-gray-700 mb-2">BGG Username</label>
                <input 
                    type="text" 
                    id="username" 
                    placeholder="Enter BGG username"
                    class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
            </div>

            <!-- Action Buttons -->
            <div class="flex gap-3 mb-6">
                <button 
                    onclick="fetchAndStore()" 
                    class="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    id="fetchBtn"
                >
                    Fetch & Store Ranks
                </button>
                <button 
                    onclick="viewHistory()" 
                    class="flex-1 bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-700 transition-colors"
                >
                    View History
                </button>
            </div>

            <!-- Progress -->
            <div id="progress" class="hidden mb-6">
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <div class="flex items-center gap-3 mb-2">
                        <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                        <span class="font-semibold text-blue-900" id="progressText">Processing...</span>
                    </div>
                    <div class="text-sm text-blue-700" id="progressDetail"></div>
                </div>
            </div>

            <!-- Results -->
            <div id="results" class="hidden">
                <div class="bg-green-50 border border-green-200 rounded-xl p-4">
                    <h3 class="font-bold text-green-900 mb-2">✓ Success</h3>
                    <div class="text-sm text-green-700" id="resultsText"></div>
                </div>
            </div>

            <!-- Error -->
            <div id="error" class="hidden">
                <div class="bg-red-50 border border-red-200 rounded-xl p-4">
                    <h3 class="font-bold text-red-900 mb-2">✗ Error</h3>
                    <div class="text-sm text-red-700" id="errorText"></div>
                </div>
            </div>

            <!-- History Table -->
            <div id="historyContainer" class="hidden mt-8">
                <h2 class="text-xl font-bold text-gray-900 mb-4">Rank History</h2>
                <div class="overflow-x-auto">
                    <table class="w-full border-collapse">
                        <thead>
                            <tr class="bg-gray-100">
                                <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">BGG ID</th>
                                <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">Game Name</th>
                                <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">BGG Rank</th>
                                <th class="px-4 py-2 text-left text-sm font-semibold text-gray-700">Date</th>
                            </tr>
                        </thead>
                        <tbody id="historyBody" class="divide-y divide-gray-200">
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>

    <script>
        // ===== CONFIGURATION =====
        const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';  // Replace with your Supabase URL
        const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';  // Replace with your anon key

        // Initialize Supabase client
        const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        // ===== UI HELPERS =====
        function showProgress(text, detail = '') {
            document.getElementById('progress').classList.remove('hidden');
            document.getElementById('progressText').textContent = text;
            document.getElementById('progressDetail').textContent = detail;
            document.getElementById('results').classList.add('hidden');
            document.getElementById('error').classList.add('hidden');
        }

        function hideProgress() {
            document.getElementById('progress').classList.add('hidden');
        }

        function showResults(text) {
            document.getElementById('results').classList.remove('hidden');
            document.getElementById('resultsText').textContent = text;
            hideProgress();
        }

        function showError(text) {
            document.getElementById('error').classList.remove('hidden');
            document.getElementById('errorText').textContent = text;
            hideProgress();
        }

        function setButtonLoading(loading) {
            const btn = document.getElementById('fetchBtn');
            btn.disabled = loading;
        }

        // ===== MAIN LOGIC =====
        async function fetchAndStore() {
            const username = document.getElementById('username').value.trim();
            if (!username) {
                showError('Please enter a BGG username');
                return;
            }

            setButtonLoading(true);
            showProgress('Fetching collection...', `User: ${username}`);

            try {
                // Step 1: Fetch collection from BGG API
                const collectionUrl = `/api/bgg-helper?endpoint=collection&username=${encodeURIComponent(username)}&own=1&stats=1`;
                showProgress('Fetching collection...', 'Requesting data from BGG API');

                const response = await fetch(collectionUrl);
                if (!response.ok) {
                    throw new Error(`BGG API error: ${response.status}`);
                }

                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

                // Step 2: Parse collection items
                const items = xmlDoc.querySelectorAll('item');
                if (items.length === 0) {
                    throw new Error('No items found in collection');
                }

                showProgress(`Processing ${items.length} games...`, 'Extracting rank data');

                // Step 3: Extract rank data
                const today = new Date().toISOString().split('T')[0];
                const rankData = [];

                items.forEach(item => {
                    const bggId = parseInt(item.getAttribute('objectid'));
                    const gameName = item.querySelector('name')?.textContent || 'Unknown';
                    
                    // Extract Board Game Rank (rank with type="subtype" and name="boardgame")
                    const ranks = item.querySelectorAll('rank');
                    let bggRank = null;

                    for (const rank of ranks) {
                        const rankType = rank.getAttribute('type');
                        const rankName = rank.getAttribute('name');
                        const rankValue = rank.getAttribute('value');

                        if (rankType === 'subtype' && rankName === 'boardgame') {
                            bggRank = rankValue === 'Not Ranked' ? null : parseInt(rankValue);
                            break;
                        }
                    }

                    rankData.push({
                        bgg_id: bggId,
                        game_name: gameName,
                        bgg_rank: bggRank,
                        snapshot_date: today
                    });
                });

                showProgress(`Storing ${rankData.length} records...`, 'Saving to Supabase');

                // Step 4: Store in Supabase (upsert to handle duplicates for same day)
                const { data, error } = await supabase
                    .from('rank_history')
                    .upsert(rankData, { 
                        onConflict: 'bgg_id,snapshot_date',
                        ignoreDuplicates: false 
                    });

                if (error) {
                    throw new Error(`Supabase error: ${error.message}`);
                }

                // Success!
                showResults(`Successfully stored ${rankData.length} rank records for ${today}`);
                
            } catch (err) {
                console.error('Error:', err);
                showError(err.message);
            } finally {
                setButtonLoading(false);
            }
        }

        async function viewHistory() {
            document.getElementById('historyContainer').classList.remove('hidden');
            showProgress('Loading history...', 'Fetching from Supabase');

            try {
                const { data, error } = await supabase
                    .from('rank_history')
                    .select('*')
                    .order('snapshot_date', { ascending: false })
                    .order('bgg_rank', { ascending: true })
                    .limit(100);

                if (error) {
                    throw new Error(`Supabase error: ${error.message}`);
                }

                const tbody = document.getElementById('historyBody');
                tbody.innerHTML = '';

                if (data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500">No history found</td></tr>';
                } else {
                    data.forEach(row => {
                        const tr = document.createElement('tr');
                        tr.className = 'hover:bg-gray-50';
                        tr.innerHTML = `
                            <td class="px-4 py-2 text-sm">${row.bgg_id}</td>
                            <td class="px-4 py-2 text-sm font-medium">${row.game_name}</td>
                            <td class="px-4 py-2 text-sm">${row.bgg_rank || 'Not Ranked'}</td>
                            <td class="px-4 py-2 text-sm text-gray-600">${row.snapshot_date}</td>
                        `;
                        tbody.appendChild(tr);
                    });
                }

                hideProgress();
            } catch (err) {
                console.error('Error:', err);
                showError(err.message);
            }
        }

        // Auto-fill username from localStorage if available
        window.addEventListener('DOMContentLoaded', () => {
            const savedUsername = localStorage.getItem('bgg_username');
            if (savedUsername) {
                document.getElementById('username').value = savedUsername;
            }

            document.getElementById('username').addEventListener('change', (e) => {
                localStorage.setItem('bgg_username', e.target.value);
            });
        });
    </script>
</body>
</html>
```

---

## 3. Configuration Steps

### Update Supabase credentials in `rankstore.html`

1. Open `rankstore.html`
2. Find these lines near the top of the `<script>` section:
   ```javascript
   const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';
   ```
3. Replace with your actual Supabase URL and anon key

---

## 4. Usage

### First-time setup
1. Complete **Step 1** (Supabase database setup)
2. Complete **Step 3** (configure credentials)
3. Deploy or open `rankstore.html` locally

### Daily usage
1. Open `rankstore.html` in your browser
2. Enter your BGG username
3. Click **"Fetch & Store Ranks"**
4. Wait for completion (progress shown)
5. Click **"View History"** to see stored data

### Automation (optional)
To automatically store ranks daily, you can:
- Use a Vercel cron job (requires API route)
- Use GitHub Actions scheduled workflow
- Use a simple Node.js script with cron

---

## 5. Data Structure

### Stored fields
| Field | Type | Description |
|-------|------|-------------|
| `bgg_id` | INTEGER | BoardGameGeek game ID |
| `game_name` | TEXT | Game title |
| `bgg_rank` | INTEGER | Current Board Game Rank (null if unranked) |
| `snapshot_date` | DATE | Date of snapshot (YYYY-MM-DD) |
| `created_at` | TIMESTAMPTZ | Timestamp when record was created |

### Unique constraint
- One record per game per day (`bgg_id`, `snapshot_date`)
- Re-running on the same day will update existing records

---

## 6. Testing

### Test the setup

1. **Test database connection:**
   - Open browser console
   - Run: `supabase.from('rank_history').select('count')`
   - Should return `{ count: 0 }` or existing count

2. **Test collection fetch:**
   - Enter a known BGG username
   - Click "Fetch & Store Ranks"
   - Check progress messages

3. **Verify data in Supabase:**
   - Go to Supabase dashboard → Table Editor
   - Select `rank_history` table
   - Check for new rows with today's date

4. **View history:**
   - Click "View History" button
   - Should display stored records

---

## 7. Troubleshooting

### Common issues

**Error: "No items found in collection"**
- Make sure the BGG username is correct
- Ensure user has owned games in their collection
- Check if BGG API is responding (try manual API call)

**Error: "Supabase error: ..."**
- Verify Supabase URL and anon key are correct
- Check that RLS policies are set up correctly
- Ensure table exists with correct schema

**CORS errors**
- If running locally, use the `/api/bgg-helper` proxy
- If deploying, ensure your domain is allowed in Supabase settings

**"Not Ranked" showing for ranked games**
- Check that `stats=1` is in the API call
- Verify the XML parsing logic is finding the correct rank element

---

## 8. Next Steps / Enhancements

### Feature ideas
- **Rank trends:** Show rank change over time with charts
- **Alerts:** Notify when a game enters/exits top 100/1000
- **Batch processing:** Store ranks for multiple users
- **Historical charts:** Use Chart.js to visualize rank history
- **Export:** Download rank data as CSV
- **Scheduled updates:** Automate daily rank snapshots

### Example: Daily automated snapshot with Vercel Cron
Create `api/store-ranks.js`:
```javascript
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Add your automation logic here
  // Trigger from Vercel cron: https://vercel.com/docs/cron-jobs
}
```

---

## 9. Quick Reference

### BGG Collection API endpoint
```
/api/bgg-helper?endpoint=collection&username=USERNAME&own=1&stats=1
```

### Supabase insert query
```javascript
await supabase
  .from('rank_history')
  .upsert([
    { bgg_id: 123, game_name: 'Game', bgg_rank: 100, snapshot_date: '2026-02-09' }
  ], { onConflict: 'bgg_id,snapshot_date' });
```

### View rank history
```javascript
const { data } = await supabase
  .from('rank_history')
  .select('*')
  .eq('bgg_id', 123)
  .order('snapshot_date', { ascending: false });
```

---

**You're all set!** Run through the steps above and you'll have a working rank history tracker. 🎲📊
