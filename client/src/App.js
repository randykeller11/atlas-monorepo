import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL =
  process.env.REACT_APP_API_URL ||
  "https://nucoord-atlas-e99e7eee1cf6.herokuapp.com/";

function App() {
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

  const sendMessage = async (message) => {
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

      const assistantMessage = {
        role: "assistant",
        content: response.data.text,
        type: response.data.type,
        options: response.data.options,
        question: response.data.question,
      };

      setConversation((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = {
        role: "assistant",
        content: "Sorry, something went wrong.",
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

  const handleOptionSelect = async (e, messageIndex) => {
    const selectedOption = e.target.value;
    const question = conversation[messageIndex];

    // Find the selected option text
    const selectedText = question.options.find(
      (opt) => opt.id === selectedOption
    )?.text;

    // Send the selected answer
    const userMessage = {
      role: "user",
      content: selectedText,
    };

    setConversation((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/message`,
        {
          message: selectedText,
        },
        {
          headers: {
            "session-id": sessionId,
          },
        }
      );

      const assistantMessage = {
        role: "assistant",
        content: response.data.text,
        type: response.data.type,
        options: response.data.options,
        question: response.data.question,
      };

      setConversation((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage = {
        role: "assistant",
        content: "Sorry, something went wrong.",
      };
      setConversation((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <h1>Atlas Career Coach</h1>
      <div style={styles.chatWindow}>
        {conversation.map((msg, index) => (
          <div key={index} style={styles.message}>
            <strong>{msg.role === "user" ? "You" : "Atlas"}:</strong>{" "}
            {msg.type === "multiple_choice" ? (
              <div>
                <p>{msg.content}</p>
                <p>{msg.question}</p>
                <div style={styles.optionsContainer}>
                  {msg.options?.map((option) => (
                    <label key={option.id} style={styles.optionLabel}>
                      <input
                        type="radio"
                        name={`question-${index}`}
                        value={option.id}
                        onChange={(e) => handleOptionSelect(e, index)}
                      />
                      {option.text}
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              msg.content
            )}
          </div>
        ))}
        {loading && (
          <div style={styles.loadingContainer}>
            <div style={{ ...styles.loadingDot, animationDelay: "0s" }}></div>
            <div style={{ ...styles.loadingDot, animationDelay: "0.2s" }}></div>
            <div style={{ ...styles.loadingDot, animationDelay: "0.4s" }}></div>
          </div>
        )}
      </div>
      <div style={styles.inputArea}>
        <input
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          style={styles.input}
        />
        <button onClick={sendMessage} style={styles.button} disabled={loading}>
          Send
        </button>
      </div>
    </div>
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

const styleSheet = document.createElement("style");
styleSheet.textContent = keyframes;
document.head.appendChild(styleSheet);

export default App;
