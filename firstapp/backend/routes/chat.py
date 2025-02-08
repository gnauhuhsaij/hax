from flask import Blueprint, request, jsonify
from services.chat_service import chat_init, chat_send
from uuid import uuid4

# Store active conversations
conversation_store = {}

# Create Flask Blueprint
chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/chat', methods=['POST'])
def chat():
    data = request.json
    nested_tasks = data.get("nested_tasks")
    model = data.get("model", "gpt-4o")

    if not nested_tasks:
        return jsonify({"error": "nested_tasks is required"}), 400

    # Initialize app and get the first responses
    app_id = str(uuid4())  # Generate a unique ID for this conversation
    app, responses = chat_init(nested_tasks, model)

    # Store app in the conversation store
    conversation_store[app_id] = app

    # Return the unique ID and responses to the frontend
    return jsonify({"app_id": app_id, "responses": responses['messages'][-1].content})


@chat_bp.route('/chat2', methods=['POST'])
def chat2():
    data = request.json
    app_id = data.get("app_id")
    user_response = data.get("user_response")

    if not app_id or not user_response:
        return jsonify({"error": "app_id and user_response are required"}), 400

    # Retrieve the app from the conversation store
    app = conversation_store.get(app_id)
    if not app:
        return jsonify({"error": "Invalid app_id"}), 404

    # Process user response and get new responses
    app, responses = chat_send(app, user_response)

    # Update the conversation store with the latest state
    conversation_store[app_id] = app

    # Return the new responses to the frontend
    return jsonify({"responses": responses['messages'][-1].content})
