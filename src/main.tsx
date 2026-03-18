import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler for debugging white screens
window.onerror = (message, source, lineno, colno, error) => {
  console.error('Global Error:', { message, source, lineno, colno, error });
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `
      <div style="background: #0a0a0a; color: #ff4444; padding: 20px; font-family: monospace; min-h-screen: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
        <h1 style="margin-bottom: 10px;">Application Error</h1>
        <p style="color: #888; margin-bottom: 20px;">The application failed to load. This usually happens due to a JavaScript error or a blocked resource.</p>
        <pre style="background: #1a1a1a; padding: 15px; border-radius: 8px; max-width: 90%; overflow: auto; text-align: left;">${message}</pre>
        <button onclick="window.location.reload()" style="margin-top: 20px; padding: 10px 20px; background: #fff; color: #000; border: none; border-radius: 5px; cursor: pointer;">Reload Application</button>
      </div>
    `;
  }
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
      
      // Check for updates periodically
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, but the user should probably be notified or just reload
              console.log('New content is available; please refresh.');
            }
          });
        }
      });
    }).catch(registrationError => {
      console.error('SW registration failed: ', registrationError);
    });
  });

  // Handle controller change (e.g. after skipWaiting)
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
