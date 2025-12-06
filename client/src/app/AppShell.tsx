/**
 * AppShell - Minimal header/footer for waitlist landing page
 * Features: Skip link, ARIA landmarks, focus management, clean typography
 */

import { Outlet, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Container } from '@/ui/Container';
import { PageTransition } from '@/components/transitions/PageTransition';
import '@/styles/a11y.css';

const appMode = import.meta.env.VITE_APP_MODE;
const isE2EMode = import.meta.env.VITE_E2E === '1';

export function AppShell() {
  const isMockMode = appMode === 'mock';
  const location = useLocation();

  return (
    <div className="min-h-screen bg-white flex flex-col" data-e2e={isE2EMode ? '1' : undefined}>
      {/* Skip link for keyboard navigation */}
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {isMockMode && (
        <div className="bg-warning-100 border-b-2 border-warning-400 py-2.5">
          <Container>
            <p className="text-sm font-semibold text-warning-800 text-center tracking-wide uppercase flex items-center justify-center gap-2">
              <span
                className="inline-block w-2 h-2 bg-warning-500 rounded-full animate-pulse"
                aria-hidden="true"
              />
              Development Mode - Using Mock Data
              <span
                className="inline-block w-2 h-2 bg-warning-500 rounded-full animate-pulse"
                aria-hidden="true"
              />
            </p>
          </Container>
        </div>
      )}

      <header className="absolute top-0 left-0 right-0 z-10 bg-transparent">
        <Container>
          <div className="flex items-center justify-between py-6">
            <Link
              to="/"
              className="text-xl tracking-tight text-text-primary font-semibold hover:text-sage transition-colors"
            >
              MaconAI
            </Link>
            {/* Minimal nav - just login for existing users */}
            <nav aria-label="Primary navigation" className="flex items-center gap-6">
              <Link
                to="/login"
                className="text-sm tracking-wide text-text-muted hover:text-text-primary transition-colors"
              >
                Log In
              </Link>
            </nav>
          </div>
        </Container>
      </header>

      <main id="main" tabIndex={-1} className="flex-1">
        <AnimatePresence mode="wait">
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>

      <footer className="bg-surface border-t border-sage-light/20">
        <Container>
          <div className="py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-text-muted">
              &copy; {new Date().getFullYear()} MaconAI Solutions
            </p>
            <a
              href="mailto:mike@maconheadshots.com"
              className="text-sm text-text-muted hover:text-sage transition-colors"
            >
              mike@maconheadshots.com
            </a>
          </div>
        </Container>
      </footer>
    </div>
  );
}
