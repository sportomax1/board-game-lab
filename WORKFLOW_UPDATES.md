# GitHub Actions Workflow Updates - Library Data Fetching

## Summary
Updated 2 library collection workflows to use Python + requests with detailed logging instead of silent curl commands.

## Changes Made

### 1. library_sportomax.yml ✅ UPDATED
- **Before**: Simple `curl` command with no error handling or logging
- **After**: Python 3 script with:
  - ✅ Detailed logging with `[LIBRARY]` prefix
  - ✅ Retry logic for BGG 202 Accepted responses
  - ✅ Timeout handling (30 seconds)
  - ✅ User-Agent header
  - ✅ File verification (size & line count)
  - ✅ Better commit messages with timestamps
- **Triggers**: Manual (`workflow_dispatch`) or every 6 hours (cron)
- **Action**: Fetches BGG collection for user `sportomax`

### 2. library_dtw.yml ✅ UPDATED  
- **Before**: Simple `curl` command with no error handling or logging
- **After**: Same Python approach as sportomax
  - ✅ Detailed logging with `[DTW]` prefix
  - ✅ Retry logic for BGG 202 responses
  - ✅ File verification
- **Triggers**: Manual (`workflow_dispatch`) or every 6 hours (cron)
- **Action**: Fetches BGG collection for user `DTWLibrary`

### 3. library_dte.yml ⏳ ALREADY COMPLEX
- **Status**: Uses different API (tabletop.events, not BGG)
- **Current state**: Already sophisticated with Node.js + jq + JSON-to-XML conversion
- **Action**: Fetches from TabletopEvents library (90655C52-5776-11EB-B202-68083970B3C4)
- **Note**: No changes needed - uses logging already

## How to Test

### Manual Trigger (GitHub UI)
1. Go to GitHub repository
2. Click **Actions** tab
3. Select workflow: "Fetch BGG Collection (Sportomax)" or "Fetch DTW Collection"
4. Click **Run workflow** → **Run workflow** (green button)
5. Watch logs in real-time - look for `[LIBRARY]` or `[DTW]` output

### Expected Output in Logs
```
[LIBRARY] Fetching from: https://boardgamegeek.com/xmlapi2/collection?username=sportomax&stats=1
[LIBRARY] Response status: 200
[LIBRARY] Response size: 524288 bytes
[LIBRARY] ✅ Successfully saved library_sportomax.xml (524288 bytes)
[LIBRARY] ✅ File exists: 524288 bytes, 1024 lines
```

### Verify in Repository
After workflow succeeds:
1. Check `library_sportomax.xml` exists in root directory
2. File size should be > 100KB (contains multiple games)
3. library.html will automatically load from this instead of fallback

## library.html Integration
When workflows succeed and populate XML files:
1. library.html fetches from: `library_sportomax.xml`, `library_dtw.xml`, etc.
2. Falls back to `private_all.xml` if files missing/empty
3. Combines all 4 sources into unified library with desire scoring
4. Console shows: `[LIBRARY] ✅ library_sportomax.xml loaded: 1523 games`

## Desire Score Formula
Applied to games with `wanttoplay` or `wishlist` attributes:
```
desireScore = (wanttoplay ? 5 : 0) + (wishlist ? 6-priority : 0)
```
- Games sorted by desire score (high to low)
- Color-coded badges: Green 8+, Blue 5+, Yellow 3+, Gray 0

## Files Modified
- ✅ `.github/workflows/library_sportomax.yml` - Replaced curl with Python + logging
- ✅ `.github/workflows/library_dtw.yml` - Replaced curl with Python + logging
- ⏳ `.github/workflows/library_dte.yml` - No changes (already using different approach)

## Next Steps
1. **Test**: Manually trigger `library_sportomax.yml` workflow in GitHub Actions
2. **Verify**: Check console logs for `[LIBRARY]` output
3. **Validate**: Confirm `library_sportomax.xml` file size > 0
4. **Monitor**: Check library.html loads games from new XML files
5. **Repeat**: Manually trigger `library_dtw.yml` and verify
6. **Schedule**: Both workflows set to run every 6 hours automatically

## Troubleshooting
If workflows still fail:
1. Check GitHub Actions logs for detailed error messages
2. Verify Python 3 and requests library available (both included in ubuntu-latest)
3. Test BGG API manually: `curl -L "https://boardgamegeek.com/xmlapi2/collection?username=sportomax&stats=1"`
4. Check if BGG API is rate-limiting (look for 429 status code in logs)
