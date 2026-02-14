/**
 * Auth Early Access Routes
 * POST /early-access — Request early access notification
 *
 * Extracted from auth.routes.ts (mechanical refactor, no logic changes)
 */

import type { Router, Request, Response, NextFunction } from 'express';
import type { UnifiedAuthRoutesOptions } from './auth.routes';
import { signupLimiter } from '../middleware/rateLimiter';
import { logger } from '../lib/core/logger';
import { ValidationError } from '../lib/errors';
import { sanitizePlainText } from '../lib/sanitization';
import { EarlyAccessRequestDtoSchema } from '@macon/contracts';

export function registerEarlyAccessRoutes(router: Router, options: UnifiedAuthRoutesOptions): void {
  const { config, mailProvider, earlyAccessRepo } = options;

  /**
   * POST /early-access
   * Request early access notification
   * Sends email to the platform owner (configured via EARLY_ACCESS_NOTIFICATION_EMAIL)
   *
   * Request body:
   * {
   *   "email": "interested@example.com"
   * }
   *
   * Response:
   * {
   *   "message": "Thanks! We'll be in touch soon."
   * }
   */
  router.post(
    '/early-access',
    signupLimiter,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Use Zod validation from contract
        const parseResult = EarlyAccessRequestDtoSchema.safeParse(req.body);
        if (!parseResult.success) {
          const errorMessage = parseResult.error.errors[0]?.message || 'Invalid email format';
          throw new ValidationError(errorMessage);
        }

        const { email } = parseResult.data;
        const normalizedEmail = email.toLowerCase().trim();
        const sanitizedEmail = sanitizePlainText(normalizedEmail);

        // Early access repo is required for this endpoint
        if (!earlyAccessRepo) {
          throw new Error('Early access repository not configured');
        }

        // Store request in database (upsert to handle duplicates gracefully)
        const { request: earlyAccessRequest, isNew: isNewRequest } = await earlyAccessRepo.upsert(
          normalizedEmail,
          'homepage'
        );

        // Format timestamp for internal notification (human-readable)
        const formattedDate = new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        });

        // Customer confirmation email - brand-aligned, warm welcome
        const customerConfirmationHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #FFFBF8; color: #1A1815;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFBF8;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">
          <tr>
            <td style="padding: 0 0 24px 0;">
              <h1 style="font-family: Georgia, 'Times New Roman', serif; font-size: 36px; font-weight: 700; color: #1A1815; line-height: 1.1; margin: 0;">
                You're in. We'll take it from here.
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 0 32px 0;">
              <p style="font-size: 18px; font-weight: 300; color: #4A4440; line-height: 1.6; margin: 0;">
                You'll hear from Mike when we're ready. Just an invitation.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 0 32px 0;">
              <h2 style="font-family: Georgia, 'Times New Roman', serif; font-size: 24px; font-weight: 700; color: #1A1815; margin: 0 0 16px 0;">
                What happens next.
              </h2>
              <p style="font-size: 16px; color: #4A4440; line-height: 1.6; margin: 0;">
                We're onboarding in small batches—photographers, planners, artists—so everyone gets real attention. Mike will reach out in the next few weeks.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 0 24px 0;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;">
            </td>
          </tr>
          <tr>
            <td>
              <p style="font-size: 14px; color: #6b7280; line-height: 1.5; margin: 0 0 8px 0;">
                Questions? Reply to this email.<br>
                Mike reads every response.
              </p>
              <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                HANDLED
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        // Internal team notification - clean, scannable format
        const internalNotificationHtml = `<!DOCTYPE html>
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
                New Early Access Request
              </h1>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F5F1EE; border-radius: 12px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px 0; font-size: 15px; color: #4A4440;">
                      <strong>Email:</strong> ${sanitizedEmail}
                    </p>
                    <p style="margin: 0 0 8px 0; font-size: 15px; color: #4A4440;">
                      <strong>Time:</strong> ${formattedDate}
                    </p>
                    <p style="margin: 0; font-size: 15px; color: #4A4440;">
                      <strong>Source:</strong> Homepage waitlist
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
</html>`;

        // Send emails - customer always gets confirmation, internal notification for new requests
        if (mailProvider) {
          try {
            // Send customer confirmation
            logger.info({ to: sanitizedEmail }, 'Sending customer confirmation email');
            await mailProvider.sendEmail({
              to: sanitizedEmail,
              subject: "You're in.",
              html: customerConfirmationHtml,
            });
            logger.info({ to: sanitizedEmail }, 'Customer confirmation email sent successfully');

            // Send internal notification only for new requests
            if (isNewRequest) {
              const notificationEmail =
                config.earlyAccessNotificationEmail || 'mike@maconheadshots.com';
              logger.info({ to: notificationEmail }, 'Sending internal notification email');
              await mailProvider.sendEmail({
                to: notificationEmail,
                subject: `Early Access: ${sanitizedEmail}`,
                html: internalNotificationHtml,
              });
              logger.info(
                { to: notificationEmail },
                'Internal notification email sent successfully'
              );
            }

            logger.info(
              {
                event: 'early_access_request',
                email: sanitizedEmail,
                requestId: earlyAccessRequest.id,
                isNewRequest,
              },
              isNewRequest
                ? 'Early access request received - confirmation and notification sent'
                : 'Duplicate early access request - confirmation resent'
            );
          } catch (emailError) {
            logger.error(
              {
                event: 'early_access_email_failed',
                email: sanitizedEmail,
                requestId: earlyAccessRequest.id,
                error: emailError instanceof Error ? emailError.message : 'Unknown error',
              },
              'Failed to send early access emails'
            );
            // Continue - don't fail the request, DB write succeeded
          }
        } else {
          // Development mode without mail provider - just log
          logger.info(
            {
              event: 'early_access_request',
              email: sanitizedEmail,
              requestId: earlyAccessRequest.id,
              isNewRequest,
            },
            'Early access request received (no mail provider configured)'
          );
        }

        res.status(200).json({
          message: "Thanks! We'll be in touch soon.",
        });
      } catch (error) {
        next(error);
      }
    }
  );
}
