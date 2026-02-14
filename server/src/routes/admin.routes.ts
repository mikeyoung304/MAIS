/**
 * Admin HTTP controller
 *
 * Handles platform-wide admin operations.
 * SECURITY: All endpoints require PLATFORM_ADMIN authentication (enforced by route middleware).
 */

import type { BookingService } from '../services/booking.service';
import type { PlatformBookingsResponse } from '@macon/contracts';

export class AdminController {
  constructor(private readonly bookingService: BookingService) {}

  /**
   * Get all bookings across ALL tenants (platform admin view)
   *
   * Issue #7 Fix: Previously used `getAllBookings(DEFAULT_TENANT)` which only
   * queried a non-existent legacy tenant, resulting in "0 of 0 bookings" display.
   *
   * Now uses `getAllPlatformBookings()` which:
   * - Queries ALL bookings from real (non-test) tenants
   * - Includes tenant name/slug for display
   * - Includes package name for display
   * - Enforces pagination (Pitfall #60)
   *
   * @param cursor - Optional pagination cursor (booking ID)
   * @returns Paginated bookings with tenant info
   */
  async getBookings(cursor?: string): Promise<PlatformBookingsResponse> {
    return this.bookingService.getAllPlatformBookings({ cursor });
  }
}
