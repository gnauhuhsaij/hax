import React, { useEffect, useState, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { AuthContext } from "../contexts/AuthContext"; // Import AuthContext
import "../styles/Dashboard.css";
import CONFIG from '../config';

const Dashboard = () => {
  const { user, setCurrentWorkflow } = useContext(AuthContext); // Get user ID and setCurrentWorkflow from AuthContext
  const [recentProjects, setRecentProjects] = useState([]);
  const navigate = useNavigate();

  // Fetch workflows from S3 when the component mounts
  useEffect(() => {
    const fetchWorkflows = async () => {
      if (!user) return; // Ensure the user is logged in

      try {
        const response = await axios.get(
          `${CONFIG.BACKEND_URL}/api/list_workflows`,
          {
            params: { user_id: user.id }, // Send user ID to backend
          }
        );

        if (response.data.workflows && response.data.workflows.length > 0) {
          // Get the most recent 3 workflows
          setRecentProjects(response.data.workflows.slice(0, 3));
        }
      } catch (error) {
        console.error("Error fetching workflows:", error);
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
        setCurrentWorkflow(JSON.stringify(response.data.workflow)); // Store workflow in context
        navigate("/start-project"); // Redirect to ProjectPage
      }
    } catch (error) {
      console.error("Error fetching project workflow:", error);
    }
  };

  const handleNewProject = async () => {
    setCurrentWorkflow(null);
  };

  if (!user) {
    return (
      <div className="dashboard">
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
    <div className="dashboard">
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
