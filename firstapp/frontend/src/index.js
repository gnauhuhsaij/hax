import React from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App"; // Adjust path to App component
import "./styles/App.css"; // Import global App styles
import { AuthProvider } from "./contexts/AuthContext"; // Import the AuthProvider

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
  document.getElementById("root")
);
