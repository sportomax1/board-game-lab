import requests
import os
import sys
import time

# --- Configuration ---
BGG_API_URL = "https://boardgamegeek.com/xmlapi/geeklist/363504?comments=1" 
OUTPUT_FILENAME = "mydata.xml"
MAX_ATTEMPTS = 4
# Delays to wait *before* the next attempt (indexed by attempt number 1, 2, 3)
RETRY_DELAYS = [5, 15, 30] 

def fetch_and_save_data():
    """
    Fetches data from the BGG API with increasing backoff retries and saves 
    the XML response only upon full success.
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
    
    for attempt in range(MAX_ATTEMPTS):
        attempt_num = attempt + 1
        print(f"Attempting to fetch data (Attempt {attempt_num} of {MAX_ATTEMPTS}) from: {BGG_API_URL}")
        
        # 1. Delay before making the API call (except for the very first attempt)
        if attempt > 0:
            # We use attempt - 1 to map to the 0-indexed RETRY_DELAYS list
            delay = RETRY_DELAYS[attempt - 1] 
            print(f"Waiting {delay} seconds before Attempt {attempt_num}...")
            time.sleep(delay)
        
        try:
            response = requests.get(BGG_API_URL, headers=headers)
            
            # Check for success (200 status code)
            if response.status_code == 200:
                successful_response = response
                print("API call successful!")
                break # Exit the retry loop on success
            
            # Handle client/server errors (e.g., 401, 404, 500)
            else:
                print(f"Non-success status code received: {response.status_code}")
                # Abort retries on critical errors like 401 (Unauthorized) or 404 (Not Found)
                if response.status_code in [401, 403, 404]:
                    print("Critical HTTP error (401/403/404). Aborting retries.")
                    # Raise the specific error to stop the execution flow
                    response.raise_for_status() 

        except requests.exceptions.RequestException as e:
            # This catches connection errors, DNS errors, etc.
            print(f"Request failed: {e}")
            # If this is the last attempt, raise the error to fail the script
            if attempt_num == MAX_ATTEMPTS:
                 print(f"Failing after {MAX_ATTEMPTS} attempts.")
                 sys.exit(1)
        
        # If the code reaches here, it means we got a recoverable failure (e.g., 5xx or connection error) 
        # and are not on the last attempt, so the loop continues.
    
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
        # If no successful_response was obtained after all retries (and no exception was raised)
        print("FAILURE: Could not retrieve data after all attempts. File not written.")
        sys.exit(1) # Ensure the script fails if all attempts finished without success

if __name__ == "__main__":
    fetch_and_save_data()
