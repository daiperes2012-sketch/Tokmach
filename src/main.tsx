import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global Quota Error Suppression
// This must run before any other code to catch errors during initialization
const suppressQuotaErrors = () => {
  if (typeof window === 'undefined') return;

  const isQuotaError = (message: string) => {
    if (!message) return false;
    const msg = message.toLowerCase();
    return (
      msg.includes('quota exceeded') || 
      msg.includes('quota metric') || 
      msg.includes('firestore/quota-exceeded')
    );
  };

  const handleQuota = () => {
    window.dispatchEvent(new CustomEvent('firestore-quota-exceeded'));
    return true; // Suppress
  };

  // 1. Hijack window.onerror
  const oldOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    if (isQuotaError(String(message))) {
      return handleQuota();
    }
    if (oldOnError) return oldOnError(message, source, lineno, colno, error);
    return false;
  };

  // 2. Hijack unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    if (isQuotaError(message)) {
      event.preventDefault();
      event.stopPropagation();
      handleQuota();
    }
  }, true);

  // 3. Hijack console.error
  const oldConsoleError = console.error;
  console.error = (...args: any[]) => {
    const message = args.map(arg => String(arg)).join(' ');
    if (isQuotaError(message)) {
      handleQuota();
      return;
    }
    oldConsoleError.apply(console, args);
  };
};

suppressQuotaErrors();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
