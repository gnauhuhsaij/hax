from flask import Blueprint, request, jsonify
from services.scrape import retrieve_evidence


scrape_bp = Blueprint('scrape', __name__)

@scrape_bp.route('/scrape', methods=['POST'])
def scrape():
    try:
        # Parse JSON data from the request
        data = request.get_json()
        
        # Extract required fields
        prompt = data.get('prompt')
        url = data.get('url')

        # Ensure required fields are present
        if not prompt or not url:
            return jsonify({"error": "Missing required fields"}), 400

        # Call the retrieve_evidence function
        final_results = retrieve_evidence(prompt, url, 0.2)

        return jsonify({"evidence": final_results}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
