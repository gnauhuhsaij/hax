# test_evidence_query.py
from db import SessionLocal
from models import Evidence

def test_query_all():
    db = SessionLocal()
    try:
        print("🔍 Querying all evidence entries...")
        evidence_entries = db.query(Evidence).all()

        for e in evidence_entries:
            print(f"\n🧾 ID: {e.id}")
            print(f"👤 User: {e.userid} | Workflow: {e.workflowid}")
            print(f"📦 Subtask {e.subtask_index}, Step {e.step_index}")
            print(f"🔎 Query Name: {e.query_name}")
            print(f"🕒 Timestamp: {e.timestamp}")
            print(f"📄 Content (preview): {e.content[:100]}...")
    finally:
        db.close()

if __name__ == "__main__":
    test_query_all()