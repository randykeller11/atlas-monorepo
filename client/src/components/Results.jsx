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
};

const Results = ({ summary }) => {
  if (!summary) return null;

  const {
    roleMatches,
    salaryRanges,
    recommendedCourses,
    portfolioSuggestions,
    networkingOpportunities,
    careerRoadmap,
  } = summary;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Your Career Assessment Results</h1>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Recommended Roles</h2>
        {roleMatches?.map((role, index) => (
          <div key={index} style={styles.roleMatch}>
            <span style={styles.percentage}>{role.match}%</span>
            <div style={styles.progressBar}>
              <div 
                style={{
                  ...styles.progressFill,
                  width: `${role.match}%`,
                }}
              />
            </div>
            <span style={{ marginLeft: '10px' }}>{role.title}</span>
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Salary Ranges</h2>
        {salaryRanges?.map((range, index) => (
          <div key={index}>
            <h3>{range.role}</h3>
            <p>{range.range}</p>
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Recommended Courses & Certifications</h2>
        <ul>
          {recommendedCourses?.map((course, index) => (
            <li key={index}>{course}</li>
          ))}
        </ul>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Portfolio Building Suggestions</h2>
        <ul>
          {portfolioSuggestions?.map((suggestion, index) => (
            <li key={index}>{suggestion}</li>
          ))}
        </ul>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Networking Opportunities</h2>
        <ul>
          {networkingOpportunities?.map((opportunity, index) => (
            <li key={index}>{opportunity}</li>
          ))}
        </ul>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Career Roadmap</h2>
        <div>{careerRoadmap}</div>
      </div>
    </div>
  );
};

export default Results;
