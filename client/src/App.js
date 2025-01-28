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
      
      if (newCount === maxQuestions) {
        console.log('Reached max questions, preparing results...');
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

  const handleNameSubmit = async (name) => {
    setUserName(name);
    setShowWelcome(false);
    
    // Directly set the initial greeting without making an API call
    const initialGreeting = {
      role: "assistant",
      content: `Hi ${name}! I'm Atlas, your guide to uncovering possibilities and navigating your path to a fulfilling career! What interests you most about technology?`,
      type: "text"
    };

    // Set the initial conversation state
    setConversation([initialGreeting]);
    
    // Initialize conversation history with system message
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
        content: initialGreeting.content
      }
    ]);

    // Don't set hasHandledName here - it will be set on the first actual response
    // This ensures the first real question gets counted properly
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
    const userMessage = {
      role: "user",
      content: question.type === 'multiple_choice' ? 
        `For the question "${question.question}", I chose: ${question.options?.find((opt) => opt.id === selectedOption)?.text}` :
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
`;

const styleSheet = document.createElement("style");
styleSheet.textContent = keyframes + globalStyles;
document.head.appendChild(styleSheet);
export default App;
