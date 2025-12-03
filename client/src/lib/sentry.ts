/**
 * Sentry error tracking integration for client
 * Production-ready configuration with optional DSN
 */

import * as Sentry from '@sentry/react';

let sentryInitialized = false;

export interface SentryConfig {
  dsn: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  replaysSessionSampleRate?: number;
  replaysOnErrorSampleRate?: number;
}

/**
 * Initializes Sentry error tracking for React
 * DSN is optional - will gracefully degrade if not provided
 */
export function initSentry(config?: SentryConfig): void {
  const dsn = config?.dsn || import.meta.env.VITE_SENTRY_DSN;

  if (!dsn) {
    console.warn('⚠️  VITE_SENTRY_DSN not set - error tracking disabled');
    console.info('To enable Sentry, set VITE_SENTRY_DSN environment variable');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: config?.environment || import.meta.env.MODE,
      release: config?.release || import.meta.env.VITE_APP_VERSION,

      // Performance monitoring
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],

      // Trace sampling (increased from 0.1 to 0.5 for better monitoring coverage)
      tracesSampleRate: config?.tracesSampleRate || 0.5,

      // Session replay sampling
      replaysSessionSampleRate: config?.replaysSessionSampleRate || 0.01,
      replaysOnErrorSampleRate: config?.replaysOnErrorSampleRate || 1.0,

      // Error filtering
      beforeSend(event, hint) {
        // Don't send events in development
        if (import.meta.env.MODE === 'development') {
          console.error('Sentry event (dev mode - not sent):', event, hint);
          return null;
        }

        // Filter out specific errors
        const error = hint.originalException;
        if (error instanceof Error) {
          // Ignore network errors from browser extensions
          if (error.message?.includes('Extension context invalidated')) {
            return null;
          }
        }

        return event;
      },

      // Scrub sensitive data
      beforeBreadcrumb(breadcrumb) {
        // Remove sensitive data from fetch breadcrumbs
        if (breadcrumb.category === 'fetch' && breadcrumb.data?.url) {
          breadcrumb.data.url = breadcrumb.data.url.replace(
            /([?&])(password|token|key|secret)=[^&]*/gi,
            '$1$2=***'
          );
        }
        return breadcrumb;
      },
    });

    sentryInitialized = true;
    console.log('Sentry initialized for client');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Captures an exception and sends to Sentry
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (sentryInitialized) {
    Sentry.captureException(error, {
      extra: context,
      tags: {
        errorName: error.name,
      },
    });
  }

  // Always log to console
  console.error('Exception:', error, context);
}

/**
 * Captures a message and sends to Sentry
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, any>
): void {
  if (sentryInitialized) {
    Sentry.captureMessage(message, {
      level,
      extra: context,
    });
  }

  // Log to console
  console[level === 'warning' ? 'warn' : level](message, context);
}

/**
 * Sets user context for error tracking
 */
export function setUser(user: { id: string; email?: string; username?: string }): void {
  if (sentryInitialized) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.username,
    });
  }
}

/**
 * Clears user context
 */
export function clearUser(): void {
  if (sentryInitialized) {
    Sentry.setUser(null);
  }
}

/**
 * Adds breadcrumb for debugging context
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  data?: Record<string, any>
): void {
  if (sentryInitialized) {
    Sentry.addBreadcrumb({
      message,
      category,
      data,
      level: 'info',
    });
  }

  // Log breadcrumb in development
  if (import.meta.env.MODE === 'development') {
    console.debug('Breadcrumb:', { message, category, data });
  }
}

/**
 * Checks if Sentry is initialized
 */
export function isSentryEnabled(): boolean {
  return sentryInitialized;
}

/**
 * Re-export Sentry for direct access if needed
 */
export { Sentry };
