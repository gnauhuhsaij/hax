import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import boto3
from flask import Flask, request, jsonify
import json
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  

def get_secret():
    secret_name = "doai/openai/1015"
    region_name = "us-east-1"

    # Create a Secrets Manager client
    session = boto3.session.Session()
    client = session.client(
        service_name='secretsmanager',
        region_name=region_name
    )

    get_secret_value_response = client.get_secret_value(SecretId=secret_name)
    
    # Parse the JSON string to extract the key
    secret = json.loads(get_secret_value_response['SecretString'])
    return secret['OPENAIAPI']  # Return only the value of 'api_key'

def list2string(list_subtasks):

    string_subtasks = ""
    current_idx = 1
    for subtask in list_subtasks:
        string_subtasks = string_subtasks + "SUBTASK " + str(current_idx) + ": " + subtask + "\n"
        current_idx += 1
    return string_subtasks

def find_phase_for_subtask(data: str, subtask_number: int) -> int:
    # Split the data by lines to process each phase separately
    data = data.split("[SPLIT]")[1]
    phases = data.strip().split('\n')

    for phase in phases:
        phase = phase.strip()[:-1]
        # Extract phase number and subtasks from each line
        phase_number, subtasks = phase.split(':')
        phase_number = int(phase_number.strip().split()[1])  # Get the phase number

        # Extract subtask numbers as a list of integers
        subtask_list = [
            int(s.strip().split()[1]) for s in subtasks.split(',') if s.strip()
        ]

        # Check if the given subtask number is in the current phase's subtask list
        if subtask_number in subtask_list:
            return phase_number

    # If the subtask number is not found, return -1
    return -1

def transform_to_dict(steps_list):
    structured_data = []
    temp = {}

    for i, line in enumerate(steps_list):
        line = line.strip()
        if line.startswith('Step'):
            # Save the previous step if it exists
            if temp:
                structured_data.append(temp)
                temp = {}

            temp['name'] = line
        elif line.lower().startswith('classification:'):
            temp['classification'] = line.replace('Classification: ', '').strip()
        elif line.lower().startswith('execution:'):
            temp['execution'] = line.replace('Execution: ', '').strip()
    
    # Append the last temp dictionary
    if temp:
        structured_data.append(temp)

    return structured_data

api_key = get_secret()
os.environ["OPENAI_API_KEY"] = api_key


split_smodel = ChatOpenAI(model="gpt-4o", organization='org-ukPTknDuMqCYzxWVt4Dhba3q')
split_prompt = """
    You are a human resource manager tasked with deciding whether a task is atomic and can be completed linearly. If not, you will break down a task into the smallest number of independent, high-level subtasks. Your goal is to ensure that each subtask can be started immediately and in parallel, without relying on the completion of other subtasks. 
    
    Each subtask should be written in a way that makes it clear how it links to the original task. For example, if "Research about the program" is a subtask of "Write a personal statement for the CMU Data Science Master Program," it should be written as "Research about the CMU Data Science Master Program."

    To ensure all subtasks can be started immediately at the same time, You need to specify the expected input and output of the subtask. Before generating each subtask, make sure the expected inputs is in the resource list above, and should ABSOLUTELY NOT include expected outputs of other steps.

    Format the response exactly as:
    Subtask 1, task_description: , expected input: , expected output: ;
    Subtask 2, task_description: , expected input: , expected output: ;
    ...

    Reflect on the responses and identify dependencies between each subtask. If a subtask's expected input is another's output, then they are sequential. Group all sequential tasks into one subtask and respond again.
    
    This is not your final response yet. Repeatedly reflect until you are confident that there is no dependencies at all, then give your final response.

    Format the Final response exactly as:
    [FINAL]
    Subtask 1| task_description: , expected input: , expected output: ;
    Subtask 2| task_description: , expected input: , expected output: ;
    ...

    The task to break down is: {user_input}.
"""
split_prompt_template = ChatPromptTemplate.from_messages(
    [("user", split_prompt)]
)
parser = StrOutputParser()

flow_model = ChatOpenAI(model="gpt-4o", organization='org-ukPTknDuMqCYzxWVt4Dhba3q')
flow_prompt = flow_prompt = """
    You are an expert in designing optimized workflows for tasks that involve collaboration between humans and AI. You are given a subtask and need to create a serialized workflow. This subtask is part of a larger set of parallel subtasks, so ensure that no duplicate steps are executed.
    For each step in the workflow, you need to decide the most effective way for humans and AI to collaborate by selecting the most relevant tools to the current step.

    Requirements:

    Consider these subtasks that are running in parallel:

    {subtasks}

    Here is the subtask you need to turn into a workflow:

    {current_task}

    Avoid Duplication: Ensure that none of the steps in the workflow duplicate efforts already handled by the other parallel subtasks.

    Atomic Steps: If one step needs domain-specific knowledge to complete, break it down into 2 steps, the first gathering information about the knowledge and the second completing the step. For example, the task "write a first draft of a Statement of Purpose" should be complemented by "gather information about how to write a Statement of Purpose".
    Step-wise Breakdown: Break the subtask into a logical sequence of steps. For each step:

    1. Classify the step as one of the following:
    Gather information from user
    Gather information from external sources
    Generate new information from knowledge base
    
    2. Specify the execution category for the step, choosing one or several of the following:
    PubMed API: For accessing biomedical and research literature.
    Google Search API: For real-time web information retrieval.
    arXiv API: For academic preprints in physics, mathematics, and computer science.
    Wolfram Alpha API: For computational and analytical tasks.
    LLM: For generating insights, summaries, brainstorming, drafting, or reasoning from its trained knowledge base.
    Human: For tasks requiring human expertise, judgment, or creativity.

    Please create a serialized workflow for this subtask, considering the context of the other parallel tasks and providing clear reasoning for the collaboration strategy between humans and AI.

    In your output, only include the workflow without any other explanation, in the format of

    Step 1: [Step summary]
    Classification: [Gather information from user/Gather information from external sources/Generate new information from knowledge base]
    Execution: [PubMed API/Google Search API/arXiv API/Wolfram Alpha API/Human]

    Step 2: [Step summary]
    Classification: [Gather information from user/Gather information from external sources/Generate new information from knowledge base]
    Execution: [PubMed API/Google Search API/arXiv API/Wolfram Alpha API/Human]

    ...

    Step n: [Step summary]
    Classification: [Gather information from user/Gather information from external sources/Generate new information from knowledge base]
    Execution: [PubMed API/Google Search API/arXiv API/Wolfram Alpha API/Human]
"""
flow_prompt_template = ChatPromptTemplate.from_messages(
    [("user", flow_prompt)]
)

