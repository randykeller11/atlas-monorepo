import React from 'react';

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '30px',
  },
  section: {
    backgroundColor: '#ffffff',
    padding: '20px',
    marginBottom: '20px',
    borderRadius: '6px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  sectionTitle: {
    color: '#333',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px',
    marginBottom: '15px',
  },
  roleMatch: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '15px',
  },
  percentage: {
    width: '60px',
    textAlign: 'right',
    marginRight: '10px',
    fontWeight: 'bold',
  },
  progressBar: {
    flex: 1,
    height: '20px',
    backgroundColor: '#e0e0e0',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    transition: 'width 0.3s ease',
  },
  loadingSection: {
    minHeight: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: '6px',
    margin: '10px 0'
  },
  loadingDots: {
    display: 'flex',
    gap: '8px'
  },
  loadingDot: {
    width: '10px',
    height: '10px',
    backgroundColor: '#4CAF50',
    borderRadius: '50%',
    animation: 'bounce 1s infinite ease-in-out'
  },
  sectionContent: {
    opacity: 1,
    transition: 'opacity 0.3s ease-in'
  }
};

const Results = ({ summary }) => {
  if (!summary) return null;

  const LoadingPlaceholder = () => (
    <div style={styles.loadingSection}>
      <div style={styles.loadingDots}>
        <div style={{...styles.loadingDot, animationDelay: '0s'}} />
        <div style={{...styles.loadingDot, animationDelay: '0.2s'}} />
        <div style={{...styles.loadingDot, animationDelay: '0.4s'}} />
      </div>
    </div>
  );

  const renderSection = (title, content, sectionKey) => (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      {summary[sectionKey] === null ? (
        <LoadingPlaceholder />
      ) : (
        <div style={styles.sectionContent}>
          {content}
        </div>
      )}
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Your Career Assessment Results</h1>
      </div>

      {renderSection("Summary of Responses", (
        <div>
          <p><strong>Interest Exploration:</strong> {summary.summaryOfResponses?.interestExploration}</p>
          <p><strong>Technical Aptitude:</strong> {summary.summaryOfResponses?.technicalAptitude}</p>
          <p><strong>Work Style:</strong> {summary.summaryOfResponses?.workStyle}</p>
          <p><strong>Career Values:</strong> {summary.summaryOfResponses?.careerValues}</p>
        </div>
      ), 'summaryOfResponses')}

      {renderSection("Career Matches", (
        <div>
          {summary.careerMatches?.map((match, index) => (
            <div key={index} style={styles.roleMatch}>
              <span style={styles.percentage}>{match.match}%</span>
              <div style={styles.progressBar}>
                <div 
                  style={{
                    ...styles.progressFill,
                    width: `${match.match}%`,
                  }}
                />
              </div>
              <span style={{ marginLeft: '10px' }}>{match.role}</span>
              <p>{match.explanation}</p>
            </div>
          ))}
        </div>
      ), 'careerMatches')}

      {renderSection("Salary Information", (
        <div>
          {summary.salaryInformation?.map((range, index) => (
            <div key={index}>
              <h3>{range.role}</h3>
              <p>{range.salary}</p>
            </div>
          ))}
        </div>
      ), 'salaryInformation')}

      {renderSection("Education Path", (
        <div>
          <h3>Recommended Courses</h3>
          <ul>
            {summary.educationPath?.courses?.map((course, index) => (
              <li key={index}>{course}</li>
            ))}
          </ul>
          <h3>Certifications</h3>
          <ul>
            {summary.educationPath?.certifications?.map((cert, index) => (
              <li key={index}>{cert}</li>
            ))}
          </ul>
        </div>
      ), 'educationPath')}

      {renderSection("Portfolio Recommendations", (
        <ul>
          {summary.portfolioRecommendations?.map((suggestion, index) => (
            <li key={index}>{suggestion}</li>
          ))}
        </ul>
      ), 'portfolioRecommendations')}

      {renderSection("Networking Suggestions", (
        <ul>
          {summary.networkingSuggestions?.map((suggestion, index) => (
            <li key={index}>{suggestion}</li>
          ))}
        </ul>
      ), 'networkingSuggestions')}

      {renderSection("Career Roadmap", (
        <div>
          <h3>High School</h3>
          <p>{summary.careerRoadmap?.highSchool}</p>
          <h3>College</h3>
          <p>{summary.careerRoadmap?.college}</p>
          <h3>Early Career</h3>
          <p>{summary.careerRoadmap?.earlyCareer}</p>
          <h3>Long-term Development</h3>
          <p>{summary.careerRoadmap?.longTerm}</p>
        </div>
      ), 'careerRoadmap')}

      <style>
        {`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
        `}
      </style>
    </div>
  );
};

export default Results;
