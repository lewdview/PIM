import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (typeof window !== 'undefined') {
  // Global auto-recovery for stale dynamic module imports and MIME type mismatches
  const handleChunkMimeError = (msg: string) => {
    if (
      msg.includes('text/html') ||
      msg.includes('MIME type') ||
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('Importing a module script failed')
    ) {
      const lastReload = sessionStorage.getItem('chunk_recovery_timestamp');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
        sessionStorage.setItem('chunk_recovery_timestamp', now.toString());
        console.warn('[Vite Chunk Recovery] Detected stale module or MIME error, refreshing page to load latest build...');
        window.location.reload();
      }
      return true;
    }
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = typeof reason === 'string' ? reason : (reason?.message || '');
    if (handleChunkMimeError(msg)) {
      event.preventDefault();
      return;
    }
    if (
      msg.includes('JSON-RPC') ||
      msg.includes('disconnect') ||
      msg.includes('Coinbase') ||
      msg.includes('WalletLink') ||
      msg.includes('inapp')
    ) {
      console.warn('[System Override] Suppressed third-party wallet exception:', msg);
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.message || '';
    const file = event.filename || '';
    if (handleChunkMimeError(msg)) {
      event.preventDefault();
      return;
    }
    if (file.includes('inapp') || file.includes('walletlink') || msg.includes('JSON-RPC') || msg.includes('disconnect')) {
      console.warn('[System Override] Suppressed third-party script error:', msg, 'in', file);
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
