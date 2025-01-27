import React, { useState } from 'react';

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: '20px'
  },
  logo: {
    width: '300px',
    height: 'auto',
    marginBottom: '40px'
  },
  inputContainer: {
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center'
  },
  title: {
    fontSize: '24px',
    marginBottom: '20px',
    color: '#333'
  },
  input: {
    width: '100%',
    padding: '12px',
    fontSize: '18px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    marginBottom: '20px',
    textAlign: 'center'
  },
  button: {
    padding: '12px 30px',
    fontSize: '18px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
    '&:hover': {
      backgroundColor: '#45a049'
    }
  },
  disabled: {
    backgroundColor: '#cccccc',
    cursor: 'not-allowed'
  }
};

const Welcome = ({ onNameSubmit }) => {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onNameSubmit(name);
    }
  };

  return (
    <div style={styles.container}>
      <img 
        src="/images/NucoordLogo.PNG"
        alt="Nucoord Logo"
        style={styles.logo}
      />
      <div style={styles.inputContainer}>
        <h1 style={styles.title}>Welcome to Atlas Career Coach</h1>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            style={styles.input}
            autoFocus
          />
          <button 
            type="submit"
            style={{
              ...styles.button,
              ...(name.trim() === '' ? styles.disabled : {})
            }}
            disabled={name.trim() === ''}
          >
            Get Started
          </button>
        </form>
      </div>
    </div>
  );
};

export default Welcome;
