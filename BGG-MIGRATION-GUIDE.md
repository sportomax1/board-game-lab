# BGG API Authentication Migration Guide

## Overview
This guide shows how to update all BGG API calls in your repository to use the centralized authentication system with your `BGG_API_TOKEN` secret.

## 🔧 New System Components

### 1. Centralized API Helper (`/api/bgg-helper.js`)
- Handles all BGG API v1 and v2 calls
- Uses `BGG_API_TOKEN` for authentication
- Supports: collection, thing, user, hot, geeklist, plays endpoints
- Includes proper error handling and retry logic

### 2. Client-Side Utility (`/bgg-api-client.js`)
- Optional JavaScript utility for easier frontend integration
- Provides helper functions like `bggAPI.getCollection()`, `bggAPI.getThing()`
- Can be included in HTML files for simplified API calls

## 🔄 Migration Patterns

### Pattern 1: Simple URL Replacement
**OLD:**
```javascript
const resp = await fetch('https://boardgamegeek.com/xmlapi2/collection?stats=1&username=sportomax');
```

**NEW:**
```javascript
const resp = await fetch('/api/bgg-helper?endpoint=collection&stats=1&username=sportomax');
```

### Pattern 2: Dynamic Parameter URLs
**OLD:**
```javascript
const resp = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${ids}&stats=1`);
```

**NEW:**
```javascript
const resp = await fetch(`/api/bgg-helper?endpoint=thing&id=${ids}&stats=1`);
```

### Pattern 3: Complex URLs with Multiple Parameters
**OLD:**
```javascript
const collectionUrl = `https://boardgamegeek.com/xmlapi2/collection?stats=1&username=${encodeURIComponent(username)}${ownParam}`;
const response = await fetch(collectionUrl);
```

**NEW:**
```javascript
const response = await fetch(`/api/bgg-helper?endpoint=collection&stats=1&username=${encodeURIComponent(username)}${ownParam}`);
```

## 📋 Complete Migration Checklist

### Files Already Updated:
- ✅ `/api/bgg-thing.js` - BGG Thing API with auth
- ✅ `/welcome.js` - Collection API call
- ✅ `/welcome2.js` - Collection and Thing API calls  
- ✅ `/hotgames.html` - Hot games API call

### Files That Need Migration:

#### High Priority (Main Tools):
- [ ] `/bga_test.html` - 3 API calls
- [ ] `/collection2.html` - 2 API calls
- [ ] `/dtw.html` - 2 API calls
- [ ] `/geeklist.html` - 7 API calls
- [ ] `/menu.html` - 2 API calls
- [ ] `/playingcards.html` - 2 API calls
- [ ] `/private.html` - 1 API call

#### Medium Priority (VFM Tools):
- [ ] `/vfm.html` - 2 API calls
- [ ] `/vfm-try.html` - 2 API calls
- [ ] `/vfmZ.html` - 3 API calls
- [ ] `/vfm_old.html` - 2 API calls

#### Lower Priority (Alternative/Specialized):
- [ ] `/alt/vfm.html` - 4 API calls
- [ ] `/matchup.html` - 1 API call

## 🚀 Quick Migration Script

For each file, replace these patterns:

1. **Collection API:**
```bash
# Find: https://boardgamegeek.com/xmlapi2/collection?
# Replace: /api/bgg-helper?endpoint=collection&
```

2. **Thing API:**
```bash
# Find: https://boardgamegeek.com/xmlapi2/thing?
# Replace: /api/bgg-helper?endpoint=thing&
```

3. **User API:**
```bash
# Find: https://boardgamegeek.com/xmlapi2/user?
# Replace: /api/bgg-helper?endpoint=user&
```

4. **Hot API:**
```bash
# Find: https://boardgamegeek.com/xmlapi2/hot?
# Replace: /api/bgg-helper?endpoint=hot&
```

5. **Geeklist API (v1):**
```bash
# Find: https://boardgamegeek.com/xmlapi/geeklist/
# Replace: /api/bgg-helper?endpoint=geeklist&id=
```

## 🎯 Endpoint Mapping Reference

| Original URL | New Endpoint | Example |
|-------------|--------------|---------|
| `/xmlapi2/collection?params` | `endpoint=collection&params` | `?endpoint=collection&username=user&stats=1` |
| `/xmlapi2/thing?params` | `endpoint=thing&params` | `?endpoint=thing&id=144733&stats=1` |
| `/xmlapi2/user?params` | `endpoint=user&params` | `?endpoint=user&name=username` |
| `/xmlapi2/hot?params` | `endpoint=hot&params` | `?endpoint=hot&type=boardgame` |
| `/xmlapi/geeklist/123` | `endpoint=geeklist&id=123` | `?endpoint=geeklist&id=123&comments=1` |
| `/xmlapi2/plays?params` | `endpoint=plays&params` | `?endpoint=plays&username=user` |

## 🔒 Environment Setup Required

Make sure your Vercel project has the environment variable set:
- **Variable Name:** `BGG_API_TOKEN`
- **Variable Value:** Your actual BGG API token

## ✅ Testing

After migration, test each tool to ensure:
1. API calls work without CORS errors
2. Authentication is successful (no 401/403 errors)
3. Data loads correctly
4. Error handling works properly

## 🆘 Troubleshooting

### Common Issues:
1. **500 Error:** Check that `BGG_API_TOKEN` is set in Vercel environment variables
2. **404 Error:** Verify the endpoint parameter is correct
3. **CORS Error:** Make sure you're using the `/api/bgg-helper` endpoint, not direct BGG URLs
4. **202 Error:** BGG is processing the request, implement retry logic or show user message

### Error Response Format:
```json
{
  "status": 500,
  "step": "Token Check", 
  "error": "Configuration Error",
  "message": "BGG_API_TOKEN not configured"
}
```

## 💡 Optional: Using the JavaScript Client

Include the client utility in your HTML:
```html
<script src="/bgg-api-client.js"></script>
<script>
// Use the simplified API
const xml = await bggAPI.getCollection('username');
const gameData = await bggAPI.getThing('144733');
</script>
```