import csv
import re

# Read the file
with open('licenses.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

publishers = []
i = 1  # Skip header line

while i < len(lines):
    line = lines[i].rstrip()
    
    # Skip empty lines
    if not line.strip():
        i += 1
        continue
    
    # Look for "Publisher logo" pattern - indicates we're at a publisher record
    if 'Publisher logo' in line:
        # Publisher name is on the previous line
        if i > 0:
            publisher_name = lines[i - 1].rstrip().strip()
        else:
            publisher_name = ''
        
        # Parse the Publisher logo line for the BGA status and game data
        # Format: "Publisher logo" (tab) YES/NO (tab) Available (tab) NON available (tab) Published!
        parts = line.split('\t')
        
        working_with_bga = parts[1].strip() if len(parts) > 1 else ''
        available = parts[2].strip() if len(parts) > 2 else ''
        non_available = parts[3].strip() if len(parts) > 3 else ''
        published = parts[4].strip() if len(parts) > 4 else ''
        
        # Parse games from each category (split by " , ")
        available_games = [g.strip() for g in available.split(' , ') if g.strip()]
        non_available_games = [g.strip() for g in non_available.split(' , ') if g.strip()]
        published_games = [g.strip() for g in published.split(' , ') if g.strip()]
        
        publishers.append({
            'Publisher': publisher_name,
            'Is working with BGA?': working_with_bga,
            'Available': ', '.join(available_games),
            'NON available': ', '.join(non_available_games),
            'Published!': ', '.join(published_games)
        })
        
        i += 1
    else:
        i += 1

# Write to CSV
with open('licenses.csv', 'w', newline='', encoding='utf-8') as f:
    fieldnames = ['Publisher', 'Is working with BGA?', 'Available', 'NON available', 'Published!']
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(publishers)

print(f"Converted {len(publishers)} publishers to licenses.csv")
