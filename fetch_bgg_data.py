import requests
import os
import sys

# Define the URL for the BGG API call
BGG_API_URL = "https://boardgamegeek.com/xmlapi/geeklist/363504?comments=1"
OUTPUT_FILENAME = "mydata.xml"

def fetch_and_save_data():
    """Fetches data from the BGG API and saves the XML response to a file."""
    print(f"Attempting to fetch data from: {BGG_API_URL}")
    
    try:
        # Use a User-Agent to be polite and identify your script
        headers = {
            "User-Agent": "Scheduled BGG Data Fetcher (GitHub Actions)"
        }
        
        # Make the GET request
        response = requests.get(BGG_API_URL, headers=headers, timeout=30)
        
        # Raise an exception for bad status codes (4xx or 5xx)
        response.raise_for_status()

        # Check if the response content is empty
        if not response.content:
            print("Error: API response was empty.")
            sys.exit(1)

        # Write the raw XML content to the output file
        with open(OUTPUT_FILENAME, "wb") as f:
            f.write(response.content)

        print(f"Success! Data saved to {OUTPUT_FILENAME}")
        
    except requests.exceptions.HTTPError as errh:
        print(f"HTTP Error occurred: {errh}")
        sys.exit(1)
    except requests.exceptions.ConnectionError as errc:
        print(f"Connection Error occurred: {errc}")
        sys.exit(1)
    except requests.exceptions.Timeout as errt:
        print(f"Timeout Error occurred: {errt}")
        sys.exit(1)
    except requests.exceptions.RequestException as err:
        print(f"An unexpected error occurred: {err}")
        sys.exit(1)

if __name__ == "__main__":
    fetch_and_save_data()
