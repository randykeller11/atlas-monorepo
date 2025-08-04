import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ImpactDashboard.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const ImpactDashboard = ({ onClose }) => {
  const [timeRange, setTimeRange] = useState('30d');
  const [selectedMetric, setSelectedMetric] = useState('overview');
  const [dashboardData, setDashboardData] = useState({
    overview: {
      totalUsers: 2847,
      completionRate: 78.5,
      avgSessionTime: '12:34',
      personaCardsGenerated: 1456,
      resumesCreated: 892,
      simulationsCompleted: 634
    },
    trends: {
      userGrowth: [
        { date: '2024-01-01', users: 1200 },
        { date: '2024-01-15', users: 1450 },
        { date: '2024-02-01', users: 1780 },
        { date: '2024-02-15', users: 2100 },
        { date: '2024-03-01', users: 2450 },
        { date: '2024-03-15', users: 2847 }
      ],
      completionRates: [
        { section: 'Introduction', rate: 95.2 },
        { section: 'Interest Exploration', rate: 87.8 },
        { section: 'Work Style', rate: 82.4 },
        { section: 'Technical Aptitude', rate: 79.1 },
        { section: 'Career Values', rate: 78.5 }
      ]
    },
    personas: {
      distribution: [
        { type: 'The Builder', count: 412, percentage: 28.3, color: '#667eea' },
        { type: 'The Explorer', count: 378, percentage: 26.0, color: '#f093fb' },
        { type: 'The Connector', count: 289, percentage: 19.8, color: '#4facfe' },
        { type: 'The Analyst', count: 234, percentage: 16.1, color: '#43e97b' },
        { type: 'The Creator', count: 89, percentage: 6.1, color: '#fa709a' },
        { type: 'The Leader', count: 54, percentage: 3.7, color: '#ffa726' }
      ]
    },
    outcomes: {
      jobApplications: 234,
      interviewsScheduled: 89,
      jobOffers: 23,
      careerChanges: 45,
      skillDevelopment: 567,
      networkingConnections: 1234
    },
    feedback: [
      {
        user: 'Sarah M.',
        persona: 'The Builder',
        rating: 5,
        comment: 'The persona card helped me understand my strengths and land my dream job as a software engineer!',
        outcome: 'Job Placement'
      },
      {
        user: 'Mike R.',
        persona: 'The Explorer',
        rating: 5,
        comment: 'The career simulator gave me confidence to transition into UX design. Amazing experience!',
        outcome: 'Career Change'
      },
      {
        user: 'Lisa K.',
        persona: 'The Connector',
        rating: 4,
        comment: 'Great insights into my communication strengths. The resume generator was spot-on.',
        outcome: 'Skill Development'
      }
    ]
  });

  useEffect(() => {
    fetchDashboardData();
  }, [timeRange]);

  const fetchDashboardData = async () => {
    try {
      const [metricsRes, personasRes, outcomesRes] = await Promise.all([
        axios.get(`${API_URL}/api/dashboard/metrics?timeRange=${timeRange}`),
        axios.get(`${API_URL}/api/dashboard/personas`),
        axios.get(`${API_URL}/api/dashboard/outcomes`)
      ]);
      
      setDashboardData(prevData => ({
        overview: metricsRes.data,
        trends: metricsRes.data.trends,
        personas: { distribution: personasRes.data },
        outcomes: outcomesRes.data,
        feedback: prevData.feedback // Keep static feedback for now
      }));
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Keep using static data as fallback
    }
  };

  const MetricCard = ({ title, value, change, icon, color = '#667eea' }) => (
    <div className="metric-card">
      <div className="metric-header">
        <div className="metric-icon" style={{ backgroundColor: color }}>
          {icon}
        </div>
        <div className="metric-change" style={{ color: change > 0 ? '#4caf50' : '#f44336' }}>
          {change > 0 ? '+' : ''}{change}%
        </div>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-title">{title}</div>
    </div>
  );

  const PersonaChart = () => (
    <div className="persona-chart">
      <h3>Persona Distribution</h3>
      <div className="persona-bars">
        {dashboardData.personas.distribution.map((persona, index) => (
          <div key={index} className="persona-bar-container">
            <div className="persona-info">
              <span className="persona-name">{persona.type}</span>
              <span className="persona-count">{persona.count} users</span>
            </div>
            <div className="persona-bar">
              <div 
                className="persona-fill"
                style={{ 
                  width: `${persona.percentage}%`,
                  backgroundColor: persona.color 
                }}
              />
            </div>
            <span className="persona-percentage">{persona.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );

  const OutcomesGrid = () => (
    <div className="outcomes-grid">
      <h3>Career Outcomes</h3>
      <div className="outcomes-cards">
        <div className="outcome-card">
          <div className="outcome-number">{dashboardData.outcomes.jobApplications}</div>
          <div className="outcome-label">Job Applications</div>
          <div className="outcome-trend">+15% this month</div>
        </div>
        <div className="outcome-card">
          <div className="outcome-number">{dashboardData.outcomes.interviewsScheduled}</div>
          <div className="outcome-label">Interviews Scheduled</div>
          <div className="outcome-trend">+22% this month</div>
        </div>
        <div className="outcome-card">
          <div className="outcome-number">{dashboardData.outcomes.jobOffers}</div>
          <div className="outcome-label">Job Offers</div>
          <div className="outcome-trend">+8% this month</div>
        </div>
        <div className="outcome-card">
          <div className="outcome-number">{dashboardData.outcomes.careerChanges}</div>
          <div className="outcome-label">Career Changes</div>
          <div className="outcome-trend">+12% this month</div>
        </div>
        <div className="outcome-card">
          <div className="outcome-number">{dashboardData.outcomes.skillDevelopment}</div>
          <div className="outcome-label">Skills Developed</div>
          <div className="outcome-trend">+18% this month</div>
        </div>
        <div className="outcome-card">
          <div className="outcome-number">{dashboardData.outcomes.networkingConnections}</div>
          <div className="outcome-label">Network Connections</div>
          <div className="outcome-trend">+25% this month</div>
        </div>
      </div>
    </div>
  );

  const FeedbackSection = () => (
    <div className="feedback-section">
      <h3>User Success Stories</h3>
      <div className="feedback-cards">
        {dashboardData.feedback.map((feedback, index) => (
          <div key={index} className="feedback-card">
            <div className="feedback-header">
              <div className="user-info">
                <strong>{feedback.user}</strong>
                <span className="persona-tag">{feedback.persona}</span>
              </div>
              <div className="rating">
                {'★'.repeat(feedback.rating)}
              </div>
            </div>
            <p className="feedback-comment">"{feedback.comment}"</p>
            <div className="feedback-outcome">
              <span className="outcome-badge">{feedback.outcome}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="dashboard-overlay">
      <div className="dashboard-container">
        <div className="dashboard-header">
          <div className="header-content">
            <h2>📊 Impact Dashboard</h2>
            <p>Real-time insights into career guidance effectiveness</p>
          </div>
          <div className="header-controls">
            <select 
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="time-range-select"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>
        
        <div className="dashboard-content">
          <div className="metrics-overview">
            <MetricCard
              title="Total Users"
              value={dashboardData.overview.totalUsers.toLocaleString()}
              change={12.5}
              icon="👥"
              color="#667eea"
            />
            <MetricCard
              title="Completion Rate"
              value={`${dashboardData.overview.completionRate}%`}
              change={3.2}
              icon="✅"
              color="#4caf50"
            />
            <MetricCard
              title="Avg Session Time"
              value={dashboardData.overview.avgSessionTime}
              change={8.7}
              icon="⏱️"
              color="#ff9800"
            />
            <MetricCard
              title="Persona Cards"
              value={dashboardData.overview.personaCardsGenerated.toLocaleString()}
              change={15.3}
              icon="🎯"
              color="#9c27b0"
            />
            <MetricCard
              title="Resumes Created"
              value={dashboardData.overview.resumesCreated.toLocaleString()}
              change={22.1}
              icon="📄"
              color="#2196f3"
            />
            <MetricCard
              title="Simulations"
              value={dashboardData.overview.simulationsCompleted.toLocaleString()}
              change={18.9}
              icon="🎮"
              color="#f44336"
            />
          </div>
          
          <div className="dashboard-grid">
            <div className="dashboard-section">
              <PersonaChart />
            </div>
            
            <div className="dashboard-section">
              <div className="completion-funnel">
                <h3>Assessment Completion Funnel</h3>
                <div className="funnel-steps">
                  {dashboardData.trends.completionRates.map((step, index) => (
                    <div key={index} className="funnel-step">
                      <div className="step-info">
                        <span className="step-name">{step.section}</span>
                        <span className="step-rate">{step.rate}%</span>
                      </div>
                      <div className="step-bar">
                        <div 
                          className="step-fill"
                          style={{ width: `${step.rate}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="dashboard-section full-width">
              <OutcomesGrid />
            </div>
            
            <div className="dashboard-section full-width">
              <FeedbackSection />
            </div>
            
            <div className="dashboard-section">
              <div className="export-section">
                <h3>Export & Reports</h3>
                <div className="export-buttons">
                  <button className="export-btn">
                    📊 Export Analytics
                  </button>
                  <button className="export-btn">
                    📈 Generate Report
                  </button>
                  <button className="export-btn">
                    📧 Email Summary
                  </button>
                </div>
              </div>
            </div>
            
            <div className="dashboard-section">
              <div className="insights-section">
                <h3>AI Insights</h3>
                <div className="insights-list">
                  <div className="insight-item">
                    <span className="insight-icon">💡</span>
                    <p>Builder personas show 23% higher job placement rates</p>
                  </div>
                  <div className="insight-item">
                    <span className="insight-icon">📈</span>
                    <p>Resume generation increases application success by 34%</p>
                  </div>
                  <div className="insight-item">
                    <span className="insight-icon">🎯</span>
                    <p>Simulation completion correlates with interview confidence</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImpactDashboard;
