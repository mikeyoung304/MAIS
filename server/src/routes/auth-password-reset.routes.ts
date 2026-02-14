/**
 * Auth Password Reset Routes
 * POST /forgot-password + POST /reset-password
 *
 * Extracted from auth.routes.ts (mechanical refactor, no logic changes)
 */

import type { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import type { UnifiedAuthRoutesOptions } from './auth.routes';
import { signupLimiter } from '../middleware/rateLimiter';
import { logger } from '../lib/core/logger';
import { ValidationError } from '../lib/errors';

export function registerPasswordResetRoutes(
  router: Router,
  options: UnifiedAuthRoutesOptions
): void {
  const { tenantRepo, tenantAuthService, mailProvider } = options;

  /**
   * POST /forgot-password
   * Request password reset email
   *
   * Request body:
   * {
   *   "email": "owner@business.com"
   * }
   *
   * Response:
   * {
   *   "message": "If an account exists, a reset link has been sent"
   * }
   */
  router.post(
    '/forgot-password',
    signupLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { email } = req.body;

        if (!email) {
          throw new ValidationError('Email is required');
        }

        const normalizedEmail = email.toLowerCase().trim();
        const tenant = await tenantRepo.findByEmail(normalizedEmail);

        if (tenant) {
          // Generate secure random token (32 bytes = 64 hex chars)
          const resetToken = crypto.randomBytes(32).toString('hex');

          // Hash the token before storing (SHA-256)
          const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
          const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

          // Store hashed token in database
          await tenantRepo.update(tenant.id, {
            passwordResetToken: tokenHash,
            passwordResetExpires: expires,
          });

          // Generate reset URL for frontend
          const resetUrl = `${process.env.CORS_ORIGIN || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

          // Send password reset email
          if (mailProvider) {
            try {
              await mailProvider.sendPasswordReset(normalizedEmail, resetToken, resetUrl);
              logger.info(
                {
                  event: 'password_reset_email_sent',
                  tenantId: tenant.id,
                  email: tenant.email,
                },
                'Password reset email sent'
              );
            } catch (emailError) {
              logger.error(
                {
                  event: 'password_reset_email_failed',
                  tenantId: tenant.id,
                  email: tenant.email,
                  error: emailError instanceof Error ? emailError.message : 'Unknown error',
                },
                'Failed to send password reset email'
              );
              // Continue - don't leak error to user
            }
          } else {
            // Development mode - log the token
            logger.info(
              {
                event: 'password_reset_requested',
                tenantId: tenant.id,
                email: tenant.email,
                resetUrl: process.env.NODE_ENV === 'development' ? resetUrl : '[redacted]',
              },
              'Password reset requested (no mail provider configured)'
            );
          }
        }

        // Always return success (don't leak email existence)
        res.status(200).json({
          message: 'If an account exists, a reset link has been sent',
        });
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * POST /reset-password
   * Reset password with token
   *
   * Request body:
   * {
   *   "token": "reset_token_here",
   *   "password": "newSecurePassword123"
   * }
   *
   * Response:
   * {
   *   "message": "Password updated successfully"
   * }
   */
  router.post(
    '/reset-password',
    signupLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token, password } = req.body;

        if (!token || !password) {
          throw new ValidationError('Token and password are required');
        }

        // Validate token format (should be 64 hex characters)
        if (!/^[a-f0-9]{64}$/i.test(token)) {
          throw new ValidationError('Invalid reset token format');
        }

        if (password.length < 8) {
          throw new ValidationError('Password must be at least 8 characters');
        }

        // Hash the token to match database storage
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Find tenant by hashed reset token
        const tenant = await tenantRepo.findByResetToken(tokenHash);

        if (!tenant) {
          throw new ValidationError('Invalid or expired reset token');
        }

        // Check if token has expired
        if (!tenant.passwordResetExpires || tenant.passwordResetExpires < new Date()) {
          throw new ValidationError('Reset token has expired');
        }

        // Hash new password
        const passwordHash = await tenantAuthService.hashPassword(password);

        // Update password and clear reset token
        await tenantRepo.update(tenant.id, {
          passwordHash,
          passwordResetToken: null,
          passwordResetExpires: null,
        });

        logger.info(
          {
            event: 'password_reset_success',
            tenantId: tenant.id,
            email: tenant.email,
          },
          'Password reset successful'
        );

        res.status(200).json({
          message: 'Password updated successfully',
        });
      } catch (error) {
        next(error);
      }
    }
  );
}
