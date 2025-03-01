import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.runnables.history import RunnableWithMessageHistory
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import START, MessagesState, StateGraph
from services.task_utils import get_secret

api_key = get_secret()
os.environ["OPENAI_API_KEY"] = api_key


def chat_init(nested_tasks, model="gpt-3.5-turbo"):
    # Initialize memory
    workflow = StateGraph(state_schema=MessagesState)

    # Check if the model is valid
    if model not in ['gpt-3.5-turbo', 'gpt-4o']:
        raise ValueError("Invalid model. Choose 'gpt-3.5-turbo' or 'gpt-4o'.")

    # Initialize the LLM
    elaborate = ChatOpenAI(model='gpt-4o', temperature=0.7)
    
    # Elaborate the task
    task_elaboration_prompt = """
        Given the following nested tasks:
        {task_hierarchy}
        The innermost task is a information-gathering task.
        Elaborate on the innermost task in the hierarchy with details from its parent tasks, such that no context is needed for someone who doesn't know about the parent tasks to understand the innermost task.
        The elaborated task will be told to another AI that ask users questions to gather information.
        """

    task_elaboration_prompt_template = ChatPromptTemplate.from_messages(
        [("user", task_elaboration_prompt)]
    )

    parser = StrOutputParser()

    # Format the nested tasks into a hierarchy
    # task_hierarchy = "->".join([f"{task}" for task in nested_tasks])[:-2]
    task_hierarchy = nested_tasks

    # Chain to elaborate the task
    task_elaboration_chain = task_elaboration_prompt_template | elaborate | parser
    elaborated_task = task_elaboration_chain.invoke({"task_hierarchy":task_hierarchy})

    chat = ChatOpenAI(model=model, temperature=0.7)
    def call_chat(state: MessagesState):
        system_prompt = ("""You are a helpful assistant tasked with asking the user questions to 
                         complete a information-gathering task. Ask only one question each time. 
                         Ask 5 questions at least. When you think you have gathered enough information, 
                         stop asking and summarize all evidence sent by the users in a coherent, 
                         non-bullet-point way. You don't have to ask all the times but also address users' questions.
                        But ALWAYS END in a summary of gathered information, and keep your response short""")
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = chat.invoke(messages)
        return {"messages": response}
    
    # Define the node and edge
    workflow.add_node("model", call_chat)
    workflow.add_edge(START, "model")

    # Add simple in-memory checkpointer
    memory = MemorySaver()
    app = workflow.compile(checkpointer=memory)
    responses = app.invoke(
        {"messages": [HumanMessage(content=elaborated_task)]},
        config={"configurable": {"thread_id": "1"}},
    )
    return app, responses

def dig_init(prompt, model="gpt-3.5-turbo"):
    # Initialize memory
    workflow = StateGraph(state_schema=MessagesState)

    # Check if the model is valid
    if model not in ['gpt-3.5-turbo', 'gpt-4o']:
        raise ValueError("Invalid model. Choose 'gpt-3.5-turbo' or 'gpt-4o'.")

    chat = ChatOpenAI(model=model, temperature=0.7)
    def call_chat(state: MessagesState):
        system_prompt = ("""You are a helpful assistant tasked with enhancing a user's initial prompt to ensure 
                         it is detailed and complete for their task. The user may provide a prompt that lacks 
                         sufficient information. Your role is to ask the user one highly relevant question at 
                         a time to clarify and refine their request.

                         You are allowed to ask a maximum of two questions. After receiving two answers, combine 
                         all the details provided by the user along with their original prompt into a coherent and 
                         detailed description of the task. The final prompt should objectively describe the task 
                         (e.g., 'write an essay') rather than framing it subjectively (e.g., 'you want to write 
                         an essay'). It should also be as short as possible. This is not for teaching the user what to do, but just an elaboration of
                         what the user first inputed""")
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = chat.invoke(messages)
        return {"messages": response}
    
    # Define the node and edge
    workflow.add_node("model", call_chat)
    workflow.add_edge(START, "model")

    # Add simple in-memory checkpointer
    memory = MemorySaver()
    app = workflow.compile(checkpointer=memory)
    responses = app.invoke(
        {"messages": [HumanMessage(content=prompt)]},
        config={"configurable": {"thread_id": "1"}},
    )
    return app, responses

def chat_send(app, user_response):

    responses = app.invoke(
        {"messages": [HumanMessage(content=user_response)]},
        config={"configurable": {"thread_id": "1"}},
    )
    # Generate a response
    return app, responses

def name_workflow(prompt, model="gpt-3.5-turbo"):
    # Initialize memory
    workflow = StateGraph(state_schema=MessagesState)

    # Check if the model is valid
    if model not in ['gpt-3.5-turbo', 'gpt-4o']:
        raise ValueError("Invalid model. Choose 'gpt-3.5-turbo' or 'gpt-4o'.")

    chat = ChatOpenAI(model=model, temperature=0.7)
    def call_chat(state: MessagesState):
        system_prompt = ("""You are a helpful assistant tasked with summarizing a prompt to a few words. Your objective is to take an prompt and outputs a sentence less than 10 words summarizing the most important information in the prompt""")
        messages = [SystemMessage(content=system_prompt)] + state["messages"]
        response = chat.invoke(messages)
        return {"messages": response}
    
    # Define the node and edge
    workflow.add_node("model", call_chat)
    workflow.add_edge(START, "model")

    # Add simple in-memory checkpointer
    memory = MemorySaver()
    app = workflow.compile(checkpointer=memory)
    responses = app.invoke(
        {"messages": [HumanMessage(content=prompt)]},
        config={"configurable": {"thread_id": "1"}},
    )
    return app, responses