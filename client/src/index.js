import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// Initialize the React application with the new Phase 1 architecture
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Performance monitoring for the new modular architecture
// This will help track the impact of the new services and state management
if (process.env.NODE_ENV === 'production') {
  // In production, send performance metrics to analytics
  reportWebVitals((metric) => {
    // Send to analytics service
    console.log('Performance metric:', metric);
    
    // TODO: Integrate with proper analytics service
    // Example: analytics.track('web-vitals', metric);
  });
} else {
  // In development, log performance metrics to console
  reportWebVitals(console.log);
}

// Add global error boundary for better error handling
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  
  // TODO: Send to error tracking service
  // Example: errorTracking.captureException(event.reason);
});

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  
  // TODO: Send to error tracking service
  // Example: errorTracking.captureException(event.error);
});
