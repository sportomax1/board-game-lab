# Home.html App Inventory

This document shows the status of HTML apps in relation to what's listed in `home.html`.

## Summary Statistics

- **Total HTML files in repository**: 122
- **Apps listed in home.html**: 120
- **Apps missing from home.html**: 11
- **Apps in home.html that don't exist**: 0 (after fixing trivabox → triviabox)

## Apps Missing from home.html

The following HTML files exist in the repository but are NOT listed in `home.html`:

1. **cubes_backup.html** - Backup version of cubes game (probably intentionally excluded)
2. **dashboard.html** - Dashboard interface (utility page)
3. **day.html** - Day-related functionality
4. **dtw.html** - DTW (Denver/Detroit/etc.) specific functionality
5. **home.html** - The home page itself (self-reference, intentionally excluded)
6. **players.html** - Player management interface
7. **profile.html** - User profile page
8. **size.html** - Size-related tool
9. **spell.html** - Spelling game or tool
10. **triviabox.html** - NEW filename after renaming from trivabox.html (needs to be added)
11. **weight.html** - Game weight/complexity analyzer

## Recommendations

### High Priority - Should be added to home.html:
1. ✅ **weight.html** - Game Weight/Complexity Ratings
   - Modern iPhone-style app with parallel processing
   - Shows game complexity ratings from BGG
   - Well-designed and functional
   
2. ✅ **triviabox.html** - Fixed filename (was trivabox.html)
   - Already listed in home.html but needs URL update
   - FIXED: Updated home.html to reference triviabox.html

### Medium Priority - Consider adding:
1. **spell.html** - Could be added to Games & Fun / Puzzle section
2. **players.html** - Could be added to Tools section
3. **size.html** - Could be added to Data & Tools section

### Low Priority / Intentionally Excluded:
1. **dashboard.html** - Likely an admin/utility page
2. **home.html** - The home page itself (self-reference)
3. **profile.html** - User profile (may be accessed differently)
4. **cubes_backup.html** - Backup file (shouldn't be public)
5. **day.html** - May be a deprecated or experimental page
6. **dtw.html** - Likely a location-specific variant

## Recently Removed Apps

The following apps were removed as part of recent changes:

1. ❌ **suggested.html** - Removed per requirements
   - Was: Suggested Player Counts tool
   - Status: Successfully removed from repository
   - Action needed: Already removed from home.html if it was there

## Apps That No Longer Exist

After the rename from `trivabox.html` to `triviabox.html`:
- Old reference in home.html has been updated
- No apps are listed in home.html that don't exist in the repository

## Next Steps

1. ✅ Update home.html reference from trivabox.html → triviabox.html (DONE)
2. 📝 Consider adding weight.html to home.html (highly recommended)
3. 📝 Review spell.html, players.html, and size.html for potential inclusion
4. 🗑️ Consider removing or archiving cubes_backup.html if no longer needed
5. 📝 Document purpose of day.html and dtw.html for future reference

## Date
January 29, 2026

## Last Updated
After removing suggested.html and renaming trivabox.html → triviabox.html
