# VFM (Virtual Flea Market) - Current Architecture Documentation

**Last Updated:** November 16, 2025  
**File:** vfm.html (2998 lines)  
**Purpose:** Board game marketplace tracker aggregating 19 BGG GeekLists with advanced filtering, analytics, and private data integration

---

## Core Requirements

### Data Sources
- **19 XML GeekLists** from BoardGameGeek API
  - 2025: vfm25bgg, vfm25spr, vfm25dte, vfm25dtw
  - 2024: vfm24bgg, vfm24spr, vfm24dte, vfm24dtw, vfm24cascade, vfm24colorado
  - 2023: vfm23bgg, vfm23spr, vfm23dte, vfm23dtw
  - 2022: vfm22spr, vfm22dte, vfm22dtw, vfm22cascade, vfm22colorado
- **Private Data XML:** `private_all.xml` (rank, average rating, price paid, ownership)
- **User Collection XML:** User's BGG collection for filtering

### Key Features
1. **Streaming Load System** - Display items as each XML file loads (not batch wait)
2. **Sold/Available Detection** - Smart regex detection of "sold" in body/comments, excludes "not sold"/"notsold"
3. **Multi-Source Filtering** - Filter by VFM file, collection status, sold status
4. **Price Analytics** - Table with 5 columns: Price, Count, Sold Price, Sold Count, comparing This Listing/This VFM/All VFM
5. **Buyer Tracking** - Format: `@seller > @buyer` (inline, clickable)
6. **Dashboard Analytics** - Game-level statistics with min/max/avg/median pricing
7. **Mobile-First** - Optimized for iPhone with compact layouts

---

## Current Architecture

### 1. **State Management** (Global Variables)
```javascript
let allItems = [];              // All loaded XML items across all files
let displayedItems = [];        // Currently displayed items (paginated)
let filteredItems = [];         // Items after filtering
let thumbnailCache = {};        // BGG thumbnail URLs by objectId
let userCache = {};             // BGG user info by username
let privateDataCache = {};      // Private data by objectId
let globalGameStats = {};       // Price statistics across all VFMs
let activeVFMFiles = new Set(); // Currently enabled VFM files
let currentPage = 0;            // Pagination state
let currentViewMode = 'detailed'; // 'detailed' or 'condensed'
let currentGameFilter = '';     // Game search filter
let currentUserFilter = '';     // User search filter
let currentMatchType = 'contains'; // Search match type
let currentSoldFilter = 'all';  // 'all', 'sold', 'available'
let currentCollectionFilter = 'all'; // Collection filter type
```

### 2. **Data Loading Flow**

#### Sequential Streaming Load
```javascript
async function loadGeekList() {
    // Load private data first
    await loadPrivateData();
    
    // Load user collection
    await loadCollectionData();
    
    // Sequential file loading with streaming display
    for (let i = 0; i < loadPromises.length; i++) {
        const items = await promise;
        allItems.push(...items);
        
        // IMMEDIATE DISPLAY - streaming key feature
        allItems = sortByDate(allItems);
        calculateGlobalGameStats();
        currentPage = 0;
        displayedItems = [];
        loadMoreItems(); // Display NOW before next file
        
        console.log(`[VFM STREAM] File ${i+1} loaded, displaying...`);
    }
}
```

#### XML Parsing
```javascript
function parseCollectionXML(xmlText, source) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const items = xmlDoc.querySelectorAll('item');
    
    return Array.from(items).map(item => {
        // Enrich item with metadata
        item.setAttribute('source-file', source);
        
        // Detect sold status
        const sold = isSold(item) ? '1' : '0';
        item.setAttribute('sold', sold);
        
        return item;
    });
}
```

### 3. **Filtering System**

#### Multi-Layer Filter Pipeline
```javascript
function applyFilter() {
    let baseItems = allItems.filter(item => {
        // Layer 1: VFM file filter
        return activeVFMFiles.has(item.getAttribute('source-file'));
    });
    
    filteredItems = baseItems.filter(item => {
        // Layer 2: Sold status filter
        if (!passesSoldFilter(item)) return false;
        
        // Layer 3: Collection filter
        if (!passesCollectionFilter(item)) return false;
        
        // Layer 4: Game search filter
        if (!passesGameFilter(item)) return false;
        
        // Layer 5: User search filter
        if (!passesUserFilter(item)) return false;
        
        return true;
    });
    
    // Reset pagination and redisplay
    currentPage = 0;
    displayedItems = [];
    loadMoreItems();
}
```

#### Sold Detection Logic
```javascript
function isSold(item) {
    const body = item.querySelector('body')?.textContent || '';
    const comments = Array.from(item.querySelectorAll('comment'))
        .map(c => c.textContent).join(' ');
    const allText = (body + ' ' + comments).toLowerCase();
    
    // Exclude false positives
    if (allText.includes('not sold') || allText.includes('notsold')) {
        return false;
    }
    
    return allText.includes('sold');
}
```

### 4. **Card Display System**

#### Two View Modes
1. **Detailed View** - Full stats, thumbnails, price table
2. **Condensed View** - Compact layout for mobile

