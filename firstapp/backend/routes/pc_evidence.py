from flask import Blueprint, request, jsonify
from services.database import add_evidence


pcev_bp = Blueprint('pc_ev', __name__)

@pcev_bp.route('/send2pc', methods=['POST'])
def send():
    try:
        # Parse JSON data from the request
        data = request.get_json()
        
        # Extract required fields
        evidence = data.get('evidence')
        app_id = data.get('app_id')
        user_id = data.get('user_id')

        # Ensure all required fields are provided
        if not evidence or not app_id or not user_id:
            return jsonify({"error": "Missing required fields"}), 400

        # Call the add_evidence function
        add_evidence(evidence, app_id, user_id)

        return jsonify({"message": "Evidence added successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
