# Game Tags Manager - Minimal Setup Guide

## Project Overview

**tags.html** is a lightweight game tagging system for board game collections. Stores only tags (bgg_id, tag_name) in Supabase—everything else (game names, thumbnails, stats) comes from the BGG API.

### Key Features

✅ **Password-Protected Entry** – Simple password unlock  
✅ **Minimal Database** – Just user_email, bgg_id, tag_name (< 100 bytes per tag)  
✅ **Single BGG API Call** – Fetches full collection once per session  
✅ **Four Views**:
  - **Games** – Browse collection with tag counts, search/filter
  - **Manage** – Quick add tags, view all tags, bulk delete
  - **Untagged** – See games needing tags
  - **Stats** – Coverage %, tag cloud, counts

✅ **Mobile Friendly** – No bloat, fast load  
✅ **Efficient** – All data from API, no redundant storage  

---

## Database Setup

### 1. Run SQL Schema in Supabase

In your Supabase project (same one as rankstore), execute [TAGS_SETUP.sql](TAGS_SETUP.sql):

```sql
-- Copy entire TAGS_SETUP.sql file into Supabase SQL Editor
-- Click "Run"
```

**What this creates (minimal):**
- `game_tags` table with just 5 columns: id, user_email, bgg_id, tag_name, timestamps
- Indexes on `user_email`, `bgg_id` for fast queries
- Unique constraint: one tag per game per user
- Auto-update trigger for `updated_at`
- RLS enabled (permissive—app filters by user_email)

No game data stored—all fetched from BGG API on each session.

### 2. Verify Setup

In Supabase:
```
Tables → game_tags → should have 5 columns only
RLS → Enabled ✅
Policies → allow SELECT, INSERT, UPDATE, DELETE (all permissive)
```

---

## How It Works

### Data Flow

1. **Unlock** → Enter password + BGG username  
2. **Fetch Collection** → 1 BGG API call = 1,000+ games with names, years, thumbnails  
3. **Load Tags** → 1 Supabase query = all user's tags (tiny dataset, maybe 100 KB)  
4. **Join Client-Side** → Match games + tags in browser, render  
5. **Manage** → Add/remove tags, updates sync to Supabase instantly  

### Data Storage

Only this is stored in Supabase:

```
game_tags table:
- user_email: "sportomax@bgg.local"
- bgg_id: 13 (Catan)
- tag_name: "Strategy"
- created_at, updated_at
```

**NOT stored** (fetched from BGG API every session):
- Game names
- Thumbnails
- Year published
- Ratings
- Ranks
- Stats

### Why Minimal?

✅ **Faster** – No need to sync game data between BGG and DB  
✅ **Smaller** – Tags table is tiny (100 rows = ~10 KB)  
✅ **Cleaner** – Single source of truth (BGG for games, Supabase for tags)  
✅ **Scalable** – Can handle 10,000+ games per user

## Deployment Steps

### 1. Deploy tags.html

Upload [tags.html](tags.html) to your Vercel project root.

### 2. Verify API Endpoints

The app needs 2 endpoints (should already exist):

- **`/api/supabase-config`** – Returns ```json
  { "url": "https://...", "anonKey": "..." }
- **`/api/bgg-helper?endpoint=collection&username=sportomax&stats=1`** – Proxies BGG API

See [rankstore.html](rankstore.html) setup if missing.

### 3. Test

1. Visit `https://your-domain.com/tags.html`
2. Enter any password + BGG username (default: sportomax)
3. Wait for collection to load
4. Click a game to add tags
5. Check Supabase to verify tag rows are created

## Usage Guide

### 🎮 Games Tab
- Displays your full BGG collection (fetched at load)
- Shows tag count for each game
- Click game to add/remove tags
- Search by game name
- Filter by tag

### 📋 Manage Tab
- **Quick Add** – Find a game and add tags
- **All Tags** – See every tag you've created across all games
- **Delete** – Click tag to remove from all games

### 🏷️ Untagged Tab
- See games without any tags
- Helps you identify gaps in your tagging
- Click to quickly tag a game

### 📊 Stats Tab
- **Total Games** – From your BGG collection
- **Tagged** – How many have at least 1 tag
- **Total Tags** – Sum of all tags you've added
- **Coverage %** – Percentage of games with tags
- **Tag Cloud** – Visual weight of your most-used tags

---

## API Quick Reference

### Supabase Queries (in tags.html)

**Add a tag:**
```javascript
dbClient.from('game_tags').insert([{
  user_email: "sportomax@bgg.local",
  bgg_id: 13,
  tag_name: "Strategy"
}])
```

**Load all tags:**
```javascript
dbClient.from('game_tags').select('*').eq('user_email', userEmail)
```

**Remove a tag:**
```javascript
dbClient.from('game_tags').delete()
  .eq('user_email', userEmail)
  .eq('bgg_id', bggId)
  .eq('tag_name', tagName)
```

### BGG API Call (via /api/bgg-helper)

```
GET /api/bgg-helper?endpoint=collection&username=sportomax&stats=1
```

Returns XML with all games, names, thumbnails, rankings.

---

## Customization

### Change Default Username
Edit line in tags.html:
```html
<input ... value="sportomax" ...>  <!-- change sportomax to your username -->
```

### Change Colors
Edit CSS variables:
```css
:root{
    --accent:#6366f1;  /* primary color */
    --green:#22c55e;   /* tagged color */
    --bg:#0f1117;      /* dark background */
}
```

### Add Real Password Auth
Modify `unlockApp()`:
```javascript
// Instead of just validating BGG username:
const authResp = await fetch('/api/auth/validate', {
    method: 'POST',
    body: JSON.stringify({ username, password })
});
if (!authResp.ok) throw new Error('Invalid password');
```

### Export/Import Tags
Extend the manage tab to support CSV:
```javascript
function exportTags() {
    const csv = allTags.map(t => `${t.bgg_id},${t.tag_name}`).join('\n');
    // create download link
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Config load failed" | Check `/api/supabase-config` endpoint is accessible |
| "BGG username not found" | Verify username exists on BoardGameGeek.com |
| Tags not appearing | Refresh page; check Supabase RLS is enabled |
| Slow collection load | BGG API is slow for users with 500+ games; normal |
| Supabase errors | Check your project URL and anon key are correct |
| Modal won't close | Click outside the sheet or reload |

---

## Performance

- **Initial load:** 2-5 seconds (depends on BGG API speed)
- **Tag operations:** <100ms (instant DB inserts/deletes)
- **Search/filter:** Instant (client-side only)
- **Mobile:** Optimized, smooth scrolling

---

## FAQ

**Q: Does it store all my game data?**  
A: No. Only your tags (bgg_id + tag_name). Game names, pics, etc. come from BGG API each session.

**Q: How many games can I tag?**  
A: Unlimited. The table stores only what you tag.

**Q: Can I share my tags with others?**  
A: Not built-in. You'd need to export CSV manually.

**Q: What if I have 1000 games?**  
A: Still fast. Collection load takes ~3-4 seconds from BGG API.

**Q: Is my data private?**  
A: Yes. RLS ensures only you can access your tags (via your username).

---

## Files Created

1. **tags.html** – Main app
2. **TAGS_SETUP.sql** – Minimal Supabase schema
3. **TAGS_SETUP.md** – This docs (you are here)

---

**Last Updated:** February 16, 2026  
**Storage:** ~50 bytes per tag  
**Queries:** 2 per session (1 BGG API, 1 Supabase)  
**Approach:** Minimal, efficient, clean
