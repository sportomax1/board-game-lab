# Copilot Instructions for Vercel BGG Applications

## Project Architecture Standards

### HTML Application Structure
- **Single-file HTML design**: All applications should be self-contained in a single `.html` file whenever possible
- **No external dependencies**: Avoid requiring Node.js, build tools, or package managers
- **All styles inline**: Use `<style>` tags in the document head, not external CSS files
- **All scripts inline**: Use `<script>` tags at the end of body, not external JS files
- **Embed data URIs**: Use data: URLs for small icons/favicons instead of external files

### Example Structure
```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <title>App Name</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='70'>🎮</text></svg>">
    <style>
        /* All styles here */
    </style>
</head>
<body>
    <!-- All HTML here -->
    <script>
        // All JavaScript here
    </script>
</body>
</html>
```

---

## Mobile-First Design Requirements

### iPhone Optimization
- **Viewport meta tags**: Always include `viewport-fit=cover` for notch support
- **Responsive breakpoints**: 
  - Desktop: No restrictions
  - Tablet: 768px max-width
  - Mobile: 480px max-width
- **Touch-friendly controls**:
  - Buttons minimum 44px height
  - Tap targets minimum 44×44px
  - Avoid double-tap zoom where possible
  - Prevent accidental pinch zoom

### Responsive CSS Pattern
```css
/* Desktop first, then mobile overrides */
@media (max-width: 768px) {
    /* Tablet adjustments */
}

@media (max-width: 480px) {
    /* Mobile adjustments */
}
```

### Safe Area Insets
```css
.container {
    padding-top: env(safe-area-inset-top, 0);
    padding-bottom: env(safe-area-inset-bottom, 0);
    padding-left: env(safe-area-inset-left, 0);
    padding-right: env(safe-area-inset-right, 0);
}
```

### Touch Optimization
```javascript
// Prevent double-tap zoom
document.addEventListener('touchstart', function(e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, false);

// Prevent pinch zoom
document.addEventListener('gesturestart', function(e) {
    e.preventDefault();
});
```

---

## BGG API Integration Standards

### API Endpoint: `/api/bgg-helper`

**DO NOT USE:**
- ❌ Direct `https://www.boardgamegeek.com/xmlapi2/` (CORS blocked)
- ❌ Client-side CORS proxies like `api.allorigins.win` (unreliable)
- ❌ Unproxied fetch calls to external APIs

**ALWAYS USE:**
- ✅ `/api/bgg-helper?endpoint={endpoint}&{params}` (Vercel server-side proxy)

### API Endpoints

#### Collection API (User's Owned Games)
```javascript
async function fetchFromBGG(endpoint, params = {}, retries = 5) {
    const queryParams = new URLSearchParams(params).toString();
    const fullUrl = `/api/bgg-helper?endpoint=${endpoint}&${queryParams}`;
    
    try {
        const response = await fetch(fullUrl);
        
        if (response.status === 202 && retries > 0) {
            // BGG is processing - wait and retry
            await new Promise(r => setTimeout(r, 3000));
            return fetchFromBGG(endpoint, params, retries - 1);
        }
        
        if (!response.ok) throw new Error(`API Status ${response.status}`);
        return await response.text();
    } catch (error) {
        throw new Error(`Network/API error: ${error.message}`);
    }
}

// Example: Fetch collection
const collectionXml = await fetchFromBGG('collection', {
    username: 'sportomax',
    own: '1',           // Only owned games
    stats: '1'          // Include ratings
});
```

### Collection API Parameters
| Parameter | Value | Purpose |
|-----------|-------|---------|
| `username` | string | BGG username |
| `own` | `1` | Fetch only owned games |
| `stats` | `1` | Include ratings/statistics |
| `excludesubtype` | `boardgameaccessory` | Filter out accessories |

### Thing API (Game Details & Versions)
```javascript
// Get game details with versions/measurements
const thingXml = await fetchFromBGG('thing', {
    ids: '7866,130899,68448',  // Comma-separated IDs
    versions: '1'               // Include version info
});
```

### Thing API Parameters
| Parameter | Value | Purpose |
|-----------|-------|---------|
| `ids` | comma-separated | Game IDs to fetch |
| `versions` | `1` | Include version data (measurements) |
| `stats` | `1` | Include ratings |

---

## API Call Best Practices

