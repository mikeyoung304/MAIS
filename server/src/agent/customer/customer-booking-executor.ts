/**
 * Customer Booking Executor
 *
 * Executes confirmed booking proposals from customer chatbot.
 * Uses advisory locks to prevent double-booking race conditions.
 *
 * Flow:
 * 1. Create PENDING booking with confirmation code
 * 2. Send notification emails (non-blocking)
 * 3. Create Stripe checkout session
 * 4. Return checkout URL to customer
 * 5. Webhook handler updates booking to CONFIRMED on payment success
 */

import type { PrismaClient } from '../../generated/prisma/client';
import type { PaymentProvider, CheckoutSession } from '../../lib/ports';
import { registerCustomerProposalExecutor } from './executor-registry';
import { logger } from '../../lib/core/logger';
import { sanitizePlainText } from '../../lib/sanitization';
import { hashTenantDate } from '../../lib/advisory-locks';
import { ResourceNotFoundError, DateUnavailableError } from '../errors';

/**
 * Email provider interface for sending booking notifications
 * Matches the shape expected by PostmarkMailAdapter
 */
export interface CustomerBookingMailProvider {
  sendEmail: (input: { to: string; subject: string; html: string }) => Promise<void>;
}

/**
 * Configuration for customer booking executor
 */
export interface CustomerBookingExecutorConfig {
  /** Base URL for storefront (e.g., https://example.com or http://localhost:3000) */
  storefrontBaseUrl: string;
}

/**
 * Generate a customer-facing confirmation code
 * Format: BK-<6 uppercase alphanumeric characters>
 */
