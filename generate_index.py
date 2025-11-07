import os
import glob
from pathlib import Path
# Added timedelta for the Mountain Time offset calculation
from datetime import datetime, timezone, timedelta
# NEW: Required for running Git commands
import subprocess

def format_time_since(delta):
    """Converts a timedelta object to a user-friendly 'time since' string."""
    seconds = int(delta.total_seconds())
    
    if seconds < 60:
        return "Just now"
    elif seconds < 3600:
        minutes = seconds // 60
        return f"{minutes} minute{'s' if minutes > 1 else ''} ago"
    elif seconds < 86400:
        hours = seconds // 3600
        return f"{hours} hour{'s' if hours > 1 else ''} ago"
    else:
        days = seconds // 86400
        return f"{days} day{'s' if days > 1 else ''} ago"

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
            # CRITICAL: If the file is newly created but not committed yet, 
            # this will raise CalledProcessError. We handle it in the except block.
            check=True
        )
        return float(result.stdout.strip())
    except (subprocess.CalledProcessError, FileNotFoundError):
        # Fallback for new (uncommitted) files or if git fails
        print(f"Warning: No git history found for {file_path}. Using filesystem time.")
        return os.path.getmtime(file_path)
    except Exception as e:
        # Generic error fallback
        print(f"Error getting git time for {file_path}: {e}")
        return os.path.getmtime(file_path)

