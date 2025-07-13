from flask import Blueprint, request, jsonify
from services.pubmed_service import call_pubmed_api
from services.google_service import call_google_search_api
from services.arxiv_service import call_arxiv_api
from services.wolfram_service import call_wolfram_alpha_api
from services.llm_service import call_llm_api
import traceback

process_step_bp = Blueprint('process_step', __name__)

@process_step_bp.route('/process_step', methods=['POST'])
def handle_process_step():
    data = request.json
    step_summary = data.get("name")
    execution = data.get("execution")
    context = data.get("context")
    try:
        if not step_summary or not execution:
            return jsonify({"error": "Missing required fields"}), 401

        if execution == "PubMed API":
            result = call_pubmed_api(step_summary)
        elif execution == "Google Search API":
            result = call_google_search_api(step_summary, context)
        elif execution == "arXiv API":
            result = call_arxiv_api(step_summary)
        elif execution == "Wolfram Alpha API":
            result = call_wolfram_alpha_api(step_summary)
        elif execution == "LLM":
            result = call_llm_api(step_summary)
        elif execution == "Human":
            result = {"evidence": f"Step requires manual execution by a human: {step_summary}"}
        else:
            return jsonify({"error": "Invalid execution type"}), 402
    except Exception as e:
        print("❌ Exception in /process_step route:")
        traceback.print_exc()  # This prints the full stack trace to the terminal
        return jsonify({"error": str(e)}), 500

    return jsonify(result)
