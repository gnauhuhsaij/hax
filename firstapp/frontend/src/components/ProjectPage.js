import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import Workflow from "./Workflow";
import "../styles/ProjectPage.css"; // Adjust the path to the styles folder
import { AuthContext } from "../contexts/AuthContext";
import { motion } from "framer-motion";
import CONFIG from "../config";

const ProjectPage = () => {
  const { user, currentWorkflow, setCurrentWorkflow, currentWorkflowName, setWorkflowId } =
    useContext(AuthContext); // Get user ID from AuthContext
  const [appId, setAppId] = useState(0);
  const [input, setInput] = useState("");
  const [workflow, setWorkflow] = useState(null);
  const [phaseNames, setPhaseNames] = useState(null); // Track phase names in state
  const [workflowName, setWorkflowName] = useState(null);
  const [loading, setLoading] = useState(false); // Track loading state
  const [clickCount, setClickCount] = useState(0); // Track button clicks
  const [textPlaceHolder, setTextPlaceHolder] = useState(
    "Tell us a task that you want to do in one sentence, and we will figure it out steps by steps!"
  );
  const [centerMessage, setCenterMessage] = useState(
    `Hey ${(user?.name?.split(" ")[0] || "Lydia").slice(
      0,
      12
    )}, what do you want to do in this project?`
  ); // Center message
  const [formattedMessage, setFormattedMessage] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState(null);
  const [digHistory, setDigHistory] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [promptTags, setPromptTags] = useState([]);
  const [summaryMode, setSummaryMode] = useState(false);
  const [reviseMode, setReviseMode] = useState(false);

  //渐进渐出
  useEffect(() => {
    setTimeout(() => {
      setIsVisible(true);
    }, 100); // Small delay before fade-in
  }, []);

  // Summary Mode
  useEffect(() => {
    if (reviseMode) {
      setInput(centerMessage);
    }
  }, [reviseMode]);

  // Recommendations
  useEffect(() => {
    setLoadingRecommendations(true);
    axios
      .post(`${CONFIG.BACKEND_URL}/api/get_rec`, {
        response: digHistory,
        prompt: originalPrompt,
      })
      .then((res) => {
        setRecommendations(res.data.recommendations); // Store list of recommendations
        console.log("Recommendations:", {
          recommendations,
          digHistory,
          originalPrompt,
        });
      })
      .catch((error) => {
        console.error("Error fetching recommendations:", error);
      })
      .finally(() => {
        setLoadingRecommendations(false);
      });
  }, [digHistory]);

  useEffect(() => {
    if (currentWorkflow) {
      console.log(workflow);
      console.log(JSON.stringify(currentWorkflow));
      setWorkflow(JSON.parse(currentWorkflow));
    }
    if (currentWorkflowName) setWorkflowName(JSON.parse(currentWorkflowName));
  }, [currentWorkflow]);

  useEffect(() => {
    autoResizeTextarea();
  }, [input]);

  const textareaRef = useRef(null);

  const handleChange = (e) => {
    setInput(e.target.value);
    autoResizeTextarea();
  };

  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto"; // reset height
      textarea.style.height = `${textarea.scrollHeight}px`; // set to scroll height
    }
  };

  const uploadWorkflowToS3 = async (workflowData, workflowName) => {
    if (!user) return; // Ensure user is logged in

    try {
      await axios.post(`${CONFIG.BACKEND_URL}/api/upload_workflows`, {
        user_id: user.id, // Unique Google user ID
        workflow: workflowData,
        workflowName: workflowName,
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
      setPromptTags(
        (prevTags) =>
          prevTags.includes(input)
            ? prevTags.filter((tag) => tag !== input) // Remove if already selected
            : [...prevTags, input] // Add if not selected
      );
      if (clickCount === 0) {
        const response = await axios.post(`${CONFIG.BACKEND_URL}/api/dig`, {
          prompt: input,
        });
        const { app_id, responses } = response.data;
        setAppId(app_id);
        setInput("");
        setCenterMessage(responses);
        setOriginalPrompt(input);
        setDigHistory(`AgentQuestion: ${responses}\nUser response: ${input}`);
      } else if (clickCount === 1) {
        const response = await axios.post(`${CONFIG.BACKEND_URL}/api/dig2`, {
          app_id: appId,
          user_response: input,
        });
        const { responses } = response.data;
        setInput("");
        setCenterMessage(responses);
        setDigHistory(
          (prev) =>
            `${prev}\nAgentQuestion: ${responses}\nUser response: ${input}`
        );
      } else {
        const response1 = await axios.post(`${CONFIG.BACKEND_URL}/api/dig2`, {
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
        setSummaryMode(true);
        // // On the third click, make the original API call
      }
    } catch (error) {
      console.error("Error during submission:", error);
    } finally {
      setClickCount((prevCount) => prevCount + 1); // Increment click count
      setLoading(false); // Stop loading
    }
  };

  const send2Process = async () => {
    if (!input.trim()) return; // Prevent empty input submission
    setLoading(true); // Start loading
    try {
      const response2 = await axios.post(
        `${CONFIG.BACKEND_URL}/api/process`,
        { user_input: centerMessage },
        { headers: { "Content-Type": "application/json" } }
      );

      const response_workflowName = await axios.post(
        `${CONFIG.BACKEND_URL}/api/get_name`,
        { user_input: centerMessage },
        { headers: { "Content-Type": "application/json" } }
      );

      const { app_id, workflow_id, workflow_name } = response_workflowName.data;
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
      setWorkflowName(workflow_name);
      setWorkflowId(workflow_id);

      uploadWorkflowToS3(JSON.stringify(parsedWorkflow), workflow_name);

      // Save workflow and phase names to localStorage
      setCurrentWorkflow(JSON.stringify(parsedWorkflow));
    } catch (error) {
      console.error("Error during submission:", error);
    } finally {
      setLoading(false); // Stop loading
    }
  };

  const handleTagToggle = (rec) => {
    setInput(rec);
  };

  useEffect(() => {
    const userName = (user?.name?.split(" ")[0] || "Lydia").slice(0, 12);
    const words = centerMessage.split(" ").map((word, index) =>
      word === userName + "," ? (
        <>
          <strong key={index}>&nbsp;{word.split(",")[0]}</strong>
          <span>,</span>
        </>
      ) : (
        <span key={index}> {word} </span>
      )
    );

    setFormattedMessage(words);
  }, [centerMessage, user]);

  return (
    <div className={`null-wrapper ${isVisible ? "visible" : ""}`}>
      {!workflow ? (
        <div className="content-wrapper">
          {summaryMode ? (
            <motion.div
              key={centerMessage} // Triggers animation on change
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className={`center-message summary`}
            >
              {reviseMode ? (
                <>
                  <p>Revise Your Prompt:</p>
                  <div className="reviseContainer">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={handleChange}
                      placeholder={textPlaceHolder}
                      className="reviseInput"
                    />
                  </div>
                  <button
                    className="generate"
                    style={{
                      marginTop: "30px",
                    }}
                    onClick={() => {
                      setCenterMessage(input);
                      setReviseMode(false);
                    }}
                  >
                    <p>Finish Revising</p>
                  </button>
                </>
              ) : (
                <>
                  <p>To Recap, You Want To</p>
                  <h2>{centerMessage}</h2>
                  <button
                    className="backAndRevise"
                    onClick={() => setReviseMode(true)}
                  >
                    back and revise
                  </button>
                  <button className="generate" onClick={() => send2Process()}>
                    {loading ? (
                      <span className="spinner"></span>
                    ) : (
                      <p>Generate a Workflow</p>
                    )}
                  </button>
                </>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={centerMessage} // Triggers animation on change
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className={`center-message`}
            >
              <h2>{formattedMessage}</h2>
            </motion.div>
          )}
          <div className={`promptTags ${summaryMode ? "hidden" : ""}`}>
            {[0, 1].map((rowIndex) => (
              <div
                key={rowIndex}
                className={`promptTags-row ${
                  rowIndex === 1 && promptTags.length <= 4 ? "hidden-row" : ""
                }`}
              >
                {Array(4)
                  .fill(null)
                  .map((_, index) => {
                    const tagIndex = rowIndex * 4 + index;
                    const isSelected = promptTags.includes(
                      promptTags[tagIndex]
                    );
                    return tagIndex < promptTags.length && isSelected ? (
                      <button
                        key={tagIndex}
                        className={`promptTag ${loading ? "hidden" : ""} `}
                      >
                        {promptTags[tagIndex].length > 50
                          ? promptTags[tagIndex].slice(0, 50) + "..."
                          : promptTags[tagIndex]}
                      </button>
                    ) : (
                      <div
                        key={`empty-${rowIndex}-${index}`}
                        className="empty-space"
                      ></div>
                    );
                  })}
              </div>
            ))}
          </div>

          {loadingRecommendations ? (
            <div
              className={`recommendations-container ${
                summaryMode ? "hidden" : ""
              }`}
            >
              {[0, 1].map((rowIndex) => (
                <div key={rowIndex} className="recommendation-row">
                  {[
                    "Placeholder rec 1 ............",
                    "Placeholder rec 2 .....",
                    "Placeholder rec 3 ........... ",
                    "Placeholder rec 4...",
                    "Placeholder rec 5 ............... ",
                    "Pl rec 6",
                    "Placeholder rec........... 7",
                    "Placeholderrec 8",
                  ]
                    .slice(rowIndex * 4, rowIndex * 4 + 4)
                    .map((placeholder, index) => (
                      <button
                        key={index}
                        className="recommendation-button loading"
                      >
                        {placeholder}
                      </button>
                    ))}
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`recommendations-container ${
                summaryMode ? "hidden" : ""
              }`}
            >
              {[0, 1].map((rowIndex) => (
                <div key={rowIndex} className="recommendation-row">
                  {recommendations
                    .slice(rowIndex * 4, rowIndex * 4 + 4)
                    .map((rec, index) => {
                      return (
                        <button
                          key={index}
                          className={`recommendation-button`}
                          onClick={() => handleTagToggle(rec)}
                        >
                          {rec.length > 50 ? rec.slice(0, 50) + "..." : rec}
                        </button>
                      );
                    })}
                </div>
              ))}
            </div>
          )}

          <div className={`input-container ${summaryMode ? "hidden" : ""}`}>
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
        <div>
          <div className="workflow-name">{workflowName}</div>
          <Workflow workflow={workflow} workflowName={workflowName} />
        </div>
      )}
    </div>
  );
};

export default ProjectPage;
