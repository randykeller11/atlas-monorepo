import React, { useEffect, useRef, useState } from 'react';
import { HamburgerMenu, Dropdown } from '../App';

// Define styles within the same file
const styles = {
  container: {
    maxWidth: "800px",
    margin: "0 auto", 
    padding: "5px 20px",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
  },
  mainContent: {
    display: "flex",
    flex: 1,
    gap: "20px",
    height: "calc(100vh - 80px)",
  },
  chatContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100%",
  },
  progressSection: {
    width: "30px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-start",
  },
  progressBarContainer: {
    width: '10px',
    height: '100%',
    backgroundColor: '#e0e0e0',
    borderRadius: '5px',
    position: "relative",
  },
  progressBar: {
    width: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: '5px',
    transition: 'height 0.3s ease',
    position: "absolute",
    bottom: 0,
  },
  questionCounter: {
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    textAlign: 'center',
    fontSize: '14px',
    color: '#666',
    marginBottom: '10px',
    whiteSpace: 'nowrap',
  },
  chatWindow: {
    flex: 1,
    border: "1px solid #cccccc",
    padding: "10px",
    overflowY: "scroll",
    backgroundColor: "#f5f5f5",
    borderRadius: "8px",
    marginBottom: "10px",
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
    width: "100%",
    padding: "10px 0",
  },
  input: {
    flex: "1",
    padding: "12px",
    fontSize: "16px",
    backgroundColor: "#f5f5f5",
    border: "1px solid #cccccc",
    borderRadius: "6px",
    color: "#000000",
    outline: "none",
    width: "100%", // Ensure input takes full width of container
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
    marginBottom: '2px',
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
  },
  radioInput: {
    margin: '0',
  },
  otherInput: {
    marginLeft: '10px',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    fontSize: '16px',
    width: '300px',
    minHeight: '60px',
    resize: 'vertical',
    fontFamily: 'inherit'
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
  rankingContainer: {
    marginTop: '15px',
  },
  rankingItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
    padding: '8px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
  },
  rankSelect: {
    padding: '5px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    minWidth: '60px',
  },
  rankLabel: {
    flex: 1,
  },
  submitRanking: {
    marginTop: '10px',
    padding: '8px 16px',
    backgroundColor: '#4a4a4a',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  }
};

const MultipleChoiceQuestion = ({ message, onSelect }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [otherText, setOtherText] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const optionsWithOther = [
    ...message.options,
    { id: 'other', text: 'Other (please specify)' }
  ];

  const handleSelect = (optionId) => {
    setSelectedOption(optionId);
    setIsSubmitted(false);
  };

  const handleSubmit = () => {
    if (selectedOption && !isSubmitted) {
      if (selectedOption === 'other') {
        if (otherText.trim()) {
          onSelect({
            target: {
              value: otherText.trim(),
              selectedText: otherText.trim()
            }
          });
          setIsSubmitted(true);
        }
      } else {
        const selectedText = message.options.find(opt => opt.id === selectedOption)?.text;
        if (selectedText) {
          onSelect({
            target: {
              value: selectedOption,
              selectedText: selectedText
            }
          });
          setIsSubmitted(true);
        }
      }
    }
  };

  return (
    <div style={styles.multipleChoice}>
      <div><strong>{message.question}</strong></div>
      <div style={styles.radioGroup}>
        {optionsWithOther.map((option) => (
          <label key={option.id} style={styles.radioOption}>
            <input
              type="radio"
              name={`question-${message.question}`}
              value={option.id}
              checked={selectedOption === option.id}
              onChange={() => handleSelect(option.id)}
              style={styles.radioInput}
            />
            {option.text}
            {option.id === 'other' && selectedOption === 'other' && (
              <input
                type="text"
                value={otherText}
                onChange={(e) => setOtherText(e.target.value)}
                placeholder="Please specify..."
                style={styles.otherInput}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </label>
        ))}
      </div>
      <button
        style={{
          ...styles.submitRanking,
          opacity: selectedOption && (selectedOption !== 'other' || otherText.trim()) ? 1 : 0.5,
          cursor: selectedOption && (selectedOption !== 'other' || otherText.trim()) ? 'pointer' : 'not-allowed'
        }}
        onClick={handleSubmit}
        disabled={!selectedOption || (selectedOption === 'other' && !otherText.trim())}
      >
        Submit Choice
      </button>
    </div>
  );
};

const RankingQuestion = ({ message, onSubmit }) => {
  const [rankings, setRankings] = useState({});
  
  console.log('RankingQuestion received message:', message);
  
  // Add more detailed safety check
  if (!message) {
    console.error('Message is undefined');
    return null;
  }
  
  if (!message.items) {
    console.error('Message items are undefined:', message);
    return null;
  }
  
  if (!Array.isArray(message.items)) {
    console.error('Message items is not an array:', message.items);
    return null;
  }

  const handleRankChange = (itemId, rank) => {
    setRankings(prev => ({
      ...prev,
      [itemId]: rank
    }));
  };

  const handleSubmit = () => {
    // Convert rankings to formatted response
    const rankedItems = Object.entries(rankings)
      .map(([id, rank]) => ({
        id,
        rank: parseInt(rank),
        text: message.items.find(item => item.id === id).text
      }))
      .sort((a, b) => a.rank - b.rank)
      .map(item => item.text)
      .join(", ");

    onSubmit(`My ranking from most to least preferred: ${rankedItems}`);
  };

  return (
    <div style={styles.rankingContainer}>
      <div><strong>{message.question}</strong></div>
      {message.items.map((item) => (
        <div key={item.id} style={styles.rankingItem}>
          <select
            style={styles.rankSelect}
            value={rankings[item.id] || ''}
            onChange={(e) => handleRankChange(item.id, e.target.value)}
          >
            <option value="">-</option>
            {[...Array(message.totalRanks)].map((_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
          <span style={styles.rankLabel}>{item.text}</span>
        </div>
      ))}
      <button
        style={styles.submitRanking}
        onClick={handleSubmit}
        disabled={Object.keys(rankings).length !== message.totalRanks}
      >
        Submit Ranking
      </button>
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
  setIsMenuOpen,
  questionCount,
  maxQuestions = 5
}) => {
  const chatWindowRef = useRef(null);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [conversation, loading]);

  const lastMessage = conversation[conversation.length - 1];
  const showTextInput = lastMessage?.role === 'assistant' && 
                     (!lastMessage.type || 
                      (lastMessage.type !== 'multiple_choice' && 
                       lastMessage.type !== 'ranking'));

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

      <div style={styles.mainContent}>
        <div style={styles.chatContainer}>
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
                {message.type === 'ranking' && message.items && (
                  <RankingQuestion
                    message={message}
                    onSubmit={(response) => handleOptionSelect({ target: { value: response }}, index)}
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

        <div style={styles.progressSection}>
          <div style={styles.questionCounter}>
            Question {Math.min(questionCount, maxQuestions)} of {maxQuestions}
          </div>
          <div style={styles.progressBarContainer}>
            <div 
              style={{
                ...styles.progressBar,
                height: `${(questionCount / maxQuestions) * 100}%`
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
