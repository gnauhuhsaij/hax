import requests

def call_wolfram_alpha_api(query):
    """
    Calls the Wolfram Alpha API to perform computational tasks or retrieve knowledge.
    Args:
        query (str): The search query.
    Returns:
        dict: A dictionary containing evidence or an error message.
    """
    base_url = "http://api.wolframalpha.com/v2/query"
    params = {
        "input": query,
        "appid": "YOUR_APP_ID",
        "output": "JSON"
    }
    
    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        return {"evidence": response.json()}
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}
