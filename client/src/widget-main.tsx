import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { WidgetApp } from './widget/WidgetApp';
import './index.css';

/**
 * Widget application entry point
 *
 * This is loaded inside an iframe by the SDK loader.
 * Receives configuration via URL parameters.
 *
 * Example URL:
 * https://app.elope.com/widget?tenant=acme&apiKey=pk_live_xxx&mode=embedded&parentOrigin=https://acme.com
 */

// Extract configuration from URL
const params = new URLSearchParams(window.location.search);
const widgetConfig = {
  tenant: params.get('tenant'),
  apiKey: params.get('apiKey'),
  mode: (params.get('mode') || 'embedded') as 'embedded' | 'modal',
  parentOrigin: params.get('parentOrigin'),
};

// Validate configuration
if (!widgetConfig.tenant || !widgetConfig.apiKey) {
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center; color: #EF4444; font-family: system-ui, sans-serif;">
      <h3 style="margin-bottom: 8px;">Widget Configuration Error</h3>
      <p style="margin: 0;">Missing required parameters: tenant, apiKey</p>
    </div>
  `;
  throw new Error('[Widget] Missing required configuration');
}

// Render widget
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <WidgetApp config={widgetConfig} />
    </QueryClientProvider>
  </StrictMode>
);
