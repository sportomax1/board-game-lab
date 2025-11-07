import requests
import os
import sys
import time
import xml.etree.ElementTree as ET
import re

# --- Configuration ---
MAX_ATTEMPTS = 4
RETRY_DELAYS = [5, 15, 30]
METALIST_ID = 66420  # The master geeklist containing other geeklists
OUTPUT_DIR = "cascade_vfm"

def fetch_xml(url, headers, attempt=1):
    """Fetch XML from BGG API with retry logic"""
    print(f"Fetching (Attempt {attempt}/{MAX_ATTEMPTS}): {url}")
    
    try:
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            return response.text
        elif response.status_code == 202:
            if attempt < MAX_ATTEMPTS:
                delay = RETRY_DELAYS[attempt - 1] if attempt <= len(RETRY_DELAYS) else RETRY_DELAYS[-1]
                print(f"BGG returned 202 (queued). Waiting {delay}s before retry...")
                time.sleep(delay)
                return fetch_xml(url, headers, attempt + 1)
            else:
                print(f"Failed after {MAX_ATTEMPTS} attempts (202 queued)")
                return None
        else:
            print(f"Error: HTTP {response.status_code}")
            return None
            
    except Exception as e:
        print(f"Exception during fetch: {e}")
        return None

def extract_geeklist_ids(xml_text):
    """Extract geeklist IDs from the metalist XML"""
    try:
        root = ET.fromstring(xml_text)
        geeklist_ids = []
        
        # Look through all items in the metalist
        for item in root.findall('.//item'):
            body = item.find('body')
            if body is not None and body.text:
                # Search for geeklist URLs or IDs in the body text
                # Pattern: boardgamegeek.com/geeklist/NUMBER or geeklist=NUMBER
                matches = re.findall(r'(?:geeklist[=/])(\d+)', body.text, re.IGNORECASE)
                geeklist_ids.extend(matches)
        
        # Remove duplicates and return
        return list(set(geeklist_ids))
        
    except Exception as e:
        print(f"Error parsing metalist XML: {e}")
        return []

def main():
    """Main function to fetch metalist and cascade to individual geeklists"""
    
    secret_token = os.environ.get("API_TOKEN")
    if not secret_token:
        print("Error: API_TOKEN environment variable not set. Aborting.")
        sys.exit(1)

    headers = {
        "User-Agent": "Scheduled BGG Data Fetcher (GitHub Actions)",
        "Authorization": f"Bearer {secret_token}"
    }
    
    # Create output directory if it doesn't exist
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # Step 1: Fetch the metalist
    print(f"\n=== STEP 1: Fetching metalist {METALIST_ID} ===")
    metalist_url = f"https://boardgamegeek.com/xmlapi/geeklist/{METALIST_ID}"
    metalist_xml = fetch_xml(metalist_url, headers)
    
    if not metalist_xml:
        print("Failed to fetch metalist. Aborting.")
        sys.exit(1)
    
    # Save the metalist itself
    metalist_file = os.path.join(OUTPUT_DIR, "vfm_metalist.xml")
    with open(metalist_file, 'w', encoding='utf-8') as f:
        f.write(metalist_xml)
    print(f"Saved metalist to: {metalist_file}")
    
    # Step 2: Extract geeklist IDs from the metalist
    print(f"\n=== STEP 2: Extracting geeklist IDs from metalist ===")
    geeklist_ids = extract_geeklist_ids(metalist_xml)
    
    if not geeklist_ids:
        print("No geeklist IDs found in metalist. Done.")
        sys.exit(0)
    
    print(f"Found {len(geeklist_ids)} unique geeklist(s): {', '.join(geeklist_ids)}")
    
    # Step 3: Fetch each individual geeklist
    print(f"\n=== STEP 3: Fetching individual geeklists ===")
    success_count = 0
    
    for geeklist_id in geeklist_ids:
        print(f"\nFetching geeklist {geeklist_id}...")
        geeklist_url = f"https://boardgamegeek.com/xmlapi/geeklist/{geeklist_id}?comments=1"
        geeklist_xml = fetch_xml(geeklist_url, headers)
        
        if geeklist_xml:
            output_file = os.path.join(OUTPUT_DIR, f"vfm_cascade_{geeklist_id}.xml")
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(geeklist_xml)
            print(f"✓ Saved geeklist {geeklist_id} to: {output_file}")
            success_count += 1
            
            # Be nice to BGG API - small delay between requests
            if len(geeklist_ids) > 1:
                time.sleep(2)
        else:
            print(f"✗ Failed to fetch geeklist {geeklist_id}")
    
    print(f"\n=== COMPLETE: Successfully fetched {success_count}/{len(geeklist_ids)} geeklists ===")
    
    # Create a summary file
    summary_file = os.path.join(OUTPUT_DIR, "cascade_summary.txt")
    with open(summary_file, 'w') as f:
        f.write(f"Cascade VFM Fetch Summary\n")
        f.write(f"=========================\n")
        f.write(f"Metalist ID: {METALIST_ID}\n")
        f.write(f"Geeklists Found: {len(geeklist_ids)}\n")
        f.write(f"Successfully Fetched: {success_count}\n")
        f.write(f"\nGeeklist IDs:\n")
        for gid in sorted(geeklist_ids):
            f.write(f"  - {gid}\n")
    
    print(f"Summary saved to: {summary_file}")

if __name__ == "__main__":
    main()
