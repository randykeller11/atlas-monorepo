import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DayInLifeSimulator.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const DayInLifeSimulator = ({ onClose, personaCard, sessionId }) => {
  const [currentScenario, setCurrentScenario] = useState(0);
  const [score, setScore] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [customerSatisfaction, setCustomerSatisfaction] = useState(85);
  const [isComplete, setIsComplete] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [feedback, setFeedback] = useState('');

  // Help Desk Scenarios
  const scenarios = [
    {
      id: 1,
      title: "Password Reset Request",
      description: "Sarah from Marketing calls in frustrated. She's been locked out of her email for 2 hours and has an important client presentation in 30 minutes.",
      customerMood: "frustrated",
      difficulty: "easy",
      choices: [
        {
          id: 'a',
          text: "Immediately reset her password and send new credentials",
          score: 15,
          feedback: "Good quick response! You prioritized urgency and customer needs.",
          impact: { time: -2, satisfaction: +10 }
        },
        {
          id: 'b', 
          text: "Ask her to verify identity with 3 security questions first",
          score: 10,
          feedback: "Security-conscious but may frustrate an already upset customer.",
          impact: { time: +3, satisfaction: -5 }
        },
        {
          id: 'c',
          text: "Transfer her to the security team for proper verification",
          score: 5,
          feedback: "Following protocol but creating delays for urgent request.",
          impact: { time: +8, satisfaction: -15 }
        }
      ]
    },
    {
      id: 2,
      title: "Software Installation Issue",
      description: "John from Finance needs help installing new accounting software. He's not very tech-savvy and seems overwhelmed by the error messages.",
      customerMood: "confused",
      difficulty: "medium",
      choices: [
        {
          id: 'a',
          text: "Walk him through each step slowly and patiently",
          score: 20,
          feedback: "Excellent! Patient guidance builds confidence and ensures success.",
          impact: { time: +5, satisfaction: +15 }
        },
        {
          id: 'b',
          text: "Send him a detailed email with installation steps",
          score: 8,
          feedback: "Efficient but may not help someone who's already overwhelmed.",
          impact: { time: -1, satisfaction: -8 }
        },
        {
          id: 'c',
          text: "Remote into his computer and install it yourself",
          score: 12,
          feedback: "Quick solution but doesn't teach the user for next time.",
          impact: { time: -3, satisfaction: +5 }
        }
      ]
    },
    {
      id: 3,
      title: "Network Connectivity Problem",
      description: "The entire Sales department reports intermittent internet connectivity. This is affecting their ability to access the CRM system during peak sales hours.",
      customerMood: "urgent",
      difficulty: "hard",
      choices: [
        {
          id: 'a',
          text: "Escalate immediately to Network Operations Center",
          score: 18,
          feedback: "Smart escalation! Department-wide issues need specialized attention.",
          impact: { time: +2, satisfaction: +12 }
        },
        {
          id: 'b',
          text: "Troubleshoot individual workstations one by one",
          score: 6,
          feedback: "Thorough but inefficient for a department-wide issue.",
          impact: { time: +15, satisfaction: -10 }
        },
        {
          id: 'c',
          text: "Check network infrastructure and document findings",
          score: 15,
          feedback: "Good diagnostic approach, but may need faster escalation.",
          impact: { time: +8, satisfaction: +5 }
        }
      ]
    },
    {
      id: 4,
      title: "Printer Malfunction",
      description: "The main office printer is jamming constantly. Multiple employees are waiting to print important documents for today's board meeting.",
      customerMood: "impatient",
      difficulty: "medium",
      choices: [
        {
          id: 'a',
          text: "Guide users to alternative printers while you fix the main one",
          score: 17,
          feedback: "Great problem-solving! You minimized disruption while addressing the root cause.",
          impact: { time: +3, satisfaction: +8 }
        },
        {
          id: 'b',
          text: "Focus entirely on fixing the main printer first",
          score: 10,
          feedback: "Focused approach but leaves users waiting unnecessarily.",
          impact: { time: +6, satisfaction: -5 }
        },
        {
          id: 'c',
          text: "Call the printer vendor for immediate service",
          score: 12,
          feedback: "Good for complex issues, but this might be something you can handle.",
          impact: { time: +10, satisfaction: +2 }
        }
      ]
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      if (!isComplete) {
        setTimeElapsed(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isComplete]);

  const handleChoiceSelect = async (choice) => {
    setSelectedChoice(choice);
    setFeedback(choice.feedback);
    
    try {
      const response = await axios.post(
        `${API_URL}/api/simulator/${sessionId}/respond`,
        {
          scenarioId: currentScenario,
          choiceId: choice.id,
          responseTime: 30 // You could track actual response time
        }
      );
      
      setScore(response.data.currentScore);
      setCustomerSatisfaction(response.data.currentSatisfaction);
      
      setTimeout(() => {
        if (!response.data.isComplete) {
          setCurrentScenario(prev => prev + 1);
          setSelectedChoice(null);
          setFeedback('');
        } else {
          setIsComplete(true);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error submitting choice:', error);
      // Fallback to original logic
      setScore(prev => prev + choice.score);
      setCustomerSatisfaction(prev => Math.max(0, Math.min(100, prev + choice.impact.satisfaction)));
      
      setTimeout(() => {
        if (currentScenario < scenarios.length - 1) {
          setCurrentScenario(prev => prev + 1);
          setSelectedChoice(null);
          setFeedback('');
        } else {
          setIsComplete(true);
        }
      }, 3000);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPerformanceRating = () => {
    if (score >= 60) return { rating: 'Excellent', color: '#4caf50', description: 'Outstanding help desk performance!' };
    if (score >= 45) return { rating: 'Good', color: '#2196f3', description: 'Solid technical support skills.' };
    if (score >= 30) return { rating: 'Fair', color: '#ff9800', description: 'Room for improvement in customer service.' };
    return { rating: 'Needs Improvement', color: '#f44336', description: 'Focus on customer-first approaches.' };
  };

  if (isComplete) {
    const performance = getPerformanceRating();
    
    return (
      <div className="simulator-overlay">
        <div className="simulator-container">
          <div className="simulator-header">
            <h2>🎉 Simulation Complete!</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          
          <div className="results-summary">
            <div className="performance-card">
              <h3 style={{ color: performance.color }}>{performance.rating}</h3>
              <p>{performance.description}</p>
            </div>
            
            <div className="metrics-grid">
              <div className="metric">
                <span className="metric-value">{score}</span>
                <span className="metric-label">Total Score</span>
              </div>
              <div className="metric">
                <span className="metric-value">{formatTime(timeElapsed)}</span>
                <span className="metric-label">Time Taken</span>
              </div>
              <div className="metric">
                <span className="metric-value">{customerSatisfaction}%</span>
                <span className="metric-label">Customer Satisfaction</span>
              </div>
              <div className="metric">
                <span className="metric-value">{scenarios.length}</span>
                <span className="metric-label">Scenarios Completed</span>
              </div>
            </div>
            
            <div className="insights-section">
              <h4>Key Insights</h4>
              <ul>
                <li>You demonstrated strong problem-solving skills under pressure</li>
                <li>Your customer service approach balanced efficiency with empathy</li>
                <li>Consider escalation procedures for department-wide issues</li>
                <li>Great job prioritizing urgent requests appropriately</li>
              </ul>
            </div>
            
            <div className="next-steps">
              <h4>Recommended Next Steps</h4>
              <ul>
                <li>Explore advanced troubleshooting techniques</li>
                <li>Practice de-escalation strategies for frustrated customers</li>
                <li>Learn more about network infrastructure basics</li>
                <li>Consider pursuing CompTIA A+ certification</li>
              </ul>
            </div>
            
            <div className="action-buttons">
              <button className="primary-btn" onClick={() => window.location.reload()}>
                Try Again
              </button>
              <button className="secondary-btn" onClick={onClose}>
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const scenario = scenarios[currentScenario];

  return (
    <div className="simulator-overlay">
      <div className="simulator-container">
        <div className="simulator-header">
          <h2>Help Desk Technician - Day in the Life</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="kpi-dashboard">
          <div className="kpi-item">
            <span className="kpi-label">Time</span>
            <span className="kpi-value">{formatTime(timeElapsed)}</span>
          </div>
          <div className="kpi-item">
            <span className="kpi-label">Score</span>
            <span className="kpi-value">{score}</span>
          </div>
          <div className="kpi-item">
            <span className="kpi-label">Customer Satisfaction</span>
            <span className="kpi-value">{customerSatisfaction}%</span>
          </div>
          <div className="kpi-item">
            <span className="kpi-label">Scenario</span>
            <span className="kpi-value">{currentScenario + 1}/{scenarios.length}</span>
          </div>
        </div>
        
        <div className="scenario-content">
          <div className="scenario-header">
            <h3>{scenario.title}</h3>
            <div className="scenario-badges">
              <span className={`mood-badge ${scenario.customerMood}`}>
                {scenario.customerMood}
              </span>
              <span className={`difficulty-badge ${scenario.difficulty}`}>
                {scenario.difficulty}
              </span>
            </div>
          </div>
          
          <div className="scenario-description">
            <p>{scenario.description}</p>
          </div>
          
          {!selectedChoice ? (
            <div className="choices-container">
              <h4>How do you respond?</h4>
              <div className="choices-grid">
                {scenario.choices.map((choice) => (
                  <button
                    key={choice.id}
                    className="choice-button"
                    onClick={() => handleChoiceSelect(choice)}
                  >
                    <span className="choice-letter">{choice.id.toUpperCase()}</span>
                    <span className="choice-text">{choice.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="feedback-container">
              <div className="choice-feedback">
                <h4>Your Choice:</h4>
                <p>{selectedChoice.text}</p>
                
                <div className="feedback-score">
                  <span>Score: +{selectedChoice.score} points</span>
                </div>
                
                <div className="feedback-text">
                  <p>{feedback}</p>
                </div>
                
                <div className="impact-indicators">
                  <div className="impact-item">
                    <span>Customer Satisfaction: </span>
                    <span className={selectedChoice.impact.satisfaction > 0 ? 'positive' : 'negative'}>
                      {selectedChoice.impact.satisfaction > 0 ? '+' : ''}{selectedChoice.impact.satisfaction}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="next-scenario-timer">
                <p>Next scenario in 3 seconds...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DayInLifeSimulator;
