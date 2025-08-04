import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

const DemoLandingPage = ({ onFeatureSelect }) => {
  const [demoData, setDemoData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDemoData();
  }, []);

  const loadDemoData = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/demo/randy-keller`);
      setDemoData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load demo data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Loading Atlas Demo...</h2>
          <div style={{ fontSize: '2rem', margin: '20px 0' }}>🚀</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      color: 'white'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>
          🎯 Atlas Career Coach Demo
        </h1>
        
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '30px',
          borderRadius: '16px',
          marginBottom: '40px'
        }}>
          <h2 style={{ margin: '0 0 15px 0' }}>Randy Keller - The Builder</h2>
          <p style={{ fontSize: '1.2rem', margin: '0', opacity: '0.9' }}>
            Explore Phase 2 features with pre-loaded persona data
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
          gap: '30px',
          marginBottom: '40px'
        }}>
          <div 
            onClick={() => window.location.href = '/simulator'}
            style={{
              background: 'white',
              color: '#333',
              padding: '40px',
              borderRadius: '16px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🎮</div>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.5rem' }}>Day-in-Life Simulator</h3>
            <p style={{ margin: '0 0 20px 0', color: '#666', lineHeight: '1.6' }}>
              Experience interactive help desk scenarios with real-time scoring and AI-powered NPCs
            </p>
            <div style={{
              background: '#f0f8ff',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              color: '#1976d2',
              fontWeight: 'bold'
            }}>
              Visit: /simulator
            </div>
          </div>

          <div 
            onClick={() => window.location.href = '/resume-generator'}
            style={{
              background: 'white',
              color: '#333',
              padding: '40px',
              borderRadius: '16px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📄</div>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.5rem' }}>AI Resume Generator</h3>
            <p style={{ margin: '0 0 20px 0', color: '#666', lineHeight: '1.6' }}>
              Generate persona-optimized resumes with multiple templates and export options
            </p>
            <div style={{
              background: '#f0f8ff',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              color: '#1976d2',
              fontWeight: 'bold'
            }}>
              Visit: /resume-generator
            </div>
          </div>

          <div 
            onClick={() => window.location.href = '/dashboard'}
            style={{
              background: 'white',
              color: '#333',
              padding: '40px',
              borderRadius: '16px',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-8px)';
              e.currentTarget.style.boxShadow = '0 16px 48px rgba(0, 0, 0, 0.2)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '20px' }}>📊</div>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.5rem' }}>Impact Dashboard</h3>
            <p style={{ margin: '0 0 20px 0', color: '#666', lineHeight: '1.6' }}>
              View real-time analytics, success metrics, and user feedback across the platform
            </p>
            <div style={{
              background: '#f0f8ff',
              padding: '10px',
              borderRadius: '8px',
              fontSize: '0.9rem',
              color: '#1976d2',
              fontWeight: 'bold'
            }}>
              Visit: /dashboard
            </div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <h4 style={{ margin: '0 0 10px 0' }}>Quick Demo URLs:</h4>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <code style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '5px 10px', borderRadius: '4px' }}>
              /simulator
            </code>
            <code style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '5px 10px', borderRadius: '4px' }}>
              /resume-generator
            </code>
            <code style={{ background: 'rgba(255, 255, 255, 0.2)', padding: '5px 10px', borderRadius: '4px' }}>
              /dashboard
            </code>
          </div>
        </div>

        <button
          onClick={() => window.location.href = '/'}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: '2px solid rgba(255, 255, 255, 0.3)',
            padding: '15px 30px',
            borderRadius: '8px',
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.3)';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
        >
          ← Back to Main App
        </button>
      </div>
    </div>
  );
};

export default DemoLandingPage;
