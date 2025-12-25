import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { api } from './lib/api';
import { initSentry } from './lib/sentry';
import './index.css';

// Initialize Sentry error tracking (optional - gracefully degrades if no DSN)
initSentry();

// Initialize tenant API key for multi-tenant mode
// In production, this would come from the tenant's subdomain or embedding config
// For E2E tests, we use a fixed test tenant key
const tenantApiKey = import.meta.env.VITE_TENANT_API_KEY;
if (tenantApiKey) {
  api.setTenantKey(tenantApiKey);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
