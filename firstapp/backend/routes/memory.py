# routes/memory.py
from flask import Blueprint, jsonify, request, g
from services.memory import add_evidence, add_evidence_metadata, delete_evidence_from_db_and_index
from db import get_db
import traceback


memory_bp = Blueprint('memory', __name__)

@memory_bp.before_request
def before_request():
    g.db = next(get_db())

@memory_bp.teardown_request
def teardown_request(exception):
    db = g.pop('db', None)
    if db is not None:
        db.close()

@memory_bp.route('/add_evidence', methods=['POST'])
def add_evidence_to_memory():
    try:
        data = request.get_json()
        evidence = data.get("evidence")
        userid = data.get("userid")
        workflowid = data.get("workflowid")

        # New metadata fields
        subtask_index = data.get("subtask_index")
        step_index = data.get("step_index")
        query_name = data.get("query_name")

        if not all([evidence, userid, workflowid]):
            return jsonify({"error": "Missing required fields"}), 400

        pinecone_result = add_evidence(evidence, userid, workflowid) 
        metadata_result = add_evidence_metadata(
            evidence, userid, workflowid, g.db,
            subtask_index=subtask_index,
            step_index=step_index,
            query_name=query_name
        )

        return jsonify({
            "pinecone": pinecone_result,
            "metadata": metadata_result
        })


    except Exception as e:
        print("❌ Exception in /add_evidence route:")
        traceback.print_exc()  # This prints the full stack trace to the terminal
        return jsonify({"error": str(e)}), 500

@memory_bp.route('/show_all_memories', methods=['GET'])
def show_all_memories():
    try:
        from db import get_db  
        db = next(get_db()) 
        from models import Evidence

        workflow_id = request.args.get("workflow_id")
        user_id = request.args.get("user_id")

        query = db.query(Evidence)
        if workflow_id:
            query = query.filter(Evidence.workflowid == workflow_id)
        if user_id:
            query = query.filter(Evidence.userid == user_id)

        memories = query.order_by(Evidence.timestamp.desc()).all()

        memory_list = [{
            "id": memory.id,
            "content": memory.content,
            "subtask_index": memory.subtask_index,
            "step_index": memory.step_index,
            "query_name": memory.query_name,
            "timestamp": memory.timestamp.isoformat(),
        } for memory in memories]

        return jsonify(memory_list)

    except Exception as e:
        error_msg = traceback.format_exc()
        return jsonify({"error": error_msg}), 500

@memory_bp.route('/delete_evidence', methods=['POST'])
def delete_evidence_route():
    try:
        data = request.get_json()
        evidence = data.get("evidence")
        userid = data.get("userid")
        workflowid = data.get("workflowid")

        result = delete_evidence_from_db_and_index(evidence, userid, workflowid, g.db)
        return jsonify(result)

    except Exception as e:
        print("❌ Exception in /delete_evidence route:")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
