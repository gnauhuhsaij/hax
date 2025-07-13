import asyncio
import aiohttp
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnableLambda
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import os
from services.task_utils import get_secret

model = SentenceTransformer("all-MiniLM-L6-v2")  # Efficient embedding model
api_key = get_secret()
os.environ["OPENAI_API_KEY"] = api_key

def get_subpages_from_homepage(url, max_links=10):
    """
    Scrape subpage URLs from homepage by checking navbars and sitemap links.
    """
    try:
        homepage = requests.get(url, timeout=5)
        homepage.raise_for_status()
        soup = BeautifulSoup(homepage.text, "html.parser")

        links = set()

        # 1. Try finding sitemap
        sitemap_url = urljoin(url, "/sitemap.xml")
        try:
            sitemap = requests.get(sitemap_url, timeout=3)
            if sitemap.status_code == 200:
                sitemap_soup = BeautifulSoup(sitemap.text, "xml")
                for loc in sitemap_soup.find_all("loc"):
                    links.add(loc.text)
        except:
            pass  # Fall back to navbar scraping

        # 2. If no sitemap or to enrich, parse <a> tags in nav/menu
        for tag in soup.find_all("a", href=True):
            href = tag["href"]
            full_url = urljoin(url, href)
            if urlparse(full_url).netloc == urlparse(url).netloc:
                links.add(full_url)

        return list(links)[:max_links]

    except Exception as e:
        print(f"Subpage scraping failed for {url}: {e}")
        return []

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

def similarity_score(query, search):
    """
    Performs similarity search between a prompt and text partitions.

    Args:
        prompt (str): The search query.
        partitions (list of str): List of partitioned text.
        threshold (float): Minimum similarity score for filtering.

    Returns:
        list: Relevant partitions with similarity scores.
    """
    # Generate embeddings
    prompt_embedding = [model.encode(query)]
    partition_embeddings = [model.encode(search)]
    # print(prompt_embedding.shape, partition_embeddings.shape)


    # Compute cosine similarity
    similarity = cosine_similarity(prompt_embedding, partition_embeddings)

    # Sort by relevance (descending similarity)
    # filtered_partitions.sort(key=lambda x: x["score"], reverse=True)

    return similarity

class SearchState(TypedDict):
    step_name: str
    workflow_structure: str
    query: str


# --- Query Generation Chain ---
llm = ChatOpenAI(model="gpt-4o", temperature=0.4)

query_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an expert researcher who crafts precise Google search queries."),
    ("user", 
     """Given the current workflow structure:
{workflow_structure}

And the current step:
{step_name}

Craft the best possible Google search query that would help someone find relevant information to complete the step in this workflow. Be specific, and assume the searcher is looking for practical resources or documentation. Reply with ONLY the query string.""")
])

query_chain = query_prompt | llm | StrOutputParser()

def call_google_search_api(step, context):
    """
    Calls the Google Search API to retrieve search results and also includes the website favicon.
    Args:
        query (str): The search query.
    Returns:
        dict: A dictionary containing evidence or an error message, including favicons.
    """
    query = get_query(step, context)[1:-1]
    print(query)
    api_key = "AIzaSyDYO5BSod8opzI20moUfGLfcYO1ez1vMQU"
    search_engine_id = "c5297ee11db07449c"  # Replace with your custom search engine ID
    base_url = "https://www.googleapis.com/customsearch/v1"

    params = {"key": api_key, "cx": search_engine_id, "q": query}

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()

        if "items" not in data:
            return {"success": False, "error": "No results found."}

        results = []
        all_items = []

        # Step 1: Process top search results
        for item in data["items"]:
            title = item.get("title")
            link = item.get("link")
            snippet = item.get("snippet")
            # favicon = get_favicon(link)
            score = similarity_score(query, title)
            all_items.append({
                "title": title, "link": link, "snippet": snippet,
                "favicon": 0, "score": float(score[0][0])
            })

        # Step 2: Scrape subpages of top 3 items
        # for top_result in all_items[:3]:
        #     subpages = get_subpages_from_homepage(top_result["link"], max_links=10)
        #     print(subpages)
        #     for subpage in subpages:
        #         sub_favicon = get_favicon(subpage)
        #         sub_score = similarity_score(query, subpage)
        #         all_items.append({
        #             "title": subpage,  # No title, so using URL
        #             "link": subpage,
        #             "snippet": "Subpage of " + top_result["link"],
        #             "favicon": sub_favicon,
        #             "score": float(sub_score[0][0])
        #         })

        # Step 3: Sort and return top 5
        top_results = sorted(all_items, key=lambda x: x["score"], reverse=True)[:8]
        return {"success": True, "evidence": top_results}

    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e)}

def get_query(step, context):

    def generate_query_node(state: SearchState) -> SearchState:
        query = query_chain.invoke({
            "workflow_structure": state["workflow_structure"],
            "step_name": state["step_name"]
        })
        return {
            "step_name": state["step_name"],
            "workflow_structure": state["workflow_structure"],
            "query": query
        }

    # Build the LangGraph
    graph = StateGraph(SearchState)
    graph.add_node("generate_query", RunnableLambda(generate_query_node))
    graph.set_entry_point("generate_query")
    graph.add_edge("generate_query", END)

    app = graph.compile()

    # --- Example Run ---
    input_data = {
        "step_name": step,
        "workflow_structure": context,
    }
    result = app.invoke(input_data)
    return result['query']