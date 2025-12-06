# Master Index Auto-Regeneration Setup

## Overview
The master_index.html now automatically scans **ALL 14 repositories** on your GitHub account (`https://github.com/sportomax1`) and generates a unified, searchable index of all files across all repos.

## What's New

### 1. **Dual Filtering**
- **File Type Filter**: Filter by file extension (.html, .py, .xml, .json, etc.)
- **Repository Filter**: Filter by specific repository (vercel, apps, boardgames, sandbox, etc.)
- **Search**: Full-text search by filename, path, or repository name

### 2. **GitHub Actions Workflow**
File: `.github/workflows/regenerate-master-index.yml`

**Schedule**: Automatically regenerates every 6 hours
- 00:00 UTC
- 06:00 UTC
- 12:00 UTC
- 18:00 UTC

**Manual Trigger**: Can also be triggered manually from GitHub Actions page (Actions > Regenerate Master Index > Run workflow)

### 3. **Updated Python Script**
File: `generate_master_index.py`

**Improvements**:
- ✅ Scans ALL repositories in your GitHub account (not just vercel)
- ✅ Supports both GITHUB_TOKEN (5000 req/hr) and unauthenticated (60 req/hr) requests
- ✅ Recursively indexes all files in all subfolders
- ✅ Dynamically generates repo filter buttons from scanned repositories
- ✅ Tracks last commit time for each file across all repos
- ✅ Displays file size, update time, and direct GitHub links

## How It Works

### Local Execution (Manual)
```bash
python generate_master_index.py
```
- Uses unauthenticated API (60 requests/hour limit)
- May rate limit if you run it multiple times within an hour

### GitHub Actions Execution (Automatic)
- Uses `GITHUB_TOKEN` environment variable
- Gets 5000 requests/hour (increased limit)
- Automatically commits changes if master_index.html changed
- Logs all activity with [INFO] tags

## Features

### Statistics Dashboard
- Total repositories scanned
- Total files indexed
- Visible files (after filtering)

### Sorting Options
- **Last Updated** (default): Most recently modified files first
- **Name**: Alphabetical file name
- **Repository**: Grouped by repo name
- **Size**: Largest files first

### Data Attributes Per File
- File extension
- Repository name
- File name (lowercase for search)
- File path (lowercase for search)
- Last commit timestamp (Unix epoch)
- File size (bytes)

## File Structure
```
All Repos (sportomax1)
├── vercel/ (248 files)
│   ├── Root files (.html, .py, .xml, .json, .csv, .md)
│   ├── reference/ (.vfm files, api.html)
│   ├── draft/ (welcome files, old versions, tests)
│   ├── private/ (collection data, checkout, matchup)
│   ├── api/ (endpoints)
│   ├── cascade_vfm/ (geeklist data)
│   └── github-actions/ (CI files)
├── apps/
├── boardgames/
├── sandbox/
├── mymaps/
├── games/
├── master/
├── googlesheets/
├── secret/
├── supabase/
├── firebase/
├── sevenflip/
├── pong-game/
└── gamemaster/
```

## Rate Limiting

### Without GITHUB_TOKEN
- 60 requests/hour per IP
- ~10 minutes per full scan (248 files = 250+ API calls)

### With GITHUB_TOKEN (GitHub Actions)
- 5000 requests/hour per token
- ~2 minutes per full scan
- Automatically used in GitHub Actions

## Troubleshooting

### "Error fetching repos: 403"
This usually means:
1. Rate limit hit (wait 1 hour or use GITHUB_TOKEN)
2. Network issue
3. GitHub API temporarily down

**Solution**: Wait an hour or run from GitHub Actions which has GITHUB_TOKEN

### Master index not updating
Check GitHub Actions logs:
1. Go to: https://github.com/sportomax1/vercel/actions
2. Click "Regenerate Master Index"
3. View logs for errors

### Workflow not running on schedule
1. Verify workflow file exists: `.github/workflows/regenerate-master-index.yml`
2. Check schedule in workflow (should be `0 */6 * * *`)
3. Verify at least one commit exists (workflows need a ref to run on)

## Next Steps

You can customize the workflow schedule by editing `.github/workflows/regenerate-master-index.yml`:

**Change to hourly**:
```yaml
cron: '0 * * * *'  # Every hour
```

**Change to daily at 2 AM UTC**:
```yaml
cron: '0 2 * * *'  # Daily at 2 AM UTC
```

**Change to weekly**:
```yaml
cron: '0 0 * * 0'  # Every Sunday at midnight UTC
```

Then commit and push - GitHub will use the new schedule automatically.
