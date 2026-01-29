# Apps with Thing API Calls

This document lists all HTML applications in the repository that make calls to the BGG "thing" API endpoint.

## Total: 33 Apps

### Apps with Thing API Calls

1. **bga.html** - Board Game Atlas integration
2. **boardgametype.html** - Board game type analysis
3. **collage.html** - Game collection collage generator
4. **component.html** - Game component viewer
5. **connections.html** - Game connections analyzer
6. **cubes.html** - Game measurements (current version)
7. **cubes_backup.html** - Game measurements (backup with parallel processing)
8. **dashboard.html** - Main dashboard with multiple API calls
9. **dte.html** - Deep Table Experience
10. **dtw.html** - Denver Table Wars
11. **expansion.html** - Game expansions viewer
12. **forums.html** - BGG forums integration
13. **geeklist.html** - GeekList viewer
14. **library_bgg-live.html** - Live BGG library
15. **library_bgg.html** - BGG library viewer
16. **marketplace.html** - Marketplace integration
17. **menu.html** - Menu system
18. **metermaster.html** - Meter master tool
19. **players.html** - Player count recommendations (with parallel processing ✓)
20. **plays.html** - Play history tracker (with parallel processing ✓)
21. **pocketvalue.html** - Pocket value calculator
22. **pubmeeple.html** - Pub Meeple integration
23. **rankfile.html** - Rank file analyzer
24. **ranks.html** - Game rankings
25. **similar.html** - Similar games finder
26. **stats.html** - Statistics dashboard
27. **suggested.html** - Game suggestions
28. **trivabox.html** - Trivia game
29. **versions.html** - Game versions viewer
30. **vfm.html** - Virtual Fantasy Market
31. **videos.html** - Video integration
32. **virtualcards.html** - Virtual cards system
33. **weight.html** - Game weight/complexity analyzer

## Parallel Processing Status

### Implemented (3 apps):
- ✅ **cubes_backup.html** - Uses Promise.all with batch processing (50 parallel batches)
- ✅ **players.html** - Uses Promise.all with batch processing (100 parallel batches)
- ✅ **plays.html** - Uses Promise.all with batch processing (50 parallel batches) - *NEWLY UPDATED*

### Sequential Processing (30 apps):
All other apps listed above still use sequential API calls and could benefit from parallel processing implementation.

## Implementation Pattern

Apps with parallel processing follow this pattern:

```javascript
// Create batches
const batchSize = 10-20;
const parallelBatches = 50-100;
const batches = [];
for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
}

// Process batches in parallel groups
for (let i = 0; i < batches.length; i += parallelBatches) {
    const batchGroup = batches.slice(i, i + parallelBatches);
    
    await Promise.all(batchGroup.map(async (batch) => {
        try {
            const ids = batch.join(',');
            const xml = await fetchAPI('thing', ids, '&stats=1');
            // Process results...
        } catch (e) {
            console.error('Batch error:', e);
        }
    }));
    
    // Small delay between groups
    await wait(300-500);
}
```

## Benefits of Parallel Processing

1. **Faster Loading**: Multiple API requests processed simultaneously
2. **Better UX**: Progressive rendering as batches complete
3. **Efficient**: Balances speed with API rate limits
4. **Resilient**: Error handling per batch prevents total failure

## Notes

- Thing API calls retrieve detailed game information including stats, ratings, rankings, and metadata
- All apps use the `/api/bgg-helper` proxy endpoint to interact with BoardGameGeek API
- Parallel processing significantly improves performance for large collections (100+ games)
- Recommended to add parallel processing to high-traffic apps handling large datasets
