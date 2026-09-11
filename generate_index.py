import os
import glob
from pathlib import Path
from datetime import datetime, timezone, timedelta
import subprocess
import re
import json

def format_time_since(delta):
    """Converts a timedelta object to a user-friendly 'time since' string."""
    seconds = int(delta.total_seconds())
    
    if seconds < 60:
        return "Just now"
    elif seconds < 3600:
        minutes = seconds // 60
        return f"{minutes}m ago"
    elif seconds < 86400:
        hours = seconds // 3600
        return f"{hours}h ago"
    else:
        days = seconds // 86400
        return f"{days}d ago"

def get_git_commit_time(file_path):
    """
    Uses the 'git log' command to get the commit timestamp of the last change 
    to the specific file. This provides the true last update time in the repo.
    Returns epoch timestamp (float) or falls back to os.path.getmtime().
    """
    try:
        # Command: git log -1 --format=%ct -- <file_path>
        # %ct = committer date, Unix timestamp format
        result = subprocess.run(
            ['git', 'log', '-1', '--format=%ct', '--', file_path],
            capture_output=True,
            text=True,
            check=True
        )
        return float(result.stdout.strip())
    except (subprocess.CalledProcessError, FileNotFoundError, ValueError):
        # Fallback for new (uncommitted) files or if git fails
        # print(f"Warning: No git history found for {file_path}. Using filesystem time.")
        return os.path.getmtime(file_path)
    except Exception as e:
        # Generic error fallback
        print(f"Error getting git time for {file_path}: {e}")
        return os.path.getmtime(file_path)

def update_home_html():
    file_path = 'home.html'
    if not os.path.exists(file_path):
        print(f"Skipping home.html update: File {file_path} not found.")
        return

    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Extract the apps array block
    pattern = r'(const\s+apps\s*=\s*\[)(.*?)(\];)'
    match = re.search(pattern, content, re.DOTALL)
    
    if not match:
        print("Could not find 'const apps = [...]' block in home.html")
        return

    start_str = match.group(1)
    apps_content = match.group(2)
    end_str = match.group(3)

    # 2. Parse existing apps to preserve metadata
    objects = []
    current_lines = []
    in_object = False
    brace_count = 0
    
    lines = apps_content.split('\n')
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
            
        if stripped.startswith('//'):
            pass # Ignore comments for parsing
        
        if '{' in stripped and not in_object:
            in_object = True
            current_lines = [line]
            brace_count = line.count('{') - line.count('}')
        elif in_object:
            current_lines.append(line)
            brace_count += line.count('{') - line.count('}')
        
        if in_object and brace_count == 0:
            full_text = '\n'.join(current_lines)
            url_match = re.search(r'url:\s*[\'"]([^\'"]+)[\'"]', full_text)
            if url_match:
                url = url_match.group(1)
                objects.append({'url': url, 'text': full_text.rstrip(',')})
            in_object = False
            current_lines = []

    # 3. Scan directory
    fs_files = set()
    exclude_files = {'index.html', 'home.html', '404.html'}
    exclude_dirs = {'.git', '.github', 'node_modules', '__pycache__', '.vercel', 'api', 'alt', '.vscode', 'private'}
    
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file.endswith('.html') and file not in exclude_files:
                rel_path = os.path.relpath(os.path.join(root, file), '.').replace('\\', '/')
                if rel_path.startswith('./'):
                    rel_path = rel_path[2:]
                fs_files.add(rel_path)

    # 4. Construct new app list
    final_objects = []
    processed_urls = set()
    
    # A. Add existing objects if file still exists
    for obj in objects:
        url = obj['url']
        if url in fs_files:
            final_objects.append(obj['text'])
            processed_urls.add(url)
        # else: print(f"Removing missing file from home.html: {url}")

    # B. Add new files
    new_files = fs_files - processed_urls
    for new_file in sorted(new_files):
        print(f"Adding new file to home.html: {new_file}")
        name = os.path.splitext(os.path.basename(new_file))[0].replace('-', ' ').title()
        
        new_entry = f"""            {{
                name: '{name}',
                emoji: '🆕',
                description: 'Auto-detected file',
                tags: ['New', 'Auto'],
                category: 'misc',
                url: '{new_file}',
                defaultRating: 0
            }}"""
        final_objects.append(new_entry)

    # 5. Reconstruct the block
    new_apps_content = '\n' + ',\n'.join(final_objects) + '\n        '
    new_full_content = content[:match.start(2)] + new_apps_content + content[match.end(2):]
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_full_content)
    
    print(f"Successfully updated home.html with {len(final_objects)} apps.")

