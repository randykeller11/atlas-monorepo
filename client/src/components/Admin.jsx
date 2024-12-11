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

  useEffect(() => {
    if (isAuthenticated) {
      fetchInstructions();
      fetchInitialMessage();
    }
  }, [isAuthenticated]);

  const fetchInitialMessage = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/initial-message`);
      setInitialMessage(response.data.message);
    } catch (error) {
      console.error('Error fetching initial message:', error);
      setMessage('Failed to load initial message');
      setIsError(true);
    }
  };

  const handleSaveInitialMessage = async () => {
    try {
      await axios.post(`${API_URL}/api/initial-message`, { message: initialMessage });
      setMessage('Initial message updated successfully');
      setIsError(false);
    } catch (error) {
      console.error('Error updating initial message:', error);
      setMessage('Failed to update initial message');
      setIsError(true);
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
        // Fetch instructions after successful login
        fetchInstructions();
      }
    } catch (error) {
      setLoginError('Invalid username or password');
    }
  };

  const fetchInstructions = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/instructions`);
      console.log("Fetched instructions:", response.data.instructions);
      setInstructions(response.data.instructions);
    } catch (error) {
      console.error('Error fetching instructions:', error);
      setMessage('Failed to load instructions');
      setIsError(true);
    }
  };

  if (!isAuthenticated) {
    return (
      <div style={styles.loginContainer}>
        <h2>Admin Login</h2>
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
          <button style={styles.button} type="submit">
            Login
          </button>
        </form>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      console.log("Saving new instructions:", instructions);
      const response = await axios.post(`${API_URL}/api/update-instructions`, { instructions });
      console.log("Server response:", response.data);
      
      // Verify the update by fetching the instructions again
      const verifyResponse = await axios.get(`${API_URL}/api/instructions`);
      console.log("Verified instructions:", verifyResponse.data.instructions);
      
      if (verifyResponse.data.instructions === instructions) {
        setMessage('Instructions updated successfully');
        setIsError(false);
        
        console.log("Clearing chat session");
        localStorage.removeItem('chatSessionId');
        
        console.log("Navigating to home with reset flag");
        navigate('/', { state: { shouldResetChat: true } });
      } else {
        throw new Error('Instructions verification failed');
      }
    } catch (error) {
      console.error('Error updating instructions:', error);
      setMessage('Failed to update instructions: ' + error.message);
      setIsError(true);
    }
  };

  const handleReset = async () => {
    try {
      await axios.post(`${API_URL}/api/reset-assistant`);
      setMessage('Assistant reset successfully');
      setIsError(false);
    } catch (error) {
      console.error('Error resetting assistant:', error);
      setMessage('Failed to reset assistant');
      setIsError(true);
    }
  };

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