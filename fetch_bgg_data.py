import requests
import os
import sys
import time

# --- Configuration ---
BGG_API_URL = "https://boardgamegeek.com/xmlapi/geeklist/363504?comments=1" 
OUTPUT_FILENAME = "mydata.xml"
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 5 # Wait time between retries

def fetch_and_save_data():
    """
    Fetches data from the BGG API with retries and saves the XML 
    response only upon full success.
    """
    secret_token = os.environ.get("API_TOKEN") 

    if not secret_token:
        print("Error: API_TOKEN environment variable not set. Aborting.")
        sys.exit(1)

    headers = {
        "User-Agent": "Scheduled BGG Data Fetcher (GitHub Actions)",
        "Authorization": f"Bearer {secret_token}" 
    }
    
    successful_response = None
    
    for attempt in range(MAX_RETRIES):
        print(f"Attempting to fetch data (Attempt {attempt + 1} of {MAX_RETRIES}) from: {BGG_API_URL}")
        
        try:
            # Note: We are not explicitly changing the default requests library timeout,
            # but we are handling any connection/request exceptions as a failure.
            response = requests.get(BGG_API_URL, headers=headers)
            
            # Check for success (200-299 status codes)
            if response.status_code == 200:
                successful_response = response
                print("API call successful!")
                break # Exit the retry loop on success
            
            # Handle client/server errors (e.g., 401, 404, 500)
            else:
                print(f"Non-success status code received: {response.status_code}")
                # We won't retry on critical errors like 401 (Unauthorized) or 404 (Not Found)
                if response.status_code in [401, 403, 404]:
                    print("Critical HTTP error (401/403/404). Aborting retries.")
                    raise requests.exceptions.HTTPError(response.status_code)

        except requests.exceptions.RequestException as e:
            print(f"Request failed: {e}")
        
        # If we failed and are not on the last attempt, wait and retry
        if attempt < MAX_RETRIES - 1:
            print(f"Waiting {RETRY_DELAY_SECONDS} seconds before next retry...")
            time.sleep(RETRY_DELAY_SECONDS)
        
        # If all retries fail, the loop finishes here.
    
    # --- Data Integrity Check and Write ---
    if successful_response and successful_response.content:
        # Only write the file if we have a successful response object AND content
        try:
            with open(OUTPUT_FILENAME, "wb") as f:
                f.write(successful_response.content)
            print(f"SUCCESS: Data successfully saved to {OUTPUT_FILENAME}")
        except IOError as e:
            print(f"Error writing file {OUTPUT_FILENAME}: {e}")
            sys.exit(1)
    else:
        # If no successful_response was obtained after all retries
        print("FAILURE: Could not retrieve data after all retries. File not written.")
        sys.exit(1)

if __name__ == "__main__":
    fetch_and_save_data()
