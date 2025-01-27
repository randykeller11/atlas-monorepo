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

  const renderSection = (title, content) => (
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
          <p><strong>Interest Exploration:</strong> {summary["Summary of Responses"]?.["Interest Exploration"]}</p>
          <p><strong>Technical Aptitude:</strong> {summary["Summary of Responses"]?.["Technical Aptitude"]}</p>
          <p><strong>Work Style:</strong> {summary["Summary of Responses"]?.["Work Style"]}</p>
          <p><strong>Career Values:</strong> {summary["Summary of Responses"]?.["Career Values"]}</p>
        </div>
      ), 'Summary_of_Responses')}

      {renderSection("Career Matches", (
        <div>
          {Object.values(summary["Career Matches"] || {}).map((match, index) => (
            <div key={index} style={styles.careerMatch}>
              <div style={styles.matchHeader}>
                <span style={styles.matchPercentage}>{match.MatchPercentage?.replace('%', '')}%</span>
                <div style={styles.progressBarContainer}>
                  <div 
                    style={{
                      ...styles.progressBarFill,
                      width: match.MatchPercentage
                    }}
                  />
                </div>
                <span style={styles.matchTitle}>{match.Role}</span>
              </div>
              <p style={styles.matchExplanation}>{match.Explanation}</p>
            </div>
          ))}
        </div>
      ), 'Career_Matches')}

      {renderSection("Salary Information", (
        <div>
          {Object.entries(summary["Salary Information"] || {}).map(([role, info], index) => (
            <div key={index}>
              <h3>{role}</h3>
              <p>{info.SalaryRange}</p>
              <p><em>Career Progression: {info.Progression}</em></p>
            </div>
          ))}
        </div>
      ), 'Salary_Information')}

      {renderSection("Education Path", (
        <div>
          <div style={styles.educationSection}>
            <h3>Recommended Courses</h3>
            <ul style={styles.educationList}>
              {Array.isArray(summary["Education Path"]?.Courses) && summary["Education Path"].Courses.map((course, index) => (
                <li key={index} style={styles.educationItem}>
                  {course}
                </li>
              ))}
            </ul>
          </div>
          <div style={styles.educationSection}>
            <h3>Certifications</h3>
            <ul style={styles.educationList}>
              {Array.isArray(summary["Education Path"]?.Certifications) && summary["Education Path"].Certifications.map((cert, index) => (
                <li key={index} style={styles.educationItem}>
                  {cert}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ), 'Education_Path')}

      {renderSection("Portfolio Recommendations", (
        <ul>
          {summary["Portfolio Recommendations"]?.ProjectIdeas?.map((idea, index) => (
            <li key={index}>{idea}</li>
          ))}
          {summary["Portfolio Recommendations"]?.SkillBuildingActivities?.map((activity, index) => (
            <li key={`skill-${index}`}>{activity}</li>
          ))}
          {summary["Portfolio Recommendations"]?.OnlinePresenceSuggestions?.map((suggestion, index) => (
            <li key={`online-${index}`}>{suggestion}</li>
          ))}
        </ul>
      ), 'Portfolio_Recommendations')}

      {renderSection("Networking Suggestions", (
        <div>
          <h4>Professional Organizations</h4>
          <ul>
            {summary["Networking Suggestions"]?.ProfessionalOrganizations?.map((org, index) => (
              <li key={`prof-${index}`}>{org}</li>
            ))}
          </ul>
          <h4>Online Communities</h4>
          <ul>
            {summary["Networking Suggestions"]?.OnlineCommunities?.map((community, index) => (
              <li key={`online-${index}`}>{community}</li>
            ))}
          </ul>
          <h4>Local Tech Groups</h4>
          <ul>
            {summary["Networking Suggestions"]?.LocalTechGroups?.map((group, index) => (
              <li key={`local-${index}`}>{group}</li>
            ))}
          </ul>
          <h4>Student Organizations</h4>
          <ul>
            {summary["Networking Suggestions"]?.StudentOrganizations?.map((org, index) => (
              <li key={`student-${index}`}>{org}</li>
            ))}
          </ul>
        </div>
      ), 'Networking_Suggestions')}

      {renderSection("Career Roadmap", (
        <div>
          <h3>High School</h3>
          <p>{summary["Career Roadmap"]?.HighSchool}</p>
          <h3>College</h3>
          <p>{summary["Career Roadmap"]?.College}</p>
          <h3>Early Career</h3>
          <p>{summary["Career Roadmap"]?.EarlyCareer}</p>
          <h3>Long Term Development</h3>
          <p>{summary["Career Roadmap"]?.LongTermDevelopment}</p>
        </div>
      ), 'Career_Roadmap')}

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
