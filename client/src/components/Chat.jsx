import React from 'react';
import { HamburgerMenu, Dropdown } from '../App';

// Define styles within the same file
const styles = {
  container: {
    maxWidth: "800px",
    margin: "0 auto",
    padding: "20px",
    backgroundColor: "#e6e6e6",  // Light gray background
    minHeight: "100vh",
  },
  chatWindow: {
    border: "1px solid #cccccc",
    padding: "10px",
    height: "400px",
    overflowY: "scroll",
    marginBottom: "10px",
    backgroundColor: "#f5f5f5",  // Slightly lighter than container
    borderRadius: "8px",
  },
  message: {
    marginBottom: "10px",
    padding: "8px",
    borderRadius: "6px",
    backgroundColor: "#ffffff",  // White message background
    color: "#000000",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  inputArea: {
    display: "flex",
    gap: "10px",
  },
  input: {
    flex: "1",
    padding: "12px",
    fontSize: "16px",
    backgroundColor: "#ffffff",
    border: "1px solid #cccccc",
    borderRadius: "6px",
    color: "#000000",
    outline: "none",
  },
  button: {
    padding: "10px 20px",
    fontSize: "16px",
    backgroundColor: "#4a4a4a",  // Dark gray button
    color: "#ffffff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  loadingContainer: {
    display: "flex",
    gap: "8px",
    padding: "10px",
  },
  loadingDot: {
    width: "10px",
    height: "10px",
    backgroundColor: "#4a4a4a",
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
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    color: "#000000",
  },
  logo: {
    width: '150px',
    height: 'auto',
    marginLeft: 'auto',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  }
};

const Chat = ({
  conversation,
  loading,
  input,
  setInput,
  handleKeyPress,
  sendMessage,
  handleOptionSelect,
  menuRef,
  isMenuOpen,
  setIsMenuOpen
}) => {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div ref={menuRef} style={styles.menuContainer}>
            <HamburgerMenu
              isOpen={isMenuOpen}
              toggleMenu={() => setIsMenuOpen(!isMenuOpen)}
            />
            <Dropdown isOpen={isMenuOpen} />
          </div>
          <h1>Atlas Career Coach</h1>
        </div>
        <img 
          src="/images/NucoordLogo.PNG"
          alt="Nucoord Logo"
          style={styles.logo}
        />
      </div>
      <div style={styles.chatWindow}>
        {conversation.map((message, index) => (
          <div key={index} style={styles.message}>
            <strong>{message.role === "assistant" ? "Atlas: " : "You: "}</strong>
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
};

export default Chat;