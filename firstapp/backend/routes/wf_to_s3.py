from flask import Blueprint, request, jsonify
import boto3
import json
import uuid
from flask_cors import cross_origin
from uuid import uuid4

wf_s3_bp = Blueprint("wf_s3", __name__)

# AWS S3 Configuration
S3_BUCKET_NAME = "hax-all-data-test"
s3_client = boto3.client("s3")

@wf_s3_bp.route("/upload_workflows", methods=["POST"])
def upload_s3():
    try:
        data = request.json  # Get JSON data from frontend
        user_id = data.get("user_id")  # Unique Google ID
        workflow = data.get("workflow")  # Workflow data
        workflowName = data.get("workflowName")
        workflow_id = data.get('workflow_id') or str(uuid4()) # Get workflow ID
        
        if not user_id or not workflow or not workflow_id:
            return jsonify({"error": "Missing user_id, workflow, or workflow_id"}), 400

        if isinstance(workflow, str):
            print("Warning: workflow is already a string. Avoiding double encoding.", flush=True)
            workflow_json = workflow  # Keep as is
        else:
            workflow_json = json.dumps(workflow)  # Convert if necessary

        # Create metadata object
        metadata = {
            "workflow_id": workflow_id,
            "workflow_name": workflowName or "",
            "user_id": user_id
        }

        # Generate unique filename
        s3_key = f"{user_id}/{workflowName}/workflow_object.json"

        # Upload to S3
        s3_client.put_object(Bucket=S3_BUCKET_NAME, Key=s3_key, Body=workflow_json, Metadata=metadata)
        
        return jsonify({
            "message": "Workflow saved successfully",
            "s3_path": s3_key,
            "workflow_id": workflow_id
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@wf_s3_bp.route("/get_workflow", methods=["GET"])
def get_workflow():
    user_id = request.args.get("user_id")  # Retrieve from query params
    project_name = request.args.get("project_name")  # Retrieve from query params

    if not user_id or not project_name:
        return jsonify({"error": "Missing user_id or project_name"}), 400

    file_key = f"{user_id}/{project_name}/workflow_object.json"

    try:
        response = s3_client.get_object(Bucket=S3_BUCKET_NAME, Key=file_key)
        workflow_data = json.loads(response["Body"].read().decode("utf-8"))
        workflow_id = response.get("Metadata", {}).get("workflow_id")
        return jsonify({
            "workflow": workflow_data,
            "workflowName": project_name,
            "workflow_id": workflow_id
        }), 200
    except s3_client.exceptions.NoSuchKey:
        return jsonify({"error": "Workflow not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@wf_s3_bp.route("/list_workflows", methods=["GET"])
def list_workflows():
    user_id = request.args.get("user_id")  # Get user ID from frontend

    if not user_id:
        return jsonify({"error": "Missing user_id"}), 400

    try:
        # Get all objects under the user's directory in S3
        response = s3_client.list_objects_v2(Bucket=S3_BUCKET_NAME, Prefix=f"{user_id}/")
        
        if "Contents" not in response:
            return jsonify({"workflows": []})  # No files found

        # Get workflow metadata for each workflow
        workflows = []
        for obj in response["Contents"]:
            try:
                metadata = s3_client.head_object(
                    Bucket=S3_BUCKET_NAME,
                    Key=obj["Key"]
                ).get("Metadata", {})
                
                workflows.append({
                    "name": obj["Key"].split("/")[1],
                    "workflow_id": metadata.get("workflow_id"),
                    "last_modified": obj["LastModified"].isoformat()
                })
            except Exception as e:
                print(f"Error getting metadata for {obj['Key']}: {str(e)}")
                continue

        # Sort by last modified time
        sorted_workflows = sorted(workflows, key=lambda x: x["last_modified"], reverse=True)

        return jsonify({"workflows": sorted_workflows})

    except Exception as e:
        return jsonify({"error": str(e)}), 500