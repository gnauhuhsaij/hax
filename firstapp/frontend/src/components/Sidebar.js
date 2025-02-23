import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "../styles/Sidebar.css";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [user, setUser] = useState(null);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const handleCredentialResponse = (response) => {
    // Decode the JWT credential to extract user information
    const decodeJwtResponse = (token) => {
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => {
            return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
          })
          .join("")
      );
      return JSON.parse(jsonPayload);
    };

    const userObject = decodeJwtResponse(response.credential);
    console.log("Google OAuth2 login successful:", userObject);
    setUser(userObject);
    // Optionally, you can send the credential to your backend for verification here
  };

  useEffect(() => {
    // Ensure the Google client library has loaded
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id:
          "741869303542-rosrg64op3dlp3v475crqr5udkbbdjam.apps.googleusercontent.com", // Replace with your actual Google Client ID
        callback: handleCredentialResponse,
      });
      // Render the Google Sign-In button into a hidden container.
      // We'll trigger the flow by wrapping our custom account icon.
      window.google.accounts.id.renderButton(
        document.getElementById("googleSignInButton"),
        {
          theme: "outline",
          size: "large",
          text: "signin",
          shape: "circle",
        }
      );
    }
  }, []);

  // Manually trigger the One Tap or popup flow when clicking our custom account icon
  const handleSignInClick = () => {
    if (window.google && window.google.accounts.id) {
      window.google.accounts.id.prompt(); // This displays the One Tap prompt if available
    }
  };

  return (
    <div className={`sidebar ${isOpen ? "open" : "collapsed"}`}>
      <button className="toggle-button" onClick={toggleSidebar}>
        <img src="/icons/collapse.svg" alt="Collapse Icon" className="icon" />
      </button>
      {isOpen && (
        <>
          <h1 className="website-title">haX</h1>
          <ul>
            <li>
              <Link to="/">
                <img src="/icons/home.svg" alt="Home Icon" className="icon" />{" "}
                Home
              </Link>
            </li>
            <li>
              <Link to="/community">
                <img
                  src="/icons/global.svg"
                  alt="Community Icon"
                  className="icon"
                />{" "}
                Community
              </Link>
            </li>
            <li>
              <Link to="/saved">
                <img src="/icons/save.svg" alt="Saved Icon" className="icon" />{" "}
                Saved
              </Link>
            </li>
            <li>
              <Link to="/reward">
                <img src="/icons/coin.svg" alt="Reward Icon" className="icon" />{" "}
                Reward
              </Link>
            </li>
          </ul>
          <div className="profile-details">
            {!user ? (
              <div>
                {/* This div is used by Google to render its hidden sign-in button */}
                <div id="googleSignInButton" style={{ display: "none" }} />
                {/* Our custom account icon triggers the Google OAuth2 prompt */}
                <button
                  onClick={handleSignInClick}
                  className="account-button"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <img
                    src="/icons/ellipse.svg"
                    alt="Account Icon"
                    className="account-icon"
                  />
                </button>
              </div>
            ) : (
              <div className="profile-section">
                <img
                  src={user.picture}
                  alt="Profile"
                  className="account-icon"
                />
                <div className="descriptions">
                  <h3 className="username">{user.name}</h3>
                  <p className="days">20 days on hax</p>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Sidebar;
