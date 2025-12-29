/**
 * Customer Booking Executor
 *
 * Executes confirmed booking proposals from customer chatbot.
 * Uses advisory locks to prevent double-booking race conditions.
 */

import type { PrismaClient } from '../../generated/prisma';
import { registerCustomerProposalExecutor } from './executor-registry';
import { logger } from '../../lib/core/logger';

/**
 * Generate deterministic lock ID from tenantId + date for PostgreSQL advisory locks
 * Uses FNV-1a hash algorithm to convert string to 32-bit integer
 */
function hashTenantDate(tenantId: string, date: string): number {
  const str = `${tenantId}:${date}`;
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  // Convert to 32-bit signed integer (PostgreSQL bigint range)
  return hash | 0;
}

/**
 * Register the customer booking executor
 */
export function registerCustomerBookingExecutor(prisma: PrismaClient): void {
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

      const bookingDate = new Date(date);

      // Wrap booking creation in transaction with advisory lock to prevent double-booking
      return await prisma.$transaction(async (tx) => {
        // Acquire advisory lock for this specific tenant+date combination
        // Lock is automatically released when transaction ends
        const lockId = hashTenantDate(tenantId, date);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockId})`;

        // CRITICAL: Verify package still exists and is active
        const pkg = await tx.package.findFirst({
          where: { id: packageId, tenantId, active: true },
        });

        if (!pkg) {
          throw new Error('Service is no longer available. Please choose a different service.');
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
          throw new Error(
            'Sorry, this date is no longer available. Please choose a different date.'
          );
        }

        // Check for blackout date
        const blackout = await tx.blackoutDate.findFirst({
          where: { tenantId, date: bookingDate },
        });

        if (blackout) {
          throw new Error('Sorry, this date is not available. Please choose a different date.');
        }

        // Verify customer still exists and belongs to this tenant
        const customer = await tx.customer.findFirst({
          where: { id: customerId, tenantId },
        });

        if (!customer) {
          throw new Error('Customer not found. Please try booking again.');
        }

        // Create the booking
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
          },
        });

        logger.info(
          { tenantId, bookingId: booking.id, customerId, packageId, date },
          'Customer booking created via chatbot'
        );

        // TODO: Send confirmation email to customer
        // TODO: Notify tenant of new booking

        return {
          action: 'booked',
          bookingId: booking.id,
          packageName: pkg.name,
          date,
          formattedDate: bookingDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          customerName,
          customerEmail,
          totalPrice,
          formattedPrice: `$${(totalPrice / 100).toFixed(2)}`,
          status: 'PENDING',
          message:
            'Your booking has been confirmed! You will receive a confirmation email shortly.',
        };
      });
    }
  );

  logger.info('Customer booking executor registered');
}
