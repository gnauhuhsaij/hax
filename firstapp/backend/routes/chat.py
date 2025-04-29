from langchain_openai import ChatOpenAI  
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from flask import Blueprint, request, jsonify
from services.chat_service import chat_init, chat_send
from uuid import uuid4

option_model = ChatOpenAI(model="gpt-4o", temperature=0)

def generate_options_dynamic(question_text):
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant that generates short answer suggestions based on a user question."),
        ("user", f"Given the question: {question_text}\nGenerate 3 possible user answers, each under 5 words, separated by '|'.")
    ])
    chain = prompt | option_model | StrOutputParser()

    result = chain.invoke({})
    return [opt.strip() for opt in result.split("|")]

# Store active conversations
conversation_store = {}

# Create Flask Blueprint
chat_bp = Blueprint('chat', __name__)

def generate_options(question_text):
    """
    Generate possible answers based on question content.
    Very simple version. You can make it smarter later.
    """
    q = question_text.lower()
    if "diet" in q or "dietary" in q:
        return ["Vegetarian", "Vegan", "Keto"]
    elif "allergy" in q:
        return ["Dairy", "Nuts", "Gluten"]
    elif "preference" in q:
        return ["Low carb", "High protein", "Mediterranean"]
    else:
        return ["Yes", "No", "Not sure"]

@chat_bp.route('/chat', methods=['POST'])
def chat():
    data = request.json
    nested_tasks = data.get("nested_tasks")
    model = data.get("model", "gpt-4o")

    if not nested_tasks:
        return jsonify({"error": "nested_tasks is required"}), 400

    app_id = str(uuid4())
    app, responses = chat_init(nested_tasks, model)
    conversation_store[app_id] = app

    ai_message = responses['messages'][-1]

    return jsonify({
        "app_id": app_id,
        "responses": [{
            "sender": "agent",
            "text": ai_message.content,
            "options": generate_options_dynamic(ai_message.content)
        }]
    })

@chat_bp.route('/chat2', methods=['POST'])
def chat2():
    data = request.json
    app_id = data.get("app_id")
    user_response = data.get("user_response")

    if not app_id or not user_response:
        return jsonify({"error": "app_id and user_response are required"}), 400

    app = conversation_store.get(app_id)
    if not app:
        return jsonify({"error": "Invalid app_id"}), 404

    app, responses = chat_send(app, user_response)
    conversation_store[app_id] = app

    ai_message = responses['messages'][-1]

    return jsonify({
        "responses": [{
            "sender": "agent",
            "text": ai_message.content,
            "options": generate_options_dynamic(ai_message.content)
        }]
    })


