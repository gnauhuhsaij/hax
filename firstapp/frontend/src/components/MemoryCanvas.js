import React, { useEffect, useState } from "react";
import "../styles//MemoryCanvas.css";
import axios from "axios";
import CONFIG from "../config"; // Ensure this has BACKEND_URL

const MemoryCanvas = ({ onClose, userId, workflowId }) => {
  const [memories, setMemories] = useState([]);

  const fetchMemories = async () => {
    try {
      const response = await axios.get(
        `${CONFIG.BACKEND_URL}/api/show_all_memories`,
        {
          params: {
            user_id: userId,
            workflow_id: workflowId,
          },
        }
      );
      setMemories(response.data);
    } catch (error) {
      console.error("Error fetching memories:", error);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [userId, workflowId]);

  const deleteMemory = async (memoryContent, userId, workflowId) => {
    try {
      const response = await axios.post(
        `${CONFIG.BACKEND_URL}/api/delete_evidence`,
        {
          evidence: memoryContent,
          userid: userId,
          workflowid: workflowId,
        }
      );
      console.log(response.data);
      fetchMemories();
    } catch (error) {
      console.error("Error deleting memory:", error);
    }
  };

  return (
    <div className="memory-overlay">
      <div className="memory-canvas">
        <div className="memory-header">
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
          <h2>Memory for this Project</h2>
        </div>

        <div className="memory-search-section">
          <input
            className="memory-search-input"
            type="text"
            placeholder="Search for anything..."
          />
          <div className="memory-filters">
            <button className="memory-filter from-you">From You</button>
            <button className="memory-filter search-result">
              Search Result
            </button>
            <button className="memory-filter ai-generate">AI Generate</button>
          </div>
        </div>

        <div className="memory-cards-grid">
          {memories.map((memory) => (
            <div key={memory.id} className="memory-card">
              <div className="memory-card-content">
                <h4>
                  {memory.content.split("\n")[0].slice(0, 40) ||
                    "Untitled Memory"}
                </h4>
                <p>{memory.content}...</p>
              </div>
              <div className="memory-card-footer">
                <p>{memory.subtask_index}</p>
                <p>{memory.step_index}</p>
                <p>{memory.step_index}</p>
                <div className="memory-card-actions">
                  <button
                    className="memory-card-delete-button"
                    onClick={() =>
                      deleteMemory(memory.content, userId, workflowId)
                    }
                  >
                    <img src="/icons/bin.png" alt="BIN" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button className="new-memory-button">＋ New memory</button>
      </div>
    </div>
  );
};

export default MemoryCanvas;
