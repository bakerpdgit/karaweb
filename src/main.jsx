import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerPyodideServiceWorker } from './python/registerServiceWorker.js';

// Register the pyodide service worker eagerly so it's active by the time
// the user opens Python mode and clicks Run. Failures are logged but
// non-fatal — FSM mode still works without it.
registerPyodideServiceWorker().catch(() => {});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
