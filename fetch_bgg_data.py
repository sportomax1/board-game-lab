import requests
import os
import sys

# The URL for the new, authenticated BGG API v2 call
# Note: I have changed the API endpoint to the v2 standard for geeklist.
BGG_API_URL = "https://api.geekdo.com/xmlapi2/geeklist?id=363504&comments=1" 
OUTPUT_FILENAME = "mydata.xml"

def fetch_and_save_data():
    """Fetches data using Bearer token authentication and saves the XML response."""
    
    # 1. SECURELY retrieve the token from the environment variable
    # The name MUST match the 'env:' key defined in the GitHub Actions YAML
    secret_token = os.environ.get("API_TOKEN") 

    if not secret_token:
        # Fails the script if the token isn't configured in GitHub Secrets
        print("Error: API_TOKEN environment variable not set. Aborting.")
        sys.exit(1)

    print(f"Attempting to fetch data from: {BGG_API_URL}")
    
    try:
        # 2. Construct the required Bearer Authorization Header
        headers = {
            "User-Agent": "Scheduled BGG Data Fetcher (GitHub Actions)",
            "Authorization": f"Bearer {secret_token}" 
        }
        
        # 3. Make the authenticated GET request
        response = requests.get(BGG_API_URL, headers=headers, timeout=30)
        
        # Raises HTTPError for 4xx/5xx responses (e.g., 401 Unauthorized)
        response.raise_for_status() 

        if not response.content:
            print("Error: API response was empty.")
            sys.exit(1)

        # 4. Write the raw XML content to the output file
        with open(OUTPUT_FILENAME, "wb") as f:
            f.write(response.content)

        print(f"Success! Data saved to {OUTPUT_FILENAME}")
        
    except requests.exceptions.HTTPError as errh:
        # Catches authentication or API-side errors
        print(f"HTTP Error occurred (check token/URL): {errh}")
        print(f"Response details: {response.text[:200]}...")
        sys.exit(1)
    except requests.exceptions.RequestException as err:
        print(f"An unexpected error occurred: {err}")
        sys.exit(1)

if __name__ == "__main__":
    fetch_and_save_data()