function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes ambiguous: 0,O,I,1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BK-${code}`;
}

/**
 * Register the customer booking executor
 *
 * @param prisma - Prisma client for database operations
 * @param mailProvider - Optional mail provider for sending booking notifications
 * @param paymentProvider - Optional payment provider for creating checkout sessions
 * @param config - Optional configuration (defaults provided for missing values)
 */
export function registerCustomerBookingExecutor(
  prisma: PrismaClient,
  mailProvider?: CustomerBookingMailProvider,
  paymentProvider?: PaymentProvider,
  config?: CustomerBookingExecutorConfig
): void {
  // Default configuration
  const _storefrontBaseUrl =
    config?.storefrontBaseUrl || process.env.STOREFRONT_URL || 'http://localhost:3000';

  registerCustomerProposalExecutor(
    'create_customer_booking',
    async (tenantId, customerId, payload) => {
      const { packageId, date, notes, totalPrice, customerName, customerEmail } = payload as {
        packageId: string;
        date: string;
        notes: string | null;
        totalPrice: number;
        customerName: string;
        customerEmail: string;
      };

      // SECURITY: Sanitize user-provided strings before use in HTML emails
      // This prevents HTML injection attacks (P1 fix from code review)
      const safeCustomerName = sanitizePlainText(customerName);
      const safeCustomerEmail = sanitizePlainText(customerEmail);

      const bookingDate = new Date(date);

      // Wrap booking creation in transaction with advisory lock to prevent double-booking
      const result = await prisma.$transaction(async (tx) => {
        // Acquire advisory lock for this specific tenant+date combination
        // Lock is automatically released when transaction ends
        const lockId = hashTenantDate(tenantId, date);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        // CRITICAL: Verify package still exists and is active
        const pkg = await tx.package.findFirst({
          where: { id: packageId, tenantId, active: true },
        });

        if (!pkg) {
          throw new ResourceNotFoundError(
            'service',
            packageId,
            'Please choose a different service.'
          );
        }

        // Check if date is still available (prevents race condition)
        const existingBooking = await tx.booking.findFirst({
          where: {
            tenantId,
            date: bookingDate,
            status: { notIn: ['CANCELED', 'REFUNDED'] },
          },
        });

        if (existingBooking) {
          throw new DateUnavailableError(date, 'booked', 'Please choose a different date.');
        }

        // Check for blackout date
        const blackout = await tx.blackoutDate.findFirst({
          where: { tenantId, date: bookingDate },
        });

        if (blackout) {
          throw new DateUnavailableError(date, 'blocked', 'Please choose a different date.');
        }

        // Verify customer still exists and belongs to this tenant
        const customer = await tx.customer.findFirst({
          where: { id: customerId, tenantId },
        });

        if (!customer) {
          // Security: Don't reveal customer ID (prevents cross-tenant enumeration)
          throw new ResourceNotFoundError(
            'customer',
            'unknown',
            'Invalid booking details. Please try again.'
          );
        }

        // Generate unique confirmation code
        const confirmationCode = generateConfirmationCode();

        // Create the booking with confirmation code
        const booking = await tx.booking.create({
          data: {
            tenantId,
            customerId,
            packageId,
            date: bookingDate,
            totalPrice,
            status: 'PENDING', // Customer bookings start as pending (await payment)
            bookingType: 'DATE',
            notes: notes ? `[Chatbot booking] ${notes}` : '[Chatbot booking]',
            confirmationCode,
          },
        });

        // Fetch tenant for email notifications
        const tenant = await tx.tenant.findUnique({
          where: { id: tenantId },
          select: {
            name: true,
            email: true,
            slug: true,
          },
        });

        logger.info(
          { tenantId, bookingId: booking.id, customerId, packageId, date, confirmationCode },
          'Customer booking created via chatbot'
        );

        return {
          booking,
          pkg,
          tenant,
          confirmationCode,
        };
      });

      const { booking, pkg, tenant, confirmationCode } = result;
      const formattedDate = bookingDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const formattedPrice = `$${(totalPrice / 100).toFixed(2)}`;

      // Create Stripe checkout session for payment
      let checkoutSession: CheckoutSession | null = null;
      if (paymentProvider && totalPrice > 0) {
        try {
          checkoutSession = await paymentProvider.createCheckoutSession({
            amountCents: totalPrice,
            email: customerEmail,
            metadata: {
              tenantId,
              bookingId: booking.id,
              packageId,
              eventDate: date,
              email: customerEmail,
              coupleName: customerName,
              source: 'customer_chatbot', // Identify chatbot bookings
              confirmationCode,
            },
            idempotencyKey: `chatbot-booking-${booking.id}`,
          });

          logger.info(
            {
              tenantId,
              bookingId: booking.id,
              checkoutSessionId: checkoutSession.sessionId,
            },
            'Stripe checkout session created for chatbot booking'
          );
        } catch (stripeError) {
          // Log error but don't fail the booking - customer can pay later
          logger.error(
            { tenantId, bookingId: booking.id, error: stripeError },
            'Failed to create Stripe checkout session'
          );
        }
      }

      // Send email notifications (outside transaction - non-blocking)
      if (mailProvider && customerEmail) {
        // Build payment link message based on checkout session availability
        const paymentSection = checkoutSession?.url
          ? `
                    <div style="margin: 20px 0;">
                      <a href="${checkoutSession.url}"
                         style="background-color: #1e3a5f; color: white; padding: 12px 24px;
                                text-decoration: none; border-radius: 6px; display: inline-block;">
                        Complete Payment (${formattedPrice})
                      </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">
                      Click the button above to complete your payment and secure your booking.
                    </p>
                  `
          : `
                    <p style="color: #666; font-size: 14px;">
                      Your booking total is <strong>${formattedPrice}</strong>.
                      We'll send you payment instructions shortly.
                    </p>
                  `;

        // Send confirmation email to customer
        try {
          await mailProvider.sendEmail({
            to: customerEmail,
            subject: `Booking Received - ${pkg.name} on ${formattedDate}`,
            html: `
              <!DOCTYPE html>
              <html>
                <head><meta charset="utf-8"></head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #1e3a5f;">Booking Received!</h2>
                    <p>Hi ${safeCustomerName},</p>
                    <p>Thank you for your booking request. Here are your details:</p>

                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #1e3a5f;">Booking Details</h3>
                      <p><strong>Confirmation Code:</strong> ${confirmationCode}</p>
                      <p><strong>Service:</strong> ${pkg.name}</p>
                      <p><strong>Date:</strong> ${formattedDate}</p>
                      <p><strong>Total:</strong> ${formattedPrice}</p>
                      <p><strong>Status:</strong> Awaiting Payment</p>
                    </div>

                    ${paymentSection}

                    <p style="color: #666; font-size: 14px;">
                      Please save your confirmation code <strong>${confirmationCode}</strong> for your records.
                      You'll need this to manage your booking.
                    </p>

                    ${tenant?.name ? `<p>Looking forward to seeing you!</p><p>— The ${tenant.name} Team</p>` : ''}

                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="color: #999; font-size: 12px;">
                      This is an automated confirmation. If you have questions, please contact us.
                    </p>
                  </div>
                </body>
              </html>
            `,
          });
          logger.info(
            { tenantId, bookingId: booking.id, customerEmail },
            'Customer booking confirmation email sent'
          );
        } catch (emailError) {
          // Log but don't fail the booking
          logger.error(
            { tenantId, bookingId: booking.id, customerEmail, error: emailError },
            'Failed to send customer booking confirmation email'
          );
        }

        // Send notification email to tenant
        if (tenant?.email) {
          try {
            await mailProvider.sendEmail({
              to: tenant.email,
              subject: `[HANDLED] New booking from ${safeCustomerName}`,
              html: `
                <!DOCTYPE html>
                <html>
                  <head><meta charset="utf-8"></head>
                  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                      <h2 style="color: #1e3a5f;">New Booking Received</h2>
                      <p>A new booking has been made through your chatbot.</p>

                      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <h3 style="margin-top: 0; color: #1e3a5f;">Booking Details</h3>
                        <p><strong>Customer:</strong> ${safeCustomerName} (${safeCustomerEmail})</p>
                        <p><strong>Service:</strong> ${pkg.name}</p>
                        <p><strong>Date:</strong> ${formattedDate}</p>
                        <p><strong>Total:</strong> ${formattedPrice}</p>
                        <p><strong>Confirmation Code:</strong> ${confirmationCode}</p>
                        <p><strong>Status:</strong> Awaiting Payment</p>
                      </div>

                      <p style="color: #666; font-size: 14px;">
                        The customer will complete payment to confirm this booking.
                        ${checkoutSession ? 'A checkout link has been sent to the customer.' : ''}
                      </p>

                      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                      <p style="color: #999; font-size: 12px;">
                        This notification was sent by HANDLED - your booking automation platform.
                      </p>
                    </div>
                  </body>
                </html>
              `,
            });
            logger.info(
              { tenantId, bookingId: booking.id, tenantEmail: tenant.email },
              'Tenant booking notification email sent'
            );
          } catch (emailError) {
            // Log but don't fail the booking
            logger.error(
              { tenantId, bookingId: booking.id, tenantEmail: tenant.email, error: emailError },
              'Failed to send tenant booking notification email'
            );
          }
        }
      }

      // Build response with or without checkout URL
      const response: Record<string, unknown> = {
        action: 'booked',
        bookingId: booking.id,
        confirmationCode,
        packageName: pkg.name,
        date,
        formattedDate,
        customerName,
        customerEmail,
        totalPrice,
        formattedPrice,
        status: 'PENDING',
      };

      // Include checkout URL if available
      if (checkoutSession?.url) {
        response.checkoutUrl = checkoutSession.url;
        response.message =
          'Your booking is confirmed! Please complete your payment to secure your spot.';
      } else {
        response.message =
          'Your booking has been received! You will receive payment instructions shortly.';
      }

      return response;
    }
  );

  logger.info('Customer booking executor registered');
}
