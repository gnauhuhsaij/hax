import React, { useState, useContext, useEffect, useRef } from "react";
import axios from "axios";
import Step from "./Step";
import ModalContainer from "./ModalContainer";
import "../styles/Workflow.css";
import { AuthContext } from "../contexts/AuthContext";
import CONFIG from "../config";

const Workflow = ({ workflow, workflowName }) => {
  const groupedByPhase = workflow.reduce((acc, subtask) => {
    acc[subtask.phase] = acc[subtask.phase] || [];
    acc[subtask.phase].push(subtask);
    return acc;
  }, {});
  const { user, workflowId } = useContext(AuthContext);
  // const [expandedSubtasks, setExpandedSubtasks] = useState({});
  const [evidence, setEvidence] = useState({}); // Store evidence for each step
  const [loadingEvidence, setLoadingEvidence] = useState({});
  const [selectedStep, setSelectedStep] = useState(null); // Track selected step
  const [modalContent, setModalContent] = useState(null);
  const [singleColumnMode, setSingleColumnMode] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [formattedStructure, setFormattedStructure] = useState("");

  const [modalCache, setModalCache] = useState({});
  const [modalData, setModalData] = useState({});

  const skipHandleRoleClickRef = useRef(false);

  // const toggleSubtask = (index) => {
  //   setExpandedSubtasks((prev) => ({
  //     ...prev,
  //     [index]: !prev[index],
  //   }));
  // };
  useEffect(() => {
    if (skipHandleRoleClickRef.current) {
      skipHandleRoleClickRef.current = false; // reset after skipping
      return;
    }
    if (selectedStep) {
      const phaseNames = Object.keys(groupedByPhase);
      const phaseName = phaseNames[selectedStep.phaseIndex];
      const subtask = groupedByPhase[phaseName]?.[selectedStep.subtaskIndex];

      const firstStep = subtask?.steps?.[0];

      if (firstStep) {
        const stepIndex = 0;
        handleRoleCircleClick(
          firstStep,
          selectedStep.phaseIndex,
          selectedStep.subtaskIndex,
          stepIndex,
          subtask
        );
      }
    }
  }, [selectedStep]);

  useEffect(() => {
    const workflowStructure = [`${workflowName}`];

    workflow.forEach((subtask) => {
      workflowStructure.push(`> ${subtask.description}`);
      subtask.steps.forEach((step) => {
        workflowStructure.push(`>> ${step.name}`);
      });
    });

    setFormattedStructure(workflowStructure.join("\n"));
    // console.log(formattedStructure);
  }, [workflow, workflowName]);

  const allSubtasks = workflow.flatMap((subtask, index) => ({
    ...subtask,
    phaseIndex: workflow.findIndex((w) => w.phase === subtask.phase),
    subtaskIndex: index,
  }));

  const callApiForEvidence = async (name, step) => {
    const fallbackUserId = user?.id || `guest-${Date.now()}`;
    const fallbackWorkflowId = workflowId || `workflow-${Date.now()}`;
    console.log(fallbackUserId, fallbackWorkflowId);
    try {
      console.log(1);
      // Step 1: If execution type is "LLM", use the RAG endpoint
      if (step === "LLM") {
        console.log(step);
        const ragResponse = await axios.post(
          `${CONFIG.BACKEND_URL}/api/rag_answer`,
          {
            query: name,
            userid: fallbackUserId, // make sure these fields exist in your step object
            workflowid: fallbackWorkflowId,
          }
        );

        const answer = ragResponse.data?.answer || "No answer found.";

        // You can shape the return however you want
        return [
          {
            title: "LLM Response",
            link: "",
            snippet: answer,
            rag_response: answer,
          },
        ];
      }

      // Step 2: Otherwise, fallback to normal evidence generation
      const response = await axios.post(
        `${CONFIG.BACKEND_URL}/api/process_step`,
        { name: name, execution: step, context: formattedStructure },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log(name, formattedStructure);
      const evidence = response.data.evidence.map((item) => ({
        title: item?.title,
        link: item?.link,
        snippet: item?.snippet,
        score: item?.score,
        rag_response: null, // optional placeholder
      }));

      return evidence.length > 0
        ? evidence
        : [
            {
              title: "No evidence found.",
              link: "",
              snippet: "",
              rag_response: null,
            },
          ];
    } catch (error) {
      console.log("Step value and type:", step, typeof step);
    
      if (error.response) {
        // The request was made and the server responded with a status code outside of 2xx
        console.error("API Response Error:", {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers,
        });
      } else if (error.request) {
        // The request was made but no response was received
        console.error("API No Response Error:", error.request);
      } else {
        // Something happened in setting up the request
        console.error("API Setup Error:", error.message);
      }
    
      console.error("Full Error Object:", error);
    
      return [
        {
          title: "Error retrieving evidence.",
          link: "",
          snippet: "",
          rag_response: null,
        },
      ];
    }
  };

  const handleRoleCircleClick = async (
    step,
    phaseIndex,
    subtaskIndex,
    stepIndex,
    subtask
  ) => {
    const evidenceKey = `${phaseIndex}-${subtaskIndex}-${stepIndex}`;
    // console.log(modalCache);
    console.log(step);
    if (modalCache[evidenceKey]) {
      setModalContent(modalCache[evidenceKey]);
      return;
    }
    // Show loading modal
    setModalContent(
      <ModalContainer
        isLoading={true}
        step={step}
        subtaskIndex={subtaskIndex}
        stepIndex={stepIndex}
        context={[]}
        evidence={[]}
        classification={step.classification}
      />
    );

    // Fetch evidence data
    const evidenceItem = await callApiForEvidence(step.name, step.execution);

    const prevSteps = [];

    Object.keys(groupedByPhase).forEach((phaseKey) => {
      const pI = parseInt(phaseKey);
      if (pI < phaseIndex) {
        groupedByPhase[phaseKey].forEach((subtask) => {
          subtask.workflow.forEach((_, sI) => {
            prevSteps.push([pI, subtask.index, sI]);
          });
        });
      } else if (pI === phaseIndex) {
        groupedByPhase[phaseKey].forEach((subtask) => {
          if (subtask.index < subtaskIndex) {
            subtask.workflow.forEach((_, sI) => {
              prevSteps.push([pI, subtask.index, sI]);
            });
          } else if (subtask.index === subtaskIndex) {
            subtask.workflow.forEach((_, sI) => {
              if (sI < stepIndex) {
                prevSteps.push([pI, subtask.index, sI]);
              }
            });
          }
        });
      }
    });

    console.log(prevSteps);
    // Update evidence and ensure modal updates after state is applied
    setEvidence((prev) => {
      const updatedEvidence = { ...prev, [evidenceKey]: evidenceItem };

      const modal = (
        <ModalContainer
          isLoading={false}
          step={step}
          subtaskIndex={subtaskIndex}
          stepIndex={stepIndex}
          context={`${step.name} for ${subtask.description} for ${workflowName}`}
          evidence={updatedEvidence[evidenceKey]} // Now it is correctly updated
          classification={step.classification}
        />
      );

      // Ensure modal update happens after state update
      setModalContent(modal);
      setModalCache((prev) => ({ ...prev, [evidenceKey]: modal }));

      return updatedEvidence;
    });

    // Update loading state
    setLoadingEvidence((prev) => ({ ...prev, [evidenceKey]: false }));
  };

  const resetSelection = () => {
    setSelectedStep(null);
    setModalContent(null);
    setSingleColumnMode(false);
  };

  const handleStepClick = (phaseIndex, subtaskIndex) => {
    setIsFading(true);
    setSelectedStep({ phaseIndex, subtaskIndex });
    setTimeout(() => {
      setSingleColumnMode(true);
      setTimeout(() => {
        setIsFading(false);
      }, 1);

      // Wait for DOM layout to update
      setTimeout(() => {
        const container = document.querySelector(".left-column"); // scrollable column
        const el = document.getElementById(
          `subtask-${phaseIndex}-${subtaskIndex}`
        );

        if (container && el) {
          const containerTop = container.getBoundingClientRect().top;
          const elTop = el.getBoundingClientRect().top;
          const currentScroll = container.scrollTop;

          const offsetFromContainer = elTop - containerTop;
          const targetOffset = window.innerHeight * 0.1; // 20vh relative to screen

          container.scrollTo({
            top: currentScroll + offsetFromContainer - targetOffset,
            behavior: "auto",
          });
        }
      }, 1);
    }, 400); // After fade-out completes
  };

  return (
    <>
      <div className="workflow-container" onClick={resetSelection}>
        {!singleColumnMode ? (
          Object.entries(groupedByPhase).map(
            ([phase, subtasks], phaseIndex) => (
              <div key={phase} className={`phase-row`}>
                <div className={`subtasks-wrapper `}>
                  {subtasks.map((subtask, subtaskIndex) => {
                    return (
                      <>
                        <div
                          key={subtaskIndex}
                          className={`subtask ${
                            selectedStep ? "faded-out" : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStepClick(phaseIndex, subtaskIndex);
                          }}
                        >
                          <h2 className="subtask-card">
                            <h3>{subtask.description}</h3>
                          </h2>
                          {
                            <div className="steps-wrapper">
                              <div className="steps">
                                {[
                                  // { isPlaceholder: true },
                                  ...subtask.steps, // Spread the original steps
                                ].map((step, stepIndex) => {
                                  const evidenceKey = `${phaseIndex}-${subtaskIndex}-${stepIndex}`;
                                  return (
                                    <Step
                                      key={stepIndex}
                                      step={{ ...step, index: stepIndex }} // Include step index
                                      evidenceKey={evidenceKey}
                                      onRoleCircleClick={() => {
                                        handleStepClick(
                                          phaseIndex,
                                          subtaskIndex
                                        );
                                        handleRoleCircleClick(
                                          step,
                                          phaseIndex,
                                          subtaskIndex,
                                          stepIndex,
                                          subtask
                                        );
                                        skipHandleRoleClickRef.current = true; // skip the next effect
                                      }}
                                      evidence={evidence[evidenceKey]}
                                      loading={loadingEvidence[evidenceKey]}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          }
                        </div>
                      </>
                    );
                  })}
                </div>
              </div>
            )
          )
        ) : (
          <div className={`left-column ${isFading ? "invisible" : ""}`}>
            {Object.entries(groupedByPhase).flatMap(
              ([phase, subtasks], phaseIndex) =>
                subtasks.map((subtask, subtaskIndex) => {
                  const isSelected =
                    selectedStep?.phaseIndex === phaseIndex &&
                    selectedStep?.subtaskIndex === subtaskIndex;

                  return (
                    <div
                      key={`single-${phaseIndex}-${subtaskIndex}`}
                      id={`subtask-${phaseIndex}-${subtaskIndex}`}
                      className={`subtask single ${
                        isSelected ? "highlighted" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStepClick(phaseIndex, subtaskIndex);
                      }}
                    >
                      <h2 className="subtask-card">
                        <h3>{subtask.description}</h3>
                      </h2>
                      {
                        <div className="steps-wrapper">
                          <div className="steps">
                            {[
                              // { isPlaceholder: true },
                              ...subtask.steps, // Spread the original steps
                            ].map((step, stepIndex) => {
                              const evidenceKey = `${phaseIndex}-${subtaskIndex}-${stepIndex}`;
                              return (
                                <Step
                                  key={stepIndex}
                                  step={{ ...step, index: stepIndex }} // Include step index
                                  evidenceKey={evidenceKey}
                                  onRoleCircleClick={() => {
                                    handleStepClick(phaseIndex, subtaskIndex);
                                    handleRoleCircleClick(
                                      step,
                                      phaseIndex,
                                      subtaskIndex,
                                      stepIndex,
                                      subtask
                                    );
                                    skipHandleRoleClickRef.current = true; // skip the next effect
                                  }}
                                  evidence={evidence[evidenceKey]}
                                  loading={loadingEvidence[evidenceKey]}
                                />
                              );
                            })}
                          </div>
                        </div>
                      }
                    </div>
                  );
                })
            )}
          </div>
        )}
        <div className="parent-container">
          {/* Modal Container */}
          {modalContent && modalContent}
        </div>
      </div>
    </>
  );
};

export default Workflow;