### Rate Limiting & Retries
- **202 Status Code**: BGG returns 202 when processing large requests
- **Always retry on 202**: Wait 3 seconds, then retry (up to 5 times)
- **Batch delays**: Add 500ms delay between batch requests
- **Console logging**: Log all API calls for debugging

### Batch Processing for Thing API
**IMPORTANT**: Thing API can only handle ~20 game IDs per request

```javascript
const batchSize = 20;
for (let i = 0; i < gameIds.length; i += batchSize) {
    const batch = gameIds.slice(i, i + batchSize);
    
    const thingText = await fetchFromBGG('thing', {
        ids: batch.join(','),
        versions: '1'
    });
    
    // Process batch...
    
    // Rate limiting
    await new Promise(r => setTimeout(r, 500));
}
```

### XML Parsing Pattern
```javascript
const parser = new DOMParser();
const xml = parser.parseFromString(responseText, 'text/xml');

// Check for parsing errors
if (xml.getElementsByTagName('parsererror').length > 0) {
    console.error('XML parsing failed');
}

// Check for BGG API errors
const errorEl = xml.querySelector('errors error');
if (errorEl) {
    throw new Error(errorEl.textContent);
}

// Extract data
const items = Array.from(xml.querySelectorAll('item'));
items.forEach(item => {
    const name = item.querySelector('name')?.getAttribute('value') || 'Unknown';
    const id = item.getAttribute('id');
    const rating = item.querySelector('stats rating > average')?.getAttribute('value');
});
```

---

## Default Configuration

### Default Username
- **Always default to "sportomax"** for collection-based features
- Allow user override via input field
- Store in input value: `value="sportomax"`

```html
<input type="text" id="username" placeholder="e.g., sportomax" value="sportomax">
```

### Default Settings
| Setting | Default | Purpose |
|---------|---------|---------|
| Username | `sportomax` | Collection owner |
| Max Games | `64` or `100` | Initial fetch limit |
| Batch Size | `20` | Thing API batch size |
| Retry Attempts | `5` | API retry count |
| Retry Delay | `3000ms` | 202 status wait time |
| Batch Delay | `500ms` | Between-batch delay |

---

## Console Logging Standards

### Log Format
Always prefix logs with `[filename]` for easy filtering in DevTools

```javascript
console.log(`[appname.html] 🔍 Starting operation...`);
console.log(`[appname.html] 📡 Fetching from ${endpoint}...`);
console.log(`[appname.html] ✓ Success: ${count} items`);
console.warn(`[appname.html] ⏳ Got 202 - retrying...`);
console.error(`[appname.html] ❌ Error: ${error.message}`);
```

### Log Levels
- **Info** (`console.log`): Normal operations, data loaded, progress
- **Warning** (`console.warn`): 202 retries, partial failures, fallbacks
- **Error** (`console.error`): API failures, parsing errors, user-facing errors

### What to Log
✅ API endpoint and parameters
✅ Response status and size
✅ 202 retry attempts
✅ Parsed data counts
✅ Error details with context

---

## Data Extraction Patterns

### Extract Game From Collection Item
```javascript
const item = collectionXml.querySelector('item');
const game = {
    id: item.getAttribute('objectid'),
    name: item.querySelector('name').textContent,
    thumbnail: item.querySelector('thumbnail')?.textContent,
    rating: parseFloat(item.querySelector('stats rating > average')?.getAttribute('value')) || 0
};
```

### Extract Game From Thing Item
```javascript
const item = thingXml.querySelector('item');
const game = {
    id: item.getAttribute('id'),
    name: item.querySelector('name')?.getAttribute('value'),
    width: parseFloat(item.querySelector('width')?.textContent),
    height: parseFloat(item.querySelector('height')?.textContent),
    depth: parseFloat(item.querySelector('depth')?.textContent),
    thumbnail: item.querySelector('thumbnail')?.textContent,
    image: item.querySelector('image')?.textContent,
    rating: parseFloat(item.querySelector('stats rating > average')?.getAttribute('value'))
};
```

---

## Common Feature Checklist

### For Collection-Based Apps
- [ ] Collection API call with `own=1` and `stats=1`
- [ ] Parse all items from collection
- [ ] Check for empty collection (0 items)
- [ ] Thing API batch processing for details
- [ ] 202 retry logic implemented
- [ ] 500ms delay between batches
- [ ] Fallback thumbnail if missing
- [ ] Flagged items for incomplete data
- [ ] Default username "sportomax"
- [ ] Mobile-responsive layout

