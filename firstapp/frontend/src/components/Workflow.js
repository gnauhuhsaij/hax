import React, { useState, useContext } from "react";
import axios from "axios";
import Step from "./Step";
import ModalContainer from "./ModalContainer";
import "../styles/Workflow.css";
import { AuthContext } from "../contexts/AuthContext";
import CONFIG from '../config';

const Workflow = ({ workflow }) => {
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
  const [forceHover, setForceHover] = useState(false);

  // const toggleSubtask = (index) => {
  //   setExpandedSubtasks((prev) => ({
  //     ...prev,
  //     [index]: !prev[index],
  //   }));
  // };

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
    stepIndex
  ) => {
    const evidenceKey = `${phaseIndex}-${subtaskIndex}-${stepIndex}`;

    // Show loading modal
    setModalContent(
      <ModalContainer
        isLoading={true}
        step={step}
        evidence={[]}
        classification={step.classification}
      />
    );

    // Fetch evidence data
    const evidenceItem = await callApiForEvidence(step.name, step.execution);
    setEvidence((prev) => ({
      ...prev,
      [evidenceKey]: evidenceItem,
    }));

    setLoadingEvidence((prev) => ({ ...prev, [evidenceKey]: false }));

    // Update modal with evidence data
    setModalContent(
      <ModalContainer
        isLoading={false}
        step={step}
        evidence={evidence[evidenceKey] || []}
        classification={step.classification}
      />
    );
  };

  const resetSelection = () => {
    setSelectedStep(null);
    setModalContent(null);
  };

  const handleStepClick = (phaseIndex, subtaskIndex) => {
    setSelectedStep({ phaseIndex, subtaskIndex });
  };

  return (
    <>
      <div className="workflow-container" onClick={resetSelection}>
        <button
          className="force-hover-button"
          onClick={() => setForceHover((prev) => !prev)}
        >
          {forceHover ? "Collapse All" : "Expand All"}
        </button>

        {Object.entries(groupedByPhase).map(([phase, subtasks], phaseIndex) => (
          <div key={phase} className={`phase-row`}>
            <div className={`subtasks-wrapper `}>
              {subtasks.map((subtask, subtaskIndex) => {
                const isSelected =
                  selectedStep &&
                  selectedStep.subtaskIndex === subtaskIndex &&
                  selectedStep.phaseIndex === phaseIndex;

                return (
                  <>
                    {isSelected && (
                      <div
                        key={`${subtaskIndex}-placeholder`}
                        className="subtask-placeholder"
                      >
                        <h2 className="subtask-card">
                          {subtask.description}
                          <div className="subtask-preview">
                            <img
                              src="/icons/downarrow.png"
                              alt="Send"
                              className="preview-icon"
                            />
                          </div>
                        </h2>
                        {
                          <div className="steps">
                            {subtask.steps.map((step, stepIndex) => {
                              const evidenceKey = `${phaseIndex}-${subtaskIndex}-${stepIndex}`;
                              return (
                                <Step
                                  key={stepIndex}
                                  step={{ ...step, index: stepIndex }} // Include step index
                                  evidenceKey={evidenceKey}
                                  onRoleCircleClick={() =>
                                    handleRoleCircleClick(
                                      step,
                                      phaseIndex,
                                      subtaskIndex,
                                      stepIndex
                                    )
                                  }
                                  evidence={evidence[evidenceKey]}
                                  loading={loadingEvidence[evidenceKey]}
                                />
                              );
                            })}
                          </div>
                        }
                      </div>
                    )}
                    <div
                      key={subtaskIndex}
                      className={`subtask ${
                        forceHover
                          ? "force-hover"
                          : !selectedStep
                          ? ""
                          : selectedStep.subtaskIndex !== subtaskIndex ||
                            selectedStep.phaseIndex !== phaseIndex
                          ? "faded-out"
                          : "selected"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStepClick(phaseIndex, subtaskIndex);
                      }}
                    >
                      <h2 className="subtask-card">
                        <h3>{subtask.description}</h3>
                        <div className="subtask-preview">
                          <img
                            src="/icons/downarrow.png"
                            alt="Send"
                            className="preview-icon"
                          />
                        </div>
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
                                  onRoleCircleClick={() =>
                                    handleRoleCircleClick(
                                      step,
                                      phaseIndex,
                                      subtaskIndex,
                                      stepIndex
                                    )
                                  }
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
        ))}
      </div>
      <div className="parent-container">
        {/* Modal Container */}
        {modalContent && modalContent}
      </div>
    </>
  );
};

export default Workflow;
