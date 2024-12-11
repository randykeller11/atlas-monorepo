import React from "react";
import { HamburgerMenu } from "../App"; // Import from App.js
import { Dropdown } from "../App"; // Import from App.js

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
  menuContainer: {
    position: "relative",
    zIndex: 1000,
    width: "30px",
    height: "30px",
    marginBottom: "20px",
  },
};

function Chat({
  conversation,
  loading,
  input,
  setInput,
  handleKeyPress,
  sendMessage,
  handleOptionSelect,
  menuRef,
  isMenuOpen,
  setIsMenuOpen,
}) {
  return (
    <div style={styles.container}>
      <div ref={menuRef} style={styles.menuContainer}>
        <HamburgerMenu
          isOpen={isMenuOpen}
          toggleMenu={() => setIsMenuOpen(!isMenuOpen)}
        />
        <Dropdown isOpen={isMenuOpen} />
      </div>
      <h1>Atlas Career Coach</h1>
      <div style={styles.chatWindow}>
        {conversation.map((message, index) => (
          <div key={index} style={styles.message}>
            <strong>
              {message.role === "assistant" ? "Atlas: " : "You: "}
            </strong>
            {message.content}
          </div>
        ))}
        {loading && (
          <div style={styles.loadingContainer}>
            <div style={styles.loadingDot}></div>
            <div style={styles.loadingDot}></div>
            <div style={styles.loadingDot}></div>
          </div>
        )}
      </div>
      <div style={styles.inputArea}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          style={styles.input}
          placeholder="Type your message..."
        />
        <button onClick={sendMessage} style={styles.button}>
          Send
        </button>
      </div>
    </div>
  );
}

export default Chat;
