import React, { useState, useEffect } from 'react';
import './PersonaCard.css';

const PersonaCard = ({ sessionId, personaCard, onClose, onEnrichPersona }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleEnrichPersona = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await onEnrichPersona();
    } catch (err) {
      setError('Failed to enrich persona. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(personaCard, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `persona-card-${personaCard.basePersona.key}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `My Career Persona: ${personaCard.archetypeName}`,
          text: personaCard.elevatorPitch,
          url: window.location.href
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: copy to clipboard
      const shareText = `My Career Persona: ${personaCard.archetypeName}\n\n${personaCard.elevatorPitch}`;
      navigator.clipboard.writeText(shareText);
      alert('Persona card copied to clipboard!');
    }
  };

  if (!personaCard) {
    return (
      <div className="persona-card-container">
        <div className="persona-card-empty">
          <h2>No Persona Card Available</h2>
          <p>Complete the assessment to generate your personalized career persona card.</p>
          <button onClick={onClose} className="btn-secondary">
            Continue Assessment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="persona-card-overlay">
      <div className="persona-card-container">
        <div className="persona-card">
          <div className="persona-card-header">
            <h1 className="archetype-name">{personaCard.archetypeName}</h1>
            <button onClick={onClose} className="close-button">×</button>
          </div>

          <div className="persona-card-content">
            <div className="persona-section">
              <h3>About You</h3>
              <p className="short-description">{personaCard.shortDescription}</p>
            </div>

            <div className="persona-section">
              <h3>Your Elevator Pitch</h3>
              <div className="elevator-pitch">
                <p>"{personaCard.elevatorPitch}"</p>
              </div>
            </div>

            <div className="persona-section">
              <h3>Top Strengths</h3>
              <div className="strengths-grid">
                {personaCard.topStrengths.map((strength, index) => (
                  <div key={index} className="strength-tag">
                    {strength}
                  </div>
                ))}
              </div>
            </div>

            <div className="persona-section">
              <h3>Suggested Career Roles</h3>
              <div className="roles-grid">
                {personaCard.suggestedRoles.map((role, index) => (
                  <div key={index} className="role-card">
                    {role}
                  </div>
                ))}
              </div>
            </div>

            <div className="persona-section">
              <h3>Next Steps</h3>
              <ol className="next-steps-list">
                {personaCard.nextSteps.map((step, index) => (
                  <li key={index} className="next-step">
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="persona-section motivational">
              <h3>Your Career Insight</h3>
              <div className="motivational-insight">
                <p>"{personaCard.motivationalInsight}"</p>
              </div>
            </div>

            <div className="persona-metadata">
              <p className="created-date">
                Created: {new Date(personaCard.createdAt).toLocaleDateString()}
              </p>
              <p className="confidence-score">
                Based on {Math.round(personaCard.basePersona.confidence * 100)}% confidence match
              </p>
            </div>
          </div>

          <div className="persona-card-actions">
            <button 
              onClick={handleEnrichPersona} 
              className="btn-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Enriching...' : 'Refresh Insights'}
            </button>
            <button onClick={handleExport} className="btn-secondary">
              Export Card
            </button>
            <button onClick={handleShare} className="btn-secondary">
              Share
            </button>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PersonaCard;
