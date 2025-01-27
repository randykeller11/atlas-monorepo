import React, { useRef } from 'react';
import html2pdf from 'html2pdf.js';

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
  },
  careerMatch: {
    backgroundColor: '#f8f8f8',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '15px'
  },
  matchHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px'
  },
  matchPercentage: {
    width: '60px',
    textAlign: 'right',
    marginRight: '15px',
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#4CAF50'
  },
  matchTitle: {
    flex: 1,
    fontSize: '18px',
    fontWeight: '500',
    marginLeft: '15px'
  },
  matchExplanation: {
    marginTop: '8px',
    color: '#666',
    fontSize: '14px',
    lineHeight: '1.4'
  },
  progressBarContainer: {
    flex: 1,
    height: '12px',
    backgroundColor: '#e0e0e0',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: '6px',
    transition: 'width 0.3s ease'
  },
  educationSection: {
    marginBottom: '20px'
  },
  educationList: {
    listStyle: 'none',
    padding: 0,
    margin: '10px 0'
  },
  educationItem: {
    padding: '8px 12px',
    backgroundColor: '#f8f8f8',
    borderRadius: '4px',
    marginBottom: '8px',
    fontSize: '14px',
    lineHeight: '1.4'
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
  loadingOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000
  },
  loadingContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px'
  },
  loadingLogo: {
    width: '200px',
    height: 'auto'
  },
  loadingProgressContainer: {
    width: '300px',
    textAlign: 'center'
  },
  loadingProgress: {
    width: '100%',
    height: '4px',
    backgroundColor: '#e0e0e0',
    borderRadius: '2px',
    overflow: 'hidden'
  },
  loadingProgressBar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    animation: 'loading 2s infinite ease-in-out'
  },
  loadingText: {
    margin: '10px 0 0 0',
    color: '#666',
    fontSize: '16px',
    fontWeight: '500'
  },
  sectionContent: {
    opacity: 1,
    transition: 'opacity 0.3s ease-in'
  },
  downloadButton: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 24px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '30px',
    cursor: 'pointer',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '16px',
    transition: 'all 0.3s ease',
    '&:hover': {
      backgroundColor: '#45a049',
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
    }
  },
  resultsContent: {
    marginBottom: '60px'
  }
};

const Results = ({ summary }) => {
  const resultsRef = useRef(null);

  const handleDownload = () => {
    const element = resultsRef.current;
    const opt = {
      margin: 1,
      filename: 'career-assessment-results.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    // Remove the download button temporarily for PDF generation
    const downloadButton = element.querySelector('#downloadButton');
    if (downloadButton) {
      downloadButton.style.display = 'none';
    }

    html2pdf().set(opt).from(element).save().then(() => {
      // Restore the download button after PDF generation
      if (downloadButton) {
        downloadButton.style.display = 'flex';
      }
    });
  };
  if (!summary) return null;

  const LoadingPlaceholder = () => (
    <div style={styles.loadingOverlay}>
      <div style={styles.loadingContent}>
        <img 
          src="/images/NucoordLogo.PNG"
          alt="Nucoord Logo"
          style={styles.loadingLogo}
        />
        <div style={styles.loadingProgressContainer}>
          <div style={styles.loadingProgress}>
            <div style={styles.loadingProgressBar}></div>
          </div>
          <p style={styles.loadingText}>Generating your career assessment...</p>
        </div>
      </div>
    </div>
  );

  // Check if any section is still loading
  const isLoading = Object.values(summary).some(section => section === null);

  const renderSection = (title, content, sectionKey) => (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.sectionContent}>
        {content}
      </div>
    </div>
  );

  return (
    <div ref={resultsRef} style={styles.container}>
      {isLoading && <LoadingPlaceholder />}
      
      <div style={styles.resultsContent}>
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
            <div key={index} style={styles.careerMatch}>
              <div style={styles.matchHeader}>
                <span style={styles.matchPercentage}>{match.match}%</span>
                <div style={styles.progressBarContainer}>
                  <div 
                    style={{
                      ...styles.progressBarFill,
                      width: `${match.match}%`
                    }}
                  />
                </div>
                <span style={styles.matchTitle}>{match.role}</span>
              </div>
              <p style={styles.matchExplanation}>{match.explanation}</p>
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
          <div style={styles.educationSection}>
            <h3>Recommended Courses</h3>
            <ul style={styles.educationList}>
              {Array.isArray(summary.educationPath?.courses) && summary.educationPath.courses.map((course, index) => (
                <li key={index} style={styles.educationItem}>
                  {course}
                </li>
              ))}
              {(!Array.isArray(summary.educationPath?.courses) || summary.educationPath?.courses.length === 0) && (
                <li style={styles.educationItem}>
                  No specific courses recommended at this time.
                </li>
              )}
            </ul>
          </div>
          <div style={styles.educationSection}>
            <h3>Certifications</h3>
            <ul style={styles.educationList}>
              {Array.isArray(summary.educationPath?.certifications) && summary.educationPath.certifications.map((cert, index) => (
                <li key={index} style={styles.educationItem}>
                  {cert}
                </li>
              ))}
              {(!Array.isArray(summary.educationPath?.certifications) || summary.educationPath?.certifications.length === 0) && (
                <li style={styles.educationItem}>
                  No specific certifications recommended at this time.
                </li>
              )}
            </ul>
          </div>
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
          @keyframes loading {
            0% {
              width: 0%;
              left: 0%;
            }
            50% {
              width: 100%;
              left: 0%;
            }
            100% {
              width: 0%;
              left: 100%;
            }
          }
        `}
      </style>
      </div>

      {!isLoading && (
        <button 
          id="downloadButton"
          onClick={handleDownload} 
          style={styles.downloadButton}
        >
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Download PDF
        </button>
      )}
    </div>
  );
};

export default Results;