### For All Apps
- [ ] Single HTML file
- [ ] iPhone-friendly design
- [ ] Console logging with prefix
- [ ] Error handling with user feedback
- [ ] Progress indicators for long operations
- [ ] Responsive at 480px, 768px breakpoints
- [ ] Safe area insets for notch devices
- [ ] Touch-friendly controls (44px minimum)
- [ ] All inline styles/scripts
- [ ] Data URI favicons

---

## Testing Checklist

### API Testing
```javascript
// Test 1: Collection fetch
await fetchFromBGG('collection', { username: 'sportomax', own: '1', stats: '1' });

// Test 2: Thing batch with 20 items
await fetchFromBGG('thing', { ids: '7866,130899,68448,...[20 total]', versions: '1' });

// Test 3: 202 retry logic
// Monitor console for "⏳ Got 202 - retrying..."

// Test 4: Error handling
// Try with invalid username - should show error
```

### Mobile Testing
- [ ] Load on iPhone 12+ (375px width)
- [ ] Load on iPad (768px width)
- [ ] Test all buttons with finger tap
- [ ] Scroll doesn't jump or glitch
- [ ] Text readable without zoom
- [ ] No horizontal scroll
- [ ] Safe area insets applied

### Browser DevTools
- Console: Check for `[appname]` logs
- Network: Verify `/api/bgg-helper` calls
- Mobile: Emulate iPhone 12/13
- Performance: Check for long tasks

---

## Git Commit Message Standards

```
feat: add new feature [scope]
fix: resolve API/bug issue [scope]
refactor: improve code structure [scope]
docs: update documentation
perf: optimize performance
style: format/style changes

Example:
fix: use /api/bgg-helper endpoint instead of CORS proxy for cubes.html
feat: add game stats modal to layers.html with click handlers
docs: add copilot instructions for BGG integration
```

---

## File Template

Use this template when creating new BGG collection apps:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <title>App Name</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='70'>🎮</text></svg>">
    <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
        .container { max-width: 1200px; margin: 0 auto; padding: 1rem; }
        @media (max-width: 768px) { .container { padding: 0.75rem; } }
        @media (max-width: 480px) { .container { padding: 0.5rem; } }
    </style>
</head>
<body>
    <div class="container">
        <h1>App Name</h1>
        <!-- Content here -->
    </div>

    <script>
        console.log(`[appname.html] 🎮 Loading app...`);

        // Prevent zoom issues
        document.addEventListener('touchstart', (e) => {
            if (e.touches.length > 1) e.preventDefault();
        }, false);

        // Main API function
        async function fetchFromBGG(endpoint, params = {}, retries = 5) {
            const queryParams = new URLSearchParams(params).toString();
            const fullUrl = `/api/bgg-helper?endpoint=${endpoint}&${queryParams}`;
            
            console.log(`[appname.html] 📡 Fetching ${endpoint}...`);
            
            try {
                const response = await fetch(fullUrl);
                
                if (response.status === 202 && retries > 0) {
                    console.warn(`[appname.html] ⏳ Got 202 - retrying...`);
                    await new Promise(r => setTimeout(r, 3000));
                    return fetchFromBGG(endpoint, params, retries - 1);
                }
                
                if (!response.ok) throw new Error(`API Status ${response.status}`);
                const text = await response.text();
                console.log(`[appname.html] ✓ Response: ${text.length} bytes`);
                return text;
            } catch (error) {
                console.error(`[appname.html] ❌ Error:`, error);
                throw error;
            }
        }

        // Your app logic here
    </script>
</body>
</html>
```

---

## Environment Variables

### Vercel Deployment
Set in Vercel Project Settings → Environment Variables:

```
BGG_API_TOKEN={your_bgg_api_token}
```

This is used by `/api/bgg-helper.js` for authentication.

---

## Resources

- **BGG XML API 2 Docs**: https://boardgamegeek.com/wiki/page/BGG_XML_API2
- **Collection API**: https://boardgamegeek.com/wiki/page/BGG_XML_API2#Collection_For_User
- **Thing API**: https://boardgamegeek.com/wiki/page/BGG_XML_API2#Thing
- **Vercel Docs**: https://vercel.com/docs
- **MDN Web Docs**: https://developer.mozilla.org/

---

## Last Updated
December 9, 2025

## Version
1.0
