import requests

def call_pubmed_api(query):
    """
    Calls the PubMed API to search for articles based on the query.
    Args:
        query (str): The search query.
    Returns:
        dict: A dictionary containing evidence or an error message.
    """
    base_url = "https://pubmed.ncbi.nlm.nih.gov/api"
    params = {"query": query}
    
    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        return {"evidence": response.json()}
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}
