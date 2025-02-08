import requests
from langchain_core.output_parsers import StrOutputParser
from langchain_openai import ChatOpenAI
from services.task_utils import get_secret
import os

def call_llm_api(prompt):
    """
    Calls an LLM API (e.g., OpenAI) to generate a response for the given prompt.
    Args:
        prompt (str): The input prompt for the LLM.
    Returns:
        dict: A dictionary containing evidence or an error message.
    """
    api_key = get_secret()
    os.environ["OPENAI_API_KEY"] = api_key
    model = ChatOpenAI(model="gpt-4o", organization='org-ukPTknDuMqCYzxWVt4Dhba3q')
    parser = StrOutputParser()
    chain = model | parser

    try:
        return {"evidence": chain.invoke(prompt)}
    except requests.exceptions.RequestException as e:
        return {"error": str(e)}
