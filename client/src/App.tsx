import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { router } from './router';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './providers/ThemeProvider';
import { ErrorBoundary } from './components/errors';
import { Toaster } from './components/ui/toaster';

export function App() {
  useEffect(() => {
    // Create DOM element for E2E tests to detect app readiness
    const appReadyMarker = document.createElement('div');
    appReadyMarker.setAttribute('data-testid', 'app-ready');
    appReadyMarker.style.display = 'none';
    document.body.appendChild(appReadyMarker);
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <RouterProvider router={router} />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
