import React, { useState, useEffect } from "react";
import axios from "axios";
import Workflow from "./Workflow";
import "../styles/ProjectPage.css"; // Adjust the path to the styles folder

const ProjectPage = () => {
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

  // Load workflow and phase names from localStorage on initial render
  useEffect(() => {
    const savedWorkflow = localStorage.getItem("workflow");
    const savedPhaseNames = localStorage.getItem("phaseNames");

    if (savedWorkflow && savedPhaseNames) {
      setWorkflow(JSON.parse(savedWorkflow));
      setPhaseNames(JSON.parse(savedPhaseNames));
    }
  }, []);

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

        // Save workflow and phase names to localStorage
        localStorage.setItem("workflow", JSON.stringify(parsedWorkflow));
        localStorage.setItem("phaseNames", JSON.stringify(phase_names));
      }
    } catch (error) {
      console.error("Error during submission:", error);
    } finally {
      setClickCount((prevCount) => prevCount + 1); // Increment click count
      setLoading(false); // Stop loading
    }
  };

  const handleClearWorkflow = () => {
    setWorkflow(null);
    setPhaseNames(null);
    setInput("");
    setCenterMessage("Hey Lydia, what do you want to do in this project?");
    setClickCount(0); // Reset click count
    localStorage.removeItem("workflow");
    localStorage.removeItem("phaseNames");
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
          <button className="clear-button" onClick={handleClearWorkflow}>
            X
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectPage;