def generate_html_index(output_file='index.html'):
    """
    Scans for all files (excluding certain directories), sorts them by their Git commit date,
    and generates an index file with file type filtering, client-side sorting and search controls.
    """
    
    # Capture the generation time
    generation_time_utc = datetime.now(timezone.utc)
    generation_time_iso = generation_time_utc.replace(microsecond=0).isoformat()
    MTN_OFFSET = timedelta(hours=-7)
    generation_time_mtn = generation_time_utc + MTN_OFFSET
    generation_time_str = generation_time_mtn.strftime('%b %d, %H:%M')
    
    # Directories to exclude from scanning
    EXCLUDE_DIRS = {'.git', '.github', 'node_modules', '__pycache__', '.vercel', 'api', 'alt', '.vscode'}
    
    # --- Start of HTML content ---
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>App Index</title>
    <meta name="theme-color" content="#0f172a">
    <style>
        :root {{
            --bg-body: #f8fafc;
            --bg-card: #ffffff;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --primary: #4f46e5;
            --primary-light: #e0e7ff;
            --border: #e2e8f0;
            --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
            --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
            --radius: 16px;
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }}

        @media (prefers-color-scheme: dark) {{
            :root {{
                --bg-body: #0f172a;
                --bg-card: #1e293b;
                --text-main: #f1f5f9;
                --text-muted: #94a3b8;
                --primary: #818cf8;
                --primary-light: #312e81;
                --border: #334155;
                --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
                --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.3);
            }}
        }}

        * {{ box-sizing: border-box; -webkit-tap-highlight-color: transparent; }}
        
        body {{ 
            font-family: var(--font-sans);
            margin: 0; 
            background-color: var(--bg-body);
            color: var(--text-main);
            line-height: 1.5;
            padding-bottom: 40px;
        }}

        .container {{ 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px;
        }}

        /* Header */
        header {{
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        
        h1 {{ 
            font-size: 24px; 
            font-weight: 800; 
            margin: 0;
            background: linear-gradient(135deg, var(--primary) 0%, #c084fc 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.5px;
        }}

        .meta-info {{
            font-size: 13px;
            color: var(--text-muted);
            font-weight: 500;
        }}

        /* Search & Controls */
        .controls-area {{
            position: sticky;
            top: 10px;
            z-index: 100;
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            padding: 12px;
            border-radius: var(--radius);
            box-shadow: var(--shadow-md);
            margin-bottom: 24px;
            border: 1px solid rgba(255,255,255,0.1);
        }}

        @media (prefers-color-scheme: dark) {{
            .controls-area {{
                background: rgba(30, 41, 59, 0.8);
                border: 1px solid rgba(255,255,255,0.05);
            }}
        }}

        .search-wrapper {{
            position: relative;
            margin-bottom: 12px;
        }}

        .search-input {{
            width: 100%;
            padding: 12px 16px 12px 44px;
            background-color: var(--bg-body);
            border: 1px solid var(--border);
            border-radius: 12px;
            font-size: 16px;
            color: var(--text-main);
            transition: all 0.2s;
            outline: none;
        }}

        .search-input:focus {{
            border-color: var(--primary);
            box-shadow: 0 0 0 3px var(--primary-light);
        }}

        .search-icon {{
            position: absolute;
            left: 14px;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            pointer-events: none;
        }}

        .filters {{
            display: flex;
            gap: 8px;
            overflow-x: auto;
            padding-bottom: 4px;
            scrollbar-width: none; /* Hide scrollbar Firefox */
        }}
        .filters::-webkit-scrollbar {{ display: none; }}

        .filter-btn {{
            padding: 8px 16px;
            font-size: 14px;
            font-weight: 600;
            border-radius: 20px;
            background-color: var(--bg-body);
            border: 1px solid var(--border);
            color: var(--text-muted);
            white-space: nowrap;
            cursor: pointer;
            transition: all 0.2s;
        }}

        .filter-btn.active {{
            background-color: var(--primary);
            color: white;
            border-color: var(--primary);
        }}

        /* App List */
        .app-list {{
            display: grid;
            gap: 4px;
            grid-template-columns: 1fr;
        }}
        
        @media (min-width: 600px) {{
            .app-list {{ grid-template-columns: repeat(2, 1fr); }}
        }}

        .app-card {{
            background-color: var(--bg-card);
            border-radius: 8px;
            box-shadow: none;
            text-decoration: none;
            color: inherit;
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 7px;
            padding: 6px 8px;
            transition: background-color 0.15s, border-color 0.15s;
            border: 1px solid var(--border);
            position: relative;
            overflow: hidden;
            min-width: 0;
        }}

        .app-card:active {{ opacity: 0.8; }}
        .app-card:hover {{
            background-color: var(--primary-light);
            border-color: var(--primary);
        }}

        .card-header {{
            display: flex;
            align-items: center;
            flex-shrink: 0;
            margin-bottom: 0;
        }}

        .file-type {{
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
            padding: 2px 5px;
            border-radius: 4px;
            background-color: var(--bg-body);
            color: var(--text-muted);
            flex-shrink: 0;
        }}
        
        .badge-html {{ color: #e34c26; background: #fff0eb; }}
        .badge-py {{ color: #3776ab; background: #e0f2ff; }}
        .badge-js {{ color: #d4b830; background: #fffbe0; }}
        
        @media (prefers-color-scheme: dark) {{
            .badge-html {{ background: #2a1b18; }}
            .badge-py {{ background: #182633; }}
            .badge-js {{ background: #2a2718; }}
        }}

        .app-name {{
            font-size: 12px;
            font-weight: 500;
            color: var(--text-main);
            margin-bottom: 0;
            flex: 1;
            min-width: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.2;
        }}

        .app-path {{
            display: none;
        }}

        .card-footer {{
            margin-top: 0;
            margin-left: auto;
            flex-shrink: 0;
            font-size: 11px;
            color: var(--text-muted);
        }}

        .time-badge {{
            display: flex;
            align-items: center;
            gap: 3px;
        }}
        
        .arrow-icon {{
            display: none;
        }}

        /* Buttons */
        .fab {{
            position: fixed;
            bottom: 24px;
            right: 24px;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: var(--primary);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.4);
            border: none;
            cursor: pointer;
            z-index: 200;
            font-size: 24px;
            transition: transform 0.2s;
        }}
        
        .fab:hover {{ transform: scale(1.1); }}

        /* Utilities */
        .hidden {{ display: none !important; }}

        /* Embedded draft/style.css */
        /* Focus mode for iPhone/iOS: hide all non-table UI, maximize table area */
        body.focus-table-mode > *:not(#results-container) {{
            display: none !important;
        }}
        body.focus-table-mode #results-container {{
            position: fixed !important;
            top: 0; left: 0; right: 0; bottom: 0;
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            background: #fafdff !important;
            z-index: 9999;
            overflow: auto !important;
            border-radius: 0 !important;
            box-shadow: none !important;
        }}
        body.focus-table-mode #results {{
            border-radius: 0 !important;
            padding: 0.5em 0.2em !important;
            background: #fafdff !important;
        }}
        body.focus-table-mode #fullscreenTableBtn {{
            top: 10px !important;
            right: 16px !important;
            z-index: 10001 !important;
        }}
        .timing-summary-topright {{
            position: absolute;
            top: 1.2em;
            right: 2em;
            background: #f8f9fa;
            border-radius: 6px;
            font-size: 1.05em;
            padding: 0.5em 1.2em;
            box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            z-index: 10;
            text-align: right;
        }}
        .timing-summary-topright .timing-row {{
            margin-bottom: 2px;
        }}
        .pagination-filters {{
            margin-bottom: 0.3em;
            text-align: center;
        }}
        .filtered-count {{
            margin-left: 1.2em;
            color: #1976d2;
            font-weight: 600;
        }}
        .timing-summary {{
            background: #f8f9fa;
            border-radius: 6px;
            font-size: 1.05em;
            margin-bottom: 0.5em;
            padding: 0.5em 1em;
        }}
        .active-filter {{
            background: #e3f2fd;
            color: #1565c0;
            border-radius: 4px;
            padding: 2px 8px;
            margin-right: 0.5em;
            font-weight: 600;
            display: inline-block;
        }}
        .active-filter-btn {{
            outline: 2px solid #1976d2 !important;
            background: #e3f2fd !important;
            color: #1976d2 !important;
        }}
        .bgg-table {{
            table-layout: auto !important;
        }}
        .bgg-table th, .bgg-table td {{
            white-space: nowrap;
            padding: 4px 6px;
            text-align: left;
            max-width: 110px;
            overflow: hidden;
            text-overflow: ellipsis;
        }}
        body.simple-view .bgg-table {{
            width: auto !important;
            min-width: 0 !important;
            max-width: 100vw !important;
        }}
        @media (max-width: 700px) {{
            .bgg-table th, .bgg-table td {{
                font-size: 0.93em;
                padding: 3px 1px;
                max-width: 70px;
                white-space: normal;
                word-break: break-word;
            }}
            .bgg-table {{
                font-size: 0.93em;
            }}
        }}
        body.mobile-view {{
            font-size: 1.08em;
        }}
        body.mobile-view .bgg-table, body.mobile-view .ranking-container, body.mobile-view #results {{
            max-width: 100vw !important;
            padding: 0.5em !important;
            font-size: 1em;
        }}
        body.mobile-view .modern-btn {{
            font-size: 1em;
            padding: 10px 12px;
        }}
        body.mobile-view .game-image {{
            width: 90px;
            height: 90px;
        }}
        .modern-btn, button.modern-btn, input[type="button"].modern-btn {{
            background: linear-gradient(90deg, #007bff 0%, #0056b3 100%);
            color: #fff;
            border: none;
            border-radius: 6px;
            padding: 10px 20px;
            font-size: 1rem;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            cursor: pointer;
            transition: background 0.2s, box-shadow 0.2s, transform 0.1s;
            margin: 0.25em 0.5em;
        }}
        .modern-btn:hover, button.modern-btn:hover, input[type="button"].modern-btn:hover {{
            background: linear-gradient(90deg, #0056b3 0%, #007bff 100%);
            box-shadow: 0 4px 16px rgba(0,123,255,0.15);
            transform: translateY(-2px) scale(1.03);
        }}
        @media (max-width: 700px) {{
            html, body {{
                margin: 0 !important;
                padding: 0 !important;
                width: 100vw !important;
                max-width: 100vw !important;
                overflow-x: hidden !important;
                font-size: 1.05em;
                background: #fafdff;
            }}
            .ranking-container, #results, .bgg-table {{
                max-width: 100vw !important;
                width: 100vw !important;
                min-width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                font-size: 0.98em;
                box-sizing: border-box;
            }}
            .bgg-table thead th, .bgg-table td {{
                font-size: 0.93em;
                padding: 3px 1px;
                max-width: 70px;
                white-space: normal;
                word-break: break-word;
            }}
            .bgg-table {{
                font-size: 0.93em;
                border-spacing: 0;
                border-collapse: collapse;
            }}
            .game-card {{
                padding: 10px;
            }}
            .game-image {{
                width: 90px;
                height: 90px;
            }}
            .ranking-controls button, .modern-btn {{
                font-size: 0.98em;
                padding: 8px 10px;
            }}
            .comparison-area {{
                flex-direction: column;
                gap: 10px;
            }}
        }}
        @media only screen and (max-device-width: 820px) and (orientation: portrait) {{
            html, body {{
                width: 100vw !important;
                max-width: 100vw !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow-x: hidden !important;
            }}
            .bgg-table, .ranking-container, #results {{
                width: 100vw !important;
                max-width: 100vw !important;
                margin: 0 !important;
                padding: 0 !important;
                box-sizing: border-box;
            }}
        }}
        body {{ font-family: Arial, sans-serif; margin: 2em; }}
        #results {{ margin-top: 2em; }}
        .game {{ border-bottom: 1px solid #ccc; padding: 1em 0; }}
        #searchInput {{
            border: 2px solid #ddd;
            border-radius: 4px;
            transition: border-color 0.3s ease;
        }}
        #searchInput:focus {{
            border-color: #007bff;
            outline: none;
        }}
        #clearSearchBtn {{
            padding: 8px 12px;
            background-color: #6c757d;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }}
        #clearSearchBtn:hover {{
            background-color: #5a6268;
        }}
        .ranking-container {{
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }}
        .ranking-header {{
            text-align: center;
            margin-bottom: 30px;
        }}
        .ranking-progress {{
            background-color: #f0f0f0;
            border-radius: 10px;
            padding: 10px;
            margin-bottom: 20px;
        }}
        .progress-bar {{
            background-color: #007bff;
            height: 20px;
            border-radius: 10px;
            transition: width 0.3s ease;
        }}
        .comparison-area {{
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 30px;
        }}
        .game-card {{
            flex: 1;
            border: 2px solid #ddd;
            border-radius: 10px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.3s ease;
            background-color: #fff;
        }}
        .game-card:hover {{
            border-color: #007bff;
            transform: translateY(-5px);
            box-shadow: 0 5px 15px rgba(0,123,255,0.3);
        }}
        .game-image {{
            width: 150px;
            height: 150px;
            object-fit: cover;
            border-radius: 8px;
            margin-bottom: 15px;
        }}
        .game-name {{
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #333;
        }}
        .game-stats {{
            font-size: 14px;
            color: #666;
            line-height: 1.4;
        }}
        .ranking-controls {{
            text-align: center;
            margin-top: 30px;
        }}
        .ranking-controls button {{
            margin: 0 10px;
            padding: 10px 20px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }}
        .back-btn {{
            background-color: #6c757d;
            color: white;
        }}
        .back-btn:hover {{
            background-color: #5a6268;
        }}
        .exit-btn {{
            background-color: #dc3545;
            color: white;
        }}
        .exit-btn:hover {{
            background-color: #c82333;
        }}
        .skip-btn {{
            background-color: #ffc107;
            color: #212529;
        }}
        .skip-btn:hover {{
            background-color: #e0a800;
        }}
        .final-rankings {{
            margin-top: 30px;
        }}
        .ranking-list {{
            list-style: none;
            padding: 0;
        }}
        .ranking-item {{
            display: flex;
            align-items: center;
            padding: 10px;
            margin-bottom: 10px;
            background-color: #f8f9fa;
            border-radius: 5px;
            border-left: 4px solid #007bff;
        }}
        .ranking-position {{
            font-weight: bold;
            font-size: 18px;
            margin-right: 15px;
            color: #007bff;
            min-width: 30px;
        }}
        .ranking-game-info {{
            flex: 1;
        }}
        .ranking-game-name {{
            font-weight: bold;
            margin-bottom: 5px;
        }}
        .ranking-game-stats {{
            font-size: 12px;
            color: #666;
        }}
        .collage-zoom {{
            display: grid;
            gap: 6px;
        }}
        .collage-zoom img {{
            width: 160px !important;
            height: 160px !important;
            object-fit: cover;
            border-radius: 8px;
            box-shadow: 0 1px 4px #0001;
        }}
        .collage-widescreen {{
            display: grid;
            gap: 18px;
        }}
        .collage-widescreen img {{
            width: 90px !important;
            height: 90px !important;
            object-fit: cover;
            border-radius: 8px;
            box-shadow: 0 1px 4px #0001;
        }}
        .collage-vertical {{
            display: grid;
            gap: 10px;
        }}
        .collage-vertical img {{
            width: 90px !important;
            height: 160px !important;
            object-fit: cover;
            border-radius: 8px;
            box-shadow: 0 1px 4px #0001;
        }}
        .collage-fit {{
            display: grid;
            gap: 10px;
        }}
        .collage-fit img {{
            width: 120px !important;
            height: 120px !important;
            object-fit: contain !important;
            background: #fff;
            border-radius: 16px;
            box-shadow: 0 1px 4px #0001;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>App Index</h1>
                <div class="meta-info">Updated: {generation_time_str}</div>
            </div>
            <div id="fileCount" class="meta-info" style="background: var(--bg-card); padding: 4px 8px; border-radius: 8px; border: 1px solid var(--border);">
                Loading...
            </div>
        </header>

        <div class="controls-area">
            <div class="search-wrapper">
                <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" id="searchInput" class="search-input" placeholder="Search apps...">
            </div>
            
            <div class="filters">
                <button class="filter-btn active" data-filter="all">All</button>
                <button class="filter-btn" data-filter=".html">Apps</button>
                <button class="filter-btn" data-filter=".py">Scripts</button>
                <button class="filter-btn" data-filter=".json">Data</button>
                <button class="filter-btn" data-filter="recent">Recent</button>
            </div>
        </div>

        <div id="appList" class="app-list">
"""
    
    # 1. Find all files (excluding certain directories and the output file)
    all_files = []
    for root, dirs, files in os.walk('.'):
        # Remove excluded directories from the search
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file in files:
            file_path = os.path.join(root, file)
            # Skip the output file itself
            if file == output_file:
                continue
            all_files.append(file_path)
    
    # 2. Get stats
    file_stats = []
    now_utc = datetime.now(timezone.utc)
    
    for file_path_str in all_files:
        path_obj = Path(file_path_str)
            
        mtime_epoch = get_git_commit_time(file_path_str)
        mod_time_dt_utc = datetime.fromtimestamp(mtime_epoch, timezone.utc)
        file_ext = path_obj.suffix.lower()
        if not file_ext: file_ext = '.txt'

        file_stats.append({
            'path': path_obj.as_posix(),
            'name': path_obj.name,
            'folder': path_obj.parent.name if path_obj.parent.name != '.' else '',
            'mtime': mtime_epoch,
            'time_since': format_time_since(now_utc - mod_time_dt_utc),
            'extension': file_ext
        })

    # 3. Sort by modification time (descending) by default
    sorted_files = sorted(file_stats, key=lambda x: x['mtime'], reverse=True)
    
    # Helper for badges
    def get_badge_class(ext):
        if ext == '.html': return 'badge-html'
        if ext == '.py': return 'badge-py'
        if ext == '.js': return 'badge-js'
        return ''

    # 4. Generate HTML cards
    for file_data in sorted_files:
        file_path = file_data['path']
        display_name = file_data['name']
        folder_display = file_data['folder'] + '/' if file_data['folder'] else ''
        file_ext = file_data['extension']
        badge_class = get_badge_class(file_ext)
        clean_ext = file_ext.replace('.', '').upper()
        
        # Determine if "recent" (last 7 days)
        is_recent = (datetime.now().timestamp() - file_data['mtime']) < (7 * 24 * 3600)
        recent_attr = "true" if is_recent else "false"

        html_content += f"""
            <a href="{file_path}" class="app-card" data-name="{display_name.lower()}" data-ext="{file_ext}" data-recent="{recent_attr}">
                <div class="card-header">
                    <span class="file-type {badge_class}">{clean_ext}</span>
                    <svg class="arrow-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                </div>
                <div class="app-name">{display_name}</div>
                <span class="app-path">{folder_display}{display_name}</span>
                <div class="card-footer">
                    <div class="time-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        {file_data['time_since']}
                    </div>
                </div>
            </a>"""

    html_content += """
        </div>
        
        <button id="randomBtn" class="fab" title="Open Random App">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
        </button>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const searchInput = document.getElementById('searchInput');
            const filterButtons = document.querySelectorAll('.filter-btn');
            const appList = document.getElementById('appList');
            const cards = document.querySelectorAll('.app-card');
            const fileCountEl = document.getElementById('fileCount');
            const randomBtn = document.getElementById('randomBtn');

            let currentFilter = 'all';

            function filterApps() {
                const query = searchInput.value.toLowerCase();
                let visibleCount = 0;

                cards.forEach(card => {
                    const name = card.dataset.name;
                    const ext = card.dataset.ext;
                    const isRecent = card.dataset.recent === 'true';
                    
                    const matchesSearch = name.includes(query);
                    let matchesFilter = true;

                    if (currentFilter === 'recent') {
                        matchesFilter = isRecent;
                    } else if (currentFilter !== 'all') {
                        matchesFilter = ext === currentFilter;
                    }

                    if (matchesSearch && matchesFilter) {
                        card.classList.remove('hidden');
                        visibleCount++;
                    } else {
                        card.classList.add('hidden');
                    }
                });
                
                fileCountEl.textContent = `${visibleCount} Apps`;
            }

            filterButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    filterButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentFilter = btn.dataset.filter;
                    filterApps();
                });
            });

            searchInput.addEventListener('input', filterApps);
            
            // Random Button
            randomBtn.addEventListener('click', () => {
                const visible = Array.from(cards).filter(c => !c.classList.contains('hidden'));
                if (visible.length > 0) {
                    const randomCard = visible[Math.floor(Math.random() * visible.length)];
                    window.location.href = randomCard.href;
                }
            });

            // Initial count
            filterApps();
        });
    </script>
</body>
</html>
"""

    html_content = html_content.replace('GENERATION_TIME_ISO_PLACEHOLDER', generation_time_iso)

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"Successfully generated {output_file} with modern UI.")

if __name__ == "__main__":
    generate_html_index()
    update_home_html()
