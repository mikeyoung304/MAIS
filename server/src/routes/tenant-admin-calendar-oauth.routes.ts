/**
 * Google Calendar OAuth Routes
 *
 * Two routes with different auth requirements:
 * - GET /oauth/start — PROTECTED (tenant auth required, generates OAuth URL)
 * - GET /oauth/callback — PUBLIC (Google redirects here, uses HMAC state for auth)
 *
 * The callback is public because the browser redirect from Google won't carry
 * the tenant's JWT. Instead, the tenantId is embedded in the HMAC-signed state
 * parameter (same pattern as Stripe Connect webhooks).
 *
 * Reference: tenant-admin-stripe.routes.ts + stripe-connect.service.ts
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import type { GoogleCalendarOAuthService } from '../services/google-calendar-oauth.service';
import { logger } from '../lib/core/logger';
import { requireAuth, getTenantId } from './tenant-admin-shared';
import { getConfig } from '../lib/core/config';

interface CalendarOAuthRoutes {
  /** Router for /oauth/start — requires tenant auth middleware */
  protectedRouter: Router;
  /** Router for /oauth/callback — public (HMAC state is the auth) */
  callbackRouter: Router;
}

export function createCalendarOAuthRoutes(
  oauthService: GoogleCalendarOAuthService
): CalendarOAuthRoutes {
  // --- Protected router (behind tenant auth middleware) ---
  const protectedRouter = Router();
  protectedRouter.use(requireAuth);

  /**
   * GET /v1/tenant-admin/calendar/oauth/start
   *
   * Generates a Google OAuth authorization URL and returns it.
   * The frontend redirects the user's browser to this URL.
   * After the user approves, Google redirects to /oauth/callback.
   */
  protectedRouter.get('/start', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = getTenantId(res);
      if (!tenantId) {
        res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
        return;
      }

      const authUrl = oauthService.generateAuthUrl(tenantId);
      logger.info({ tenantId }, 'Google Calendar OAuth flow initiated');

      res.json({ url: authUrl });
    } catch (error) {
      next(error);
    }
  });

  /**
   * DELETE /v1/tenant-admin/calendar/oauth/disconnect
   *
   * Disconnect Google Calendar: clear stored tokens and set connected = false.
   */
  protectedRouter.delete(
    '/disconnect',
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = getTenantId(res);
        if (!tenantId) {
          res.status(401).json({ error: 'Unauthorized: No tenant authentication' });
          return;
        }

        await oauthService.disconnect(tenantId);
        logger.info({ tenantId }, 'Google Calendar disconnected');

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    }
  );

  // --- Public callback router (no tenant auth — uses HMAC state) ---
  const callbackRouter = Router();

  /**
   * GET /v1/tenant-admin/calendar/oauth/callback
   *
   * Google redirects here after the user approves (or denies) the OAuth consent.
   * Query params: ?code=xxx&state=yyy (success) or ?error=access_denied&state=yyy (denied)
   *
   * On success: exchanges code for tokens, stores encrypted, redirects to settings page.
   * On error: redirects to settings page with error query param.
   */
  callbackRouter.get('/callback', async (req: Request, res: Response) => {
    const config = getConfig();
    const clientUrl = config.CLIENT_URL || 'http://localhost:3000';
    const settingsPath = '/tenant/settings/calendar';

    try {
      const { code, state, error: oauthError } = req.query;

      // User denied the OAuth consent
      if (oauthError) {
        logger.warn({ oauthError }, 'Google OAuth consent denied by user');
        res.redirect(`${clientUrl}${settingsPath}?error=denied`);
        return;
      }

      // Validate required params
      if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
        logger.warn(
          { hasCode: !!code, hasState: !!state },
          'Google OAuth callback missing code or state'
        );
        res.redirect(`${clientUrl}${settingsPath}?error=invalid`);
        return;
      }

      // Exchange code for tokens and store
      await oauthService.handleCallback(code, state);

      // Redirect to settings page with success indicator
      res.redirect(`${clientUrl}${settingsPath}?connected=true`);
    } catch (error) {
      logger.error({ error }, 'Google Calendar OAuth callback failed');
      res.redirect(`${clientUrl}${settingsPath}?error=failed`);
    }
  });

  return { protectedRouter, callbackRouter };
}
