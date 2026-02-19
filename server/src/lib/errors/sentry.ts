/**
 * Sentry error tracking integration
 * Production-ready Sentry configuration with optional DSN
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { logger } from '../core/logger';
import { getConfig } from '../core/config';

// ============================================================================
// Sentry Configuration
// ============================================================================

let sentryInitialized = false;

export interface SentryConfig {
  dsn: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
  profilesSampleRate?: number;
}

/**
 * Initializes Sentry error tracking
 *
 * In production: SENTRY_DSN is REQUIRED - server will fail to start without it
 * In development: DSN is optional - gracefully degrades if not provided
 *
 * @returns Object indicating if Sentry is enabled
 */
export function initSentry(config?: SentryConfig): { enabled: boolean } {
  const appConfig = getConfig();
  const dsn = config?.dsn || appConfig.SENTRY_DSN;

  // Fail fast in production if Sentry not configured
  if (appConfig.NODE_ENV === 'production' && !dsn) {
    throw new Error(
      'SENTRY_DSN is required in production. ' +
        'Set SENTRY_DSN environment variable or use NODE_ENV=development.'
    );
  }

  if (!dsn) {
    logger.info('Sentry disabled (non-production, no SENTRY_DSN)');
    return { enabled: false };
  }

  try {
    Sentry.init({
      dsn,
      environment: config?.environment || appConfig.NODE_ENV,
      release: config?.release || appConfig.APP_VERSION,
      tracesSampleRate: config?.tracesSampleRate || 0.5, // 50% (increased from 10%)
      profilesSampleRate: config?.profilesSampleRate || 0.1,

      // Performance monitoring
      integrations: [nodeProfilingIntegration()],

      // Error filtering
      beforeSend(event, hint) {
        // Filter out health check requests
        if (event.request?.url?.includes('/health')) {
          return null;
        }

        // Filter out 404 and 429 responses (operational noise)
        if (
          event.contexts?.response?.status_code === 404 ||
          event.contexts?.response?.status_code === 429
        ) {
          return null;
        }

        // Filter out operational errors (already logged)
        // originalException may be any throwable; check for isOperational property
        const error = hint.originalException as Record<string, unknown> | undefined;
        if (error && error.isOperational === true) {
          return null;
        }

        return event;
      },

      // Scrub sensitive data
      beforeBreadcrumb(breadcrumb) {
        // Remove sensitive query parameters
        if (breadcrumb.data?.url) {
          breadcrumb.data.url = breadcrumb.data.url.replace(
            /([?&])(password|token|key|secret)=[^&]*/gi,
            '$1$2=***'
          );
        }
        return breadcrumb;
      },
    });

    sentryInitialized = true;
    logger.info({ dsn: dsn.substring(0, 20) + '...' }, 'Sentry initialized');
    return { enabled: true };
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Sentry');
    return { enabled: false };
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

  // Always log to console as fallback
  logger.error({ error, context }, 'Exception captured');
}

/**
 * Captures a message and sends to Sentry
 */
export function captureMessage(
  message: string,
  level: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info',
  context?: Record<string, any>
): void {
  if (sentryInitialized) {
    Sentry.captureMessage(message, {
      level: level === 'fatal' ? 'error' : level,
      extra: context,
    });
  }

  // Log to console
  const logLevel = level === 'warning' ? 'warn' : level;
  logger[logLevel === 'fatal' ? 'error' : logLevel]({ context }, message);
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

  // Log breadcrumb for development
  if (getConfig().NODE_ENV !== 'production') {
    logger.debug({ message, category, data }, 'Breadcrumb');
  }
}

/**
 * Checks if Sentry is initialized
 */
export function isSentryEnabled(): boolean {
  return sentryInitialized;
}

// ============================================================================
// Express Middleware (for when Sentry is enabled)
// ============================================================================

/**
 * Sentry request handler middleware
 * Call this BEFORE your routes
 * Note: In Sentry v8+, this is replaced by expressIntegration() in init()
 * This function is kept for backwards compatibility but is now a no-op
 */
export function sentryRequestHandler() {
  // In Sentry v8+, request handling is done via expressIntegration()
  // which should be added to the integrations array in init()
  return (_req: unknown, _res: unknown, next: (err?: unknown) => void) => next();
}

/**
 * Sentry error handler middleware
 * Call this AFTER your routes but BEFORE other error handlers
 * Note: In Sentry v8+, use setupExpressErrorHandler(app) instead
 */
export function sentryErrorHandler() {
  if (!sentryInitialized) {
    return (_err: unknown, _req: unknown, _res: unknown, next: (err?: unknown) => void) =>
      next(_err);
  }

  // Return a middleware that captures errors to Sentry
  return (err: unknown, _req: unknown, _res: unknown, next: (err?: unknown) => void) => {
    if (err instanceof Error) {
      Sentry.captureException(err);
    }
    next(err);
  };
}
