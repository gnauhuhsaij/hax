import React, { useEffect, useContext, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../contexts/AuthContext"; // Import AuthContext
import "../styles/Sidebar.css";

const Sidebar = () => {
  const { user, login, logout } = useContext(AuthContext); // Use AuthContext for global user state
  const [isOpen, setIsOpen] = useState(true);
  const [currentSection, setCurrentSection] = useState("Home");
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  // Decode JWT from Google OAuth2
  const decodeJwtResponse = (token) => {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  };

  // Handle login response from Google OAuth2
  const handleCredentialResponse = (response) => {
    const userObject = decodeJwtResponse(response.credential);
    console.log("Google OAuth2 login successful:", userObject);

    // Use login() from AuthContext instead of directly calling setUser
    login({
      id: userObject.sub, // Store unique Google user ID
      name: userObject.name,
      email: userObject.email,
      picture: userObject.picture,
    });
  };

  useEffect(() => {
    // Initialize Google OAuth2
    if (window.google) {
      window.google.accounts.id.initialize({
        client_id:
          "741869303542-rosrg64op3dlp3v475crqr5udkbbdjam.apps.googleusercontent.com", // Replace with your actual Google Client ID
        callback: handleCredentialResponse,
        itp_support: true,
      });
      window.google.accounts.id.renderButton(
        document.getElementById("googleSignInButton"),
        { theme: "outline", size: "large", text: "signin", shape: "circle" }
      );
    }
  }, []);

  // Manually trigger Google sign-in prompt
  const handleSignInClick = () => {
    if (window.google && window.google.accounts.id) {
      console.log("Triggering Google sign-in...");

      // Ensure login prompt is shown
      setTimeout(() => {
        console.log("window.google:", window.google);
        console.log("window.google.accounts.id:", window.google?.accounts?.id);
        window.google.accounts.id.prompt();
      }, 500); // Small delay to bypass rate limiting
    }
  };

  return (
    <div className={`sidebar ${isOpen ? "open" : "collapsed"}`}>
      <button className="toggle-button" onClick={toggleSidebar}>
        <img src="/icons/collapse.svg" alt="Collapse Icon" className="icon" />
      </button>
      <img src="/icons/haxLogo.svg" alt="Logo Icon" className="logo" />

      {/* <h1 className="website-title">haX</h1> */}
      <div className="navSection">
        <ul>
          <li>
            <Link
              to="/"
              onClick={() => setCurrentSection("Home")}
              className={currentSection === "Home" ? "active" : ""}
            >
              <img src="/icons/home.svg" alt="Home Icon" className="icon" />{" "}
              {isOpen && <>Home</>}
            </Link>
          </li>
          <li>
            <Link
              to="/community"
              onClick={() => setCurrentSection("Community")}
              className={currentSection === "Community" ? "active" : ""}
            >
              <img
                src="/icons/global.svg"
                alt="Community Icon"
                className="icon"
              />{" "}
              {isOpen && <>Community</>}
            </Link>
          </li>
          <li>
            <Link
              to="/saved"
              onClick={() => setCurrentSection("Saved")}
              className={currentSection === "Saved" ? "active" : ""}
            >
              <img src="/icons/save.svg" alt="Saved Icon" className="icon" />{" "}
              {isOpen && <>Saved</>}
            </Link>
          </li>
          <li>
            <Link
              to="/reward"
              onClick={() => setCurrentSection("Reward")}
              className={currentSection === "Reward" ? "active" : ""}
            >
              <img src="/icons/coin.svg" alt="Reward Icon" className="icon" />{" "}
              {isOpen && <>Reward</>}
            </Link>
          </li>
        </ul>
      </div>

      {/* Profile Section */}
      <div className="profile-section">
        <img
          src={user ? user.picture : "/icons/ellipse.svg"}
          alt="Profile"
          className="account-icon"
        />
        {isOpen && (
          <>
            {!user ? (
              <div className="profile-container">
                <button onClick={handleSignInClick} className="login-button">
                  <p>Log In</p>
                </button>
              </div>
            ) : (
              <div className="profile-container">
                <div className="descriptions">
                  <p className="username">{user.name}</p>
                  <p className="days">20 days on haX</p>
                </div>
                <button onClick={logout} className="logout-button">
                  🚪
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
