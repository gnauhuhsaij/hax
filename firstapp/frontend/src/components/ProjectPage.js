import React, { useState, useEffect, useContext } from "react";
import axios from "axios";
import Workflow from "./Workflow";
import "../styles/ProjectPage.css"; // Adjust the path to the styles folder
import { AuthContext } from "../contexts/AuthContext";

const ProjectPage = () => {
  const { user, currentWorkflow, setCurrentWorkflow } = useContext(AuthContext); // Get user ID from AuthContext
  const [appId, setAppId] = useState(0);
  const [input, setInput] = useState("");
  const [workflow, setWorkflow] = useState(null);
  const [phaseNames, setPhaseNames] = useState(null); // Track phase names in state
  const [loading, setLoading] = useState(false); // Track loading state
  const [clickCount, setClickCount] = useState(0); // Track button clicks
  const [textPlaceHolder, setTextPlaceHolder] = useState(
    "Tell us a task that you want to do in one sentence, and we will figure it out steps by steps!"
  );
  const [centerMessage, setCenterMessage] = useState(
    "Hey Lydia, what do you want to do in this project?"
  ); // Center message

  useEffect(() => {
    if (currentWorkflow) {
      console.log(workflow);
      console.log(JSON.stringify(currentWorkflow));
      setWorkflow(JSON.parse(currentWorkflow));
    }
  }, [currentWorkflow]);

  const uploadWorkflowToS3 = async (workflowData) => {
    if (!user) return; // Ensure user is logged in

    try {
      await axios.post("http://127.0.0.1:8000/api/upload_workflows", {
        user_id: user.id, // Unique Google user ID
        workflow: workflowData,
      });
      console.log("Workflow uploaded successfully");
    } catch (error) {
      console.error("Error uploading workflow to S3:", error);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim()) return; // Prevent empty input submission
    setLoading(true); // Start loading

    try {
      if (clickCount === 0) {
        // Simulate fetching a response from an API
        const response = await axios.post("http://127.0.0.1:8000/api/dig", {
          prompt: input,
        });
        const { app_id, responses } = response.data;
        setAppId(app_id);
        setInput("");
        setCenterMessage(responses);
      } else if (clickCount === 1) {
        const response = await axios.post("http://127.0.0.1:8000/api/dig2", {
          app_id: appId,
          user_response: input,
        });
        const { responses } = response.data;
        setInput("");
        setCenterMessage(responses);
      } else {
        const response1 = await axios.post("http://127.0.0.1:8000/api/dig2", {
          app_id: appId,
          user_response: input,
        });
        console.log("Response from /api/dig2 on third click:", response1.data);
        const { responses } = response1.data;
        setInput("");
        setTextPlaceHolder(
          "We are good to go! Wait a few more seconds for the workflow to generate."
        );
        setCenterMessage(responses);

        // On the third click, make the original API call
        const response2 = await axios.post(
          "http://127.0.0.1:8000/api/process",
          { user_input: responses },
          { headers: { "Content-Type": "application/json" } }
        );

        const { wf, phase_names } = response2.data;

        const parsedWorkflow = Object.entries(wf).map(
          ([subtaskName, details]) => ({
            name: subtaskName,
            description: details.description,
            steps: details.workflow.map((step) => ({
              name: step.name,
              classification: step.classification,
              execution: step.execution,
            })),
            phase: details.phase,
          })
        );

        setWorkflow(parsedWorkflow); // Set workflow
        setPhaseNames(phase_names); // Set phase names

        uploadWorkflowToS3(JSON.stringify(parsedWorkflow));

        // Save workflow and phase names to localStorage
        setCurrentWorkflow(JSON.stringify(parsedWorkflow));
      }
    } catch (error) {
      console.error("Error during submission:", error);
    } finally {
      setClickCount((prevCount) => prevCount + 1); // Increment click count
      setLoading(false); // Stop loading
    }
  };

  return (
    <div className="null-wrapper">
      {!workflow ? (
        <div className="content-wrapper">
          <div className="center-message">
            <h2>{centerMessage}</h2>
          </div>
          <div className="input-container">
            <input
              type="text"
              placeholder={textPlaceHolder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <span className="spinner"></span>
              ) : (
                <img src="/icons/send.svg" alt="Send" className="send-icon" />
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="workflow-wrapper">
          <Workflow workflow={workflow} phaseDict={phaseNames} />
        </div>
      )}
    </div>
  );
};

export default ProjectPage;