#### Card Creation
```javascript
function createDetailedCard(item, index) {
    // Extract item data
    const objectId = item.getAttribute('objectid');
    const objectName = item.getAttribute('objectname');
    const username = item.getAttribute('username');
    
    // Calculate statistics
    const gameStats = calculateGameStats(objectId, sourceFile);
    const globalStats = globalGameStats[objectId];
    
    // Calculate sold-specific stats
    const soldItems = allItems.filter(i => 
        i.getAttribute('objectid') === objectId && isSold(i)
    );
    const soldPrices = soldItems.map(getPriceFromItem);
    const soldAvg = average(soldPrices);
    
    // Build price table (5 columns)
    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th></th>
                    <th>💵</th>
                    <th>#</th>
                    <th>🛒</th>
                    <th>🛒#</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>This Listing</td>
                    <td>$${price}</td>
                    <td></td>
                    <td>$${soldPrice || ''}</td>
                    <td>${soldCount || ''}</td>
                </tr>
                <tr>
                    <td>This VFM</td>
                    <td>$${gameStats.avg}</td>
                    <td>${gameStats.count}</td>
                    <td>$${vfmSoldAvg || ''}</td>
                    <td>${vfmSoldCount || ''}</td>
                </tr>
                <tr>
                    <td>All VFM</td>
                    <td>$${globalStats.avg}</td>
                    <td>${globalStats.count}</td>
                    <td>$${allSoldAvg || ''}</td>
                    <td>${allSoldCount || ''}</td>
                </tr>
            </tbody>
        </table>
    `;
    
    // Render card with inline @seller > @buyer format
    return cardElement;
}
```

### 5. **Analytics Dashboard**

#### Game-Level Statistics
```javascript
function showDashboard() {
    const gameStats = {};
    
    allItems.forEach(item => {
        const objectId = item.getAttribute('objectid');
        const price = extractPrice(item);
        
        if (!gameStats[objectId]) {
            gameStats[objectId] = {
                objectName: item.getAttribute('objectname'),
                prices: [],
                soldListings: 0,
                totalListings: 0
            };
        }
        
        gameStats[objectId].totalListings++;
        if (price) gameStats[objectId].prices.push(price);
        if (isSold(item)) gameStats[objectId].soldListings++;
    });
    
    // Calculate aggregates
    const dashboard = Object.values(gameStats).map(game => ({
        ...game,
        min: Math.min(...game.prices),
        max: Math.max(...game.prices),
        avg: average(game.prices),
        median: median(game.prices),
        firstPrice: game.prices[0],
        lastPrice: game.prices[game.prices.length - 1],
        availableListings: game.totalListings - game.soldListings
    }));
    
    renderDashboard(dashboard);
}
```

### 6. **Performance Optimizations**

#### Lazy Loading
- **Thumbnails:** Load only visible images using Intersection Observer
- **User Info:** Fetch on-demand when cards scroll into view
- **Pagination:** Load 50 items at a time with "Load More" button

#### Caching
- Thumbnail URLs cached in memory
- User info cached to avoid duplicate API calls
- Private data pre-loaded and cached

#### Streaming Display
- Display items immediately after each file loads
- Console logging proves sequential rendering
- Prevents long wait times for all 19 files

---

## Technical Stack

### APIs Used
1. **BGG XML API** - GeekList data, thumbnails, user info
2. **Private XML** - Custom data file for ownership/pricing

### Browser Features
- **DOMParser** - XML parsing
- **Intersection Observer** - Lazy loading
- **Fetch API** - Async data loading
- **LocalStorage** - Not currently used

### Mobile Optimization
- **Viewport:** `maximum-scale=1.0, user-scalable=no`
- **Apple Web App:** Standalone mode support
- **Font Sizes:** 9-14px for compact mobile display
- **Touch-Friendly:** Large click targets, smooth scrolling

---

## Known Issues & Limitations

1. **Item Not Found Errors** - Fixed by searching `allItems` instead of `displayedItems`
2. **Duplicate itemId Declaration** - Fixed in recent commit
3. **Performance** - 19 XML files = ~2000+ items, can be slow on older devices
4. **BGG API Rate Limits** - Thumbnails/users fetched incrementally
5. **No Offline Support** - Requires internet for XML/API calls

---

## Key Design Decisions

### Why Streaming Load?
- User sees data immediately (progressive enhancement)
- Better perceived performance than "Loading..." for 30+ seconds
- Console logs prove each file displays before next loads

### Why Inline @seller > @buyer?
- Saves vertical space on mobile
- Clickable usernames for quick filtering
- Green arrow (>) visually indicates transaction flow

### Why 5-Column Price Table?
- Compact emoji headers save horizontal space
- Sold vs All comparison shows market trends
- Smaller fonts (9-14px) fit more data on iPhone

### Why No Framework?
- Vanilla JS = no dependencies
- Faster load times
- Full control over rendering

---

## File Structure

**Total Lines:** 2998  
**HTML:** ~100 lines  
**CSS:** ~800 lines  
**JavaScript:** ~2100 lines  

### Major Sections
1. **Lines 1-1000:** Styles, UI components, VFM controls
2. **Lines 1000-1600:** Filtering, search, utility functions
3. **Lines 1600-2200:** Data loading, streaming logic
4. **Lines 2200-2600:** Card rendering, view modes
5. **Lines 2600-3000:** Dashboard, modals, analytics

---

## Future Improvement Ideas

1. **IndexedDB Caching** - Store XML locally for offline use
2. **Service Worker** - PWA support, background sync
3. **Virtual Scrolling** - Render only visible cards (performance)
4. **WebSocket Updates** - Real-time sold status changes
5. **Image Optimization** - WebP thumbnails, lazy srcset
6. **Advanced Analytics** - Price trends over time, seller reputation
7. **Export Features** - CSV/JSON export of filtered results
8. **Notification System** - Alert when desired games posted

---

## Conclusion

VFM is a feature-rich marketplace tracker with sophisticated filtering, streaming data loads, mobile-first design, and comprehensive analytics. The codebase has grown organically to ~3000 lines with room for architectural improvements through refactoring.
