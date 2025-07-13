from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv
import os
import hashlib
from models import Evidence
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from openai import OpenAI
import openai


def add_evidence_metadata(evidence, userid, workflowid, db: Session,
                          subtask_index=None, step_index=None, query_name=None):
    """
    Adds metadata to SQL DB, including subtask/step indexes and optional query label.
    """
    if not evidence or not userid or not workflowid:
        raise ValueError("Missing required parameters")

    hashid = hashlib.sha256(evidence.encode()).hexdigest()

    existing = db.query(Evidence).filter_by(id=hashid).first()
    if existing:
        return {"id": hashid, "message": "Evidence already exists in metadata DB"}

    new_entry = Evidence(
        id=hashid,
        userid=userid,
        workflowid=workflowid,
        content=evidence,
        timestamp=datetime.now(timezone.utc),
        subtask_index=subtask_index,
        step_index=step_index,
        query_name=query_name
    )
    db.add(new_entry)
    db.commit()
    return {"id": hashid, "message": "Metadata stored successfully"}


# Load environment variables from .env file
load_dotenv()
# Get the API key
pinecone_api_key = os.getenv("PINECONE_API_KEY")
pc = Pinecone(api_key=pinecone_api_key)
index = pc.Index("test0713")  # Locate index hax

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
                    "chunk_text": evidence,
                }
            ]
        )
        return {"id": hashid, "namespace": namespace, "message": "Evidence added successfully"}

    except Exception as e:
        return {"error": str(e)}

def delete_evidence_from_db_and_index(evidence, userid, workflowid, db: Session):
    """
    Deletes evidence from both the SQL metadata database and the Pinecone index.

    Args:
        evidence (str): The evidence string to be deleted.
        userid (str): The user ID.
        workflowid (str): The workflow ID.
        db (Session): SQLAlchemy database session.

    Returns:
        dict: A status message indicating success or failure.
    """
    try:
        if not evidence or not userid or not workflowid:
            raise ValueError("Missing required parameters: 'evidence', 'userid', 'workflowid'")

        # Generate hash ID
        hashid = hashlib.sha256(evidence.encode()).hexdigest()
        namespace = f"{userid}-{workflowid}"

        # 1. Delete from Pinecone
        index.delete(ids=[hashid], namespace=namespace)

        # 2. Delete from SQL
        evidence_entry = db.query(Evidence).filter_by(id=hashid).first()
        if evidence_entry:
            db.delete(evidence_entry)
            db.commit()
            sql_status = "Deleted from SQL"
        else:
            sql_status = "Not found in SQL"

        return {"id": hashid, "namespace": namespace, "pinecone": "Deleted", "sql": sql_status}

    except Exception as e:
        return {"error": str(e)}


OpenAI.api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI()  # Automatically uses OPENAI_API_KEY from env


def query_pinecone(query: str, userid: str, workflowid: str, k=5):
    namespace = f"{userid}-{workflowid}"

    results = index.search(
        namespace=f"{userid}-{workflowid}",
        query={
            "top_k": 10,
            "inputs": {
                'text': query
            }
        }
    )

    return [hit['fields']['chunk_text'] for hit in results['result']['hits']]


def generate_rag_response(query: str, context_list: list[str]) -> str:
    context = "\n".join(f"- {chunk}" for chunk in context_list)

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are a helpful assistant. Use the following memory to answer the question."},
            {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}
        ]
    )
    return response.choices[0].message.content

