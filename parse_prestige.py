import re
import csv

def parse_prestige_data(input_file, output_file):
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove header and footer junk
    if "achievements" in content:
        content = content.split("achievements", 1)[1]

    lines = [line.strip() for line in content.split('\n') if line.strip()]

    games = []
    i = 0
    while i < len(lines):
        # Game Name is at lines[i]
        game_name = lines[i]
        
        # Prestige is at lines[i+1]
        if i + 1 < len(lines):
            prestige = lines[i+1]
        else:
            i += 1
            continue

        # Stats are at lines[i+2]
        if i + 2 < len(lines):
            stats_line = lines[i+2]
            
            # Check if the line contains "Victories" and "wins", which is characteristic of a stats line
            if "Victories" not in stats_line or "wins" not in stats_line:
                # This is not a stats line, so we probably have a game name with a subtitle.
                # Let's combine the current line with the next one as the game name.
                game_name = f"{game_name} {prestige}"
                
                # The new prestige is at lines[i+2]
                if i + 2 < len(lines):
                    prestige = lines[i+2]
                else:
                    i+=1
                    continue

                # The new stats line is at lines[i+3]
                if i + 3 < len(lines):
                    stats_line = lines[i+3]
                    i += 1 # Extra increment because we consumed an extra line for the name
                else:
                    i+=1
                    continue
        else:
            i += 1
            continue

        games_played_match = re.search(r'(\d+)', stats_line)
        games_played = games_played_match.group(1) if games_played_match else '0'

        victories_match = re.search(r'(\d+)\s+Victories', stats_line)
        victories = victories_match.group(1) if victories_match else '0'

        wins_percent_match = re.search(r'(\d+%)\s+wins', stats_line)
        wins_percent = wins_percent_match.group(1) if wins_percent_match else '0%'
        
        games.append([game_name, prestige, games_played, victories, wins_percent])
        
        # Move to the next potential game block
        # A game block is name, prestige, stats, and "My statistics..."
        # which is 4 lines.
        i += 4


    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Game Name', 'Prestige', 'Games Played', 'Victories', 'Percent Wins'])
        writer.writerows(games)

if __name__ == '__main__':
    parse_prestige_data('prestige.csv', 'prestige_parsed.csv')
