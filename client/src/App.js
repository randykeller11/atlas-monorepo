import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import Admin from "./components/Admin";
import Chat from "./components/Chat";
import Results from "./components/Results";
import Welcome from "./components/Welcome";
import PersonaCard from "./components/PersonaCard";
import PersonaPreview from "./components/PersonaPreview";
import AssessmentProgress from "./components/AssessmentProgress";
import DayInLifeSimulator from './components/DayInLifeSimulator';
import ResumeGenerator from './components/ResumeGenerator';
import ImpactDashboard from './components/ImpactDashboard';
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

export const HamburgerMenu = ({ isOpen, toggleMenu }) => {
  return (
    <div style={styles.hamburger} onClick={toggleMenu}>
      <div
        style={{
          ...styles.hamburgerLine,
          transform: isOpen ? "rotate(45deg) translate(5px, 5px)" : "none",
        }}
      ></div>
      <div
        style={{
          ...styles.hamburgerLine,
          opacity: isOpen ? 0 : 1,
        }}
      ></div>
      <div
        style={{
          ...styles.hamburgerLine,
          transform: isOpen ? "rotate(-45deg) translate(7px, -6px)" : "none",
        }}
      ></div>
    </div>
  );
};

export const Dropdown = ({ isOpen }) => {
  const navigate = useNavigate();

  const handleAdminClick = () => {
    navigate("/admin");
  };

  return (
    <div
      style={{
        ...styles.dropdown,
        display: isOpen ? "block" : "none",
      }}
    >
      <div style={styles.dropdownItem} onClick={handleAdminClick}>
        Admin
      </div>
    </div>
  );
};

