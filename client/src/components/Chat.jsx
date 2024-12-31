import React, { useEffect, useRef } from 'react';
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
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1000,
    width: '30px',
    height: '30px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    width: '100%',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  logo: {
    width: '150px',
    height: 'auto',
  },
  title: {
    margin: 0,  // Remove default margin from h1
    fontSize: '24px',  // Adjust size as needed
    lineHeight: '30px',  // Match height of hamburger menu
  },
  multipleChoice: {
    marginTop: '10px',
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '10px',
  },
  radioOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: '#f0f0f0',
    '&:hover': {
      backgroundColor: '#e0e0e0',
    },
  },
  radioInput: {
    margin: '0',
  },
  disabledInput: {
    flex: "1",
    padding: "12px",
    fontSize: "16px",
    backgroundColor: "#e0e0e0",  // Lighter gray for disabled state
    border: "1px solid #cccccc",
    borderRadius: "6px",
    color: "#666666",  // Darker gray text for disabled state
    outline: "none",
    cursor: "not-allowed",
  },
  disabledButton: {
    padding: "10px 20px",
    fontSize: "16px",
    backgroundColor: "#cccccc",  // Gray out the button
    color: "#666666",
    border: "none",
    borderRadius: "6px",
    cursor: "not-allowed",
  },
};

const MultipleChoiceQuestion = ({ message, onSelect }) => {
  return (
    <div style={styles.multipleChoice}>
      <div><strong>{message.question}</strong></div>
      <div style={styles.radioGroup}>
        {message.options.map((option) => (
          <label key={option.id} style={styles.radioOption}>
            <input
              type="radio"
              name={`question-${message.question}`}
              value={option.id}
              onChange={(e) => onSelect(e)}
              style={styles.radioInput}
            />
            {option.text}
          </label>
        ))}
      </div>
    </div>
  );
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
  const chatWindowRef = useRef(null);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [conversation, loading]);

  // Check if the last message is a multiple choice question
  const lastMessage = conversation[conversation.length - 1];
  const showTextInput = !lastMessage?.type || lastMessage.type !== 'multiple_choice';

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
          <h1 style={styles.title}>Atlas Career Coach</h1>
        </div>
        <img 
          src="/images/NucoordLogo.PNG"
          alt="Nucoord Logo"
          style={styles.logo}
        />
      </div>
      <div ref={chatWindowRef} style={styles.chatWindow}>
        {conversation.map((message, index) => (
          <div key={index} style={styles.message}>
            <strong>{message.role === "assistant" ? "Atlas: " : "You: "}</strong>
            {message.content}
            {message.type === 'multiple_choice' && (
              <MultipleChoiceQuestion
                message={message}
                onSelect={(e) => handleOptionSelect(e, index)}
              />
            )}
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
          onKeyPress={(e) => showTextInput && handleKeyPress(e)}
          style={showTextInput ? styles.input : styles.disabledInput}
          placeholder={showTextInput ? "Type your message..." : "Please select an option above..."}
          disabled={!showTextInput}
        />
        <button 
          onClick={sendMessage} 
          style={showTextInput ? styles.button : styles.disabledButton}
          disabled={!showTextInput}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;