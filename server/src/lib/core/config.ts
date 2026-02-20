/**
 * Environment configuration with zod validation
 *
 * ALL server-side environment variables are declared here.
 * Use `getConfig()` or DI-injected `config` to read values — never `process.env` directly.
 *
 * Exceptions (see comments at bottom):
 * - logger.ts reads process.env directly to avoid circular import
 * - Cloud Run agent deploy copies (server/src/agent-v2/deploy/*) are standalone
 */

import { z } from 'zod';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const ConfigSchema = z.object({
  // --- Core Server ---
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
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
  // Auto-confirm bookings after payment (skip PAID status, go directly to CONFIRMED)
  // Useful for testing/demo purposes where manual confirmation is not needed
  AUTO_CONFIRM_BOOKINGS: z
    .string()
    .transform((val) => val === 'true')
    .default('false'),

  // --- Authentication ---
  JWT_SECRET: z.string().min(1),
  BOOKING_TOKEN_SECRET: z
    .string()
    .min(
      32,
      'BOOKING_TOKEN_SECRET must be at least 32 characters. Generate with: openssl rand -hex 32'
    )
    .describe('Required for booking management tokens - must be separate from JWT_SECRET'),
  // Internal API secret for service-to-service communication
  INTERNAL_API_SECRET: z.string().optional(),

  // --- Database ---
  // Real mode only (optional for mock preset)
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_TEST: z.string().optional(),
  // Connection pooling configuration for Supabase Pro (200 pooler connections available)
  // Render runs persistent Node.js processes, so 5 connections/instance is safe
  DATABASE_POOL_SIZE: z.coerce.number().int().positive().default(5),
  DATABASE_POOL_TIMEOUT: z.coerce.number().int().positive().default(10), // seconds
  DATABASE_CONNECTION_LIMIT: z.coerce.number().int().positive().default(5), // per instance (200 pooler max)

  // --- Stripe ---
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_SUCCESS_URL: z.string().url().optional().default('http://localhost:5173/success'),
  STRIPE_CANCEL_URL: z.string().url().optional().default('http://localhost:5173'),
  STRIPE_CONNECT_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_STARTER_PRICE_ID: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),

  // --- Email ---
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  POSTMARK_FROM_EMAIL: z.string().email().optional(),
  EARLY_ACCESS_NOTIFICATION_EMAIL: z.string().email().optional().default('mike@maconheadshots.com'),
  // Admin notification for tenant signups - receives email when new tenant registers
  ADMIN_NOTIFICATION_EMAIL: z.string().email().optional().default('mike@maconheadshots.com'),

  // --- Google Calendar (Service Account — legacy) ---
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: z.string().optional(),

  // --- Google Calendar OAuth 2.0 ---
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url().optional(),
  GOOGLE_OAUTH_STATE_SECRET: z.string().min(32).optional(),

  // --- Agent URLs (Cloud Run) ---
  CUSTOMER_AGENT_URL: z.string().url().optional(),
  TENANT_AGENT_URL: z.string().url().optional(),
  RESEARCH_AGENT_URL: z.string().url().optional(),

  // --- Google / Vertex AI ---
  GOOGLE_VERTEX_PROJECT: z.string().optional(),
  GOOGLE_VERTEX_LOCATION: z.string().optional().default('us-central1'),
  GOOGLE_CLOUD_PROJECT: z.string().optional(), // alias for VERTEX_PROJECT in some contexts
  GOOGLE_CLOUD_LOCATION: z.string().optional(), // alias for VERTEX_LOCATION
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  // --- Supabase ---
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),

  // --- Storage ---
  STORAGE_MODE: z.enum(['local', 'supabase']).optional(),
  UPLOAD_DIR: z.string().optional(),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().int().positive().optional().default(2),

  // --- Next.js Integration ---
  NEXTJS_APP_URL: z.string().url().optional().default('http://localhost:3000'),
  NEXTJS_REVALIDATE_SECRET: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional().default('http://localhost:3000'),
  CLIENT_URL: z.string().url().optional().default('http://localhost:3000'),

  // --- Internal Services ---
  MAIS_API_URL: z.string().url().optional().default('https://api.gethandled.ai'),
  AGENT_API_PATH: z.string().optional().default('/v1/internal/agent'),

  // --- Monitoring ---
  METRICS_BEARER_TOKEN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  APP_VERSION: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  npm_package_version: z.string().optional(),

  // --- Redis ---
  REDIS_URL: z.string().optional(),

  // --- Server Lifecycle ---
  // Graceful shutdown timeout (milliseconds)
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(30000), // 30 seconds
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(60000),
  REMINDER_CRON_SCHEDULE: z.string().optional().default('0 9 * * *'),

  // --- Cloud Run Detection ---
  K_SERVICE: z.string().optional(), // Set automatically by Cloud Run

  // --- Agent Infrastructure ---
  AGENT_ENGINE_ID: z.string().optional(),
  AGENT_STAGING_BUCKET: z.string().optional(),
  MEDIA_BUCKET: z.string().optional(),
  MEDIA_COST_WARN_PERCENT: z.string().optional(),
  MEDIA_COST_CRITICAL_PERCENT: z.string().optional(),

  // --- Security ---
  TENANT_SECRETS_ENCRYPTION_KEY: z
    .string()
    .length(
      64,
      'TENANT_SECRETS_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate with: openssl rand -hex 32'
    )
    .regex(
      /^[0-9a-f]+$/i,
      'TENANT_SECRETS_ENCRYPTION_KEY must be hexadecimal characters only. Generate with: openssl rand -hex 32'
    )
    .optional(),

  // --- Testing ---
  E2E_TEST: z.string().optional(),
  LOCAL_DEV: z.string().optional(),
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

// =============================================================================
// Module-level Config Singleton
// =============================================================================

let _config: Config | undefined;

/**
 * Module-level config singleton. Validated on first access.
 *
 * Prefer this over `loadConfig()` in files that are NOT inside the DI container.
 * Inside the DI container, use the `config` parameter that was passed to `buildContainer()`.
 *
 * Falls back gracefully in test environments where process.env may be incomplete.
 */
export function getConfig(): Config {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/**
 * Reset the config singleton (for testing only).
 */
export function resetConfig(): void {
  _config = undefined;
}

/**
 * Get booking token secret
 * Separate secret for booking tokens allows key rotation without invalidating tenant sessions
 *
 * SECURITY: This must be a separate secret from JWT_SECRET to prevent privilege escalation
 * if the tenant admin JWT is compromised. No fallback to JWT_SECRET is allowed.
 *
 * @throws Error if BOOKING_TOKEN_SECRET is not set (should never happen due to Zod validation)
 */
export function getBookingTokenSecret(config: Config): string {
  if (!config.BOOKING_TOKEN_SECRET) {
    throw new Error(
      'BOOKING_TOKEN_SECRET is required for production. Generate with: openssl rand -hex 32'
    );
  }
  return config.BOOKING_TOKEN_SECRET;
}
