import React from "react";
import "../styles/Step.css";

const Step = ({ step, evidenceKey, onRoleCircleClick, evidence, loading }) => {
  const getSvgPath = () => {
    switch (step.classification) {
      case "Gather information from external sources":
        return "/icons/opt1.svg";
      case "Gather information from user":
        return "/icons/opt2.svg";
      case "Generate new information from knowledge base":
        return "/icons/opt3.svg";
      default:
        return null;
    }
  };

  return (
    <div className="step">
      <div className="step-header">
        <div className="step-indexCircle">
          {getSvgPath() ? (
            <img src={getSvgPath()} alt={`SVG for ${step.classification}`} />
          ) : null}
        </div>
        <div className="step-name">{step.name?.split(": ")[1]}</div>
        <div
          className={`step-roleCircle`}
          onClick={(e) => {
            e.stopPropagation();
            onRoleCircleClick();
          }}
        ></div>
      </div>

      {/* {
      <div className="step-details">
        <div className="step-attribute">
          <strong>Classification:</strong> <br />
          {step.classification}
        </div>
        <div className="step-attribute">
          <strong>Role:</strong> <br />
          {step.execution}
        </div>
        <div className="step-attribute">
          <strong>Evidence:</strong> <br />
          {loading
            ? "Loading evidence..."
            : evidence?.length
            ? evidence.slice(0, 20).map((item, index) => (
                <div key={index} style={{ marginBottom: "1em" }}>
                  <strong>Title:</strong> {item.title}
                  <br />
                  <strong>Link:</strong>{" "}
                  <a href={item.link} target="_blank" rel="noopener noreferrer">
                    {item.link}
                  </a>
                  <br />
                  <strong>Snippet:</strong> {item.snippet}
                </div>
              ))
            : "Click the role circle to fetch evidence."}
        </div>
      </div>
    } */}
    </div>
  );
};

export default Step;
