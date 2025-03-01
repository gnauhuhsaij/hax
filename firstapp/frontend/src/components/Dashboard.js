import React, { useEffect, useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../contexts/AuthContext"; // Import AuthContext
import "../styles/Dashboard.css";
import CONFIG from '../config';

const Dashboard = () => {
  const { user, setCurrentWorkflow, setCurrentWorkflowName } =
    useContext(AuthContext); // Get user ID and setCurrentWorkflow from AuthContext
  const [recentProjects, setRecentProjects] = useState([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true); // Track loading state
  const [isExiting, setIsExiting] = useState(false); // Track exit animation
  const [isVisible, setIsVisible] = useState(false);

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
          setRecentProjects(response.data.workflowsNames.slice(0, 4));
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
        setIsExiting(true); // Trigger fade-out

        setTimeout(() => {
          setCurrentWorkflow(JSON.stringify(response.data.workflow));
          setCurrentWorkflowName(JSON.stringify(response.data.workflowName));
          navigate("/start-project"); // Redirect after animation
        }, 200); // Matches the CSS animation duration
      }
    } catch (error) {
      console.error("Error fetching project workflow:", error);
    }
  };

  const handleNewProject = async () => {
    setCurrentWorkflow(null);
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
        <Link to="/start-project">
          <button className="start-project-btn">
            <p>+ Start a project</p>
          </button>
        </Link>
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
      <Link to="/start-project">
        <button
          className="start-project-btn"
          onClick={() => handleNewProject()}
        >
          <p>+ Start a project</p>
        </button>
      </Link>

      <div className="project-section">
        <h3>Recent</h3>
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
                <div className="project-header">
                  {project.replace(".json", "")}
                </div>
                <div className="project-image"></div>
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
