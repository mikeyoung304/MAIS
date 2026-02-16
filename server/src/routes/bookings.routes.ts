/**
 * Bookings HTTP controller
 */

import type { BookingService } from '../services/booking.service';
import type { CreateCheckoutDto, BookingDto } from '@macon/contracts';
import { NotFoundError } from '../lib/errors';

export class BookingsController {
  constructor(private readonly bookingService: BookingService) {}

  async createCheckout(
    tenantId: string,
    input: CreateCheckoutDto
  ): Promise<{ checkoutUrl: string }> {
    return this.bookingService.createCheckout(tenantId, {
      tierId: input.tierId,
      coupleName: input.coupleName,
      email: input.email,
      eventDate: input.eventDate,
      addOnIds: input.addOnIds,
    });
  }

  async getBookingById(tenantId: string, id: string): Promise<BookingDto> {
    const booking = await this.bookingService.getBookingById(tenantId, id);
    if (!booking) {
      throw new NotFoundError(`Booking ${id} not found`);
    }

    // Map domain entity to DTO
    return {
      id: booking.id,
      tierId: booking.tierId,
      coupleName: booking.coupleName,
      email: booking.email,
      phone: booking.phone,
      eventDate: booking.eventDate,
      addOnIds: booking.addOnIds,
      totalCents: booking.totalCents,
      guestCount: booking.guestCount ?? null,
      status: booking.status,
      createdAt: booking.createdAt,
    };
  }
}
