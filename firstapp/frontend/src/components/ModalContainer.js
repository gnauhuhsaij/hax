import React, { useState, useEffect, useContext } from "react";
import "../styles/ModalContainer.css"; // Adjust the path to the styles folder
import axios from "axios";
import CONFIG from "../config";
import { motion } from "framer-motion";
import { AuthContext } from "../contexts/AuthContext";
import ReactMarkdown from "react-markdown";

const ModalContainer = ({
  isLoading,
  step,
  phaseIndex,
  subtaskIndex,
  stepIndex,
  context,
  evidence,
  classification,
  markFetched,
  markEvidenceField,
  hasSummary,
  summaryContent,
  handleOpenFromModal,
}) => {
  const {
    user,
    currentWorkflow,
    setCurrentWorkflow,
    currentWorkflowName,
    workflowId,
    setWorkflowId,
    modalCacheData,
    setModalCacheData,
    saveModalCacheDebounced,
  } = useContext(AuthContext);
  const [chatHistory, setChatHistory] = useState([
    {
      sender: "agent",
      text: "Initializing chat... Please wait.",
    },
  ]); // Store chat messages with a placeholder
  const [userInput, setUserInput] = useState("");
  const [appId, setAppId] = useState(null); // Store app_id for the session
  const [selectedLink, setSelectedLink] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [responses, setResponses] = useState({});
  const [fetchLoading, setFetchLoading] = useState(Array(10).fill(false));
  const [memoryStatus, setMemoryStatus] = useState({});
  const [endChat, setEndChat] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [synthesis, setSynthesis] = useState(summaryContent);
  const [reviseSynthesisMode, setReviseSynthesisMode] = useState(false);
  const [editedSynthesis, setEditedSynthesis] = useState(summaryContent); // editable buffer
  const [isSaving, setIsSaving] = useState(false);
  const isAnyLoading = fetchLoading.some((loading) => loading === true);
  const [localHasSummary, setLocalHasSummary] = useState(hasSummary);
  const [displayedEvidence, setDisplayedEvidence] = useState([]); // max 10 at once
  const [queueEvidence, setQueueEvidence] = useState([]); // remaining pool

  useEffect(() => {
    // Reset all stateful data when subtask/step changes
    setResponses({});
    setFetchLoading(Array(10).fill(false));
    setMemoryStatus({});
    setEndChat(false);
    setAppId(null);
    setChatHistory([
      {
        sender: "agent",
        text: "Initializing chat... Please wait.",
      },
    ]);
  }, [subtaskIndex, stepIndex]);

  useEffect(() => {
    if (currentPage === 1) {
      setIsSaving(false);
    }
  }, [currentPage]);

  useEffect(() => {
    if (evidence?.length) {
      setDisplayedEvidence(evidence.slice(0, 10));
      setQueueEvidence(evidence.slice(10, 30));
    }
  }, [evidence]);

  useEffect(() => {
    displayedEvidence.forEach((item, index) => {
      if (!item.fetched) {
        fetchEvidence(item.link, index);
      }
    });
  }, [displayedEvidence]);

  const handleEvidenceResult = (index, responses) => {
    const strongCount = responses.filter((r) => r.score > 0.4).length;

    if (strongCount === 0) {
      // Need to replace this evidence if possible
      if (queueEvidence.length > 0) {
        const replacement = queueEvidence[0];
        setQueueEvidence((prev) => prev.slice(1)); // drop from queue
        setDisplayedEvidence((prev) => {
          const newArr = [...prev];
          newArr[index] = replacement;
          return newArr;
        });
      }
    } else {
      // Mark it as valid (don’t replace anymore)
      setDisplayedEvidence((prev) => {
        const newArr = [...prev];
        newArr[index] = { ...newArr[index], valid: true };
        return newArr;
      });
    }
  };

  const evidenceKey = `${phaseIndex}-${subtaskIndex}-${stepIndex}`;
  const fetchEvidence = async (link, index) => {
    setFetchLoading((prev) => {
      const newLoading = [...prev];
      newLoading[index] = true;
      return newLoading;
    });
    try {
      // console.log(context);
      // console.log(link);
      // console.log(evidence);
      const response = await axios.post(`${CONFIG.BACKEND_URL}/api/scrape`, {
        prompt: context, // Send context as prompt
        url: link, // Send URL for scraping
      });
      // console.log(response.data.evidence);

      if (response.status === 200) {
        const evidences = response.data.evidence;
        setResponses((prev) => ({
          ...prev,
          [index]: response.data.evidence, // Store response for this evidence item
        }));

        let n_evidenceFetched = 0;
        evidences.forEach((text, i) => {
          if (text.score > 0.4 && !memoryStatus[`${index}-${i}`]) {
            addEvidenceToMemory(text.text, `${index}-${i}`, false, link);
            n_evidenceFetched += 1;
          }
        });
        if (evidences.length === 0) {
          n_evidenceFetched = -1;
          // Need to replace this evidence if possible
          if (queueEvidence.length > 0) {
            const replacement = queueEvidence[0];
            setQueueEvidence((prev) => prev.slice(1)); // drop from queue
            setDisplayedEvidence((prev) => {
              const newArr = [...prev];
              newArr[index] = replacement;
              return newArr;
            });
          } else {
            // Mark it as valid (don’t replace anymore)
            setDisplayedEvidence((prev) => {
              const newArr = [...prev];
              newArr[index] = { ...newArr[index], valid: true };
              return newArr;
            });
          }
        } else {
          // console.log("markFetched is:", markFetched);
          // console.log("type:", typeof markFetched);
          if (typeof markFetched === "function") {
            markFetched(index, evidenceKey);
            console.log(1);
          }
          if (typeof markEvidenceField == "function") {
            markEvidenceField(evidenceKey, index, {
              nFetched: n_evidenceFetched,
            });
          }
        }
      }
    } catch (error) {
      console.log("Error fetching evidence:", error);
      setResponses((prev) => ({
        ...prev,
        [index]: ["Failed to retrieve evidence."], // Display an error message
      }));
    } finally {
      setFetchLoading((prev) => {
        const newLoading = [...prev];
        newLoading[index] = false;
        return newLoading;
      });
    }
  };

  const sendMessage = async () => {
    try {
      let response;

      if (!appId) {
        // First request to initialize the chat
        response = await axios.post(`${CONFIG.BACKEND_URL}/api/chat`, {
          nested_tasks: step.name,
        });

        if (response.status === 200) {
          const { app_id, responses } = response.data;
          setAppId(app_id); // Save the app_id for future requests
          const initialResponse = {
            sender: "agent",
            text: responses, // Adjust based on actual response format
          };
          // Replace the placeholder message with the actual response
          setChatHistory([initialResponse]);
        } else {
          console.error("Failed to initialize chat:", response.data.error);
          setChatHistory((prev) => [
            ...prev,
            { sender: "agent", text: "Failed to initialize chat." },
          ]);
        }
      }
    } catch (error) {
      console.error("Error in chat initialization:", error);
      setChatHistory((prev) => [
        ...prev,
        { sender: "agent", text: "Error occurred during initialization." },
      ]);
    }
  };

  // 1. 对话chatbot

  useEffect(() => {
    if (classification === "Gather information from user") {
      sendMessage(); // Only send message if classification matches
    }
  }, [classification]); // Empty dependency array ensures it runs only once

  const handleUserInput = async () => {
    if (!userInput.trim()) return;

    const userMessage = { sender: "user", text: userInput };
    setChatHistory((prev) => [...prev, userMessage]);
    setUserInput("");

    try {
      const response = await axios.post(`${CONFIG.BACKEND_URL}/api/chat2`, {
        app_id: appId,
        user_response: userInput,
      });

      if (response.status === 200) {
        const { responses } = response.data;

        let endDetected = false;
        let cleanText = responses;

        if (responses.trim().endsWith("[END]")) {
          endDetected = true;
          cleanText = responses.trim().slice(0, -5).trim(); // remove "[END]"
        }

        const agentMessage = {
          sender: "agent",
          text: cleanText,
        };

        setChatHistory((prev) => [...prev, agentMessage]);

        if (endDetected) {
          setEndChat(true);
        }
      } else {
        console.error("Failed to send message:", response.data.error);
      }
    } catch (error) {
      console.error("Error in chat communication:", error);
    }
  };

  const addEvidenceToMemory = async (
    evidenceText,
    uniqueKey,
    isSynthesis = false,
    source = null
  ) => {
    // console.log(subtaskIndex, stepIndex, step.name);
    // console.log("Adding Evidence to memory:", {
    //   evidence: evidenceText,
    //   userId: user?.id,
    //   workflowId: workflowId,
    //   isSynthesis,
    // });

    const fallbackUserId = user?.id || `guest-${Date.now()}`;
    const fallbackWorkflowId = workflowId || `workflow-${Date.now()}`;

    try {
      const response = await axios.post(
        `${CONFIG.BACKEND_URL}/api/add_evidence`,
        {
          evidence: evidenceText,
          userid: fallbackUserId,
          workflowid: fallbackWorkflowId,
          subtask_index: subtaskIndex,
          step_index: stepIndex,
          query_name: step.name,
          isSynthesis: isSynthesis, // or just "isSynthesis," since key and value match
          source: source,
        }
      );

      if (response.status === 200) {
        setMemoryStatus((prev) => ({ ...prev, [uniqueKey]: true }));
      } else {
        alert("Failed to add evidence to memory.");
      }
    } catch (error) {
      console.error("Add to memory failed:", error);
      // alert("Error while adding to memory.");
    }
  };

  const handleMarkIP = async () => {
    console.log(2);
    if (!currentWorkflow) return;

    let wfObj =
      typeof currentWorkflow === "string"
        ? JSON.parse(currentWorkflow)
        : currentWorkflow;
    const wfArray = Object.values(wfObj);
    console.log(wfArray);
    console.log(1);

    const getRealSubtaskIndex = (phaseIndex, subtaskIndex, workflow) => {
      if (!workflow || !Array.isArray(workflow)) return 10;

      // Count all subtasks that belong to earlier phases
      let count = 0;
      for (let i = 0; i < workflow.length; i++) {
        if (workflow[i].phase - 1 < phaseIndex) {
          count++;
        }
      }

      return count + subtaskIndex;
    };
    const sortedWfArray = [...wfArray].sort((a, b) => a.phase - b.phase);
    console.log(sortedWfArray);
    const updatedArray = sortedWfArray.map((subtask, sI) => {
      const real_subtask_index = getRealSubtaskIndex(
        phaseIndex,
        subtaskIndex,
        wfArray
      );
      console.log(
        `[MarkInProgress] Checking subtask: sI=${sI}, expected subtaskIndex=${real_subtask_index}`
      );
      console.log("AAA", phaseIndex, subtaskIndex, real_subtask_index);
      if (sI === real_subtask_index) {
        console.log(
          `[MarkInProgress] ✅ Match found at subtaskIndex=${subtaskIndex}, phaseIndex=${phaseIndex}`
        );
        console.log(subtask);

        const newSteps = subtask.steps.map((st, idx) => {
          if (idx === stepIndex) {
            if (st.status !== "Finished") {
              console.log("[MarkInProgress] Found step before update:", st);
              const updatedStep = { ...st, status: "In Progress" };
              console.log("[MarkInProgress] Step after update:", updatedStep);
              return updatedStep;
            }
          }
          return st;
        });
        return { ...subtask, steps: newSteps };
      }

      return subtask;
    });

    // Push back into context
    setCurrentWorkflow(JSON.stringify(updatedArray));

    // Re-combine with modalCacheData before upload
    saveModalCacheDebounced(600, modalCacheData);
  };

  useEffect(() => {
    handleMarkIP();
    console.log(summaryContent);
  }, []);

  if (classification === "Gather information from user") {
    return (
      <div
        className="modal-container user"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="chat-container">
          <div className="chat-header">Gather Information about ...</div>
          <div className="chat-history">
            {chatHistory.map((message, index) => {
              const isLastMessage = index === chatHistory.length - 1;
              const isAgent = message.sender === "agent";
              const memoryKey = `${index}-0`;

              return (
                <div
                  key={index}
                  className={`chat-message ${
                    message.sender === "user" ? "user-message" : "agent-message"
                  }`}
                >
                  {/* {isAgent && (
                    <img
                      src="icons/hax.png"
                      alt="hax"
                      className="icon-circle agent-icon"
                    />
                  )} */}
                  <div
                    className={`message-text ${
                      message.sender === "user" ? "user" : "agent"
                    }`}
                  >
                    {message.text}

                    {/* Add-to-memory icon (unchanged) */}
                    {isLastMessage && isAgent && endChat && (
                      <img
                        src={
                          memoryStatus[memoryKey]
                            ? "icons/added_evidence.png"
                            : "icons/add_evidence.png"
                        }
                        alt="Add to Memory"
                        title={
                          memoryStatus[memoryKey]
                            ? "Already Added to Memory"
                            : "Add to Memory"
                        }
                        onClick={() => {
                          if (!memoryStatus[memoryKey]) {
                            addEvidenceToMemory(message.text, memoryKey, true);
                          }
                        }}
                        style={{
                          marginLeft: "10px",
                          cursor: memoryStatus[memoryKey]
                            ? "default"
                            : "pointer",
                          height: "20px",
                          width: "20px",
                          opacity: memoryStatus[memoryKey] ? 0.5 : 1,
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>

                  {/* Inline input appears right after the last agent message */}
                  {isLastMessage && isAgent && !endChat && (
                    <div className="chat-input-inline">
                      <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder="Type your reply..."
                      />
                      <button
                        onClick={() => {
                          handleUserInput(); // pushes new user message to chatHistory
                        }}
                      >
                        <img
                          src="icons/send.svg"
                          alt="Send"
                          className="sendIcon"
                        />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {/* <div className="chat-input">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your message..."
            />
            <button onClick={handleUserInput}>
              {" "}
              <img
                src="icons/send.svg"
                alt="Send"
                className="chat-input-button"
              ></img>
            </button>
          </div> */}
        </div>
      </div>
    );
  }

  //2. 搜索+总结
  if (classification !== "Gather information from external sources") {
    // console.log(evidence);
    return (
      <div
        className="modal-container"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="placeholder-content">
          {/* <h2>Coming Soon</h2>
          <p>Details for classif\\ication: {classification}</p> */}
          <h2>{evidence[0]?.snippet}</h2>
        </div>
      </div>
    );
  }

  const handleMarkFinished = async () => {
    if (!currentWorkflow) return;

    let wfObj =
      typeof currentWorkflow === "string"
        ? JSON.parse(currentWorkflow)
        : currentWorkflow;
    const wfArray = Object.values(wfObj);
    console.log(wfArray);
    const sortedWfArray = [...wfArray].sort((a, b) => a.phase - b.phase);
    console.log(sortedWfArray);
    const updatedArray = sortedWfArray.map((subtask, sI) => {
      console.log(
        `[MarkFinished] Checking subtask: sI=${sI}, expected subtaskIndex=${subtaskIndex}, subtask.phase=${subtask.phase}, expected phaseIndex=${phaseIndex}`
      );

      if (sI === subtaskIndex && subtask.phase === phaseIndex + 1) {
        console.log(
          `[MarkFinished] ✅ Match found at subtaskIndex=${subtaskIndex}, phaseIndex=${phaseIndex}`
        );

        const newSteps = subtask.steps.map((st, idx) => {
          if (idx === stepIndex) {
            console.log("[MarkFinished] Found step before update:", st);
            const updatedStep = { ...st, status: "Finished" };
            console.log("[MarkFinished] Step after update:", updatedStep);
            return updatedStep;
          }
          return st;
        });
        return { ...subtask, steps: newSteps };
      }

      return subtask;
    });

    // Push back into context
    setCurrentWorkflow(JSON.stringify(updatedArray));

    // Re-combine with modalCacheData before upload
    saveModalCacheDebounced(600, modalCacheData);
  };

  const handleMarkSummary = () => {
    setModalCacheData((prev) => {
      const oldEntry = prev[evidenceKey] || {};
      const updatedEntry = { ...oldEntry, hasSummary: true };

      const next = { ...prev, [evidenceKey]: updatedEntry };
      console.log("[ModalContainer] Updating hasSummary:", next);
      saveModalCacheDebounced(600, next); // persist to S3
      return next;
    });
  };

  const handleSaveAndNext = async () => {
    setIsSaving(true);
    const fallbackUserId = user?.id || `guest-${Date.now()}`;
    const fallbackWorkflowId = workflowId || `workflow-${Date.now()}`;

    const dependencies = step.dependence
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // if (!dependencies?.length) {
    //   setCurrentPage(2);
    //   return;
    // }

    const collectedResponses = [];

    try {
      if (dependencies?.length) {
        for (const dep of dependencies) {
          let subtaskIndexToSend, stepIndexToSend;

          if (/^\d+x$/.test(dep)) {
            subtaskIndexToSend = parseInt(dep);
            stepIndexToSend = 0;
          } else if (/^\d+$/.test(dep)) {
            subtaskIndexToSend = subtaskIndex;
            stepIndexToSend = parseInt(dep);
          } else {
            console.warn("Skipping invalid dependence:", dep);
            continue;
          }

          const response = await axios.post(
            `${CONFIG.BACKEND_URL}/api/depend_step`, // <- Your first API
            {
              workflowid: fallbackWorkflowId,
              userid: fallbackUserId,
              subtask_index: subtaskIndexToSend,
              step_index: stepIndexToSend,
            }
          );

          if (response.status === 200) {
            collectedResponses.push({
              subtask_index: subtaskIndexToSend,
              step_index: stepIndexToSend,
              evidence: response.data.evidence, // or adjust key
            });
          } else {
            console.warn("Dependency API failed for", dep);
          }
        }
      }

      const collectedEvidence = await axios.post(
        `${CONFIG.BACKEND_URL}/api/depend_step`, // <- Your first API
        {
          workflowid: fallbackWorkflowId,
          userid: fallbackUserId,
          subtask_index: subtaskIndex,
          step_index: stepIndex,
        }
      );

      // ✅ Now send everything to the second API
      const finalResponse = await axios.post(
        `${CONFIG.BACKEND_URL}/api/rag_dependence_synthesis`, // <- Your second API
        {
          query: step.name,
          dependencies: collectedResponses,
          evidence: collectedEvidence.data.evidence,
        }
      );

      if (finalResponse.status === 200) {
        setCurrentPage(2); // Go to next page
        // console.log(finalResponse.data.synthesized_evidence);
        // console.log(step.name);
        setSynthesis(finalResponse.data.synthesized_evidence);
        setModalCacheData((prev) => {
          const oldEntry = prev[evidenceKey] || {};
          const updatedEntry = {
            ...oldEntry,
            summaryContent: finalResponse.data.synthesized_evidence,
          };

          const next = { ...prev, [evidenceKey]: updatedEntry };
          console.log("[ModalContainer] Updating summaryContent:", next);
          saveModalCacheDebounced(600, next); // persist to S3
          return next;
        });
      } else {
        alert("Failed to submit dependencies.");
      }
    } catch (error) {
      console.error("Error processing dependencies:", error);
      alert("Something went wrong during submission.");
    } finally {
      setIsSaving(false);
      handleMarkSummary();
      setLocalHasSummary(true);
    }
  };

  const handleKeyDown = (e, link) => {
    if (e.key === " " || e.keyCode === 32) {
      e.preventDefault(); // Prevent scrolling
      setSelectedLink(link);
      setIsModalOpen(true);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // Content for "Gather information from external sources"
  return (
    <div
      className="modal-container"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "12%",
          right: "10px", // adjust for your layout
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          zIndex: "30",
        }}
      >
        {/* Circle 1 (always visible) */}
        <div
          onClick={() => setCurrentPage(1)}
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: currentPage === 1 ? "#333" : "#ccc",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "14px",
          }}
        >
          1
        </div>

        {/* Circle 2 (only when hasSummary === true) */}
        {modalCacheData?.[evidenceKey]?.hasSummary && (
          <div
            onClick={() => setCurrentPage(2)}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: currentPage === 2 ? "#333" : "#ccc",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            2
          </div>
        )}
      </div>
      {/* {localHasSummary === true ? <p>a</p> : <p>b</p>} */}
      {currentPage === 1 ? (
        isLoading ? (
          <div className="search-header">
            <h2>Loading...</h2>
            <h4>Please wait while we fetch search results for {step.name}.</h4>
          </div>
        ) : (
          <>
            <div className="search-header">
              <h2>Here’s what we found for you</h2>
              <h4>10 results based on Google search</h4>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "75%",
                gap: "20px",
                overflow: "auto",
                padding: "2vh 2vw 2vh 2vw",
                maskImage:
                  "linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 1) 4%, rgba(0, 0, 0, 1) 96%, rgba(0, 0, 0, 0) 100%)",
              }}
            >
              {evidence?.length
                ? displayedEvidence.map((item, index) => (
                    <div
                      role="button"
                      key={index}
                      className="evidence-container"
                      tabIndex={0} // Allow focus for keyboard events
                      onKeyDown={(e) => handleKeyDown(e, item.link)}
                      onKeyUp={(e) => closeModal()}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "row",
                          gap: "5px",
                        }}
                      >
                        <img
                          src={item.favicon}
                          alt={
                            "https://serpapi.com/searches/68cc6189f0527577026d486e/images/414af87a276593c9b4187120a26ec4e796f799186336196e235b14f47b46c586.png"
                          }
                          className="evidence-favicon"
                          onError={(e) => (e.target.style.display = "none")} // Hide the image if the favicon is not found
                        />
                        <div className="evidence-link">
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            tabIndex={-1}
                          >
                            {item.link && item.link.startsWith("http")
                              ? new URL(item.link).hostname
                              : "Invalid Link"}
                          </a>
                        </div>
                      </div>
                      <div className="evidence-title">{item.title}</div>
                      <div className="evidence-snippet">{item.snippet}</div>
                      <div className="lastRow">
                        <button
                          className="preview-button"
                          style={{
                            position: "absolute",
                            left: "0px",
                            borderRadius: "250px",
                            background: "#f2f0f0",
                            width: "15%",
                            padding: "10px",
                            fontSize: "12px",
                            fontWeight: "800",
                          }}
                        >
                          Preview
                        </button>
                        <div
                          className="fetch-evidence-button"
                          style={{
                            borderRadius: "5px",
                            color: fetchLoading[index] ? "#555" : "#aaa8a8",
                            width: "100%",
                            padding: "10px",
                            fontSize: "12px",
                            cursor: fetchLoading[index]
                              ? "not-allowed"
                              : "pointer",
                            display: "flex",
                            alignItems: "flex-end",
                            justifyContent: "flex-end",
                          }}
                        >
                          {item.fetched ? (
                            evidence[index]?.nFetched >= 0 ? (
                              <span
                                style={{
                                  textDecoration: "underline",
                                  cursor: "pointer",
                                  color: "blue",
                                }}
                                onClick={() => handleOpenFromModal(item.link)}
                              >
                                {`${evidence[index]?.nFetched} pieces fetched`}
                              </span>
                            ) : (
                              "Unable to fetch"
                            )
                          ) : fetchLoading[index] ? (
                            <span
                              className="spinner"
                              style={{ animation: "spin 1s linear infinite" }}
                            >
                              ⚙️
                            </span>
                          ) : responses[index] &&
                            responses[index].length > 0 ? (
                            (() => {
                              const greenCount = responses[index].filter(
                                (text) => text.score > 0.4
                              ).length;
                              return greenCount > 0
                                ? `${greenCount} pieces`
                                : "No strong evidence";
                            })()
                          ) : (
                            "Unable to fetch"
                          )}
                        </div>
                      </div>
                      {responses[index] && (
                        <div className="retrieved-evidences">
                          {responses[index].map((text, i) => (
                            <div className="retrieved-evidence" key={i}>
                              <div
                                className={`score-bar ${
                                  text.score > 0.4
                                    ? "good"
                                    : text.score > 0.3
                                    ? "med"
                                    : ""
                                }`}
                              ></div>
                              <div className="retrieved-evidence-text">
                                <p key={i}>{text.text}</p>
                              </div>

                              <img
                                src={
                                  memoryStatus[`${index}-${i}`]
                                    ? "icons/added_evidence.png"
                                    : "icons/add_evidence.png"
                                }
                                alt="Add to Memory"
                                title={
                                  memoryStatus[`${index}-${i}`]
                                    ? "Already Added to Memory"
                                    : "Add to Memory"
                                }
                                onClick={() => {
                                  if (!memoryStatus[`${index}-${i}`]) {
                                    addEvidenceToMemory(
                                      text.text,
                                      `${index}-${i}`,
                                      false,
                                      item.link
                                    );
                                  }
                                }}
                                style={{
                                  marginLeft: "10px",
                                  cursor: memoryStatus[`${index}-${i}`]
                                    ? "default"
                                    : "pointer",
                                  height: "20px",
                                  width: "20px",
                                  opacity: memoryStatus[`${index}-${i}`]
                                    ? 0.5
                                    : 1,
                                  flexShrink: 0,
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                : "Click the role circle to fetch evidence."}
            </div>
            <div className="button-container">
              <div
                className="save-button"
                onClick={isAnyLoading ? undefined : handleSaveAndNext}
                style={{
                  cursor: isAnyLoading ? "not-allowed" : "pointer",
                  opacity: isAnyLoading ? 0.5 : 1,
                }}
              >
                {currentPage === 1 && isSaving ? (
                  <span
                    className="spinner"
                    style={{ animation: "spin 1s linear infinite" }}
                  >
                    ⚙️
                  </span>
                ) : (
                  "Save and next"
                )}
              </div>
            </div>
          </>
        )
      ) : (
        <motion.div
          key={reviseSynthesisMode ? "edit" : "view"}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="second-page-content"
        >
          <div className="stepTag">Step {stepIndex + 1}</div>
          <div className="goal">Goal: {step.name?.split(": ")[1]}</div>
          {reviseSynthesisMode ? (
            <>
              <div className="reviseContainer2">
                <p>Edit Your Summary:</p>
                <textarea
                  value={editedSynthesis}
                  onChange={(e) => setEditedSynthesis(e.target.value)}
                  placeholder="Revise the synthesis here..."
                  className="reviseInput"
                />
              </div>
              <button
                className="generate2"
                onClick={() => {
                  setSynthesis(editedSynthesis);
                  setReviseSynthesisMode(false);
                }}
              >
                Complete
              </button>
            </>
          ) : (
            <>
              <div className="synthesisText">
                <ReactMarkdown>{synthesis}</ReactMarkdown>
              </div>
              <div className="buttonRow">
                <button
                  className="backAndRevise2"
                  onClick={() => {
                    setEditedSynthesis(synthesis);
                    setReviseSynthesisMode(true);
                  }}
                >
                  Back and Revise
                </button>
                <button
                  className="generate2"
                  onClick={() => {
                    if (!memoryStatus["synthesis"]) {
                      addEvidenceToMemory(synthesis, "synthesis", true, null);
                    }
                    handleMarkFinished();
                  }}
                  title={
                    memoryStatus["synthesis"]
                      ? "Already Added to Memory"
                      : "Add to Memory"
                  }
                  style={{
                    opacity: memoryStatus["synthesis"] ? 0.5 : 1,
                    cursor: memoryStatus["synthesis"] ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  Mark Complete
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}
      {isModalOpen && (
        <div className="preview-modal">
          <div className="modal-content">
            <iframe
              src={selectedLink}
              onError={() => window.open(selectedLink, "_blank")}
              title="Preview"
              className="preview-iframe"
            ></iframe>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModalContainer;
