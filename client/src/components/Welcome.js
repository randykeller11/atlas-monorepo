import React, { useState } from 'react';
import './Welcome.css';

const Welcome = ({ onNameSubmit }) => {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onNameSubmit(name.trim());
    }
  };

  const handleDemoClick = async () => {
    setIsLoading(true);
    try {
      // Simply redirect to demo URL - let App.js handle the loading
      window.location.href = '/?demo=randy';
    } catch (error) {
      console.error('Error loading demo:', error);
      alert('Failed to load demo. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="welcome-container">
      <div className="welcome-card">
        <div className="welcome-header">
          <h1>Welcome to Atlas</h1>
          <p className="welcome-subtitle">Your AI-powered career guidance companion</p>
        </div>
        
        <div className="welcome-content">
          <p>
            Discover your career potential through our personalized assessment. 
            Atlas will help you explore your interests, understand your work style, 
            and find career paths that align with your unique strengths.
          </p>
          
          <form onSubmit={handleSubmit} className="name-form">
            <div className="input-group">
              <label htmlFor="name">What's your name?</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="name-input"
                disabled={isLoading}
              />
            </div>
            
            <button 
              type="submit" 
              className="start-button"
              disabled={!name.trim() || isLoading}
            >
              Start Your Journey
            </button>
          </form>
          
          <div className="demo-section">
            <div className="divider">
              <span>or</span>
            </div>
            
            <button 
              onClick={handleDemoClick}
              className="demo-button"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner"></div>
                  Loading Demo...
                </>
              ) : (
                <>
                  🎯 Try Randy Keller Demo
                </>
              )}
            </button>
            
            <p className="demo-description">
              See a completed assessment with "The Builder" persona card and career insights
            </p>
          </div>
        </div>
        
        <div className="welcome-features">
          <div className="feature">
            <div className="feature-icon">📊</div>
            <div className="feature-text">
              <h3>Personalized Assessment</h3>
              <p>10 thoughtful questions across 5 key areas</p>
            </div>
          </div>
          
          <div className="feature">
            <div className="feature-icon">🎭</div>
            <div className="feature-text">
              <h3>Career Persona</h3>
              <p>Discover your unique professional archetype</p>
            </div>
          </div>
          
          <div className="feature">
            <div className="feature-icon">🚀</div>
            <div className="feature-text">
              <h3>AI Guidance</h3>
              <p>Get personalized career coaching and insights</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Welcome;
