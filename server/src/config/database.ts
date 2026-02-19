/**
 * Supabase Client Configuration
 *
 * NOTE: Supabase clients are ONLY used for:
 * - Storage uploads (segment hero images)
 * - Auth flows (if using Supabase Auth)
 *
 * Database queries use PRISMA, not Supabase JS client.
 * See: docs/setup/SUPABASE.md
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../lib/core/logger';
import { getConfig } from '../lib/core/config';

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
    const cfg = getConfig();
    const url = cfg.SUPABASE_URL;
    const key = cfg.SUPABASE_SERVICE_KEY;

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
    const cfg = getConfig();
    const url = cfg.SUPABASE_URL;
    const key = cfg.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY required for auth client');
    }

    supabaseAnonClient = createClient(url, key);
    logger.info('✅ Supabase auth client initialized (respects RLS)');
  }

  return supabaseAnonClient;
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