phase_model = ChatOpenAI(model="gpt-4o", organization='org-ukPTknDuMqCYzxWVt4Dhba3q')
phase_prompt = """
    The following is a series of subtask that will collectively help solve a main task:

    {subtasks}

    The main task is: {task}.

    I want you to first check the dependencies between these subtasks.

    Then, according to the dependencies, group the subtasks into sequential phases, such that all subtasks in a later phase depend on the completion of subtasks in a earlier phase.

    Format your output EXACTLY as:

    Reasoning:

    [SPLIT]

    Phase 1: Subtask 1, Subtask 4, Subtask 5;
    Phase 2: ...;
    ...
    Phase n: ...;

    You have to include the [SPLIT] token.
"""
phase_prompt_template = ChatPromptTemplate.from_messages(
    [("user", phase_prompt)]
)

phase_summary_model = ChatOpenAI(model="gpt-4o", organization='org-ukPTknDuMqCYzxWVt4Dhba3q')
phase_summary_prompt = """
    Summarize the following sentence as a high-level summary in less than or equal to five words.
    {subtask_descriptions}
"""
phase_summary_prompt_template = ChatPromptTemplate.from_messages(
    [("user", phase_summary_prompt)]
)

@app.route('/process', methods=['POST'])
def process_task():
    user_input = request.json.get('user_input', '')
    
    # Step 1: Break the task into subtasks
    chain = split_prompt_template | split_smodel | parser
    output = chain.invoke({"user_input": user_input})
    parsed_output = output.split('[FINAL]')[1].split('Subtask')[1:]
    new_output = [i.split('| ')[1] for i in parsed_output]
    
    # Step 2: Group subtasks into phases
    phase_chain = phase_prompt_template | phase_model | parser
    subtasks = list2string(new_output)
    task = user_input
    result = phase_chain.invoke({"task": task, "subtasks": subtasks})
    phase_dict = {}
    for i in range(1, len(new_output)+1):
        phase_dict[i] = find_phase_for_subtask(result, i)

    # Step 3: Phase naming
    phase_summary_chain = phase_summary_prompt_template | phase_summary_model | parser
    phase_groups = {}
    for i in range(len(phase_dict)):
        key = list(phase_dict.keys())[i]
        phase = phase_dict[key]
        if phase not in phase_groups.keys():
            phase_groups[phase] = [i+1]
        else:
            phase_groups[phase].append(i+1)

    phase_tasks = {}
    for group in phase_groups.keys():
        subtasks_descriptions = new_output[phase_groups[group][0]-1].split("task_description: ")[1].split("expected input")[0]
        for idx in range(len(phase_groups[group][1:])):
            subtask_idx = phase_groups[group][1:][idx]
            subtasks_descriptions = subtasks_descriptions + "and " + new_output[subtask_idx-1].split("task_description: ")[1].split("expected input")[0]
        phase_tasks[group] = phase_summary_chain.invoke({"subtask_descriptions": subtasks_descriptions})

    
    # Step 3: Process each subtask with AI-human collaboration
    flow_outputs = []
    for i in range(len(new_output)):
        current_task = new_output[i]
        subtasks = ""
        for j, task in enumerate(new_output[:i] + new_output[i+1:]):
            subtasks += f"Subtask {chr(65 + j)}: '{task.strip()}';\n"
        flow_chain = flow_prompt_template | flow_model | parser
        flow_output = flow_chain.invoke({"current_task": current_task, "subtasks": subtasks})
        flow_outputs.append(flow_output)
    flow_result = [transform_to_dict(flow_outputs[i].split("\n")) for i in range(len(flow_outputs))]

    # Combine the outputs into the final result
    final_output = {}
    for i in range(len(new_output)):
        final_output[f"Subtask {chr(65 + i)}"] = {
            "description": new_output[i].split("task_description: ")[1].split(", expected input")[0],
            # "workflow": flow_outputs[i],
            "workflow": flow_result[i],
            "phase": phase_dict[i+1]
        }

    response = {
        "wf": final_output,
        "phase_names": phase_tasks  # Return the second variable here
    }
    return jsonify(response)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)