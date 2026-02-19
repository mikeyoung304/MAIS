/**
 * Pino logger with request ID support
 *
 * IMPORTANT: This file reads process.env directly instead of using getConfig().
 * config.ts imports logger.ts, so importing config.ts here would create a circular dependency.
 * This is the ONE intentional exception to the "use getConfig()" rule.
 */

import pino from 'pino';

// Reads process.env directly — see module docstring for rationale (circular dep with config.ts)
const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'HH:MM:ss',
      },
    },
  }),
});

export type Logger = typeof logger;

export function createRequestLogger(requestId: string): Logger {
  return logger.child({ requestId });
}
