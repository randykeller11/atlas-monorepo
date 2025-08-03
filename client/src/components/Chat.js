import React from 'react';
import './Chat.css';

const Chat = ({
  conversation,
  loading,
  input,
  setInput,
  handleKeyPress,
  sendMessage,
  handleOptionSelect,
  questionCount,
  maxQuestions
}) => {
  const renderMessage = (message, index) => {
    if (message.role === 'user') {
      return (
        <div key={index} className="message user-message">
          <div className="message-content">
            {message.content}
          </div>
        </div>
      );
    }

    if (message.role === 'assistant') {
      return (
        <div key={index} className="message assistant-message">
          <div className="message-content">
            {message.content && (
              <div className="message-text">
                {message.content}
              </div>
            )}
            
            {message.type === 'multiple_choice' && message.options && (
              <div className="options-container">
                <h4 className="question-title">{message.question}</h4>
                <div className="options-grid">
                  {message.options.map((option) => (
                    <button
                      key={option.id}
                      className="option-button"
                      onClick={(e) => {
                        e.target.selectedText = option.text;
                        handleOptionSelect(e, index);
                      }}
                      value={option.id}
                    >
                      <span className="option-id">{option.id.toUpperCase()}</span>
                      <span className="option-text">{option.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {message.type === 'ranking' && message.items && (
              <div className="ranking-container">
                <h4 className="question-title">{message.question}</h4>
                <p className="ranking-instructions">
                  Drag to reorder these items from most important to least important:
                </p>
                <div className="ranking-items">
                  {message.items.map((item, itemIndex) => (
                    <div key={item.id} className="ranking-item">
                      <span className="ranking-number">{itemIndex + 1}</span>
                      <span className="ranking-text">{item.text}</span>
                    </div>
                  ))}
                </div>
                <button
                  className="ranking-submit"
                  onClick={(e) => {
                    const order = message.items.map((item, idx) => `${idx + 1}. ${item.text}`).join(', ');
                    e.target.value = order;
                    handleOptionSelect(e, index);
                  }}
                >
                  Submit Ranking
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>Career Assessment Chat</h2>
        <div className="question-counter">
          Question {questionCount}/{maxQuestions}
        </div>
      </div>
      
      <div className="chat-messages">
        {conversation.map((message, index) => renderMessage(message, index))}
        
        {loading && (
          <div className="message assistant-message">
            <div className="message-content">
              <div className="typing-indicator">
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <div className="chat-input-container">
        <div className="input-group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your response..."
            className="chat-input"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="send-button"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
