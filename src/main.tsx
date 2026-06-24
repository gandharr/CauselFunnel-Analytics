import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { setupVirtualBackend } from './virtualBackend.ts';

// Self-healing: Activate local virtual database immediately if hosted statically on GitHub Pages
// Otherwise, probe the server and activate the virtual database as an automatic fallback if unreachable
if (
  window.location.hostname.includes('github.io') ||
  window.location.hostname.includes('github') ||
  window.location.search.includes('demo=true')
) {
  setupVirtualBackend();
} else {
  fetch('/api/db-status')
    .then(res => {
      if (!res.ok) {
        setupVirtualBackend();
      }
    })
    .catch(() => {
      setupVirtualBackend();
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
