import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin

def get_favicon(url):
    """Fetch the favicon URL from a website."""
    try:
        response = requests.get(url)
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            favicon_url = None
            for link in soup.find_all('link', rel=['icon', 'shortcut icon', 'apple-touch-icon']):
                favicon_url = link.get('href')
                if favicon_url:
                    break
            
            if favicon_url:
                return urljoin(url, favicon_url)  # Ensure the favicon URL is absolute
            else:
                return None
        else:
            return None
    except Exception as e:
        return None

def call_google_search_api(query):
    """
    Calls the Google Search API to retrieve search results and also includes the website favicon.
    Args:
        query (str): The search query.
    Returns:
        dict: A dictionary containing evidence or an error message, including favicons.
    """
    api_key = "AIzaSyDYO5BSod8opzI20moUfGLfcYO1ez1vMQU"
    search_engine_id = "c5297ee11db07449c"  # Replace with your custom search engine ID
    base_url = "https://www.googleapis.com/customsearch/v1"

    # Construct the request parameters
    params = {
        "key": api_key,
        "cx": search_engine_id,
        "q": query
    }

    try:
        # Make the API request
        response = requests.get(base_url, params=params)
        response.raise_for_status()  # Raise HTTPError for bad responses

        # Parse the JSON response
        data = response.json()

        # Extract relevant information, including favicon
        if "items" in data:
            results = []
            for item in data["items"]:
                title = item.get("title")
                link = item.get("link")
                snippet = item.get("snippet")

                # Fetch the favicon using the helper function
                favicon_url = get_favicon(link)
                
                results.append({
                    "title": title,
                    "link": link,
                    "snippet": snippet,
                    "favicon": favicon_url  # Store the actual favicon URL
                })

            return {"success": True, "evidence": results}
        else:
            return {"success": False, "error": "No results found."}

    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e)}
