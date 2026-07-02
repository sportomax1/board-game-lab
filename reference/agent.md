# BGG API Integration Guide - Master Prompt Reference

This document contains comprehensive details about BoardGameGeek (BGG) API integration patterns, helper endpoint syntax, and best practices used in this board game tools repository. Use this guide when building new applications that interact with BGG data.

---

## Table of Contents

1. [API Endpoints Overview](#api-endpoints-overview)
2. [BGG Helper Endpoint](#bgg-helper-endpoint)
3. [Collection API v2](#collection-api-v2)
4. [Common Patterns & Code Examples](#common-patterns--code-examples)
5. [Retry Strategy & Error Handling](#retry-strategy--error-handling)
6. [XML Parsing](#xml-parsing)
7. [Best Practices](#best-practices)
8. [Code Snippets Library](#code-snippets-library)

---

## API Endpoints Overview

### Primary BGG APIs Used

| Endpoint | Purpose | Rate Limit | Notes |
|----------|---------|-----------|-------|
| `/api/bgg-helper` | Custom local proxy to BGG API | None (internal) | Used to avoid CORS issues |
| `Collection API v2` | Fetch user's collection | 202 responses | Respects `own=1&stats=1` params |
| `User API` | Fetch user buddies & profiles | 202 responses | Used for buddy list features |
| `Hot List API` | Trending games | Rate limited | Cached results recommended |

### Why Use `/api/bgg-helper`?

The `/api/bgg-helper` endpoint is a custom proxy that wraps the BGG XML API. It:
- **Bypasses CORS errors** - Frontend can call it directly
- **Handles retries** - Built-in retry logic for 202 responses
- **Returns raw XML** - No additional parsing needed
- **Supports all BGG endpoints** - Via the `endpoint` query parameter

---

## BGG Helper Endpoint

### Syntax

```
/api/bgg-helper?endpoint={ENDPOINT}&{PARAM1}={VALUE1}&{PARAM2}={VALUE2}&...
```

### Common Endpoints & Parameters

#### 1. Collection API v2

**Fetch a user's collection with statistics:**

```javascript
const endpoint = 'collection';
const params = {
    username: 'sportomax',      // Required
    own: '1',                   // 1 = owned games only
    stats: '1',                 // Include rating stats
    includeexpansions: '1'      // Optional: include expansions
};

const query = new URLSearchParams(params).toString();
const url = `/api/bgg-helper?endpoint=${endpoint}&${query}`;
```

**Query Parameters:**
- `username`: BGG username (required)
- `own`: '1' = games they own, '0' or omit = all statuses
- `stats`: '1' = include detailed stats (ratings, plays, etc.)
- `includeexpansions`: '1' = include expansions, '0' or omit = base games only
- `brief`: '1' = minimal data only

**Response Structure (XML):**

```xml
<items>
    <item objecttype="thing" objectid="428224" subtype="boardgame" collid="122965327">
        <name sortindex="1">1 A.M. Jailbreak</name>
        <yearpublished>2024</yearpublished>
        <image>https://cf.geekdo-images.com/...</image>
        <thumbnail>https://cf.geekdo-images.com/...</thumbnail>
        <stats minplayers="2" maxplayers="5" minplaytime="20" maxplaytime="20" playingtime="20" numowned="663">
            <rating value="N/A">
                <usersrated value="348" />
                <average value="6.50934" />
                <bayesaverage value="5.62611" />
                <stddev value="1.16104" />
                <median value="0" />
                <ranks>
                    <rank type="subtype" id="1" name="boardgame" friendlyname="Board Game Rank" value="8060" bayesaverage="5.62611" />
                </ranks>
            </rating>
        </stats>
        <status own="0" prevowned="0" fortrade="0" want="0" wanttoplay="1" wanttobuy="0" wishlist="1" wishlistpriority="4" preordered="0" lastmodified="2025-02-21 20:19:55" />
        <numplays>0</numplays>
    </item>
</items>
```

#### 2. User API (Buddies)

**Fetch a user's buddy list:**

```javascript
const url = `/api/bgg-helper?endpoint=user&name=${encodeURIComponent('sportomax')}&buddies=1`;
```

**Parameters:**
- `endpoint`: 'user'
- `name`: BGG username
- `buddies`: '1' = include buddy list

**Response Structure:**

```xml
<user id="12345" name="sportomax">
    <buddies>
        <buddy id="67890" name="tune_squad" />
        <buddy id="11111" name="other_player" />
    </buddies>
</user>
```

---

## Collection API v2

### All Capturable Fields

When fetching collections with `stats=1`, each item contains:

**Basic Info:**
- `objectid` - Game ID
- `name` - Game title
- `yearpublished` - Release year
- `image` - Full-size image URL
- `thumbnail` - Thumbnail image URL
- `subtype` - Always 'boardgame' for base games, 'boardgameexpansion' for expansions

**Player Info (from `<stats>` attributes):**
- `minplayers` - Minimum players
- `maxplayers` - Maximum players
- `minplaytime` - Minimum playtime in minutes
- `maxplaytime` - Maximum playtime in minutes
- `playingtime` - Standard playing time
- `numowned` - Total users who own this game

**Ratings (from `<rating>` element):**
- `value` - User's personal rating (0-10 or 'N/A')
- `usersrated` - Number of BGG users who rated it
- `average` - BGG average rating
- `bayesaverage` - Bayesian average (adjusted for small sample sizes)
- `stddev` - Standard deviation
- `median` - Median rating
- `rank[name="boardgame"]` - BGG board game rank

**Status Flags (from `<status>` attributes):**
- `own` - '1' if user owns it
- `prevowned` - '1' if user previously owned it
- `want` - '1' if on want list
- `wanttoplay` - '1' if on want to play list
- `fortrade` - '1' if marked for trade
- `wanttobuy` - '1' if on want to buy list
- `wishlist` - '1' if on wishlist
- `wishlistpriority` - Priority level (1-5) if wishlisted
- `preordered` - '1' if pre-ordered
- `lastmodified` - Last time status was changed

**Other:**
- `numplays` - Number of times user played this game
- `collid` - Collection item ID

### Example Parsing

```javascript
// Fetch collection
const response = await fetch(
    `/api/bgg-helper?endpoint=collection&username=sportomax&own=1&stats=1`
);
const xml = new DOMParser().parseFromString(
    await response.text(),
    'text/xml'
);

// Parse each game
const items = Array.from(xml.querySelectorAll('item'));
items.forEach(item => {
    const gameId = item.getAttribute('objectid');
    const name = item.querySelector('name')?.textContent;
    
    // Stats
    const statsElem = item.querySelector('stats');
    const minPlayers = parseInt(statsElem?.getAttribute('minplayers') || 2);
    const maxPlayers = parseInt(statsElem?.getAttribute('maxplayers') || 2);
    
    // Ratings
    const rating = item.querySelector('stats rating');
    const userRating = parseFloat(rating?.getAttribute('value') || 0);
    const average = parseFloat(rating?.querySelector('average')?.getAttribute('value') || 0);
    
    // Status
    const statusElem = item.querySelector('status');
    const isOwned = statusElem?.getAttribute('own') === '1';
    const forTrade = statusElem?.getAttribute('fortrade') === '1';
    const plays = parseInt(item.querySelector('numplays')?.textContent || 0);
    
    console.log({gameId, name, minPlayers, maxPlayers, userRating, average, isOwned, plays});
});
```

---

## Common Patterns & Code Examples

### Pattern 1: Fetch with Retry (Exponential Backoff)

```javascript
async function fetchBGGWithRetry(url, maxRetries = 5, timeoutMs = 15000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Fetch attempt ${attempt}/${maxRetries}`);
            
            // Setup timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            // Handle BGG 202 (still processing)
            if (res.status === 202) {
                console.log(`⏳ BGG busy (202), waiting before retry...`);
                const waitTime = Math.min(3000 * attempt, 15000);
                await new Promise(r => setTimeout(r, waitTime));
                continue;
            }
            
            // Handle other HTTP errors
            if (!res.ok) {
                console.warn(`⚠️ HTTP ${res.status}`);
                const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, waitTime));
                    continue;
                }
                throw new Error(`HTTP ${res.status}`);
            }
            
            const text = await res.text();
            if (!text?.trim()) {
                console.warn(`⚠️ Empty response`);
                if (attempt < maxRetries) {
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                throw new Error('Empty response');
            }
            
            console.log(`✅ Success on attempt ${attempt}`);
            return text;
            
        } catch (error) {
            lastError = error;
            console.error(`❌ Attempt ${attempt} failed:`, error.message);
            
            if (error.name === 'AbortError') {
                console.log(`⏱️ Request timeout (${timeoutMs}ms)`);
            }
            
            if (attempt < maxRetries) {
                const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                console.log(`⏳ Retrying in ${waitTime}ms...`);
                await new Promise(r => setTimeout(r, waitTime));
            }
        }
    }
    
    throw new Error(`Failed after ${maxRetries} attempts: ${lastError.message}`);
}

// Usage
const xml = await fetchBGGWithRetry(
    `/api/bgg-helper?endpoint=collection&username=sportomax&own=1&stats=1`
);
```

### Pattern 2: Parse Collection with Multi-Status Filter

```javascript
async function loadCollection(username, selectedStatuses = ['own']) {
    const xml = await fetchBGGWithRetry(
        `/api/bgg-helper?endpoint=collection&username=${encodeURIComponent(username)}&own=1&stats=1`
    );
    
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const games = [];
    
    Array.from(doc.querySelectorAll('item')).forEach(item => {
        const statusElem = item.querySelector('status');
        
        // Check if game matches any selected status
        const matches = selectedStatuses.some(status => {
            return statusElem?.getAttribute(status) === '1';
        });
        
        if (matches) {
            games.push({
                id: item.getAttribute('objectid'),
                name: item.querySelector('name')?.textContent,
                image: item.querySelector('thumbnail')?.textContent,
                year: parseInt(item.querySelector('yearpublished')?.textContent) || 0,
                status: {
                    own: statusElem?.getAttribute('own') === '1',
                    want: statusElem?.getAttribute('want') === '1',
                    fortrade: statusElem?.getAttribute('fortrade') === '1',
                    wanttoplay: statusElem?.getAttribute('wanttoplay') === '1',
                    preordered: statusElem?.getAttribute('preordered') === '1'
                }
            });
        }
    });
    
    return games;
}

// Usage: Load games that are either owned OR for trade
const games = await loadCollection('sportomax', ['own', 'fortrade']);
```

### Pattern 3: Buddy Picker with Multi-Select

```javascript
async function loadAndSelectBuddies(username) {
    const xml = await fetchBGGWithRetry(
        `/api/bgg-helper?endpoint=user&name=${encodeURIComponent(username)}&buddies=1`
    );
    
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const buddies = Array.from(doc.querySelectorAll('buddy')).map(b => ({
        id: b.getAttribute('id'),
        name: b.getAttribute('name')
    }));
    
    // Render checkboxes for selection
    const buddyList = document.getElementById('buddyList');
    buddyList.innerHTML = buddies.map(buddy => `
        <label style="display: flex; gap: 0.5rem;">
            <input type="checkbox" class="buddy-checkbox" data-buddy-id="${buddy.id}" data-buddy-name="${buddy.name}">
            <span>${buddy.name}</span>
        </label>
    `).join('');
    
    // Get selected
    function getSelectedBuddies() {
        return Array.from(document.querySelectorAll('.buddy-checkbox:checked'))
            .map(cb => cb.dataset.buddyName);
    }
    
    return getSelectedBuddies;
}
```

### Pattern 4: Image Proxy for CORS Safety

**Problem:** Direct BGG image URLs may have CORS restrictions.

**Solution:** Use weserv.nl proxy

```javascript
const IMAGE_PROXY = 'https://images.weserv.nl/?url=';

// Original URL from API
const originalImage = 'https://cf.geekdo-images.com/example.png';

// Proxied URL
const proxiedImage = `${IMAGE_PROXY}${encodeURIComponent(originalImage)}`;

// Use in img tag
const img = document.createElement('img');
img.src = proxiedImage;
img.onerror = () => {
    img.src = 'data:image/svg+xml,...'; // fallback
};
```

### Pattern 5: Canvas-Based Image Analysis (Color Detection)

```javascript
async function analyzeImageColors(imageUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imageUrl)}`;
        
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Sample pixels (every Nth pixel based on sampling rate)
            const samplingRate = 100; // 0-100%
            const step = Math.max(1, Math.floor(100 / samplingRate));
            const colorMap = {};
            const pixelCount = (data.length / 4) / (step * step);
            
            for (let i = 0; i < data.length; i += step * 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const hex = rgbToHex(r, g, b);
                
                if (!colorMap[hex]) {
                    colorMap[hex] = { hex, count: 0 };
                }
                colorMap[hex].count++;
            }
            
            // Convert to percentages
            const colors = Object.values(colorMap)
                .map(c => ({
                    hex: c.hex,
                    count: c.count,
                    percentage: ((c.count / pixelCount) * 100).toFixed(2)
                }))
                .sort((a, b) => b.count - a.count);
            
            resolve({
                colors: colors,
                primary: colors[0] || { hex: '#ccc', percentage: 0 }
            });
        };
        
        img.onerror = () => {
            resolve({
                colors: [{ hex: '#999', count: 0, percentage: 100 }],
                primary: { hex: '#999', percentage: 100 }
            });
        };
        
        img.src = proxiedUrl;
    });
}

function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('').toUpperCase();
}
```

---

## Retry Strategy & Error Handling

### HTTP Status Codes from BGG

| Code | Meaning | Action |
|------|---------|--------|
| 200 | OK | Use response |
| 202 | Accepted (processing) | Wait 3-15s, retry |
| 429 | Rate limited | Wait 5-30s, retry |
| 502 | Bad Gateway | Wait, retry (BGG error) |
| 5xx | Server error | Exponential backoff, retry |

### Recommended Retry Configuration

```javascript
// For collection/user endpoints (slow)
const COLLECTION_RETRY_CONFIG = {
    maxRetries: 5,
    initialWait: 3000,  // 3s
    timeout: 15000      // 15s per request
};

// For quick endpoints (fast)
const QUICK_RETRY_CONFIG = {
    maxRetries: 3,
    initialWait: 1000,  // 1s
    timeout: 5000       // 5s per request
};

// For buddy lists (medium)
const BUDDY_RETRY_CONFIG = {
    maxRetries: 4,
    initialWait: 2000,  // 2s
    timeout: 10000      // 10s per request
};
```

### User Feedback During Loading

```javascript
function updateProgress(percent, message, subtext) {
    document.getElementById('progressBar').style.width = `${percent}%`;
    document.getElementById('progressText').textContent = message;
    document.getElementById('progressCount').textContent = subtext;
    console.log(`📊 ${percent}% - ${message} (${subtext})`);
}

// Usage
updateProgress(25, '📦 Loading collection...', '1/4');
updateProgress(50, '📥 Parsing data...', '2/4');
updateProgress(75, '🎨 Rendering games...', '3/4');
updateProgress(100, '✅ Done!', '4/4');
```

---

## XML Parsing

### DOMParser Syntax

```javascript
// Parse XML response
const xml = new DOMParser().parseFromString(xmlText, 'text/xml');

// Check for parse errors
if (xml.getElementsByTagName('parsererror').length > 0) {
    console.error('XML parse error');
    return;
}

// Query elements
const items = Array.from(xml.querySelectorAll('item'));
const value = element.getAttribute('attributeName');
const text = element.textContent;
const child = element.querySelector('child > grandchild');

// Safely navigate
const item = items[0];
const stats = item.querySelector('stats');
const rating = stats?.querySelector('rating');
const average = parseFloat(rating?.querySelector('average')?.getAttribute('value') || 0);
```

### Common XML Navigation Patterns

```javascript
// Get attribute value with fallback
const minPlayers = parseInt(statsElem?.getAttribute('minplayers') || '2');

// Get text content with fallback
const name = item.querySelector('name')?.textContent || 'Unknown';

// Get deeply nested value
const boardGameRank = item
    .querySelector('stats rating')?
    .querySelector('rank[name="boardgame"]')?
    .getAttribute('value') || 'Not Ranked';

// Check boolean attributes
const isOwned = statusElem?.getAttribute('own') === '1';

// Iterate through collection
Array.from(doc.querySelectorAll('rank[type="subtype"]')).forEach(rank => {
    const name = rank.getAttribute('name');
    const value = rank.getAttribute('value');
});
```

---

## Best Practices

### 1. Always Use Retry Logic

```javascript
// ❌ Bad - No retry
const response = await fetch(url);

// ✅ Good - With retry
const text = await fetchBGGWithRetry(url);
```

### 2. Add Console Logging

```javascript
console.log(`👤 Loading collection for ${username}...`);
console.log(`📡 Fetching: ${url}`);
console.log(`✅ Found ${games.length} games`);
console.log(`❌ Error: ${error.message}`);
```

### 3. Handle Empty Responses

```javascript
// Always check before parsing
const text = await fetchBGGWithRetry(url);
if (!text?.trim()) {
    throw new Error('Empty response from server');
}
const xml = new DOMParser().parseFromString(text, 'text/xml');
```

### 4. Use Optional Chaining Extensively

```javascript
// ✅ Safe - Won't throw if element missing
const value = item.querySelector('stats')?.querySelector('rating')?.getAttribute('value');

// ❌ Risky - Throws if element missing
const value = item.querySelector('stats').querySelector('rating').getAttribute('value');
```

### 5. Provide User Feedback

```javascript
// Show loading state
showStatus('📦 Loading collection...', 'loading');

// Update progress
updateProgress(50, 'Processing games...', '2/4');

// Show success/error
showStatus('✅ Loaded 142 games!', 'success');
showStatus('❌ Failed: Network error', 'error');
```

### 6. Cache Large Responses

```javascript
let cachedGames = null;

async function getCollection(username) {
    if (cachedGames?.username === username) {
        console.log('📦 Using cached collection');
        return cachedGames.games;
    }
    
    // Fetch fresh
    const games = await loadCollection(username);
    cachedGames = { username, games };
    return games;
}
```

### 7. Escape HTML Properly

```javascript
// ✅ Safe
const gameName = 'Portal & Co.';
const div = document.createElement('div');
div.textContent = gameName;
return div.innerHTML; // Returns 'Portal &amp; Co.'

// Use in HTML
element.innerHTML = `<h2>${escapeHtml(gameName)}</h2>`;

// Helper function
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

---

## Code Snippets Library

### Multi-Player Collection Loader

```javascript
async function compareMultipleCollections(usernames) {
    const collections = {};
    const failedUsers = [];
    
    for (let i = 0; i < usernames.length; i++) {
        const username = usernames[i];
        try {
            console.log(`👤 Loading ${username}...`);
            updateProgress(
                (i / usernames.length) * 100,
                `Loading ${username}...`,
                `${i}/${usernames.length}`
            );
            
            const xml = await fetchBGGWithRetry(
                `/api/bgg-helper?endpoint=collection&username=${encodeURIComponent(username)}&own=1&stats=1`
            );
            
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            
            if (doc.getElementsByTagName('parsererror').length > 0) {
                failedUsers.push(username);
                continue;
            }
            
            collections[username] = Array.from(doc.querySelectorAll('item')).map(item => ({
                id: item.getAttribute('objectid'),
                name: item.querySelector('name')?.textContent
            }));
            
            console.log(`✓ ${username}: ${collections[username].length} games`);
        } catch (error) {
            console.error(`❌ ${username}: ${error.message}`);
            failedUsers.push(username);
        }
    }
    
    if (failedUsers.length > 0) {
        console.warn(`⚠️ Failed to load: ${failedUsers.join(', ')}`);
    }
    
    return collections;
}
```

### Find Common Games Between Collections

```javascript
function findCommonGames(collections) {
    const allGameIds = Object.values(collections).map(games => 
        new Set(games.map(g => g.id))
    );
    
    // Find intersection
    const common = [...allGameIds[0]].filter(id =>
        allGameIds.every(set => set.has(id))
    );
    
    return common;
}

// Usage
const collections = await compareMultipleCollections(['sportomax', 'tune_squad']);
const commonIds = findCommonGames(collections);
console.log(`🎯 ${commonIds.length} games in common`);
```

### Color Analysis with Multiple Sampling Rates

```javascript
async function analyzeWithMultipleSamplingRates(imageUrl) {
    const rates = [100, 50, 25, 10, 5, 1];
    const results = {};
    
    for (const rate of rates) {
        console.log(`📊 Analyzing at ${rate}% sampling...`);
        const colors = await analyzeImageColors(imageUrl, rate);
        
        // Get primary color
        const primary = colors.colors[0];
        results[rate] = {
            primary: primary.hex,
            percentage: primary.percentage,
            unique_colors: colors.colors.length
        };
    }
    
    return results;
}
```

### Create Pagination for Large Collections

```javascript
function paginateGames(games, pageSize = 20) {
    const pages = [];
    for (let i = 0; i < games.length; i += pageSize) {
        pages.push(games.slice(i, i + pageSize));
    }
    return pages;
}

// Usage
const games = await loadCollection('sportomax');
const pages = paginateGames(games, 50);
let currentPage = 0;

function showPage(pageNum) {
    const games = pages[pageNum];
    renderGames(games);
    console.log(`📄 Page ${pageNum + 1}/${pages.length}`);
}
```

---

## Important Notes

### Rate Limiting
- BGG API has rate limits (~1 request per 3-5 seconds per IP)
- Always implement exponential backoff
- Cache responses when possible
- Use 202 status as indicator to wait longer

### CORS Issues
- Direct BGG URLs may fail in browser
- Always use `/api/bgg-helper` proxy endpoint
- Use `images.weserv.nl` for image URLs

### Username Encoding
- Always use `encodeURIComponent()` for usernames with special characters
- Example: "Player & Co." → "Player%20%26%20Co."

### Collection Scope
- `own=1` in collection API only returns owned games
- Status flags in `<status>` element show additional statuses (want, for trade, etc.)
- Use these flags for multi-status filtering instead of separate API calls

### Image Handling
- Thumbnails are small (suitable for lists)
- Full images are large (use for detail views)
- Always provide fallback placeholder if image fails to load
- Use canvas analysis with caution (performance intensive)

---

**Last Updated:** December 15, 2025  
**Repository:** https://github.com/sportomax1/vercel  
**For Issues or Questions:** Check existing apps in repository for working examples
