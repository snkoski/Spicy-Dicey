import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

const sentryDsn = import.meta.env['VITE_SENTRY_DSN'] as string | undefined;
if (sentryDsn) {
  void import('@sentry/browser').then((Sentry) => Sentry.init({ dsn: sentryDsn }));
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root element');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
