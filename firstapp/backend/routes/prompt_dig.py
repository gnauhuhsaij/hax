from flask import Blueprint, request, jsonify
from services.chat_service import dig_init, chat_send, rec_send, name_workflow
from uuid import uuid4
from copy import deepcopy

# Store active conversations
conversation_store = {}

# Create Flask Blueprint
dig_bp = Blueprint('dig', __name__)

@dig_bp.route('/dig', methods=['POST'])
def dig():
    data = request.json
    prompt = data.get("prompt")
    model = data.get("model", "gpt-4o")

    if not prompt:
        return jsonify({"error": "nested_tasks is required"}), 400

    # Initialize app and get the first responses
    app_id = str(uuid4())  # Generate a unique ID for this conversation
    app, responses = dig_init(prompt, model)

    # Store app in the conversation store
    conversation_store[app_id] = app

    # Return the unique ID and responses to the frontend
    return jsonify({"app_id": app_id, "responses": responses['messages'][-1].content})

@dig_bp.route('/dig2', methods=['POST'])
def dig2():
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

@dig_bp.route('/get_rec', methods=['POST'])
def getRec():
    data = request.json
    response = data.get("response")
    prompt = data.get("prompt")

    # Generate a response using the copied app instance
    recommendations = rec_send(response, prompt)['recommendations']

    return jsonify({"recommendations": recommendations})

@dig_bp.route('/get_name', methods=['POST'])
def getName():
    data = request.json
    prompt = data.get("user_input", "")
    model = data.get("model", "gpt-4o")

    if not prompt:
        return jsonify({"error": "nested_tasks is required"}), 400

    # Initialize app and get the first responses
    app_id = str(uuid4())  # Generate a unique ID for this conversation
    app, responses = name_workflow(prompt, model)

    # Store app in the conversation store
    # conversation_store[app_id] = app

    # Return the unique ID and responses to the frontend
    return jsonify({"app_id": app_id, "workflow_name": responses['messages'][-1].content})
