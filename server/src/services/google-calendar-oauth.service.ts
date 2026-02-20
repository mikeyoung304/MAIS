/**
 * Google Calendar OAuth 2.0 Service
 *
 * Handles the OAuth flow for connecting tenant Google Calendars:
 * 1. Generate authorization URL with HMAC-signed state
 * 2. Exchange authorization code for tokens
 * 3. Encrypt and store tokens in Tenant.secrets.googleCalendar
 * 4. Retrieve/refresh tokens for API calls
 *
 * SECURITY:
 * - State parameter is HMAC-signed with GOOGLE_OAUTH_STATE_SECRET (anti-CSRF)
 * - State expires after 10 minutes (anti-replay)
 * - Tokens encrypted with TENANT_SECRETS_ENCRYPTION_KEY (AES-256-GCM)
 * - Refresh token stored encrypted; access token refreshed on expiry
 *
 * Reference pattern: StripeConnectService (stripe-connect.service.ts)
 */

import crypto from 'node:crypto';
import type { PrismaClient, Prisma } from '../generated/prisma/client';
import { encryptionService } from '../lib/encryption.service';
import type { TenantSecrets, GoogleCalendarOAuthTokens } from '../types/prisma-json';
import type { CacheServicePort } from '../lib/ports';
import { logger } from '../lib/core/logger';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Scopes: read calendar for availability + manage events for booking sync
const OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

// State parameter expires after 10 minutes
const STATE_TTL_MS = 10 * 60 * 1000;

// Refresh access token when it expires within 5 minutes
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

// Cache access token in Redis for 55 minutes (tokens last 60 min; 5 min safety buffer)
const ACCESS_TOKEN_CACHE_TTL_S = 55 * 60;

