from flask import Blueprint, jsonify, request
from services.memory import add_evidence  

memory_bp = Blueprint('memory', __name__)

@memory_bp.route('/add_evidence',methods=['POST'])
def add_evidence_to_memory():
    try:
        data = request.get_json()
        evidence = data.get("evidence")
        userid = data.get("userid")
        workflowid = data.get("workflowid")

        result = add_evidence(evidence, userid, workflowid)
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

