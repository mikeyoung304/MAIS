/**
 * Cloud Run Auth Service
 *
 * Shared singleton for Google Cloud Run service-to-service authentication.
 * Replaces duplicated getIdentityToken() implementations across 4 files:
 * - tenant-admin-tenant-agent.routes.ts
 * - vertex-agent.service.ts
 * - customer-agent.service.ts
 * - project-hub-agent.service.ts
 *
 * Features:
 * - 3-tier fallback: Cloud Run metadata → JWT.fetchIdToken() → gcloud CLI
 * - Per-audience token caching with 55-minute TTL
 * - Zod safeParse for credential validation (Pitfall #62)
 *
 * ADC (GoogleAuth.getIdTokenClient) is intentionally omitted:
 * It silently returns empty headers for service accounts on non-GCP environments.
 * @see docs/solutions/JWT_ID_TOKEN_FOR_CLOUD_RUN_AUTH.md
 *
 * @see docs/plans/2026-02-04-refactor-shared-cloud-run-auth-service-plan.md
 */

import { execSync } from 'child_process';
import { z } from 'zod';
import { JWT } from 'google-auth-library';
import { logger } from '../lib/core/logger';

interface CachedToken {
  token: string;
  expiresAt: number; // Unix ms
}

const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 minutes (tokens valid ~1 hour)

// Zod schema for credential validation (Pitfall #62: runtime data must be validated)
const ServiceAccountSchema = z.object({
  client_email: z.string().min(1),
  private_key: z.string().min(1),
});

export class CloudRunAuthService {
  private serviceAccountCredentials: z.infer<typeof ServiceAccountSchema> | null = null;

  /** Per-audience token cache (e.g., tenant-agent vs customer-agent URLs) */
  private tokenCache = new Map<string, CachedToken>();

  constructor() {
    const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      try {
        const parsed = JSON.parse(serviceAccountJson);
        const result = ServiceAccountSchema.safeParse(parsed);
        if (result.success) {
          this.serviceAccountCredentials = result.data;
          logger.info('[CloudRunAuth] Initialized with service account credentials');
        } else {
          logger.error(
            { error: result.error.message },
            '[CloudRunAuth] GOOGLE_SERVICE_ACCOUNT_JSON missing required fields (client_email, private_key)'
          );
        }
      } catch (e) {
        logger.error(
          { error: e instanceof Error ? e.message : String(e) },
          '[CloudRunAuth] Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON'
        );
      }
    } else {
      logger.info('[CloudRunAuth] No service account configured (local dev mode)');
    }
  }

  /**
   * Get an identity token for a Cloud Run audience URL.
   * Uses 3-tier fallback: Metadata service → JWT → gcloud CLI.
   * Tokens are cached for 55 minutes per audience URL.
   */
  async getIdentityToken(audience: string): Promise<string | null> {
    // Check cache first
    const cached = this.tokenCache.get(audience);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const token = await this.fetchIdentityToken(audience);
    if (token) {
      this.tokenCache.set(audience, {
        token,
        expiresAt: Date.now() + TOKEN_TTL_MS,
      });
    }
    return token;
  }

  /** Clear cached token for an audience. Call on 401/403 before retrying. */
  clearCacheFor(audience: string): void {
    this.tokenCache.delete(audience);
  }

  private async fetchIdentityToken(audience: string): Promise<string | null> {
    // Priority 1: Cloud Run metadata service (fastest when on GCP)
    if (process.env.K_SERVICE) {
      try {
        const metadataUrl =
          'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';
        const response = await fetch(`${metadataUrl}?audience=${audience}`, {
          headers: { 'Metadata-Flavor': 'Google' },
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          const token = await response.text();
          logger.debug('[CloudRunAuth] Got token via metadata service');
          return token;
        }
      } catch (error) {
        logger.warn({ error }, '[CloudRunAuth] Metadata service unavailable');
      }
    }

    // Priority 2: JWT with service account (Render, CI)
    if (this.serviceAccountCredentials) {
      try {
        const jwtClient = new JWT({
          email: this.serviceAccountCredentials.client_email,
          key: this.serviceAccountCredentials.private_key,
        });
        const idToken = await jwtClient.fetchIdToken(audience);
        if (idToken) {
          logger.debug('[CloudRunAuth] Got token via JWT (service account)');
          return idToken;
        }
        logger.warn('[CloudRunAuth] JWT.fetchIdToken returned empty token');
      } catch (e) {
        logger.warn(
          { error: e instanceof Error ? e.message : String(e) },
          '[CloudRunAuth] JWT fetchIdToken failed'
        );
      }
    }

    // Priority 3: gcloud CLI (local development)
    try {
      const token = execSync('gcloud auth print-identity-token', {
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
      if (token) {
        logger.debug('[CloudRunAuth] Got token via gcloud CLI (local dev)');
        return token;
      }
    } catch {
      // Expected on non-local environments (Render, Cloud Run)
    }

    logger.warn(
      { audience },
      '[CloudRunAuth] No identity token available - requests will be unauthenticated'
    );
    return null;
  }
}

// Module-level singleton (no DI ceremony needed for a leaf service with no swappable deps)
export const cloudRunAuth = new CloudRunAuthService();
