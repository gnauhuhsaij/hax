from flask import Blueprint, jsonify, request
from services.memory import add_evidence  
from services.memory import index

memory_bp = Blueprint('memory', __name__)

@memory_bp.route('/add_evidence',methods=['POST'])
def add_evidence_to_memory():
    """
    Adding evidence to the user's specific workflow's namespace 
    base, generating a hash ID for the evidence.
    Args:
        evidence (str): The evidence.
        userid (str): The user ID.
        workflowid (str): The workflow ID.
    Returns:
        a status message (json): if success, return id, namespace, and success message; otherwise, return error message
    """
    try:
        data = request.get_json()
        evidence = data.get("evidence")
        userid = data.get("userid")
        workflowid = data.get("workflowid")

        result = add_evidence(evidence, userid, workflowid)
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@memory_bp.route('/list_all_evidence', methods=['GET'])
def list_all_evidence():
    userid = request.args.get('userid')
    workflowid = request.args.get('workflowid')
    
    if not userid or not workflowid:
        return jsonify({"error": "Missing userid or workflowid"}), 400

    try:
        namespace = f"{userid}-{workflowid}"

        # Fetch all vectors
        response = index.describe_index_stats()
        if namespace not in response["namespaces"]:
            return jsonify({"evidences": []}), 200  # No vectors if namespace doesn't exist

        # Get all IDs in the namespace
        all_ids = response["namespaces"][namespace]["vector_count"]

        # For simple testing, let's assume you have a way to list IDs
        # Otherwise Pinecone fetch needs specific IDs

        # Here for simplicity, let's query with empty vector and topK=100
        query_response = index.query(
            vector=[0.0] * 1024,  # a dummy vector of correct dimension
            top_k=100,
            namespace=namespace,
            include_metadata=True
        )

        evidences = [
            {"id": match["id"], "text": match.get("metadata", {}).get("chunk_text", "")}
            for match in query_response.matches
        ]

        return jsonify({"evidences": evidences})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
