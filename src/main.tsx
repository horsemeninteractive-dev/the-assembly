import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App.tsx';
import './index.css';
import { debugLog, debugError } from './utils/utils';

// Global Fetch Interceptor for Native Capacitor
if (Capacitor.isNativePlatform()) {
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    let url = args[0];
    if (typeof url === 'string' && url.startsWith('/api/')) {
      args[0] = 'https://theassembly.web.app' + url;
    }
    return originalFetch(...args);
  };
}

// Global error handler for debugging white screens
window.onerror = (message, source, lineno, colno, error) => {
  debugError('Global Error:', { message, source, lineno, colno, error });
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `
      <div class="error-page-container">
        <h1 class="error-page-title">Application Error</h1>
        <p class="error-page-message">The application failed to load. This usually happens due to a JavaScript error or a blocked resource.</p>
        <pre class="error-page-pre">${message}</pre>
        <button onclick="window.location.reload()" class="error-page-button">Reload Application</button>
      </div>
    `;
  }
};

try {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          debugLog('SW registered:', registration);

          // Force an update check on every load
          registration.update();

          registration.onupdatefound = () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.onstatechange = () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  debugLog('New SW version installed, reloading...');
                  window.location.reload();
                }
              };
            }
          };
        })
        .catch((error) => {
          debugLog('SW registration failed:', error);
        });
    });

    // Handle the case where the new SW takes over
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        debugLog('Controller changed, reloading...');
        window.location.reload();
      }
    });
  }
} catch (e) {
  debugError('Service worker initialization error:', e);
}

import { SettingsProvider } from './contexts/SettingsContext.tsx';
import { AuthProvider } from './contexts/AuthContext.tsx';
import { AudioProvider } from './contexts/AudioContext.tsx';
import { GameProvider } from './contexts/GameContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <AuthProvider>
        <AudioProvider>
          <GameProvider>
            <App />
          </GameProvider>
        </AudioProvider>
      </AuthProvider>
    </SettingsProvider>
  </StrictMode>
);


