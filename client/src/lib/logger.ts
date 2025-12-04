/**
 * Frontend Logger
 *
 * Provides structured logging for the client application.
 * - In development: outputs to console with full context
 * - In production: can be extended to send to error tracking services (Sentry, etc.)
 *
 * Follows project convention: "Use logger, never console.log"
 */

interface LogContext {
  error?: Error | unknown;
  component?: string;
  tenantId?: string;
  [key: string]: unknown;
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = import.meta.env.DEV;

/**
 * Formats error objects for logging
 */
const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  if (typeof error === 'string') {
    return error;
  }
  return JSON.stringify(error);
};

/**
 * Core logging function
 */
const log = (level: LogLevel, message: string, context?: LogContext): void => {
  const timestamp = new Date().toISOString();
  const formattedContext = context
    ? {
        ...context,
        error: context.error ? formatError(context.error) : undefined,
      }
    : undefined;

  // In development, log to console
  if (isDev) {
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    if (formattedContext) {
      console[consoleMethod](
        `[${timestamp}] [${level.toUpperCase()}] ${message}`,
        formattedContext
      );
    } else {
      console[consoleMethod](`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }

  // In production, we could send to an error tracking service
  // Example: Sentry, LogRocket, etc.
  // if (!isDev && level === 'error') {
  //   sendToErrorTracking({ level, message, context: formattedContext, timestamp });
  // }
};

/**
 * Logger object with level-specific methods
 */
export const logger = {
  debug: (message: string, context?: LogContext): void => {
    if (isDev) {
      log('debug', message, context);
    }
  },

  info: (message: string, context?: LogContext): void => {
    log('info', message, context);
  },

  warn: (message: string, context?: LogContext): void => {
    log('warn', message, context);
  },

  error: (message: string, context?: LogContext): void => {
    log('error', message, context);
  },
};

export default logger;
