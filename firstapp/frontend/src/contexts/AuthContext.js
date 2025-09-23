import React, {
  createContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

// Create Context
export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Always starts as null for new visitors
  const [currentWorkflow, setCurrentWorkflow] = useState(null);
  const [currentWorkflowName, setCurrentWorkflowName] = useState(null);
  const [workflowId, setWorkflowId] = useState(null);

  // NEW: serializable modal cache (data only, NOT JSX)
  const [modalCacheData, setModalCacheData] = useState({});

  // ---- Uploader bridge (kept in ProjectPage.js, registered here) ----
  const uploadFnRef = useRef(null);
  const registerWorkflowUploader = useCallback((fn) => {
    uploadFnRef.current = fn;
  }, []);

  // Build the canonical JSON we upload (injects __uiMeta.modalCacheData)
  const getWorkflowJSON = useCallback(() => {
    const wfObj =
      typeof currentWorkflow === "string"
        ? JSON.parse(currentWorkflow)
        : currentWorkflow || {};
    return {
      ...wfObj,
      __uiMeta: {
        ...(wfObj?.__uiMeta || {}),
        modalCacheData,
      },
    };
  }, [currentWorkflow, modalCacheData]);

  // Debounced saver so we don't spam uploads
  const saveTimerRef = useRef(null);
  const saveModalCacheDebounced = useCallback(
    (delayMs = 500, overrideCache) => {
      if (!uploadFnRef.current) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(() => {
        const wfObj =
          typeof currentWorkflow === "string"
            ? JSON.parse(currentWorkflow)
            : currentWorkflow || {};

        const wfJSON = {
          ...wfObj,
          __uiMeta: {
            ...(wfObj.__uiMeta || {}),
            modalCacheData: overrideCache ?? modalCacheData,
          },
        };

        uploadFnRef.current(
          JSON.stringify(wfJSON),
          currentWorkflowName,
          workflowId
        );
      }, delayMs);
    },
    [currentWorkflow, modalCacheData, currentWorkflowName, workflowId]
  );

  // ---- Session restore (unchanged) ----
  useEffect(() => {
    const savedUser = JSON.parse(localStorage.getItem("user"));
    const savedWorkflowId = localStorage.getItem("workflowId");
    if (savedUser) setUser(savedUser);
    if (savedWorkflowId) setWorkflowId(savedWorkflowId);
  }, []);

  // ---- Auth helpers (unchanged) ----
  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setWorkflowId(null);
    localStorage.removeItem("user");
    localStorage.removeItem("workflowId");
  };

  // Persist workflowId in localStorage
  const setWorkflowIdPersist = (id) => {
    setWorkflowId(id);
    if (id) localStorage.setItem("workflowId", id);
    else localStorage.removeItem("workflowId");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        workflowId,
        setWorkflowId: setWorkflowIdPersist,
        currentWorkflow,
        setCurrentWorkflow,
        currentWorkflowName,
        setCurrentWorkflowName,

        // NEW: modal cache + cross-file save bridge
        modalCacheData,
        setModalCacheData,
        registerWorkflowUploader, // call once in ProjectPage.js
        saveModalCacheDebounced, // call after you update modalCacheData
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
