import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard">
    <Link to="/start-project">
      <button className="start-project-btn">
        <p>+ Start a project</p>
      </button>
    </Link>
      <div className="project-section">
        <h3>Recent</h3>
        <div className="projects">
          <div className="project-card">
            <div className="project-header">Social Media Poster</div>
            <div className="project-image"></div>
          </div>
          <div className="project-card">
            <div className="project-header">TMP 120 Project</div>
            <div className="project-image"></div>
          </div>
          <div className="project-card">
            <div className="project-header">Self-Study App-Dev</div>
            <div className="project-image"></div>
          </div>
        </div>
        <h3>Done</h3>
        <div className="projects">
          <div className="project-card">
            <div className="project-header">Event Plan</div>
            <div className="project-image"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

