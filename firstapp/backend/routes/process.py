from flask import Blueprint, request, jsonify
from services.langchain_service import process_task_with_langchain

process_bp = Blueprint('process', __name__)

@process_bp.route('/process', methods=['POST'])
def process_task():
    user_input = request.json.get('user_input', '')
    if not user_input:
        return jsonify({"error": "Missing user input"}), 400

    # Process the task using LangChain services
    response = process_task_with_langchain(user_input)
    return jsonify(response)
