import logging
import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "config")))
from celery_config import celery
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "model")))
from summarizer import summarize_text
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from db import SessionLocal
from models import Evidence
import multiprocessing
multiprocessing.set_start_method("spawn", force=True)



logger = logging.getLogger(__name__)

@celery.task(name="tasks.summarize_evidence")
def summarize_evidence(evidence_id, text):
    logger.info(f"📥 Received summarization task for evidence_id={evidence_id}")
    db = SessionLocal()
    try:
        summary = summarize_text(text)
        logger.info(f"✅ Generated summary for evidence_id={evidence_id}: {summary[:80]}...")

        evidence = db.query(Evidence).filter_by(id=evidence_id).first()
        if evidence:
            evidence.summary = summary
            db.commit()
            # db.refresh(evidence)  # pull latest values from DB
            evidence2 = db.query(Evidence).filter_by(id=evidence_id).first()
            logger.info(f"💾 Saved summary to DB for evidence_id={evidence_id}")
            logger.info(f"🔎 Row after commit: id={evidence2.id}, user={evidence2.userid}, workflow={evidence2.workflowid}, content={evidence2.content}, summary={evidence2.summary[:120]}..., ")
        else:
            logger.warning(f"⚠️ Evidence not found in DB for id={evidence_id}")
        return {"id": evidence_id, "summary": summary}

    except Exception as e:
        db.rollback()
        logger.error(f"❌ Failed to summarize evidence_id={evidence_id}: {e}", exc_info=True)
        raise
    finally:
        db.close()
