import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/Sidebar.css';

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : 'collapsed'}`}>
      <button className="toggle-button" onClick={toggleSidebar}>
        <img src="/icons/collapse.svg" alt="Collapse Icon" className="icon" />
      </button>
      {isOpen && (
        <>
          <h1 className="website-title">haX</h1>
          <ul>
            <li>
              <Link to="/">
                <img src="/icons/home.svg" alt="Home Icon" className="icon" /> Home
              </Link>
            </li>
            <li>
              <Link to="/community">
                <img src="/icons/global.svg" alt="Community Icon" className="icon" /> Community
              </Link>
            </li>
            <li>
              <Link to="/saved">
                <img src="/icons/save.svg" alt="Saved Icon" className="icon" /> Saved
              </Link>
            </li>
            <li>
              <Link to="/reward">
                <img src="/icons/coin.svg" alt="Reward Icon" className="icon" /> Reward
              </Link>
            </li>
          </ul>
          <div className="profile-section">
            <img src="/icons/ellipse.svg" alt="Account Icon" className="account-icon" />
            <div className="descriptions">
              <h3 className="username">William Pan</h3>
              <p className="days">20 Days at Do.ai</p>
            </div>
            
          </div>
        </>
      )}
    </div>
  );
};

export default Sidebar;
