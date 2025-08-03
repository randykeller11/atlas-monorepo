import React from 'react';
import './AssessmentProgress.css';

const AssessmentProgress = ({ 
  questionsCompleted, 
  totalQuestions, 
  currentSection, 
  sections = {},
  onViewPersona,
  hasPersona = false
}) => {
  const progressPercentage = Math.round((questionsCompleted / totalQuestions) * 100);
  
  const sectionInfo = {
    introduction: { name: 'Introduction', color: '#667eea' },
    interestExploration: { name: 'Interest Exploration', color: '#f093fb' },
    workStyle: { name: 'Work Style', color: '#4facfe' },
    technicalAptitude: { name: 'Technical Aptitude', color: '#43e97b' },
    careerValues: { name: 'Career Values', color: '#fa709a' },
    summary: { name: 'Complete', color: '#38ef7d' }
  };

  const getSectionStatus = (sectionKey, sectionCount) => {
    const maxQuestions = {
      introduction: 1,
      interestExploration: 2,
      workStyle: 2,
      technicalAptitude: 2,
      careerValues: 3
    };
    
    const max = maxQuestions[sectionKey] || 0;
    const completed = sectionCount || 0;
    
    if (completed >= max) return 'completed';
    if (sectionKey === currentSection) return 'current';
    if (completed > 0) return 'partial';
    return 'pending';
  };

  return (
    <div className="assessment-progress">
      <div className="progress-header">
        <h3>Assessment Progress</h3>
        <div className="progress-stats">
          <span className="progress-fraction">
            {questionsCompleted}/{totalQuestions}
          </span>
          <span className="progress-percentage">
            {progressPercentage}%
          </span>
        </div>
      </div>
      
      <div className="progress-bar-container">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ 
              width: `${progressPercentage}%`,
              background: `linear-gradient(90deg, ${sectionInfo[currentSection]?.color || '#667eea'}, #764ba2)`
            }}
          />
        </div>
      </div>
      
      <div className="sections-overview">
        {Object.entries(sectionInfo).map(([key, info]) => {
          if (key === 'summary') return null;
          
          const status = getSectionStatus(key, sections[key]);
          const isActive = key === currentSection;
          
          return (
            <div 
              key={key} 
              className={`section-indicator ${status} ${isActive ? 'active' : ''}`}
            >
              <div 
                className="section-dot"
                style={{ backgroundColor: status === 'completed' ? info.color : undefined }}
              />
              <span className="section-name">{info.name}</span>
              <span className="section-count">
                {sections[key] || 0}
              </span>
            </div>
          );
        })}
      </div>
      
      {progressPercentage >= 60 && hasPersona && (
        <div className="persona-prompt">
          <div className="persona-prompt-content">
            <h4>🎯 Your Career Persona is Ready!</h4>
            <p>We've analyzed your responses and identified your career archetype.</p>
            <button onClick={onViewPersona} className="view-persona-btn">
              View My Persona
            </button>
          </div>
        </div>
      )}
      
      {progressPercentage === 100 && (
        <div className="completion-celebration">
          <div className="celebration-content">
            <h4>🎉 Assessment Complete!</h4>
            <p>Great job! You've completed all {totalQuestions} questions.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentProgress;
