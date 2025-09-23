from pinecone import Pinecone, ServerlessSpec
from dotenv import load_dotenv
import os
import hashlib
from models import Evidence
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from openai import OpenAI
import openai


def add_evidence_metadata(evidence, userid, workflowid, db: Session, isSynthesis,
                          subtask_index=None, step_index=None, query_name=None, source=None):
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
        query_name=query_name,
        issynthesis=isSynthesis,
        source=source
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
    context = "\n\n".join(f"- {chunk}" for chunk in context_list)

    prompt = f"""
You are a professional research assistant. You are given multiple sources of information (chunks of web content) related to the user’s query.

Your job is to synthesize a comprehensive, well-structured answer using only the information in the context. Your answer should:

1. **Be structured** using clear headings and bullet points.
2. **Group insights thematically** (e.g. Effectiveness, Reach, Impact, Timeline, etc.) if applicable.
3. **Cite sources** using (Source X) where X is the index of the context chunk that provided the information.
4. **Avoid repetition** and hallucination. Do not make up data not in the context.
5. **Be concise and professional**—suitable for a report or executive summary.

---
### User Query:
{query}

---
### Context Chunks:
{context}

---
### Final Response:
"""

    response = client.chat.completions.create(
        model="gpt-4",
        temperature=0.2,
        messages=[
            {"role": "system", "content": "You are a helpful assistant that synthesizes information into professional summaries using only verified context."},
            {"role": "user", "content": prompt}
        ]
    )

    return response.choices[0].message.content


def synthesize(query, evidence_list, dependency_list):
    # Format evidence for current step
    step_evidence = "\n".join(
        f"- {item.get('content')}" for item in evidence_list if item.get("content")
    )

    # Format dependencies only if they exist
    if dependency_list:
        preceding_info = "\n".join(
            f"- {item.get('content')}" for item in dependency_list if item.get("content")
        )
        user_prompt = (
            f"You are completing the following task:\n{query}\n\n"
            f"Evidence collected for this step:\n{step_evidence or '[None]'}\n\n"
            f"Important information from preceding tasks:\n{preceding_info}\n\n"
            "Based on this information, complete the task as clearly and fully as possible."
        )
    else:
        user_prompt = (
            f"You are completing the following task:\n{query}\n\n"
            f"Evidence collected for this step:\n{step_evidence or '[None]'}\n\n"
            "Use the above evidence to complete the task as clearly and fully as possible."
        )

    system_prompt = (
        "You are an intelligent agent helping to complete a multi-step task. "
        "Use relevant evidence and reasoning to fulfill the current task."
    )

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    )
    return response.choices[0].message.content.strip()