function AppContent() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [conversationHistory, setConversationHistory] = useState([
    {
      role: "system",
      content: "You are Atlas, a career guidance AI assistant helping users explore tech careers."
    }
  ]);
  const [conversation, setConversation] = useState([]);
  const [userName, setUserName] = useState('');
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [assessmentSummary, setAssessmentSummary] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [maxQuestions] = useState(10);
  const [isProcessingResponse, setIsProcessingResponse] = useState(false);
  const [hasHandledName, setHasHandledName] = useState(false);
  const [showPersonaCard, setShowPersonaCard] = useState(false);
  const [personaCard, setPersonaCard] = useState(null);
  const [persona, setPersona] = useState(null);
  const [assessmentProgress, setAssessmentProgress] = useState({
    questionsCompleted: 0,
    totalQuestions: 10,
    currentSection: 'introduction',
    sections: {}
  });
  const [isLoadingPersona, setIsLoadingPersona] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [showResumeGenerator, setShowResumeGenerator] = useState(false);
  const [showImpactDashboard, setShowImpactDashboard] = useState(false);
  const [completedServices, setCompletedServices] = useState({
    simulator: false,
    resume: false,
    dashboard: false
  });
  const menuRef = useRef(null);
  const location = useLocation();

  const incrementQuestionCount = async (responseData, messageContent) => {
    console.log('\n=== Question Count Check ===');
    console.log('Response state:', responseData._state);
    
    if (!hasHandledName) {
      setHasHandledName(true);
      return;
    }

    if (responseData._state) {
      const newCount = responseData._state.questionsAsked;
      console.log('Updating question count to:', newCount);
      setQuestionCount(newCount);
      
      // Update assessment progress
      setAssessmentProgress({
        questionsCompleted: newCount,
        totalQuestions: maxQuestions,
        currentSection: responseData._state.currentSection || 'introduction',
        sections: responseData._state.sectionsCompleted || {}
      });
      
      // Check for persona availability
      if (newCount >= 6 && !persona) {
        await checkForPersona();
      }
      
      if (newCount === maxQuestions) {
        console.log('Reached max questions, preparing results...');
        
        // Try to enrich persona if we have one
        if (persona && !personaCard) {
          await enrichPersona();
        }
        
        setAssessmentSummary({
          summaryOfResponses: null,
          careerMatches: null,
          salaryInformation: null,
          educationPath: null,
          portfolioRecommendations: null,
          networkingSuggestions: null,
          careerRoadmap: null
        });
        setShowResults(true);
        
        try {
          const summaryResponse = await axios.post(
            `${API_URL}/api/message`,
            {
              message: `[GENERATE_RESULTS] Please analyze our conversation and return a JSON object with this exact structure:
{
  "1. Summary of Responses": {
    "Interest Exploration": "string",
    "Technical Aptitude": "string", 
    "Work Style": "string",
    "Career Values": "string"
  },
  "2. Career Matches": [
    {
      "role": "string",
      "match": "95%",
      "explanation": "string"
    }
  ],
  "3. Salary Information": [
    {
      "role": "string",
      "salary": "string",
      "progression": "string" 
    }
  ],
  "4. Education Path": {
    "Courses": [
      "string"
    ],
    "Certifications": [
      "string"
    ]
  },
  "5. Portfolio Recommendations": [
    "string"
  ],
  "6. Networking Suggestions": [
    "string"
  ],
  "7. Career Roadmap": {
    "High School": "string",
    "College": "string",
    "Early Career": "string",
    "Long-term Development": "string"
  }
}`,
              conversation: conversationHistory
            },
            {
              headers: {
                "session-id": sessionId,
              },
            }
          );
          setAssessmentSummary(summaryResponse.data);
        } catch (error) {
          console.error("Error generating summary:", error);
        }
      }
    }
  };

  const checkForPersona = async () => {
    if (!sessionId) return;
    
    try {
      const response = await axios.get(`${API_URL}/api/persona/${sessionId}`);
      if (response.data) {
        setPersona(response.data);
      }
    } catch (error) {
      console.log('Persona not yet available:', error.message);
    }
  };

  const enrichPersona = async () => {
    if (!sessionId) return;
    
    setIsLoadingPersona(true);
    try {
      const response = await axios.post(
        `${API_URL}/api/persona-card/${sessionId}/enrich`,
        {
          userGoals: "Explore career options and find fulfilling work",
          forceRefresh: false
        },
        {
          headers: {
            "session-id": sessionId,
          },
        }
      );
      
      if (response.data.personaCard) {
        setPersonaCard(response.data.personaCard);
      }
    } catch (error) {
      console.error('Error enriching persona:', error);
    } finally {
      setIsLoadingPersona(false);
    }
  };

  const handleViewPersonaCard = async () => {
    if (personaCard) {
      setShowPersonaCard(true);
      return;
    }
    
    // Try to get existing persona card first
    try {
      const response = await axios.get(`${API_URL}/api/persona-card/${sessionId}`);
      if (response.data) {
        setPersonaCard(response.data);
        setShowPersonaCard(true);
        return;
      }
    } catch (error) {
      console.log('No existing persona card, enriching...');
    }
    
    // If no existing card, enrich the persona
    await enrichPersona();
    if (personaCard) {
      setShowPersonaCard(true);
    }
  };


  useEffect(() => {
    console.log('\n=== State Update ===');
    console.log('hasHandledName:', hasHandledName);
    console.log('questionCount:', questionCount);
    console.log('maxQuestions:', maxQuestions);
    console.log('showResults:', showResults);
  }, [hasHandledName, questionCount, maxQuestions, showResults]);

  useEffect(() => {
    // Reset chat if coming from admin with reset flag
    if (location.state?.shouldResetChat) {
      setConversation([
        {
          role: "assistant",
          content:
            "Hi, I'm Atlas, your guide to uncovering possibilities and navigating your path to a fulfilling career! What's your name?",
        },
      ]);
      // Clear the reset flag from location state
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    // Generate or retrieve session ID when component mounts
    const existingSessionId = localStorage.getItem("chatSessionId");
    if (existingSessionId) {
      setSessionId(existingSessionId);
    } else {
      const newSessionId =
        Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem("chatSessionId", newSessionId);
      setSessionId(newSessionId);
    }
  }, []);

  // Check for demo mode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const isDemoMode = urlParams.get('demo') === 'randy';
    
    if (isDemoMode && sessionId) {
      console.log('Demo mode detected, loading Randy Keller data...');
      loadDemoData();
    }
  }, [sessionId]); // Depend on sessionId so it runs after session is set

  // Add cleanup effect
  useEffect(() => {
    const handleBeforeUnload = async () => {
      try {
        // Cleanup the session before page unload
        await axios.post(
          `${API_URL}/api/reset-session`,
          {},
          {
            headers: {
              "session-id": sessionId,
            },
          }
        );
      } catch (error) {
        console.error("Error cleaning up session:", error);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [sessionId]);

  const validateResponse = (response) => {
    if (!response?.text || response.text.trim() === "") {
      throw new Error("Empty response received");
    }
    return response;
  };

  const sendMessage = async () => {
    if (!input.trim() || isProcessingResponse) return;
    setIsProcessingResponse(true);

    const userMessage = {
      role: "user",
      content: input
    };

    // Update UI immediately
    setConversation([...conversation, userMessage]);
    setLoading(true);
    setInput("");

    // Update conversation history
    const updatedHistory = [...conversationHistory, userMessage];
    setConversationHistory(updatedHistory);

    try {
      const response = await axios.post(
        `${API_URL}/api/message`,
        {
          message: input,
          conversation: updatedHistory
        },
        {
          headers: {
            "session-id": sessionId,
          },
          timeout: 25000,
        }
      );

        const assistantMessage = {
          role: "assistant",
          content: response.data.content,
          type: response.data.type,
          question: response.data.question,
          items: response.data.items,
          totalRanks: response.data.totalRanks,
          options: response.data.options,
        };

        // Update UI
        setConversation(prev => [...prev, assistantMessage]);
        
        // Update conversation history
        setConversationHistory([...updatedHistory, {
          role: "assistant",
          content: response.data.content
        }]);

        await incrementQuestionCount(response.data, input);

        // Remove results check - now handled in incrementQuestionCount
    } catch (error) {
      console.error("Error:", error);
      
      // For timeout errors, try to get a simpler response
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        try {
          const response = await axios.post(
            `${API_URL}/api/message`,
            { message: "Please provide a simple response." },
            {
              headers: { "session-id": sessionId },
              timeout: 10000
            }
          );
          
          setConversation(prev => [...prev, {
            role: "assistant",
            content: response.data.content,  // Changed from response.data.text
            type: "text"
          }]);
        } catch (retryError) {
          console.error("Retry failed:", retryError);
          // Set fallback error message
          setConversation(prev => [...prev, {
            role: "assistant",
            content: "I apologize, but I'm having trouble processing your request. Please try again.",
            type: "text"
          }]);
        }
      } else {
        // For non-timeout errors, show multiple choice recovery options
        const errorMessage = {
          role: "assistant",
          type: "multiple_choice",
          content: "I'm having trouble processing your request.",
          question: "How would you like to proceed?",
          options: [
            {
              id: "retry",
              text: "Try sending your message again",
            },
            {
              id: "rephrase",
              text: "Rephrase your message",
            },
            {
              id: "continue",
              text: "Start a new conversation",
            },
          ],
        };
        setConversation(prev => [...prev, errorMessage]);
      }
    } finally {
      setLoading(false);
      setIsProcessingResponse(false);
    }
  };

  const loadDemoData = async () => {
    if (!sessionId) return;
    
    try {
      console.log('Loading demo data...');
      const response = await axios.get(`${API_URL}/api/demo/randy-keller`);
      const demoData = response.data;
      
      console.log('Demo data received:', demoData);
      
      // Set all the demo state
      setUserName('Randy Keller');
      setPersona(demoData.persona);
      setPersonaCard(demoData.personaCard);
      
      // Force show services immediately for demo
      console.log('Setting personaCard for demo:', demoData.personaCard);
      
      setAssessmentProgress({
        questionsCompleted: demoData.assessmentProgress.questionsCompleted,
        totalQuestions: demoData.assessmentProgress.totalQuestions,
        currentSection: demoData.assessmentProgress.currentSection,
        sections: demoData.assessmentProgress.sections
      });
      setQuestionCount(demoData.assessmentProgress.questionsCompleted);
      
      // Set conversation history
      setConversation(demoData.conversationHistory);
      setConversationHistory([
        {
          role: "system",
          content: "You are Atlas, a career guidance AI assistant helping users explore tech careers."
        },
        ...demoData.conversationHistory
      ]);
      
      setHasHandledName(true);
      setShowWelcome(false);
      
      // Update the session ID to match demo
      localStorage.setItem("chatSessionId", demoData.sessionId);
      setSessionId(demoData.sessionId);
      
      console.log('✓ Demo data loaded successfully for Randy Keller');
      console.log('✓ PersonaCard set:', !!demoData.personaCard);
    } catch (error) {
      console.error('❌ Failed to load demo data:', error);
      alert(`Failed to load demo data: ${error.message}`);
    }
  };

  const handleNameSubmit = async (name) => {
    setUserName(name);
    setShowWelcome(false);
    
    // Regular flow for non-demo users
    const initialGreeting = {
      role: "assistant",
      content: `Hi ${name}! I'm Atlas, your guide to uncovering possibilities and navigating your path to a fulfilling career! What interests you most about technology?`,
      type: "text"
    };

    setConversation([initialGreeting]);
    
    setConversationHistory([
      {
        role: "system",
        content: "You are Atlas, a career guidance AI assistant helping users explore tech careers."
      },
      {
        role: "user",
        content: name
      },
      {
        role: "assistant",
        content: initialGreeting.content,
        type: "text"
      }
    ]);

    setHasHandledName(true);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  const handleOptionSelect = async (e, messageIndex) => {
    const selectedOption = e.target.value;
    const question = conversation[messageIndex];

    // Set processing state after validating the selection
    setIsProcessingResponse(true);

    // Create user message with context based on question type
    const selectedText = e.target.selectedText;  // Get the selected text from the event
    const userMessage = {
      role: "user",
      content: question.type === 'multiple_choice' ? 
        `For the question "${question.question}", I chose: ${selectedText || question.options?.find((opt) => opt.id === selectedOption)?.text}` :
        question.type === 'ranking' ?
        `For the ranking question "${question.question}", my ranking order is: ${selectedOption}` :
        selectedOption
    };

    // Update conversation immediately
    setConversation(prev => [...prev, userMessage]);
    setLoading(true);

    try {
        // First check if this is the name response
        if (!hasHandledName) {
          setHasHandledName(true);
          // Name has been handled, enable question counting
        }

        // Update conversation history with context
        const updatedHistory = [...conversationHistory, userMessage];
        setConversationHistory(updatedHistory);

        const response = await axios.post(
          `${API_URL}/api/message`,
          {
            message: userMessage.content,
            conversation: updatedHistory
          },
          {
            headers: {
              "session-id": sessionId,
            },
          }
        );

        // Add validation check
        if (!response.data || !response.data.content) {
          console.error('Invalid response format:', response.data);
          throw new Error('Empty or invalid response received');
        }

        const assistantMessage = {
          role: "assistant",
          content: response.data.content,
          type: response.data.type || 'text',  // Provide default type
          question: response.data.question,
          items: response.data.items,
          totalRanks: response.data.totalRanks,
          options: response.data.options,
        };

        // Update conversation with assistant's response
        setConversation(prev => [...prev, assistantMessage]);
        
        // Update conversation history with assistant's response
        setConversationHistory([...updatedHistory, {
          role: "assistant",
          content: response.data.content
        }]);

        await incrementQuestionCount(response.data, userMessage.content);
        
        // Remove results check - now handled in incrementQuestionCount
    } catch (error) {
      console.error("Error:", error);
      
      // For timeout errors, try to get a simpler response
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        try {
          const response = await axios.post(
            `${API_URL}/api/message`,
            { message: "Please provide a simple response." },
            {
              headers: { "session-id": sessionId },
              timeout: 10000
            }
          );
          
          setConversation(prev => [...prev, {
            role: "assistant",
            content: response.data.content,
            type: "text"
          }]);
          return;
        } catch (retryError) {
          console.error("Retry failed:", retryError);
        }
      }

      // Fallback error message
      const errorMessage = {
        role: "assistant",
        content: "I apologize, but I'm having trouble generating a response. Please try again.",
      };
      setConversation((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setIsProcessingResponse(false);
    }
  };

  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route
        path="/"
        element={
          showWelcome ? (
            <Welcome onNameSubmit={handleNameSubmit} />
          ) : showResults ? (
            <Results summary={assessmentSummary} />
          ) : (
            <div className="chat-container">
              <AssessmentProgress
                questionsCompleted={assessmentProgress.questionsCompleted}
                totalQuestions={assessmentProgress.totalQuestions}
                currentSection={assessmentProgress.currentSection}
                sections={assessmentProgress.sections}
                onViewPersona={handleViewPersonaCard}
                hasPersona={!!persona}
              />

              {/* Temporary test buttons for Randy */}
              {userName === 'Randy Keller' && (
                <div style={{
                  margin: '20px 0',
                  padding: '15px',
                  background: '#f0f8ff',
                  border: '2px solid #4169e1',
                  borderRadius: '8px'
                }}>
                  <h4>🧪 Randy Demo - Test Services</h4>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button onClick={() => setShowSimulator(true)} style={{padding: '8px 16px', background: '#667eea', color: 'white', border: 'none', borderRadius: '4px'}}>
                      Test Simulator
                    </button>
                    <button onClick={() => setShowResumeGenerator(true)} style={{padding: '8px 16px', background: '#2196f3', color: 'white', border: 'none', borderRadius: '4px'}}>
                      Test Resume
                    </button>
                    <button onClick={() => setShowImpactDashboard(true)} style={{padding: '8px 16px', background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px'}}>
                      Test Dashboard
                    </button>
                  </div>
                  <p style={{margin: '10px 0 0 0', fontSize: '0.9rem', color: '#666'}}>
                    PersonaCard exists: {personaCard ? '✅ Yes' : '❌ No'} | 
                    Persona exists: {persona ? '✅ Yes' : '❌ No'}
                  </p>
                </div>
              )}
              
              {persona && !showPersonaCard && (
                <PersonaPreview
                  persona={persona}
                  onViewFullCard={handleViewPersonaCard}
                  isLoading={isLoadingPersona}
                />
              )}
              
              {/* Debug logging */}
              {console.log('Debug - personaCard exists:', !!personaCard)}
              {console.log('Debug - userName:', userName)}
              {console.log('Debug - showWelcome:', showWelcome)}

              {/* Enhanced Services Dashboard */}
              {(personaCard || (userName === 'Randy Keller' && !showWelcome)) && (
                <div className="services-dashboard">
                  <div className="services-header">
                    <h3>🚀 Explore Your Career Journey</h3>
                    <p>Now that you have your persona card, try these powerful career tools:</p>
                    {!personaCard && userName === 'Randy Keller' && (
                      <p style={{color: '#ff9800', fontWeight: 'bold'}}>
                        Demo Mode: Services available for Randy Keller
                      </p>
                    )}
                  </div>
                  
                  <div className="services-status">
                    <div className="status-item available">
                      <span className="status-dot"></span>
                      <span>Persona Analysis Complete</span>
                    </div>
                    <div className="status-item available">
                      <span className="status-dot"></span>
                      <span>Career Simulator Ready</span>
                    </div>
                    <div className="status-item available">
                      <span className="status-dot"></span>
                      <span>Resume Generator Active</span>
                    </div>
                    <div className="status-item available">
                      <span className="status-dot"></span>
                      <span>Impact Dashboard Available</span>
                    </div>
                  </div>
                  
                  <div className="services-grid">
                    <div className={`service-card simulator ${completedServices.simulator ? 'completed' : ''}`} onClick={() => setShowSimulator(true)}>
                      <div className="service-icon">🎮</div>
                      <div className="service-content">
                        <h4>Day-in-Life Simulator</h4>
                        <p>Experience a help desk technician role through interactive scenarios</p>
                        <div className="service-features">
                          <span>• Real-time scoring</span>
                          <span>• AI-powered NPCs</span>
                          <span>• Performance insights</span>
                        </div>
                      </div>
                      <div className="service-action">Try Now →</div>
                      {completedServices.simulator && (
                        <div className="completion-badge">✓ Completed</div>
                      )}
                    </div>
                    
                    <div className={`service-card resume ${completedServices.resume ? 'completed' : ''}`} onClick={() => setShowResumeGenerator(true)}>
                      <div className="service-icon">📄</div>
                      <div className="service-content">
                        <h4>AI Resume Generator</h4>
                        <p>Create a tailored resume based on your Builder persona</p>
                        <div className="service-features">
                          <span>• Persona-optimized content</span>
                          <span>• Multiple templates</span>
                          <span>• ATS-friendly format</span>
                        </div>
                      </div>
                      <div className="service-action">Generate →</div>
                      {completedServices.resume && (
                        <div className="completion-badge">✓ Completed</div>
                      )}
                    </div>
                    
                    <div className={`service-card dashboard ${completedServices.dashboard ? 'completed' : ''}`} onClick={() => setShowImpactDashboard(true)}>
                      <div className="service-icon">📊</div>
                      <div className="service-content">
                        <h4>Impact Dashboard</h4>
                        <p>View analytics and success metrics across all users</p>
                        <div className="service-features">
                          <span>• Real-time metrics</span>
                          <span>• Career outcomes</span>
                          <span>• Success stories</span>
                        </div>
                      </div>
                      <div className="service-action">Explore →</div>
                      {completedServices.dashboard && (
                        <div className="completion-badge">✓ Completed</div>
                      )}
                    </div>
                  </div>
                  
                  {/* Demo mode indicator */}
                  {userName === 'Randy Keller' && (
                    <div className="demo-indicator">
                      <span>🎯 Demo Mode Active - All features unlocked for Randy Keller</span>
                    </div>
                  )}
                </div>
              )}
              
              <Chat
                conversation={conversation}
                loading={loading}
                input={input}
                setInput={setInput}
                handleKeyPress={handleKeyPress}
                sendMessage={sendMessage}
                handleOptionSelect={handleOptionSelect}
                menuRef={menuRef}
                isMenuOpen={isMenuOpen}
                setIsMenuOpen={setIsMenuOpen}
                questionCount={questionCount}
                maxQuestions={10}
              />
              
              {showPersonaCard && (
                <PersonaCard
                  sessionId={sessionId}
                  personaCard={personaCard}
                  onClose={() => setShowPersonaCard(false)}
                  onEnrichPersona={enrichPersona}
                />
              )}
              
              {showSimulator && (
                <DayInLifeSimulator
                  onClose={() => {
                    setCompletedServices(prev => ({ ...prev, simulator: true }));
                    setShowSimulator(false);
                  }}
                  personaCard={personaCard}
                  sessionId={sessionId}
                />
              )}

              {showResumeGenerator && (
                <ResumeGenerator
                  onClose={() => {
                    setCompletedServices(prev => ({ ...prev, resume: true }));
                    setShowResumeGenerator(false);
                  }}
                  personaCard={personaCard}
                  sessionId={sessionId}
                />
              )}

              {showImpactDashboard && (
                <ImpactDashboard
                  onClose={() => {
                    setCompletedServices(prev => ({ ...prev, dashboard: true }));
                    setShowImpactDashboard(false);
                  }}
                />
              )}
            </div>
          )
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

const styles = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "20px",
  },
  chatWindow: {
    border: "1px solid #ccc",
    padding: "10px",
    height: "400px",
    overflowY: "scroll",
    marginBottom: "10px",
    backgroundColor: "#f9f9f9",
  },
  message: {
    marginBottom: "10px",
  },
  inputArea: {
    display: "flex",
  },
  input: {
    flex: "1",
    padding: "10px",
    fontSize: "16px",
  },
  button: {
    padding: "10px 20px",
    fontSize: "16px",
  },
  loadingContainer: {
    display: "flex",
    gap: "8px",
    padding: "10px",
  },
  loadingDot: {
    width: "10px",
    height: "10px",
    backgroundColor: "#666",
    borderRadius: "50%",
    animation: "bubble 1s infinite",
    animationTimingFunction: "ease-in-out",
  },
  optionsContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    margin: "10px 0",
  },
  optionLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
    padding: "8px",
    borderRadius: "4px",
    backgroundColor: "#f0f0f0",
  },
  hamburger: {
    width: "30px",
    height: "20px",
    position: "relative",
    cursor: "pointer",
  },
  hamburgerLine: {
    width: "100%",
    height: "2px",
    backgroundColor: "#000000",
    margin: "6px 0",
    transition: "all 0.3s ease",
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    right: "0",
    backgroundColor: "#f5f5f5",
    border: "1px solid #cccccc",
    padding: "10px",
    borderRadius: "6px",
    zIndex: 1000,
    boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
  },
  dropdownItem: {
    padding: "10px 15px",
    cursor: "pointer",
    color: "#000000",
    "&:hover": {
      backgroundColor: "#e0e0e0",
    },
    borderRadius: "4px",
  },
  menuContainer: {
    position: "relative",
    zIndex: 1000,
    width: "30px",
    height: "30px",
    marginBottom: "20px",
  },
};

const keyframes = `
  @keyframes bubble {
    0% { transform: translateY(0); }
    50% { transform: translateY(-5px); }
    100% { transform: translateY(0); }
  }
`;

const globalStyles = `
  body {
    margin: 0;
    padding: 0;
    background-color: #e6e6e6;
    color: #000000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  }

  * { box-sizing: border-box; }

  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: #f5f5f5; }
  ::-webkit-scrollbar-thumb {
    background: #cccccc;
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover { background: #b3b3b3; }

  .dropdownItem:hover { background-color: #e0e0e0; }

  .downloadButton:hover {
    background-color: #45a049;
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  }

  .radioOption:hover { background-color: #e0e0e0; }

  .services-dashboard {
    margin: 30px 0;
    padding: 30px;
    background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
    border-radius: 16px;
    border: 1px solid #e3f2fd;
    box-shadow: 0 4px 20px rgba(102, 126, 234, 0.1);
  }

  .services-header {
    text-align: center;
    margin-bottom: 30px;
  }

  .services-header h3 {
    margin: 0 0 10px 0;
    color: #333;
    font-size: 1.5rem;
    font-weight: 600;
  }

  .services-header p {
    margin: 0;
    color: #666;
    font-size: 1rem;
    line-height: 1.5;
  }

  .services-status {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 25px;
    padding: 20px;
    background: rgba(255, 255, 255, 0.7);
    border-radius: 8px;
    border: 1px solid #e0e0e0;
  }

  .status-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.9rem;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4caf50;
    animation: pulse 2s infinite;
  }

  .status-item.available {
    color: #2e7d32;
  }

  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }

  .services-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 20px;
  }

  .service-card {
    background: white;
    border-radius: 12px;
    padding: 25px;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 2px solid transparent;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    position: relative;
    overflow: hidden;
  }

  .service-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    transition: all 0.3s ease;
  }

  .service-card.simulator::before {
    background: linear-gradient(90deg, #667eea, #764ba2);
  }

  .service-card.resume::before {
    background: linear-gradient(90deg, #2196f3, #21cbf3);
  }

  .service-card.dashboard::before {
    background: linear-gradient(90deg, #4caf50, #45a049);
  }

  .service-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
  }

  .service-card:hover::before {
    height: 6px;
  }

  .service-card.simulator:hover {
    border-color: #667eea;
  }

  .service-card.resume:hover {
    border-color: #2196f3;
  }

  .service-card.dashboard:hover {
    border-color: #4caf50;
  }

  .service-card.completed {
    border-color: #4caf50;
    background: linear-gradient(135deg, #f8fff8 0%, #f0fff0 100%);
  }

  .service-icon {
    font-size: 2.5rem;
    margin-bottom: 15px;
    display: block;
  }

  .service-content h4 {
    margin: 0 0 10px 0;
    color: #333;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .service-content p {
    margin: 0 0 15px 0;
    color: #666;
    line-height: 1.5;
    font-size: 0.95rem;
  }

  .service-features {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 15px;
  }

  .service-features span {
    font-size: 0.85rem;
    color: #888;
    display: flex;
    align-items: center;
  }

  .service-action {
    color: #667eea;
    font-weight: 600;
    font-size: 0.9rem;
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  }

  .service-card.resume .service-action {
    color: #2196f3;
  }

  .service-card.dashboard .service-action {
    color: #4caf50;
  }

  .completion-badge {
    position: absolute;
    top: 15px;
    right: 15px;
    background: #4caf50;
    color: white;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .demo-indicator {
    text-align: center;
    padding: 15px;
    background: linear-gradient(90deg, #ffd54f, #ffb74d);
    border-radius: 8px;
    margin-top: 20px;
  }

  .demo-indicator span {
    color: #333;
    font-weight: 500;
    font-size: 0.9rem;
  }

  @media (max-width: 768px) {
    .services-grid {
      grid-template-columns: 1fr;
    }
    
    .services-dashboard {
      margin: 20px 0;
      padding: 20px;
    }
    
    .service-card {
      padding: 20px;
    }
  }
`;

const styleSheet = document.createElement("style");
styleSheet.textContent = keyframes + globalStyles;
document.head.appendChild(styleSheet);
export default App;
