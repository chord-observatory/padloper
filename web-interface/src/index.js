import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import { withBase } from './paths';
import axios from 'axios';

// Safety net: rewrite bare '/api/*' requests to '/padloper/api/*' at runtime.
// This guards against any legacy code that might bypass `withBase(...)`.
if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      if (typeof input === 'string' && input.startsWith('/api/')) {
        input = withBase(input);
      }
    } catch (_) {}
    return originalFetch(input, init);
  };
}

// Safety net for axios: rewrite bare '/api/*' to '/padloper/api/*'
axios.interceptors.request.use((config) => {
  try {
    if (config && typeof config.url === 'string' && config.url.startsWith('/api/')) {
      config.url = withBase(config.url);
    }
  } catch (_) {}
  return config;
});

// Render the React app in the 'root' DOM element.
ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);
