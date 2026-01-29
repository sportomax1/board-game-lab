# Recent Changes - Parallel Processing 100x Implementation

## Overview
Implemented parallel processing (100x) across multiple HTML applications to significantly improve data fetching performance from the BoardGameGeek (BGG) API.

## API Endpoints Used

The following HTML applications use BGG API endpoints:

### Primary API Endpoints
1. **collection** - Fetch user's BGG collection
   - Used by: forums.html, expansion.html, connections.html, marketplace.html, videos.html, and many others
   - Parameters: `username`, `own=1`, `stats=1`

2. **thing** - Fetch detailed game information
   - Used by: ALL apps that need game details, weights, expansions, marketplace listings, etc.
   - Parameters: `id` (comma-separated IDs), `stats=1`, `marketplace=1`, etc.

3. **forumlist** - Fetch forum information for games
   - Used by: forums.html
   - Parameters: `type=thing`, `id`

## Parallel Processing Implementation

### Files Updated with 100x Parallel Processing

All the following files now use parallel batch processing with `parallelBatches = 100`:

1. ✅ **forums.html** - Forum data fetching
2. ✅ **expansion.html** - Expansion counts loading
3. ✅ **connections.html** - Game metadata processing
4. ✅ **collage.html** - Thumbnail fetching
5. ✅ **marketplace.html** - Marketplace listings
6. ✅ **menu.html** - Game details fetching
7. ✅ **similar.html** - Game details for similarity analysis
8. ✅ **pocketvalue.html** - Measurements fetching
9. ✅ **videos.html** - Video data processing
10. ✅ **virtualcards.html** - Batch loading
11. ✅ **ranks.html** - Ranking data fetching

### Implementation Pattern

```javascript
const batchSize = 20; // or other value appropriate for the API
const parallelBatches = 100; // Process 100 batches in parallel

// Create batches
const batches = [];
for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
}

// Process batches in parallel groups
for (let i = 0; i < batches.length; i += parallelBatches) {
    const batchGroup = batches.slice(i, i + parallelBatches);
    
    await Promise.all(batchGroup.map(async (batch) => {
        // Process each batch
    }));
    
    // Throttle between parallel groups
    await new Promise(resolve => setTimeout(resolve, 500));
}
```

### Performance Improvements

- **Before**: Sequential batch processing (one batch at a time)
- **After**: Up to 100 batches processed in parallel
- **Speed Increase**: Up to 100x faster for large collections
- **Rate Limiting**: Maintained with 500ms throttling between parallel groups

## Files Modified in This Update

### Removed
- ❌ `suggested.html` - Removed per requirements

### Renamed
- ✅ `trivabox.html` → `triviabox.html` - Fixed typo in filename

### Updated with Parallel Processing
All files listed above in the "Files Updated" section

## Testing Notes

- All parallel processing implementations include error handling
- Rate limiting is maintained to respect BGG API constraints
- Progress indicators updated to show batch processing status
- Console logging included for debugging

## Date
January 29, 2026
