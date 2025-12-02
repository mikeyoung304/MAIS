/**
 * Supabase Database Configuration
 * Based on rebuild-6.0 pattern
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../lib/core/logger';

let supabaseServiceClient: SupabaseClient | null = null;
let supabaseAnonClient: SupabaseClient | null = null;

/**
 * Get Supabase client with SERVICE_ROLE key
 * Bypasses Row-Level Security (RLS) for server-side operations
 *
 * @example
 * ```typescript
 * const supabase = getSupabaseClient();
 * const { data } = await supabase.from('Tenant').select('*');
 * ```
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseServiceClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required for service client');
    }

    supabaseServiceClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    logger.info('✅ Supabase service client initialized (bypasses RLS)');
  }

  return supabaseServiceClient;
}

/**
 * Get Supabase client with ANON key
 * Respects Row-Level Security (RLS) for user-facing operations
 * Use for auth flows and operations that should respect RLS policies
 *
 * @example
 * ```typescript
 * const supabase = getSupabaseAuthClient();
 * const { data, error } = await supabase.auth.signInWithPassword({
 *   email: 'user@example.com',
 *   password: 'password'
 * });
 * ```
 */
export function getSupabaseAuthClient(): SupabaseClient {
  if (!supabaseAnonClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY required for auth client');
    }

    supabaseAnonClient = createClient(url, key);
    logger.info('✅ Supabase auth client initialized (respects RLS)');
  }

  return supabaseAnonClient;
}

/**
 * Verify database connection on startup
 * Tests connection by querying Tenant table
 *
 * @throws Error if connection fails
 */
export async function verifyDatabaseConnection(): Promise<void> {
  try {
    logger.info('🔍 Verifying Supabase database connection...');

    const supabase = getSupabaseClient();

    // Simple query to verify connection
    const { data, error } = await supabase
      .from('Tenant')
      .select('id')
      .limit(1);

    if (error) {
      logger.error({
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
      }, '❌ Supabase query error');
      throw new Error(`Database query failed: ${error.message} (code: ${error.code})`);
    }

    logger.info('✅ Database connection verified successfully');
    logger.info(`📊 Database contains ${data?.length ?? 0} tenant(s) (sample query)`);
  } catch (error) {
    const err = error as Error;
    logger.error({
      errorName: err.name,
      errorMessage: err.message,
      errorStack: err.stack,
    }, '❌ Database connection verification failed');
    throw error;
  }
}

/**
 * Close all Supabase client connections
 * Call during graceful shutdown
 */
export async function closeSupabaseConnections(): Promise<void> {
  try {
    logger.info('Closing Supabase connections...');

    // Supabase clients don't have explicit close method
    // They use HTTP connections which are automatically managed
    // Just clear the references
    supabaseServiceClient = null;
    supabaseAnonClient = null;

    logger.info('Supabase connections closed');
  } catch (error) {
    logger.error({ error }, 'Error closing Supabase connections');
  }
}
