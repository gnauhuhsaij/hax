import React, { createContext, useState, useEffect } from "react";

// Create Context
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Always starts as null for new visitors
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const [currentWorkflowName, setCurrentWorkflowName] = useState(null);
  const [workflowId, setWorkflowId] = useState(null);

  // Load user data from localStorage ONLY if the session is still active (refresh case)
  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("user"));
    if (savedUser) {
      setUser(savedUser);
    }
  }, []);

  // Login function: Stores user data in state & session (localStorage)
  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData)); // Persist data only during session
  };

  // Logout function: Clears session state
  const logout = () => {
    setUser(null);
    localStorage.removeItem("user"); // Remove session storage
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        workflowId,
        setWorkflowId,
        currentWorkflow,
        setCurrentWorkflow,
        currentWorkflowName,
        setCurrentWorkflowName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
