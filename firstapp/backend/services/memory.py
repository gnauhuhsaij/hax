from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv
import os
import hashlib


# Load environment variables from .env file
load_dotenv()
# Get the API key
pinecone_api_key = os.getenv("PINECONE_API_KEY")
pc = Pinecone(api_key=pinecone_api_key)
index = pc.Index("hax")  # Locate index hax

def add_evidence(evidence, userid, workflowid):
    """
    Adding evidence to the user's specific workflow's memory 
    base, generating a hash ID for the evidence.
    Args:
        evidence (str): The evidence.
        userid (str): The user ID.
        workflowid (str): The workflow ID.
    Returns:
        a status message (json): if success, return id, namespace, and success message; otherwise, return error message
    """
    try:
        if not evidence or not userid or not workflowid:
            raise ValueError("Missing required parameters: 'evidence', 'userid', 'workflowid'")

        namespace = f"{userid}-{workflowid}"
        hashid = hashlib.sha256(evidence.encode()).hexdigest()
        index.upsert_records(
            namespace,
            [
                {
                    "_id": hashid,
                    "chunk_text": evidence
                }
            ]
        )
        return {"id": hashid, "namespace": namespace, "message": "Evidence added successfully"}

    except Exception as e:
        return {"error": str(e)}
