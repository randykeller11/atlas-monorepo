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
import config from "./config";

const { API_URL } = config;

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
  const [conversation, setConversation] = useState([
    {
      role: "assistant",
      content:
        "Hi, I'm Atlas, your guide to uncovering possibilities and navigating your path to a fulfilling career! What's your name?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [assessmentSummary, setAssessmentSummary] = useState(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [maxQuestions] = useState(5);
  const menuRef = useRef(null);
  const location = useLocation();

  useEffect(() => {
    console.log('Question count updated:', questionCount);
    if (questionCount >= maxQuestions) {
      console.log('Maximum questions reached, triggering summary');
    }
  }, [questionCount, maxQuestions]);

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

  const sendMessage = async (message, retryCount = 0) => {
    if (!input.trim()) return;

    const userMessage = {
      role: "user",
      content: input,
    };

    setConversation([...conversation, userMessage]);
    setLoading(true);
    setInput("");

    try {
      const response = await axios.post(
        `${API_URL}/api/message`,
        {
          message: input,
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
        content: response.data.text,
        type: response.data.type,
        question: response.data.question,
        items: response.data.items,
        totalRanks: response.data.totalRanks,
        options: response.data.options,
      };

      setConversation((prev) => [...prev, assistantMessage]);
      
      // Only increment for non-greeting messages
      if (!response.data.text.includes("Hi, I'm Atlas") && 
          !response.data.text.includes("Hello") && 
          !response.data.text.toLowerCase().includes("nice to meet you")) {
        const newCount = questionCount + 1;
        setQuestionCount(newCount);

        // Check if we've reached max questions
        if (newCount >= maxQuestions) {
          try {
            const summaryResponse = await axios.post(
              `${API_URL}/api/message`,
              {
                message: `Please provide a comprehensive summary of our conversation using exactly this format:

**Summary of Responses:**
- Interest Exploration: [key interests and findings]
- Technical Aptitude: [technical skills and preferences]
- Work Style: [work environment and collaboration preferences]
- Career Values: [prioritized values and goals]

**Career Matches:**
- [Role Name] ([X]% match): [brief explanation]
- [Role Name] ([X]% match): [brief explanation]

**Salary Information:**
- [Role Name]: [salary range]
- [Role Name]: [salary range]

**Education Path:**
- Courses: [specific course names]
- Certifications: [specific certification names]

**Portfolio Recommendations:**
- [specific project suggestion]
- [specific project suggestion]

**Networking Suggestions:**
- [specific community or platform]
- [specific community or platform]

**Career Roadmap:**
- High School: [specific steps]
- College: [specific steps]
- Early Career: [specific steps]
- Long-term Development: [specific steps]`
              },
              {
                headers: {
                  "session-id": sessionId,
                },
              }
            );

            setAssessmentSummary(summaryResponse.data);
            setShowResults(true);
          } catch (error) {
            console.error("Error generating summary:", error);
          }
        }
      }
    } catch (error) {
      console.error("Error:", error);

      // Handle timeout specifically
      const timeoutMessage = {
        role: "assistant",
        type: "multiple_choice",
        content: "I'm taking longer than expected to process your request.",
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

      setConversation((prev) => [...prev, timeoutMessage]);
    } finally {
      setLoading(false);
    }
  };

  const resetAssessment = () => {
    setQuestionCount(0);
    setShowResults(false);
    setAssessmentSummary(null);
    setConversation([
      {
        role: "assistant",
        content: "Hi, I'm Atlas, your guide to uncovering possibilities and navigating your path to a fulfilling career! What's your name?",
      },
    ]);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  const handleOptionSelect = async (e, messageIndex) => {
    const selectedOption = e.target.value;
    const question = conversation[messageIndex];

    // Create user message
    const userMessage = {
      role: "user",
      content: typeof selectedOption === 'string' ? selectedOption : 
        question.options?.find((opt) => opt.id === selectedOption)?.text || selectedOption,
    };

      setConversation((prev) => [...prev, userMessage]);
      setLoading(true);

      try {
        const response = await axios.post(
          `${API_URL}/api/message`,
          {
            message: userMessage.content,
          },
          {
            headers: {
              "session-id": sessionId,
            },
          }
        );

        validateResponse(response.data);

        const assistantMessage = {
          role: "assistant",
          content: response.data.text,
          type: response.data.type,
          question: response.data.question,
          items: response.data.items,
          totalRanks: response.data.totalRanks,
          options: response.data.options,
        };

        setConversation((prev) => [...prev, assistantMessage]);
        
        // Increment the counter after a successful response
        const newCount = questionCount + 1;
        setQuestionCount(newCount);

        // Check if we've reached max questions
        if (newCount >= maxQuestions) {
          try {
            const summaryResponse = await axios.post(
              `${API_URL}/api/message`,
              {
                message: "Please provide a comprehensive summary of our conversation including: 1. A summary of responses by section 2. 2-3 recommended tech roles with percentage matches and explanations 3. Entry-level salary ranges for suggested roles 4. Recommended courses and certifications 5. Portfolio building suggestions 6. Networking opportunities 7. A detailed high school to career roadmap for their suggested paths",
              },
              {
                headers: {
                  "session-id": sessionId,
                },
              }
            );

            setAssessmentSummary(summaryResponse.data);
            setShowResults(true);
          } catch (error) {
            console.error("Error generating summary:", error);
          }
        }
      } catch (error) {
        console.error("Error:", error);
        const errorMessage = {
          role: "assistant",
          content: "I apologize, but I'm having trouble generating a response. Please try again.",
        };
        setConversation((prev) => [...prev, errorMessage]);
      } finally {
        setLoading(false);
      }
  };

  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route
        path="/"
        element={
          showResults ? (
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
              maxQuestions={5}
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
    0% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-5px);
    }
    100% {
      transform: translateY(0);
    }
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

  * {
    box-sizing: border-box;
  }

  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: #f5f5f5;
  }

  ::-webkit-scrollbar-thumb {
    background: #cccccc;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #b3b3b3;
  }
`;

const styleSheet = document.createElement("style");
styleSheet.textContent = keyframes + globalStyles;
document.head.appendChild(styleSheet);
export default App;
