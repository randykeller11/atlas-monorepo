import React from 'react';
import './Results.css';

const Results = ({ summary }) => {
  if (!summary) {
    return (
      <div className="results-container">
        <div className="results-loading">
          <div className="loading-spinner"></div>
          <p>Generating your career assessment results...</p>
        </div>
      </div>
    );
  }

  const renderSection = (title, content, icon) => {
    if (!content) return null;

    return (
      <div className="results-section">
        <div className="section-header">
          <span className="section-icon">{icon}</span>
          <h3>{title}</h3>
        </div>
        <div className="section-content">
          {typeof content === 'string' ? (
            <p>{content}</p>
          ) : Array.isArray(content) ? (
            <ul>
              {content.map((item, index) => (
                <li key={index}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
              ))}
            </ul>
          ) : (
            <div className="content-object">
              {Object.entries(content).map(([key, value]) => (
                <div key={key} className="content-item">
                  <strong>{key}:</strong> {Array.isArray(value) ? value.join(', ') : value}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="results-container">
      <div className="results-header">
        <h1>🎉 Your Career Assessment Results</h1>
        <p>Congratulations on completing your career exploration journey!</p>
      </div>

      <div className="results-content">
        {renderSection(
          "Summary of Your Responses",
          summary["1. Summary of Responses"] || summary.summaryOfResponses,
          "📋"
        )}

        {renderSection(
          "Career Matches",
          summary["2. Career Matches"] || summary.careerMatches,
          "🎯"
        )}

        {renderSection(
          "Salary Information",
          summary["3. Salary Information"] || summary.salaryInformation,
          "💰"
        )}

        {renderSection(
          "Education Path",
          summary["4. Education Path"] || summary.educationPath,
          "🎓"
        )}

        {renderSection(
          "Portfolio Recommendations",
          summary["5. Portfolio Recommendations"] || summary.portfolioRecommendations,
          "📁"
        )}

        {renderSection(
          "Networking Suggestions",
          summary["6. Networking Suggestions"] || summary.networkingSuggestions,
          "🤝"
        )}

        {renderSection(
          "Career Roadmap",
          summary["7. Career Roadmap"] || summary.careerRoadmap,
          "🗺️"
        )}
      </div>

      <div className="results-actions">
        <button 
          className="action-button primary"
          onClick={() => window.print()}
        >
          📄 Download Results
        </button>
        
        <button 
          className="action-button secondary"
          onClick={() => window.location.reload()}
        >
          🔄 Start New Assessment
        </button>
        
        <button 
          className="action-button secondary"
          onClick={() => {
            const text = `My Career Assessment Results:\n\n${JSON.stringify(summary, null, 2)}`;
            navigator.clipboard.writeText(text);
            alert('Results copied to clipboard!');
          }}
        >
          📋 Copy Results
        </button>
      </div>

      <div className="results-footer">
        <p>
          These results are based on your responses to our career assessment. 
          Consider them as guidance for your career exploration journey.
        </p>
        <p>
          <strong>Next Steps:</strong> Connect with a career counselor, explore the suggested 
          education paths, and start building your professional network in your areas of interest.
        </p>
      </div>
    </div>
  );
};

export default Results;
