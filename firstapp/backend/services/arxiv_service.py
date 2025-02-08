import requests

def call_arxiv_api(query):
    """
    Calls the arXiv API to search for research papers based on the query.
    Args:
        query (str): The search query.
    Returns:
        dict: A dictionary containing evidence or an error message.
    """
    base_url = "http://export.arxiv.org/api/query"
    params = {
        "search_query": query,
        "start": 0,
        "max_results": 10
    }
    
    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        return {"evidence": response.text}  # arXiv API returns Atom feed XML
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}
