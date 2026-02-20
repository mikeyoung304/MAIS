/**
 * Environment Variable Validation Schema
 * Based on rebuild-6.0 three-tier validation pattern
 */

import { z } from 'zod';

/**
 * TIER 1: Always Required (Development + Production)
 * These variables MUST be present in all environments
 */
const tier1Schema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_PORT: z.coerce.number().optional(), // Alias for PORT

  // Database (Supabase)
  DATABASE_URL: z
    .string()
    .refine(
      (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
      'DATABASE_URL must be a valid PostgreSQL connection string'
    ),
  DIRECT_URL: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z
      .string()
      .refine(
        (url) => url.startsWith('postgresql://') || url.startsWith('postgres://'),
        'DIRECT_URL must be a valid PostgreSQL connection string'
      )
      .optional()
  ),

  // Supabase - Optional in mock mode, required in real mode
  // (validated in validateEnv() when ADAPTERS_PRESET=real)
  SUPABASE_URL: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url('SUPABASE_URL must be a valid URL').optional()
  ),
  SUPABASE_ANON_KEY: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().startsWith('eyJ', 'SUPABASE_ANON_KEY must be a valid JWT').optional()
  ),
  SUPABASE_SERVICE_KEY: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().startsWith('eyJ', 'SUPABASE_SERVICE_KEY must be a valid JWT').optional()
  ),
  SUPABASE_JWT_SECRET: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().min(32, 'SUPABASE_JWT_SECRET must be at least 32 characters').optional()
  ),

  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  TENANT_SECRETS_ENCRYPTION_KEY: z
    .string()
    .length(
      64,
      'TENANT_SECRETS_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate with: openssl rand -hex 32'
    )
    .regex(
      /^[0-9a-f]+$/i,
      'TENANT_SECRETS_ENCRYPTION_KEY must be hexadecimal characters only. Generate with: openssl rand -hex 32'
    ),

  // Adapters Preset
  ADAPTERS_PRESET: z.enum(['mock', 'real']).default('real'),
});

/**
 * TIER 2: Production-Critical (Required in production only)
 * These variables are optional in development but REQUIRED in production
 */
const tier2Schema = z.object({
  // Stripe (required in production)
  // Use preprocess to convert empty strings to undefined, then validate
  STRIPE_SECRET_KEY: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().startsWith('sk_').optional()
  ),
  STRIPE_WEBHOOK_SECRET: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().startsWith('whsec_').optional()
  ),
  STRIPE_SUCCESS_URL: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url().optional()
  ),
  STRIPE_CANCEL_URL: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().url().optional()
  ),

  // Email (optional - falls back to file-sink)
  POSTMARK_SERVER_TOKEN: z.string().optional(),
  POSTMARK_FROM_EMAIL: z.string().email().optional(),

  // CORS
  CORS_ORIGIN: z.string().optional(),
});

/**
 * TIER 3: Optional (Feature Flags)
 * These variables enable optional features
 */
const tier3Schema = z.object({
  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  APP_VERSION: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),

  // Calendar Integration
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional(),
  PRETTY_LOGS: z.enum(['true', 'false']).optional(),
});

/**
 * Complete environment schema (all tiers merged)
 */
export const envSchema = tier1Schema.merge(tier2Schema).merge(tier3Schema);

export type Env = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup
 * Enforces tier-specific requirements based on NODE_ENV
 *
 * @throws Process exits with code 1 if validation fails
 * @returns Validated environment object
 */
export function validateEnv(): Env {
  logger.info('🔍 Validating environment variables...');

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    logger.error({ errors: result.error.format() }, 'Environment validation failed');
    logger.error('Missing or invalid environment variables detected.');
    logger.error('Tip: Copy .env.example to .env and fill in your values.');
    process.exit(1);
  }

  const env = result.data;

  // Production-specific validation (Tier 2)
  if (env.NODE_ENV === 'production') {
    const prodRequired = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'POSTMARK_SERVER_TOKEN',
      'CORS_ORIGIN',
    ] as const;

    const missing = prodRequired.filter((key) => !env[key]);

    if (missing.length > 0) {
      logger.error({ missing }, 'Production environment missing required variables');
      logger.error('These variables are REQUIRED in production.');
      process.exit(1);
    }
  }

  // Real mode validation (requires Stripe and Supabase)
  if (env.ADAPTERS_PRESET === 'real') {
    if (!env.STRIPE_SECRET_KEY) {
      logger.error('ADAPTERS_PRESET=real requires STRIPE_SECRET_KEY');
      logger.error('Either set STRIPE_SECRET_KEY or use ADAPTERS_PRESET=mock');
      process.exit(1);
    }

    const supabaseRequired = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_KEY',
      'SUPABASE_JWT_SECRET',
    ] as const;

    const missingSupa = supabaseRequired.filter((key) => !env[key]);
    if (missingSupa.length > 0) {
      logger.error({ missing: missingSupa }, 'ADAPTERS_PRESET=real requires Supabase variables');
      logger.error('Either set Supabase variables or use ADAPTERS_PRESET=mock');
      process.exit(1);
    }
  }

  logger.info('✅ Environment validation passed');
  logger.info(`📝 NODE_ENV: ${env.NODE_ENV}`);
  logger.info(`🔧 ADAPTERS_PRESET: ${env.ADAPTERS_PRESET}`);
  logger.info(`🔌 PORT: ${env.PORT}`);
  logger.info(`🗄️  Database: ${env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'configured'}`);

  return env;
}

// Import logger at the end to avoid circular dependency
import { logger } from '../lib/core/logger';
