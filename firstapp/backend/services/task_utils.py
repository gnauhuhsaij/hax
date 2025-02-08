import boto3
import json

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
