import React, { useEffect, useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../contexts/AuthContext"; // Import AuthContext
import "../styles/Dashboard.css";
import CONFIG from "../config";

const Dashboard = () => {
  const { user, setCurrentWorkflow, setCurrentWorkflowName } =
    useContext(AuthContext); // Get user ID and setCurrentWorkflow from AuthContext
  const [recentProjects, setRecentProjects] = useState([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true); // Track loading state
  const [isExiting, setIsExiting] = useState(false); // Track exit animation
  const [isVisible, setIsVisible] = useState(false);

  const date = new Date();
  const options = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const formattedDate = date.toLocaleDateString(undefined, options);

  useEffect(() => {
    setTimeout(() => {
      setIsVisible(true);
    }, 100); // Small delay before fade-in
  }, []);

  // Fetch workflows from S3 when the component mounts
  useEffect(() => {
    setLoading(true);
    const fetchWorkflows = async () => {
      if (!user) {
        setLoading(false); // If no user, stop loading
        return;
      }

      try {
        const response = await axios.get(
          `${CONFIG.BACKEND_URL}/api/list_workflows`,
          {
            params: { user_id: user.id }, // Send user ID to backend
          }
        );

        if (
          response.data.workflowsNames &&
          response.data.workflowsNames.length > 0
        ) {
          // Get the most recent 3 workflows
          setRecentProjects(response.data.workflowsNames.slice(0, 10));
        }
      } catch (error) {
        console.error("Error fetching workflows:", error);
      } finally {
        setLoading(false); // Stop loading after API call
      }
    };

    fetchWorkflows();
  }, [user]);

  const handleProjectClick = async (projectName) => {
    if (!user) return;

    try {
      const response = await axios.get(
        `${CONFIG.BACKEND_URL}/api/get_workflow`,
        { params: { user_id: user.id, project_name: projectName } }
      );

      if (response.data.workflow) {
        setTimeout(() => {
          setIsExiting(true); // Trigger fade-out
        }, 300);

        setTimeout(() => {
          setCurrentWorkflow(JSON.stringify(response.data.workflow));
          setCurrentWorkflowName(JSON.stringify(response.data.workflowName));
          navigate("/start-project"); // Redirect after animation
        }, 300); // Matches the CSS animation duration
      }
    } catch (error) {
      console.error("Error fetching project workflow:", error);
    }
  };

  const handleNewProject = async () => {
    setTimeout(() => {
      setIsExiting(true); // Trigger fade-out
    }, 300);

    setCurrentWorkflow(null);
    navigate("/start-project");
  };

  if (loading) {
    return (
      <div
        className={`dashboard ${
          isExiting ? "exiting" : isVisible ? "visible" : ""
        }`}
      >
        <Link to="/start-project">
          <button className="start-project-btn">
            <p>+ Start a project</p>
          </button>
        </Link>

        <div className="project-section">
          <h3>Recent</h3>
          <div className="projects">
            {[1, 2, 3, 4].map((index) => (
              <div key={index} className="project-card placeholder">
                <div className="project-header placeholder"></div>
                <div className="project-image placeholder"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        className={`dashboard ${
          isExiting ? "exiting" : isVisible ? "visible" : ""
        }`}
      >
        <button
          className="start-project-btn"
          onClick={() => handleNewProject()}
        >
          <p>+ Start a project</p>
        </button>
        <div className="dashboard-center">
          <h2>Log in to unlock the full version</h2>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`dashboard ${
        isExiting ? "exiting" : isVisible ? "visible" : ""
      }`}
    >
      <div className="announcements">
        <div className="ADescription">{formattedDate}</div>
        <div className="ASection">
          💪 A productive morning leads to a confident evening. Pick a task and
          dive in! ☀️ 💼
        </div>
      </div>
      <div className="quickStart">
        <div className="QSDescription">Quick Tasks to Start...</div>
        <div className="QSSection"></div>
      </div>

      <div className="project-section">
        <div className="project-headings">
          <div className="headings-left">
            <div className="myProject">My Projects</div>
            <div className="statusRow">
              <button className="status-btn">
                <p>In Progress</p>
              </button>
              <button className="status-btn">
                <p>Done</p>
              </button>
            </div>
          </div>
          <div className="headings-right">
            <button
              className="start-project-btn"
              onClick={() => handleNewProject()}
            >
              <p>+ Start a project</p>
            </button>
          </div>
        </div>
        <div className="projects">
          {recentProjects.length > 0 ? (
            recentProjects.map((project, index) => (
              <div
                key={index}
                className="project-card"
                onClick={() => handleProjectClick(project)}
                style={{
                  cursor: "pointer",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <div className="project-image"></div>
                <div className="project-description">
                  <div className="project-header">
                    {project.replace(".json", "")}
                  </div>
                  <div className="project-management">
                    <div className="project-members">
                    <div className="project-member">
                      <img
                        src={user ? user.picture : "/icons/ellipse.svg"}
                        alt="Profile"
                        className="account-icon"
                      />
                      <p className="username">{user.name}</p>
                      </div>
                    </div>
                    <div className="project-progress">
                      <div className="progress-text">In Progress</div>
                      <div className="progress-bar"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p>No recent projects</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
