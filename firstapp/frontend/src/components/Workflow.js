import React, { useState } from 'react';
import '../styles/Workflow.css';

const Workflow = ({ workflow, phaseDict }) => {
  const groupedByPhase = workflow.reduce((acc, subtask) => {
    acc[subtask.phase] = acc[subtask.phase] || [];
    acc[subtask.phase].push(subtask);
    return acc;
  }, {});

  const [expandedSubtasks, setExpandedSubtasks] = useState({});
  const [expandedSteps, setExpandedSteps] = useState({});

  const toggleSubtask = (index) => {
    setExpandedSubtasks((prev) => ({
      ...prev,
      [index]: !prev[index], // Toggle subtask visibility by index
    }));
  };

  const toggleStepDetails = (subtaskIndex, stepIndex) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [`${subtaskIndex}-${stepIndex}`]: !prev[`${subtaskIndex}-${stepIndex}`],
    }));
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'AI':
        return 'AI';
      case 'Human':
        return 'H';
      default:
        return 'B';
    }
  };

  return (
    <div className="workflow-container">
      {Object.entries(groupedByPhase).map(([phase, subtasks], phaseIndex) => (
        <div key={phase} className="phase-row">
          <div className="phase-label-container">
            {/* Use phaseDict to display the phase name */}
            <span className="phase-label-text">
              {`PHASE ${phaseIndex + 1} - ${phaseDict[phase] || `Phase ${phase}`}`}
            </span>
          </div>
          <div className="subtasks-wrapper">
            {subtasks.map((subtask, subtaskIndex) => (
              <div
                key={subtaskIndex}
                className="subtask"
                onClick={() => toggleSubtask(`${phaseIndex}-${subtaskIndex}`)}
              >
                <h2 className="subtask-title">
                {/* {`${String.fromCharCode(65 + subtaskIndex)} - ${subtask.description}`} */}
                {subtask.description}
                </h2>
                {/* <p className="subtask-description">{}</p> */}

                {expandedSubtasks[`${phaseIndex}-${subtaskIndex}`] && (
                  <div className="steps">
                    {subtask.steps.map((step, stepIndex) => (
                      <div
                        key={stepIndex}
                        className="step"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStepDetails(
                            `${phaseIndex}-${subtaskIndex}`,
                            stepIndex
                          );
                        }}
                      >
                        <div className="step-header">
                          <div className="step-indexCircle">{stepIndex + 1}</div>
                          <div className="step-name">{step.name}</div>
                          <div className={`step-roleCircle ${getRoleLabel(step.role)}`}>
                            {getRoleLabel(step.role)}
                          </div>
                        </div>

                        {expandedSteps[`${phaseIndex}-${subtaskIndex}-${stepIndex}`] && (
                          <div className="step-details">
                            <div className="step-attribute">
                              <strong>Objective</strong> <br />
                              {step.objective}
                            </div>
                            <div className="step-attribute">
                              <strong>Role</strong> <br />
                              {step.role}
                            </div>
                            <div className="step-attribute">
                              <strong>Rationale</strong> <br />
                              {step.rationale}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Workflow;