def generate_html_index(output_file='index.html'):
    """
    Scans for all files (excluding certain directories), sorts them by their Git commit date,
    and generates an index file with file type filtering, client-side sorting and search controls.
    """
    
    # Directories to exclude from scanning
    EXCLUDE_DIRS = {'.git', '.github', 'node_modules', '__pycache__', '.vercel', 'api'}
    
    # --- Start of HTML content ---
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Application Index (Sorted by Update)</title>
    <style>
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 20px; 
            background-color: #fdfdfd;
            color: #333;
        }}
        .container {{ max-width: 800px; margin: auto; }}
        h1 {{ 
            border-bottom: 2px solid #eee; 
            padding-bottom: 10px; 
        }}
        
        /* --- Search Bar Styles --- */
        .search-input {{
            width: 100%;
            padding: 10px;
            margin-bottom: 20px;
            border: 1px solid #ccc;
            border-radius: 6px;
            box-sizing: border-box;
            font-size: 16px;
        }}
        /* --- End Search Bar Styles --- */
        
        /* --- File Type Filter Styles --- */
        .filter-controls {{
            margin-bottom: 20px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }}
        .filter-btn {{
            padding: 8px 16px;
            font-size: 13px;
            border: 2px solid #ddd;
            background-color: #fff;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.2s;
            font-weight: 500;
        }}
        .filter-btn:hover {{
            background-color: #f0f0f0;
        }}
        .filter-btn.active {{
            background-color: #0366d6;
            color: white;
            border-color: #0366d6;
        }}
        .file-type-badge {{
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            margin-left: 8px;
        }}
        .badge-html {{ background-color: #e34c26; color: white; }}
        .badge-xml {{ background-color: #ff6600; color: white; }}
        .badge-py {{ background-color: #3776ab; color: white; }}
        .badge-js {{ background-color: #f7df1e; color: black; }}
        .badge-json {{ background-color: #000; color: white; }}
        .badge-yml {{ background-color: #cb171e; color: white; }}
        .badge-md {{ background-color: #083fa1; color: white; }}
        .badge-txt {{ background-color: #888; color: white; }}
        .badge-other {{ background-color: #6c757d; color: white; }}
        /* --- End File Type Filter Styles --- */

        /* --- Sorting Button Styles --- */
        .sort-controls {{
            margin-bottom: 20px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }}
        .sort-btn {{
            flex-grow: 1;
            padding: 8px 12px;
            font-size: 14px;
            border: 1px solid #ccc;
            background-color: #f7f7f7;
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s, box-shadow 0.2s;
        }}
        .sort-btn:hover {{
            background-color: #eee;
        }}
        .sort-btn.active {{
            background-color: #0366d6;
            color: white;
            border-color: #0366d6;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        /* --- End Sorting Button Styles --- */

        /* --- Card Styles (Mobile Friendly) --- */
        .app-entry {{
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-bottom: 15px;
            background-color: #fff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            transition: box-shadow 0.2s ease;
        }}
        .app-entry:hover {{
            box-shadow: 0 3px 6px rgba(0,0,0,0.08);
        }}

        /* New style for the App Name Header (link) */
        .app-name-header {{
            display: block;
            width: 100%;
            padding: 12px 15px;
            text-align: left;
            background-color: #f0f6fc; /* Light blue background for header look */
            border: none;
            border-bottom: 1px solid #cce;
            cursor: pointer;
            text-decoration: none;
            color: #1a1a1a; /* Darker text for bold header */
            font-size: 18px; /* Slightly larger */
            font-weight: 700; /* Bold */
            border-top-left-radius: 8px;
            border-top-right-radius: 8px;
            transition: background-color 0.2s;
        }}
        .app-name-header:hover {{
            background-color: #e3effc;
        }}

        .file-info {{
            padding: 10px 15px;
            font-size: 14px;
            color: #555;
            line-height: 1.4;
        }}
        .file-info p {{
            margin: 5px 0; /* Add margin between file name and update time */
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Available Applications</h1>
        <p>Click a file name to open it. Filter by file type below.</p>
        
        <!-- File Type Filters -->
        <div class="filter-controls">
            <button class="filter-btn active" data-filter="all">All Files</button>
            <button class="filter-btn" data-filter=".html">HTML</button>
            <button class="filter-btn" data-filter=".xml">XML</button>
            <button class="filter-btn" data-filter=".py">Python</button>
            <button class="filter-btn" data-filter=".js">JavaScript</button>
            <button class="filter-btn" data-filter=".json">JSON</button>
            <button class="filter-btn" data-filter=".yml">YML</button>
            <button class="filter-btn" data-filter=".md">Markdown</button>
            <button class="filter-btn" data-filter=".txt">Text</button>
        </div>
        
        <!-- Search Bar -->
        <input type="text" id="searchInput" placeholder="Search files by name or path..." class="search-input">
        
        <!-- Sorting Controls -->
        <div class="sort-controls">
            <button id="sortByUpdate" class="sort-btn active">Sort by Last Update (Newest)</button>
            <button id="sortByName" class="sort-btn">Sort by Name (A-Z)</button>
        </div>

        <!-- Container for App Entries -->
        <div id="app-list">
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
    
    # Define Mountain Time offset (e.g., MST/MDT -7 hours) for display
    MTN_OFFSET = timedelta(hours=-7)
    
    for file_path_str in all_files:
        path_obj = Path(file_path_str)
            
        # *** USING GIT COMMIT TIME ***
        mtime_epoch = get_git_commit_time(file_path_str)
        # -----------------------------

        mod_time_dt_utc = datetime.fromtimestamp(mtime_epoch, timezone.utc)
        app_name_label = path_obj.stem.replace('-', ' ').replace('_', ' ').title()
        
        # Get file extension
        file_ext = path_obj.suffix.lower()
        if not file_ext:
            file_ext = '.txt'  # Default for files without extension

        # Calculate time for MTN display
        mod_time_mtn = mod_time_dt_utc + MTN_OFFSET
        mod_time_mtn_str = mod_time_mtn.strftime('%Y-%m-%d %H:%M:%S MST/MDT')

        file_stats.append({
            'path': path_obj.as_posix(),
            'mtime': mtime_epoch,
            'mod_time_str_mtn': mod_time_mtn_str,
            'time_since': format_time_since(now_utc - mod_time_dt_utc),
            'app_name_lower': app_name_label.lower(),
            'extension': file_ext
        })

    # 3. Sort the list by modification time (mtime), descending
    sorted_files = sorted(file_stats, key=lambda x: x['mtime'], reverse=True)
    
    # Helper function to get badge class
    def get_badge_class(ext):
        badge_map = {
            '.html': 'html',
            '.xml': 'xml',
            '.py': 'py',
            '.js': 'js',
            '.json': 'json',
            '.yml': 'yml',
            '.yaml': 'yml',
            '.md': 'md',
            '.txt': 'txt'
        }
        return badge_map.get(ext, 'other')

    # 4. Generate HTML for each file
    if not sorted_files:
        html_content += '<p>No files found.</p>'
    else:
        for file_data in sorted_files:
            file_path = file_data['path']
            app_name_label = file_data['app_name_lower'].title()
            file_ext = file_data['extension']
            badge_class = get_badge_class(file_ext)
            
            # Add data- attributes for JavaScript sorting and filtering
            html_content += f"""
            <div class="app-entry" data-mtime="{file_data['mtime']}" data-name="{file_data['app_name_lower']}" data-extension="{file_ext}">
                <a href="{file_path}" class="app-name-header" role="button">
                    {app_name_label}
                    <span class="file-type-badge badge-{badge_class}">{file_ext[1:]}</span>
                </a>
                <div class="file-info">
                    <p><strong>File Name:</strong> {file_path}</p>
                    <p><strong>Last Update:</strong> {file_data['mod_time_str_mtn']} ({file_data['time_since']})</p>
                </div>
            </div>
"""

    # End of the app list
    html_content += "        </div> <!-- /#app-list -->\n"
    
    # --- JavaScript for Sorting, Filtering, and File Type Filter ---
    html_content += """
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const btnSortUpdate = document.getElementById('sortByUpdate');
            const btnSortName = document.getElementById('sortByName');
            const appListContainer = document.getElementById('app-list');
            const searchInput = document.getElementById('searchInput');
            const filterButtons = document.querySelectorAll('.filter-btn');
            
            let currentFilter = 'all';

            function sortItems(criteria) {
                const items = Array.from(appListContainer.querySelectorAll('.app-entry'));
                
                let sortedItems;

                if (criteria === 'name') {
                    sortedItems = items.sort((a, b) => {
                        return a.dataset.name.localeCompare(b.dataset.name);
                    });
                    btnSortName.classList.add('active');
                    btnSortUpdate.classList.remove('active');
                } else {
                    sortedItems = items.sort((a, b) => {
                        return b.dataset.mtime - a.dataset.mtime;
                    });
                    btnSortUpdate.classList.add('active');
                    btnSortName.classList.remove('active');
                }

                sortedItems.forEach(item => {
                    appListContainer.appendChild(item);
                });
            }
            
            function applyFilters() {
                const searchTerm = searchInput.value.toLowerCase();
                const items = Array.from(appListContainer.querySelectorAll('.app-entry'));
                
                items.forEach(item => {
                    const appName = item.dataset.name;
                    const fileInfo = item.querySelector('.file-info').textContent;
                    const extension = item.dataset.extension;
                    
                    // Check if item matches search term
                    const matchesSearch = !searchTerm || appName.includes(searchTerm) || fileInfo.toLowerCase().includes(searchTerm);
                    
                    // Check if item matches file type filter
                    const matchesFilter = currentFilter === 'all' || extension === currentFilter;
                    
                    // Show item only if it matches both filters
                    if (matchesSearch && matchesFilter) {
                        item.style.display = 'block';
                    } else {
                        item.style.display = 'none';
                    }
                });
            }
            
            function setFileTypeFilter(filter) {
                currentFilter = filter;
                
                // Update active state of filter buttons
                filterButtons.forEach(btn => {
                    if (btn.dataset.filter === filter) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
                
                applyFilters();
            }

            // Add event listeners
            btnSortUpdate.addEventListener('click', () => sortItems('update'));
            btnSortName.addEventListener('click', () => sortItems('name'));
            searchInput.addEventListener('keyup', applyFilters);
            
            filterButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    setFileTypeFilter(btn.dataset.filter);
                });
            });

            // Initial setup
            sortItems('update'); 
        });
    </script>
"""
    # --- End of JavaScript ---

    # End of the HTML content
    html_content += """
    </div> <!-- /.container -->
</body>
</html>
"""

    # Write the content to the specified output file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)

    print(f"Successfully generated {output_file} with {len(sorted_files)} links, sorting, and search controls.")

if __name__ == "__main__":
    generate_html_index()
