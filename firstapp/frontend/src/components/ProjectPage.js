import React, { useState } from 'react';
import axios from 'axios';
import Workflow from './Workflow';
import '../styles/ProjectPage.css'; // Adjust the path to the styles folder

const ProjectPage = () => {
    const [input, setInput] = useState('');
    const [workflow, setWorkflow] = useState(null);
    const [phaseNames, setPhaseNames] = useState(null); // Track phase names in state
    const [loading, setLoading] = useState(false); // Track loading state

    const handleSubmit = async () => {
        if (!input.trim()) return; // Prevent empty input submission
        setLoading(true); // Start loading
        try {
        const response = await axios.post('http://127.0.0.1:8000/api/process', 
            { user_input: input },
            { headers: { 'Content-Type': 'application/json' } }
          );

        const { wf, phase_names } = response.data;
        console.error("record workflow", response.data)

        const parsedWorkflow = Object.entries(wf).map(([subtaskName, details]) => ({
            name: subtaskName,
            description: details.description,
            // steps: details.workflow.split('Step'), 
            steps: details.workflow.map((step) => ({
                name: step.name,
                objective: step.objective,
                rationale: step.rationale,
                role: step.role,
            })), 
            phase: details.phase,
        }));

        setWorkflow(parsedWorkflow); // Set workflow        
        setPhaseNames(phase_names); // Set phase names
        } catch (error) {
        console.error('Error generating workflow:', error);
        } finally {
        setLoading(false); // Stop loading
        }


    };

    return (
        <div className="null-wrapper">
        {!workflow ? (
            <div className="content-wrapper">
            <div className="center-message">
                <h2>What do you want to do in this project?</h2>
            </div>
            <div className="input-container">
                <input
                type="text"
                placeholder="Tell us a task that you want to do in one sentence, and we will figure it out steps by steps!"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                />
                <button onClick={handleSubmit} disabled={loading}>
                {loading ? (
                    <span className="spinner"></span>
                ) : (
                    <i className="fas fa-paper-plane"></i>
                )}
                </button>
            </div>
            </div>
        ) : (
            <Workflow workflow={workflow} phaseDict={phaseNames} />

        )}
        </div>

    );
};

export default ProjectPage;
