import requests
from bs4 import BeautifulSoup
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import re
import random

def scrape_website(url):
    """
    Scrapes text content from a given website URL.

    Args:
        url (str): The webpage URL.

    Returns:
        str: Extracted text content.
    """
    headers = {"User-Agent": "Mozilla/5.0"}
    session = requests.Session()
    session.headers.update(headers)

    response = session.get(url)

    response.raise_for_status()  # Ensure successful request

    soup = BeautifulSoup(response.text, "html.parser")

     # Extract meaningful content (paragraphs and headers)
    text_elements = soup.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
    text = " ".join(element.get_text() for element in text_elements)

    # Remove extra spaces, newlines, and special characters
    text = re.sub(r"\s+", " ", text).strip()

    return text

def split_text(text, chunk_size=300):
    """
    Splits a large text into smaller partitions, ensuring each partition ends with a period.
    
    Args:
        text (str): The full text.
        chunk_size (int): Approximate number of words per partition.
        
    Returns:
        list: List of text partitions.
    """
    # First, split text into sentences.
    # The regex splits after a period (keeping the period with the sentence).
    sentences = re.split(r'(?<=[.])\s+', text)
    
    partitions = []
    current_partition = ""
    current_word_count = 0

    for sentence in sentences:
        # Count words in the sentence.
        sentence_word_count = len(sentence.split())
        
        # If adding this sentence exceeds the chunk size and there is content in the current partition,
        # finalize the current partition.
        if current_partition and current_word_count + sentence_word_count > chunk_size:
            # Ensure the partition ends with a period.
            if not current_partition.endswith('.'):
                current_partition = current_partition.rstrip() + '.'
            partitions.append(current_partition.strip())
            # Start a new partition with the current sentence.
            current_partition = sentence
            current_word_count = sentence_word_count
        else:
            # Otherwise, add the sentence to the current partition.
            if current_partition:
                current_partition += " " + sentence
            else:
                current_partition = sentence
            current_word_count += sentence_word_count

    # Add the last partition.
    if current_partition:
        if not current_partition.endswith('.'):
            current_partition = current_partition.rstrip() + '.'
        partitions.append(current_partition.strip())

    return partitions

def similarity_search(prompt, partitions, threshold=0.5):
    """
    Performs similarity search between a prompt and text partitions.

    Args:
        prompt (str): The search query.
        partitions (list of str): List of partitioned text.
        threshold (float): Minimum similarity score for filtering.

    Returns:
        list: Relevant partitions with similarity scores.
    """
    model = SentenceTransformer("all-MiniLM-L6-v2")  # Efficient embedding model
    # Generate embeddings
    prompt_embedding = model.encode([prompt])
    partition_embeddings = model.encode(partitions)
    # print(prompt_embedding.shape, partition_embeddings.shape)


    # Compute cosine similarity
    similarity = cosine_similarity(prompt_embedding, partition_embeddings)[0]

        # Filter partitions based on threshold
    filtered_partitions = [
        {"text": partitions[i]}
        for i in range(len(partitions))
        if similarity[i] > threshold
    ]
    print(similarity)

    # Sort by relevance (descending similarity)
    # filtered_partitions.sort(key=lambda x: x["score"], reverse=True)

    return filtered_partitions

def retrieve_evidence(prompt, url):
    try:
        # Step 1: Scrape website
        web_text = scrape_website(url)
        # Step 2: Partition text
        partitions = split_text(web_text)
        # Step 3: Perform similarity search
        results = similarity_search(prompt, partitions, threshold = 0.5)
        final_results = random.sample(results, k=min(10, len(results)))
        print(len(final_results))
        return final_results
        
    except requests.exceptions.RequestException as e:
        print(e)