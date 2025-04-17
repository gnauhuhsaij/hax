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

  // const [expandedSubtasks, setExpandedSubtasks] = useState({});
  const [evidence, setEvidence] = useState({}); // Store evidence for each step
  const [loadingEvidence, setLoadingEvidence] = useState({});
  const [selectedStep, setSelectedStep] = useState(null); // Track selected step
  const [modalContent, setModalContent] = useState(null);
  const [singleColumnMode, setSingleColumnMode] = useState(false);
  const [isFading, setIsFading] = useState(false);

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

  const allSubtasks = workflow.flatMap((subtask, index) => ({
    ...subtask,
    phaseIndex: workflow.findIndex((w) => w.phase === subtask.phase),
    subtaskIndex: index,
  }));

  const callApiForEvidence = async (name, execution) => {
    try {
      const response = await axios.post(
        `${CONFIG.BACKEND_URL}/api/process_step`,
        { name: name, execution: execution },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const evidence = response.data.evidence.map((item) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet,
        score: item.score,
      }));

      return evidence.length > 0
        ? evidence // Assuming you want the first evidence item
        : { title: "No evidence found.", link: "", snippet: "" };
    } catch (error) {
      console.error("Error calling API:", error);
      return { title: "Error retrieving evidence.", link: "", snippet: "" };
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

    // Show loading modal
    setModalContent(
      <ModalContainer
        isLoading={true}
        step={step}
        context={[]}
        evidence={[]}
        classification={step.classification}
      />
    );

    // Fetch evidence data
    const evidenceItem = await callApiForEvidence(step.name, step.execution);

    // Update evidence and ensure modal updates after state is applied
    setEvidence((prev) => {
      const updatedEvidence = { ...prev, [evidenceKey]: evidenceItem };

      // Ensure modal update happens after state update
      setModalContent(
        <ModalContainer
          isLoading={false}
          step={step}
          context={`${step.name} for ${subtask.description} for ${workflowName}`}
          evidence={updatedEvidence[evidenceKey]} // Now it is correctly updated
          classification={step.classification}
        />
      );

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