export class GoogleCalendarOAuthService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly redirectUri: string,
    private readonly stateSecret: string,
    private readonly cache?: CacheServicePort
  ) {
    logger.info('Google Calendar OAuth service initialized');
  }

  /**
   * Generate Google OAuth authorization URL with HMAC-signed state.
   *
   * The state parameter encodes: tenantId + timestamp + HMAC signature.
   * This prevents CSRF attacks and identifies which tenant is connecting.
   *
   * @param tenantId - Tenant initiating the OAuth flow
   * @returns Google OAuth consent screen URL
   */
  generateAuthUrl(tenantId: string): string {
    const state = this.signState(tenantId);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: OAUTH_SCOPES,
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent to always get refresh token
      state,
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback: verify state, exchange code, encrypt & store tokens.
   *
   * @param code - Authorization code from Google
   * @param state - HMAC-signed state parameter
   * @returns tenantId that was connected
   * @throws Error if state is invalid/expired or token exchange fails
   */
  async handleCallback(code: string, state: string): Promise<{ tenantId: string }> {
    // 1. Verify HMAC state → extract tenantId
    const tenantId = this.verifyState(state);
    if (!tenantId) {
      throw new Error('Invalid or expired OAuth state parameter');
    }

    // 2. Verify tenant exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true },
    });
    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    // 3. Exchange authorization code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text().catch(() => '');
      logger.error(
        { status: tokenResponse.status, error: errorText, tenantId },
        'Google OAuth token exchange failed'
      );
      throw new Error('Failed to exchange authorization code for tokens');
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
      token_type: string;
    };

    if (!tokenData.refresh_token) {
      logger.error({ tenantId }, 'No refresh token received from Google');
      throw new Error(
        'No refresh token received. The user may need to revoke access at https://myaccount.google.com/permissions and try again.'
      );
    }

    // 4. Build token object and store encrypted
    const tokens: GoogleCalendarOAuthTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
      scope: tokenData.scope,
      tokenType: tokenData.token_type,
    };

    await this.storeTokens(tenantId, tokens);

    logger.info(
      { event: 'integration.google-calendar.connected', tenantId, tenantSlug: tenant.slug },
      'Google Calendar connected via OAuth'
    );

    return { tenantId };
  }

  /**
   * Get decrypted OAuth tokens for a tenant.
   * Does NOT refresh — call getValidAccessToken() for auto-refresh.
   */
  async getTokens(tenantId: string): Promise<GoogleCalendarOAuthTokens | null> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { secrets: true, googleCalendarConnected: true },
    });

    if (!tenant?.secrets || !tenant.googleCalendarConnected) return null;

    const secrets = tenant.secrets as TenantSecrets;
    if (!secrets.googleCalendar) return null;

    try {
      return encryptionService.decryptObject<GoogleCalendarOAuthTokens>(secrets.googleCalendar);
    } catch (error) {
      logger.error({ tenantId, error }, 'Failed to decrypt Google Calendar OAuth tokens');
      return null;
    }
  }

  /**
   * Get a valid access token, refreshing if needed.
   *
   * Check order: Redis cache → DB (check expiry) → refresh if needed.
   * This avoids a DB read + decrypt on every calendar API call.
   *
   * @returns Valid access token or null if not connected/refresh fails
   */
  async getValidAccessToken(tenantId: string): Promise<string | null> {
    // 1. Check Redis cache first (avoids DB read + decrypt)
    const cacheKey = `tenant:${tenantId}:gcal:access_token`;
    if (this.cache) {
      try {
        const cached = await this.cache.get<string>(cacheKey);
        if (cached) {
          logger.debug({ tenantId }, 'OAuth access token served from cache');
          return cached;
        }
      } catch (error) {
        // Cache failure is non-fatal — fall through to DB
        logger.debug({ tenantId, error }, 'Cache read failed for OAuth token');
      }
    }

    // 2. Read from DB
    const tokens = await this.getTokens(tenantId);
    if (!tokens) return null;

    // 3. Check if token needs refresh (expires within 5 minutes)
    if (tokens.expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
      // Token is still valid — cache it and return
      await this.cacheAccessToken(tenantId, tokens.accessToken, tokens.expiresAt);
      return tokens.accessToken;
    }

    // 4. Refresh the token
    logger.debug({ tenantId }, 'OAuth access token expired or expiring soon, refreshing');
    return this.refreshAccessToken(tenantId, tokens.refreshToken);
  }

  /**
   * Refresh the OAuth access token using the refresh token.
   *
   * @returns New access token or null if refresh fails
   */
  async refreshAccessToken(tenantId: string, refreshToken: string): Promise<string | null> {
    try {
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        signal: AbortSignal.timeout(10_000),
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text().catch(() => '');
        logger.error(
          { status: tokenResponse.status, error: errorText, tenantId },
          'Google OAuth token refresh failed'
        );

        // 401/400 with invalid_grant means refresh token was revoked
        if (tokenResponse.status === 400 || tokenResponse.status === 401) {
          logger.warn(
            { tenantId },
            'Google OAuth refresh token appears revoked — marking calendar as disconnected'
          );
          await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { googleCalendarConnected: false },
          });
        }

        return null;
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
        expires_in: number;
        scope: string;
        token_type: string;
      };

      // Update stored tokens with new access token (keep existing refresh token)
      const updatedTokens: GoogleCalendarOAuthTokens = {
        accessToken: tokenData.access_token,
        refreshToken, // Google doesn't always return a new refresh token
        expiresAt: Date.now() + tokenData.expires_in * 1000,
        scope: tokenData.scope,
        tokenType: tokenData.token_type,
      };

      await this.storeTokens(tenantId, updatedTokens);

      // Cache the new access token
      await this.cacheAccessToken(tenantId, tokenData.access_token, updatedTokens.expiresAt);

      logger.debug({ tenantId }, 'OAuth access token refreshed successfully');

      return tokenData.access_token;
    } catch (error) {
      logger.error({ tenantId, error }, 'Error refreshing Google OAuth access token');
      return null;
    }
  }

  /**
   * Disconnect Google Calendar: revoke token at Google, clear stored tokens, set connected = false.
   *
   * Best-effort revocation: local deletion always proceeds even if Google revocation fails.
   * This is defense-in-depth — revoking at Google ensures the token can't be used even if
   * our database is compromised.
   */
  async disconnect(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { secrets: true, slug: true },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    // Attempt to revoke token at Google (best-effort, non-blocking on error)
    const secrets: TenantSecrets = (tenant.secrets as TenantSecrets) || {};
    if (secrets.googleCalendar) {
      try {
        const tokens = encryptionService.decryptObject<GoogleCalendarOAuthTokens>(
          secrets.googleCalendar
        );
        await this.revokeTokenAtGoogle(tokens.accessToken);
        logger.info({ tenantId }, 'Google OAuth token revoked at Google');
      } catch (error) {
        // Log warning but proceed — local deletion is more important
        logger.warn(
          { tenantId, error },
          'Failed to revoke Google OAuth token (proceeding with local deletion)'
        );
      }
    }

    // Surgical removal of googleCalendar key — preserves other secrets (e.g. Stripe)
    const { googleCalendar: _gc, ...remaining } = secrets;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        secrets: remaining as Prisma.InputJsonValue,
        googleCalendarConnected: false,
      },
    });

    // Invalidate cached access token
    await this.invalidateCache(tenantId);

    logger.info(
      { event: 'integration.google-calendar.disconnected', tenantId, tenantSlug: tenant.slug },
      'Google Calendar disconnected for tenant'
    );
  }

  /**
   * Revoke an OAuth token at Google's revocation endpoint.
   * Best-effort — failures are logged but do not throw.
   */
  private async revokeTokenAtGoogle(token: string): Promise<void> {
    const response = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      {
        signal: AbortSignal.timeout(10_000),
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      logger.warn(
        { status: response.status, error: errorText },
        'Google OAuth token revocation returned non-200'
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Redis cache for access tokens
  // ---------------------------------------------------------------------------

  /**
   * Cache an access token in Redis with TTL based on token expiry.
   * TTL = min(55 minutes, time until token expires - 5 min buffer).
   */
  private async cacheAccessToken(
    tenantId: string,
    accessToken: string,
    expiresAt: number
  ): Promise<void> {
    if (!this.cache) return;

    const cacheKey = `tenant:${tenantId}:gcal:access_token`;
    const ttlMs = Math.min(
      ACCESS_TOKEN_CACHE_TTL_S * 1000,
      expiresAt - Date.now() - TOKEN_REFRESH_BUFFER_MS
    );

    if (ttlMs <= 0) return; // Token is already expired or expiring too soon

    try {
      await this.cache.set(cacheKey, accessToken, Math.floor(ttlMs / 1000));
    } catch (error) {
      // Cache write failure is non-fatal
      logger.debug({ tenantId, error }, 'Failed to cache OAuth access token');
    }
  }

  /**
   * Invalidate the cached access token for a tenant.
   */
  private async invalidateCache(tenantId: string): Promise<void> {
    if (!this.cache) return;

    const cacheKey = `tenant:${tenantId}:gcal:access_token`;
    try {
      await this.cache.del(cacheKey);
    } catch (error) {
      logger.debug({ tenantId, error }, 'Failed to invalidate cached OAuth access token');
    }
  }

  // ---------------------------------------------------------------------------
  // Private: HMAC state signing/verification
  // ---------------------------------------------------------------------------

  /**
   * Sign a state parameter with HMAC-SHA256.
   * Format: base64url(tenantId:timestamp:hmac)
   */
  private signState(tenantId: string): string {
    const timestamp = Date.now().toString();
    const payload = `${tenantId}:${timestamp}`;
    const hmac = crypto.createHmac('sha256', this.stateSecret).update(payload).digest('hex');
    return Buffer.from(`${payload}:${hmac}`).toString('base64url');
  }

  /**
   * Verify and decode an HMAC-signed state parameter.
   * Returns tenantId if valid, null if invalid/expired.
   */
  private verifyState(state: string): string | null {
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      if (parts.length !== 3) return null;

      const [tenantId, timestamp, hmac] = parts;

      // Verify timestamp (10-minute expiry)
      const age = Date.now() - parseInt(timestamp, 10);
      if (age > STATE_TTL_MS || age < 0) return null;

      // Verify HMAC (constant-time comparison)
      const payload = `${tenantId}:${timestamp}`;
      const expectedHmac = crypto
        .createHmac('sha256', this.stateSecret)
        .update(payload)
        .digest('hex');

      if (
        !crypto.timingSafeEqual(Buffer.from(hmac, 'hex'), Buffer.from(expectedHmac, 'hex'))
      ) {
        return null;
      }

      return tenantId;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: Token storage
  // ---------------------------------------------------------------------------

  /**
   * Encrypt and store OAuth tokens in Tenant.secrets.googleCalendar.
   * Also sets googleCalendarConnected = true.
   */
  private async storeTokens(
    tenantId: string,
    tokens: GoogleCalendarOAuthTokens
  ): Promise<void> {
    const encrypted = encryptionService.encryptObject(tokens);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { secrets: true },
    });

    const existingSecrets: TenantSecrets = (tenant?.secrets as TenantSecrets) || {};
    const updatedSecrets: TenantSecrets = {
      ...existingSecrets,
      googleCalendar: encrypted,
    };

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        secrets: updatedSecrets as Prisma.InputJsonValue,
        googleCalendarConnected: true,
      },
    });
  }
}
