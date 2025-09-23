from flask import Blueprint, request, jsonify
from services.memory import query_pinecone, generate_rag_response, synthesize
import traceback
rag_bp = Blueprint("rag", __name__)

@rag_bp.route('/rag_answer', methods=['POST'])
def rag_answer():
    try:
        data = request.json
        query = data.get("query")
        userid = data.get("userid")
        workflowid = data.get("workflowid")

        if not query or not userid or not workflowid:
            return jsonify({"error": "Missing query, userid, or workflowid"}), 400

        context_list = query_pinecone(query, userid, workflowid)
        answer = generate_rag_response(query, context_list)

        return jsonify({
            "query": query,
            "context_used": context_list,
            "answer": answer
        })

    except Exception as e:
        print("❌ Exception in /process_step route:")
        traceback.print_exc()  # This prints the full stack trace to the terminal
        return jsonify({"error": str(e)}), 500

@rag_bp.route('/rag_dependence_synthesis', methods=['POST'])
def rag_dependence_synthesis():
    try:
        data = request.json
        query = data.get("query")
        dependencies = data.get("dependencies")  # might be empty
        evidence = data.get("evidence")  # current step's evidence

        if not query or not evidence:
            return jsonify({"error": "Missing query or evidence"}), 400

        synthesized_output = synthesize(query, evidence, dependencies)

        return jsonify({
            "query": query,
            "synthesized_evidence": synthesized_output
        })

    except Exception as e:
        print("❌ Exception in /rag_dependence_synthesis:")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
