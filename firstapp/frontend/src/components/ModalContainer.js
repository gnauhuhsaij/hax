import React, { useState, useEffect, useContext } from "react";
import "../styles/ModalContainer.css"; // Adjust the path to the styles folder
import axios from "axios";
import CONFIG from "../config";
import { AuthContext } from "../contexts/AuthContext";

const ModalContainer = ({
  isLoading,
  step,
  context,
  evidence,
  classification,
}) => {
  const { user, workflowId } = useContext(AuthContext);
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

  const fetchEvidence = async (link, index) => {
    setFetchLoading((prev) => {
      const newLoading = [...prev];
      newLoading[index] = true;
      return newLoading;
    });
    try {
      console.log(context);
      console.log(link);
      console.log(evidence);
      const response = await axios.post(`${CONFIG.BACKEND_URL}/api/scrape`, {
        prompt: context, // Send context as prompt
        url: link, // Send URL for scraping
      });
      console.log(response.data.evidence);

      if (response.status === 200) {
        setResponses((prev) => ({
          ...prev,
          [index]: response.data.evidence, // Store response for this evidence item
        }));
      }
    } catch (error) {
      console.error("Error fetching evidence:", error);
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

  const autoFetchEvidenceSequentially = async () => {
    if (!evidence || !evidence.length) return;

    for (let i = 0; i < evidence.length; i++) {
      const item = evidence[i];
      await fetchEvidence(item.link, i);
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

  // useEffect(() => {
  //   if (
  //     classification === "Gather information from external sources" &&
  //     !isLoading &&
  //     evidence?.length
  //   ) {
  //     autoFetchEvidenceSequentially();
  //   }
  // }, [classification, isLoading, evidence]);

  useEffect(() => {
    sendMessage(); // Call sendMessage immediately after component mounts
  }, []); // Empty dependency array ensures it runs only once

  const handleUserInput = async () => {
    if (!userInput.trim()) return;

    // Add user message to chat history
    const userMessage = { sender: "user", text: userInput };
    setChatHistory((prev) => [...prev, userMessage]);

    // Clear the input box
    setUserInput("");

    try {
      const response = await axios.post(`${CONFIG.BACKEND_URL}/api/chat2`, {
        app_id: appId,
        user_response: userInput,
      });

      if (response.status === 200) {
        const { responses } = response.data;
        const agentMessage = {
          sender: "agent",
          text: responses, // Adjust based on actual response format
        };
        setChatHistory((prev) => [...prev, agentMessage]);
      } else {
        console.error("Failed to send message:", response.data.error);
      }
    } catch (error) {
      console.error("Error in chat communication:", error);
    }
  };

  if (classification === "Gather information from user") {
    return (
      <div
        className="modal-container user"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="chat-container">
          <div className="chat-history">
            {chatHistory.map((message, index) => (
              <div
                key={index}
                className={`chat-message ${
                  message.sender === "user" ? "user-message" : "agent-message"
                }`}
              >
                {message.sender === "agent" && (
                  <img
                    src="icons/hax.png"
                    alt="hax"
                    className="icon-circle agent-icon"
                  ></img>
                )}
                <div
                  className={`message-text ${
                    message.sender === "user" ? "user" : "agent"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>
          <div className="chat-input">
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
          </div>
        </div>
      </div>
    );
  }

  if (classification !== "Gather information from external sources") {
    return (
      <div
        className="modal-container"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="placeholder-content">
          <h2>Coming Soon</h2>
          <p>Details for classification: {classification}</p>
        </div>
      </div>
    );
  }

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

  const addEvidenceToMemory = async (evidenceText, uniqueKey) => {
    console.log("Adding Evidence to memory:", {
      evidence: evidenceText,
      userId: user?.id,
      workflowId: workflowId,
    });

    if (!user?.id || !workflowId) {
      console.warn("Missing user ID or workflow ID");
      return;
    }

    try {
      const response = await axios.post(
        `${CONFIG.BACKEND_URL}/api/add_evidence`,
        {
          evidence: evidenceText,
          userid: user.id,
          workflowid: workflowId,
        }
      );

      if (response.status === 200) {
        setMemoryStatus((prev) => ({ ...prev, [uniqueKey]: true }));
      } else {
        alert("Failed to add evidence to memory.");
      }
    } catch (error) {
      console.error("Add to memory failed:", error);
      alert("Error while adding to memory.");
    }
  };

  // Content for "Gather information from external sources"
  return (
    <div
      className="modal-container"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {isLoading ? (
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
              ? evidence.slice(0, 20).map((item, index) => (
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
                        src={item.favicon || "/favicon.ico"}
                        alt={"public/icons/favicon.ico"}
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
                          {new URL(item.link).hostname}
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
                      <button
                        key={index}
                        className="fetch-evidence-button"
                        onClick={() => fetchEvidence(item.link, index)}
                        disabled={fetchLoading[index]} // Disable button when loading
                        style={{
                          borderRadius: "5px",
                          color: fetchLoading[index] ? "#555" : "#aaa8a8",
                          width: "10%",
                          padding: "10px",
                          fontSize: "12px",
                          cursor: fetchLoading[index]
                            ? "not-allowed"
                            : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {fetchLoading[index] ? (
                          <span
                            className="spinner"
                            style={{ animation: "spin 1s linear infinite" }}
                          >
                            ⚙️
                          </span>
                        ) : (
                          "Fetch"
                        )}
                      </button>
                    </div>
                    {responses[index] && (
                      <div className="retrieved-evidences">
                        {responses[index].map((text, i) => (
                          <div
                            className="retrieved-evidence"
                            key={i}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "10px",
                              backgroundColor: "#f2f0f0",
                              borderRadius: "8px",
                            }}
                          >
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
                                    `${index}-${i}`
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
            <div className="save-button">Save All to Memory</div>
          </div>
        </>
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
