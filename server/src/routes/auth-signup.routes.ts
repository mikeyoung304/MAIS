/**
 * Auth Signup Routes
 * POST /signup — Self-service tenant signup
 *
 * Extracted from auth.routes.ts (mechanical refactor, no logic changes)
 */

import type { Router, Request, Response, NextFunction } from 'express';
import type { UnifiedAuthRoutesOptions } from './auth-shared';
import validator from 'validator';
import { signupLimiter } from '../middleware/rateLimiter';
import { logger } from '../lib/core/logger';
import { ConflictError, ValidationError, TenantProvisioningError } from '../lib/errors';
import { sanitizePlainText } from '../lib/sanitization';

export function registerSignupRoutes(router: Router, options: UnifiedAuthRoutesOptions): void {
  const { tenantRepo, tenantAuthService, config, mailProvider, tenantProvisioningService } =
    options;

  /**
   * POST /signup
   * Self-service tenant signup
   * Creates new tenant with API keys and returns JWT token
   *
   * Request body:
   * {
   *   "email": "owner@business.com",
   *   "password": "securepass123",
   *   "businessName": "My Business"
   * }
   *
   * Response:
   * {
   *   "token": "eyJhbGc...",
   *   "tenantId": "tenant_123",
   *   "slug": "my-business-1234567890",
   *   "email": "owner@business.com",
   *   "apiKeyPublic": "pk_live_...",
   *   "secretKey": "sk_live_..." // Shown ONCE, never stored in plaintext
   * }
   */
  router.post('/signup', signupLimiter, async (req: Request, res: Response, next: NextFunction) => {
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    try {
      const { email, password, businessName, city, state, brainDump } = req.body;

      // Validate required fields
      if (!email || !password || !businessName) {
        throw new ValidationError('Email, password, and business name are required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format');
      }

      // Validate password length
      if (password.length < 8) {
        throw new ValidationError('Password must be at least 8 characters');
      }

      // Validate business name
      if (businessName.length < 2 || businessName.length > 100) {
        throw new ValidationError('Business name must be between 2 and 100 characters');
      }

      // Validate optional fields
      if (brainDump && typeof brainDump === 'string' && brainDump.length > 2000) {
        throw new ValidationError('Brain dump must be 2000 characters or less');
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check email uniqueness
      const existingTenant = await tenantRepo.findByEmail(normalizedEmail);
      if (existingTenant) {
        throw new ConflictError('Email already registered');
      }

      // Undo global sanitize middleware's HTML encoding for business names
      // (React auto-escapes on output, making server-side escaping redundant and harmful)
      // e.g. "Ember &amp; Ash Photography" → "Ember & Ash Photography"
      const cleanBusinessName = validator.unescape(businessName);

      // Generate unique slug from clean business name with timestamp
      const baseSlug = cleanBusinessName
        .toLowerCase()
        .replace(/&/g, 'and') // & → and (human-readable)
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      const slug = `${baseSlug}-${Date.now()}`;

      // Check slug uniqueness (should always be unique due to timestamp, but verify)
      const existingSlug = await tenantRepo.findBySlug(slug);
      if (existingSlug) {
        throw new ConflictError('Please try again');
      }

      // Hash password
      const passwordHash = await tenantAuthService.hashPassword(password);

      // =========================================================================
      // ATOMIC TENANT PROVISIONING (#632)
      // =========================================================================
      // Uses TenantProvisioningService for atomic creation of:
      // - Tenant record with API keys
      // - Default "General" segment
      // - Default packages (Basic/Standard/Premium)
      //
      // If any part fails, the entire transaction rolls back.
      // No more orphaned tenants without segments!
      // =========================================================================
      if (!tenantProvisioningService) {
        throw new Error('Tenant provisioning service not configured');
      }

      const provisionedTenant = await tenantProvisioningService.createFromSignup({
        slug,
        businessName: cleanBusinessName,
        email: normalizedEmail,
        passwordHash,
        city: typeof city === 'string' ? city.trim() : undefined,
        state: typeof state === 'string' ? state.trim() : undefined,
        brainDump: typeof brainDump === 'string' ? brainDump.trim() : undefined,
      });

      const { tenant } = provisionedTenant;

      // Generate JWT token
      const { token } = await tenantAuthService.login(normalizedEmail, password);

      // Log successful signup
      logger.info(
        {
          event: 'tenant_signup_success',
          endpoint: '/v1/auth/signup',
          tenantId: tenant.id,
          slug: tenant.slug,
          email: tenant.email,
          ipAddress,
          timestamp: new Date().toISOString(),
        },
        'New tenant signup (atomic provisioning)'
      );

      // Send admin notification - best effort, don't fail signup if email fails
      if (mailProvider) {
        try {
          const adminEmail = config.adminNotificationEmail || 'mike@maconheadshots.com';
          const signupDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
          });

          await mailProvider.sendEmail({
            to: adminEmail,
            subject: `New Signup: ${businessName}`,
            html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px;">
          <tr>
            <td style="padding: 32px;">
              <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 700; color: #1A1815; margin: 0 0 24px 0;">
                New Tenant Signup
              </h1>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F5F1EE; border-radius: 12px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 15px; color: #4A4440;">
                      <strong>Business:</strong> ${sanitizePlainText(businessName)}
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 15px; color: #4A4440;">
                      <strong>Email:</strong> ${sanitizePlainText(normalizedEmail)}
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 15px; color: #4A4440;">
                      <strong>Slug:</strong> ${tenant.slug}
                    </p>
                    <p style="margin: 0; font-size: 15px; color: #4A4440;">
                      <strong>Time:</strong> ${signupDate}
                    </p>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0 0; font-size: 12px; color: #9ca3af;">
                Reply to this email to reach out directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
          });
          logger.info(
            { tenantId: tenant.id, email: normalizedEmail },
            'Tenant signup notification sent'
          );
        } catch (notificationError) {
          // Log warning but don't fail signup - notification is best-effort
          logger.warn(
            {
              tenantId: tenant.id,
              error:
                notificationError instanceof Error ? notificationError.message : 'Unknown error',
            },
            'Failed to send signup notification'
          );
        }
      }

      res.status(201).json({
        token,
        tenantId: tenant.id,
        slug: tenant.slug,
        email: tenant.email,
        apiKeyPublic: tenant.apiKeyPublic,
      });
    } catch (error) {
      // Log failed signup attempts with appropriate level
      // TenantProvisioningError is a known failure mode - log at error level
      // Other errors (validation, conflict) are expected - log at warn level
      const isCriticalError = error instanceof TenantProvisioningError;

      const logFn = isCriticalError ? logger.error.bind(logger) : logger.warn.bind(logger);
      logFn(
        {
          event: isCriticalError ? 'tenant_provisioning_failed' : 'tenant_signup_failed',
          endpoint: '/v1/auth/signup',
          email: req.body.email,
          ipAddress,
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
          // Include original cause for provisioning errors (internal debugging)
          ...(isCriticalError && error.originalError ? { cause: error.originalError.message } : {}),
        },
        isCriticalError
          ? 'Tenant provisioning failed - signup aborted, no partial tenant created'
          : 'Failed signup attempt'
      );

      next(error);
    }
  });
}
