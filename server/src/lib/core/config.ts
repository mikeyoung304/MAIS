/**
 * Environment configuration with zod validation
 */

import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const ConfigSchema = z.object({
  ADAPTERS_PRESET: z.enum(['mock', 'real']).default('mock'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_BASE_URL: z.string().url().optional().default('http://localhost:5000'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  // CORS allowed origins for production (comma-separated list)
  ALLOWED_ORIGINS: z
    .string()
    .optional()
    .transform((val) => {
      if (!val) return [];
      return val.split(',').map((origin) => origin.trim());
    }),
  JWT_SECRET: z.string().min(1),
  BOOKING_TOKEN_SECRET: z.string().optional(),
  // Real mode only (optional for mock preset)
  DATABASE_URL: z.string().optional(),
  // Connection pooling configuration for serverless (Supabase/Vercel)
  // Default values optimized for serverless: fewer connections, faster timeout
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(5),
  DATABASE_POOL_TIMEOUT: z.coerce.number().int().positive().default(10), // seconds
  DATABASE_CONNECTION_LIMIT: z.coerce.number().int().positive().default(1), // per instance
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().url().optional().default('http://localhost:5173/success'),
  STRIPE_CANCEL_URL: z.string().url().optional().default('http://localhost:5173'),
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  POSTMARK_FROM_EMAIL: z.string().email().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: z.string().optional(),
  // Graceful shutdown timeout (milliseconds)
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(30000), // 30 seconds
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    logger.error({ errors: result.error.format() }, 'Invalid environment configuration');
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

/**
 * Get booking token secret with fallback to JWT_SECRET
 * Separate secret for booking tokens allows key rotation without invalidating tenant sessions
 */
export function getBookingTokenSecret(config: Config): string {
  return config.BOOKING_TOKEN_SECRET || config.JWT_SECRET;
}
