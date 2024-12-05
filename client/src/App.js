import React, { useState } from "react";
import axios from "axios";

function App() {
  const [conversation, setConversation] = useState([
    {
      role: "assistant",
      content:
        "Hello! I am your personal math tutor. How can I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      role: "user",
      content: input,
    };

    setConversation([...conversation, userMessage]);
    setLoading(true);
    setInput("");

    try {
      const response = await axios.post("http://localhost:5001/api/message", {
        message: input,
      });

      const assistantMessage = {
        role: "assistant",
        content: response.data.response,
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

  return (
    <div style={styles.container}>
      <h1>Math Tutor Chatbot</h1>
      <div style={styles.chatWindow}>
        {conversation.map((msg, index) => (
          <div key={index} style={styles.message}>
            <strong>{msg.role === "user" ? "You" : "Tutor"}:</strong>{" "}
            {msg.content}
          </div>
        ))}
        {loading && <div style={styles.message}>Tutor is typing...</div>}
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
};

export default App;
