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
  const menuRef = useRef(null);
  const location = useLocation();

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
        }
      );

      try {
        validateResponse(response.data);
      } catch (error) {
        if (retryCount < 3) {
          console.log(`Retrying request (attempt ${retryCount + 1})`);
          setLoading(true);
          return sendMessage(message, retryCount + 1);
        } else {
          throw new Error("Maximum retry attempts exceeded");
        }
      }

      const assistantMessage = {
        role: "assistant",
        content: response.data.text,
      };

      setConversation((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = {
        role: "assistant",
        content:
          "I apologize, but I'm having trouble generating a response. Please try again.",
      };
      setConversation((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <Routes>
      <Route path="/admin" element={<Admin />} />
      <Route
        path="/"
        element={
          <Chat
            conversation={conversation}
            loading={loading}
            input={input}
            setInput={setInput}
            handleKeyPress={handleKeyPress}
            sendMessage={sendMessage}
            menuRef={menuRef}
            isMenuOpen={isMenuOpen}
            setIsMenuOpen={setIsMenuOpen}
          />
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
