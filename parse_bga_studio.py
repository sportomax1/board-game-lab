import csv
import re

# Read the file
with open('bga-studio.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

games = []
i = 1  # Skip header line

while i < len(lines):
    line = lines[i].rstrip()
    
    # Look for game name (should have tab followed by "Game logo")
    if 'Game logo' in line:
        parts = line.split('\t')
        game_name = parts[0].strip() if len(parts) > 0 else ''
        
        # Next line should be license status
        i += 1
        license_status = ''
        if i < len(lines):
            license_status = lines[i].strip()
            i += 1
        
        # Skip empty line
        if i < len(lines) and not lines[i].strip():
            i += 1
        
        # Next line should have publisher, designer, rating, complexity
        publisher = ''
        designer = ''
        rating = ''
        complexity = ''
        
        if i < len(lines):
            data_line = lines[i].rstrip()
            if data_line and 'Game logo' not in data_line:
                parts = data_line.split('\t')
                publisher = parts[0].strip() if len(parts) > 0 else ''
                designer = parts[1].strip() if len(parts) > 1 else ''
                rating = parts[2].strip() if len(parts) > 2 else ''
                complexity = parts[3].strip() if len(parts) > 3 else ''
                i += 1
        
        # Collect studio projects (lines until next game or end)
        studio_projects = []
        while i < len(lines):
            proj_line = lines[i].rstrip()
            
            # Check if next line is a game (has "Game logo")
            if 'Game logo' in proj_line:
                break
            
            # Skip empty lines
            if not proj_line.strip():
                i += 1
                continue
            
            # Add project, removing file change date
            proj_clean = re.sub(r'\s*\(latest file change:.*?\)', '', proj_line).strip()
            if proj_clean:
                studio_projects.append(proj_clean)
            
            i += 1
        
        studio_projects_str = ', '.join(studio_projects)
        
        games.append({
            'Game name': game_name,
            'License status': license_status,
            'Publisher': publisher,
            'Designer': designer,
            'BGG rating': rating,
            'Complexity': complexity,
            'Studio projects': studio_projects_str
        })
    else:
        i += 1

# Write to CSV
with open('bga-studio.csv', 'w', newline='', encoding='utf-8') as f:
    fieldnames = ['Game name', 'License status', 'Publisher', 'Designer', 'BGG rating', 'Complexity', 'Studio projects']
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(games)

print(f"Converted {len(games)} games to bga-studio.csv")
