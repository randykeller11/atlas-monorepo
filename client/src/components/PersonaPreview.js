import React from 'react';
import './PersonaPreview.css';

const PersonaPreview = ({ persona, onViewFullCard, isLoading }) => {
  if (isLoading) {
    return (
      <div className="persona-preview loading">
        <div className="loading-spinner"></div>
        <p>Analyzing your responses...</p>
      </div>
    );
  }

  if (!persona) {
    return null;
  }

  return (
    <div className="persona-preview">
      <div className="preview-header">
        <h3>Your Career Persona</h3>
        <div className="confidence-badge">
          {Math.round(persona.primary.confidence * 100)}% match
        </div>
      </div>
      
      <div className="preview-content">
        <h4 className="archetype-name">{persona.primary.name}</h4>
        <p className="archetype-description">
          {persona.primary.traits.slice(0, 3).join(', ')}
        </p>
        
        <div className="preview-strengths">
          <strong>Key Strengths:</strong>
          <div className="strength-tags">
            {persona.primary.traits.slice(0, 2).map((trait, index) => (
              <span key={index} className="strength-tag-mini">
                {trait}
              </span>
            ))}
            {persona.primary.traits.length > 2 && (
              <span className="more-indicator">
                +{persona.primary.traits.length - 2} more
              </span>
            )}
          </div>
        </div>
        
        <div className="preview-careers">
          <strong>Career Fit:</strong>
          <p>{persona.primary.careerFit.slice(0, 2).join(', ')}</p>
        </div>
      </div>
      
      <div className="preview-actions">
        <button onClick={onViewFullCard} className="view-card-btn">
          View Full Persona Card
        </button>
      </div>
    </div>
  );
};

export default PersonaPreview;
