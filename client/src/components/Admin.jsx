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
  }
};

function Admin() {
  const navigate = useNavigate();
  const [instructions, setInstructions] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    // Fetch current instructions when component mounts
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

    fetchInstructions();
  }, []);

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

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <div style={styles.buttonContainer}>
        <button style={styles.button} onClick={handleBack}>
          Back to Home
        </button>
      </div>
      <h1 style={styles.heading}>Admin Panel</h1>
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