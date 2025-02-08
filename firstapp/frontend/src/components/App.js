import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Sidebar from './Sidebar';
import Dashboard from './Dashboard';
import ProjectPage from './ProjectPage';
import '../styles/App.css'; // Import the CSS

function App() {
  return (
    <Router>
      <div className="app-container">
        <Sidebar /> {/* Sidebar on the left */}
        <div className="content-area"> {/* Content on the right */}
          <Routes>
            <Route path="/start-project" element={<ProjectPage />} />
            <Route path="/" element={<Dashboard />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
