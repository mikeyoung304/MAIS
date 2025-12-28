/**
 * Isomorphic logger for Next.js app
 * Works in both Server and Client components
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogData {
  [key: string]: unknown;
}

const isDev = process.env.NODE_ENV === 'development';

function formatMessage(level: LogLevel, message: string, data?: LogData): string {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
}

export const logger = {
  debug: (message: string, data?: LogData) => {
    if (isDev) console.debug(formatMessage('debug', message, data));
  },
  info: (message: string, data?: LogData) => {
    console.info(formatMessage('info', message, data));
  },
  warn: (message: string, data?: LogData) => {
    console.warn(formatMessage('warn', message, data));
  },
  error: (message: string, error?: Error | LogData) => {
    const data = error instanceof Error ? { message: error.message, stack: error.stack } : error;
    console.error(formatMessage('error', message, data));
  },
};
