import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import config from '../config';

// Use config.API_URL instead of defining it in the file
const { API_URL } = config;

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
  },
  heading: {
    marginBottom: '20px',
  },
  textArea: {
    width: '100%',
    minHeight: '400px',
    marginBottom: '20px',
    padding: '10px',
    fontFamily: 'monospace',
  },
  smallTextArea: {
    width: '100%',
    minHeight: '100px',
    marginBottom: '20px',
    padding: '10px',
    fontFamily: 'monospace',
  },
  button: {
    padding: '10px 20px',
    fontSize: '16px',
    marginRight: '10px',
  },
  message: {
    marginTop: '10px',
    padding: '10px',
    borderRadius: '4px',
  },
  success: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  error: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  buttonContainer: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
  },
  loginContainer: {
    maxWidth: '400px',
    margin: '100px auto',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  loginInput: {
    width: '100%',
    padding: '10px',
    marginBottom: '10px',
    border: '1px solid #cccccc',
    borderRadius: '4px',
    fontSize: '16px',
  },
  errorMessage: {
    color: '#dc3545',
    marginBottom: '10px',
  },
  sectionHeader: {
    fontSize: '1.5em',
    marginBottom: '15px',
    color: '#333',
    borderBottom: '1px solid #cccccc',
    paddingBottom: '10px',
  },
  instructionsSection: {
    marginBottom: '30px',
  }
};

function Admin() {
  const navigate = useNavigate();
  const [instructions, setInstructions] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showingSavePrompt, setShowingSavePrompt] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const instructionsResponse = await axios.get(`${API_URL}/api/instructions`);
      setInstructions(instructionsResponse.data.instructions);
      const messageResponse = await axios.get(`${API_URL}/api/initial-message`);
      setInitialMessage(messageResponse.data.message);
    } catch (error) {
      console.error('Error fetching data:', error);
      setMessage('Failed to load data');
      setIsError(true);
    }
  };

  const clearCredentials = () => {
    setUsername('');
    setPassword('');
    setLoginError('');
  };

  const handleSaveInitialMessage = () => {
    setShowingSavePrompt(true);
    clearCredentials();
    setPendingSave({
      type: 'initial-message',
      data: initialMessage
    });
  };

  const handleSave = () => {
    setShowingSavePrompt(true);
    clearCredentials();
    setPendingSave({
      type: 'instructions',
      data: instructions
    });
  };

  const handleReset = () => {
    setShowingSavePrompt(true);
    clearCredentials();
    setPendingSave({
      type: 'reset',
      data: null
    });
  };

  const executeSave = async () => {
    try {
      if (pendingSave.type === 'instructions') {
        await axios.post(`${API_URL}/api/update-instructions`, { 
          instructions: pendingSave.data 
        });
        setMessage('Instructions updated successfully');
      } else if (pendingSave.type === 'initial-message') {
        await axios.post(`${API_URL}/api/initial-message`, { 
          message: pendingSave.data 
        });
        setMessage('Initial message updated successfully');
      } else if (pendingSave.type === 'reset') {
        await axios.post(`${API_URL}/api/reset-assistant`);
        setMessage('Assistant reset successfully');
      }
      setIsError(false);
      setTimeout(() => {
        setMessage('');
      }, 3000);
      return true;
    } catch (error) {
      setMessage(`Failed to ${pendingSave.type === 'reset' ? 'reset assistant' : 'update ' + pendingSave.type}`);
      setIsError(true);
      return false;
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/api/auth`, {
        username,
        password
      });
      
      if (response.data.authenticated) {
        setIsAuthenticated(true);
        setLoginError('');
        if (pendingSave) {
          const saveSuccess = await executeSave();
          if (saveSuccess) {
            setShowingSavePrompt(false);
            setPendingSave(null);
            clearCredentials();
          }
        }
      }
    } catch (error) {
      setLoginError('Invalid username or password');
    }
  };

  if (showingSavePrompt) {
    return (
      <div style={styles.loginContainer}>
        <h2>Log in to save changes</h2>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.loginInput}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.loginInput}
          />
          {loginError && <div style={styles.errorMessage}>{loginError}</div>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={styles.button} type="submit">
              Save Changes
            </button>
            <button 
              style={{...styles.button, backgroundColor: '#6c757d'}} 
              onClick={() => {
                setShowingSavePrompt(false);
                setPendingSave(null);
                clearCredentials();
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.buttonContainer}>
        <button style={styles.button} onClick={() => navigate('/')}>
          Back to Home
        </button>
      </div>
      <h1 style={styles.heading}>Admin Panel</h1>
      
      <div style={styles.instructionsSection}>
        <h2 style={styles.sectionHeader}>Initial Message</h2>
        <textarea
          style={styles.smallTextArea}
          value={initialMessage}
          onChange={(e) => setInitialMessage(e.target.value)}
          placeholder="Enter the initial message users will see..."
        />
        <div style={styles.buttonContainer}>
          <button style={styles.button} onClick={handleSaveInitialMessage}>
            Save Initial Message
          </button>
        </div>
      </div>

      <div style={styles.instructionsSection}>
        <h2 style={styles.sectionHeader}>Chatbot Instructions</h2>
        <textarea
          style={styles.textArea}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Enter instructions here..."
        />
        <div>
          <button style={styles.button} onClick={handleSave}>
            Save Instructions
          </button>
          <button style={styles.button} onClick={handleReset}>
            Reset Assistant
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          ...styles.message,
          ...(isError ? styles.error : styles.success)
        }}>
          {message}
        </div>
      )}
    </div>
  );
}

export default Admin;