/**
 * Availability HTTP controller
 */

import type { AvailabilityService } from '../services/availability.service';
import type { AvailabilityDto } from '@macon/contracts';

export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  async getAvailability(tenantId: string, date: string): Promise<AvailabilityDto> {
    const result = await this.availabilityService.checkAvailability(tenantId, date);
    return {
      date: result.date,
      available: result.available,
      reason: result.reason,
    };
  }

  async getUnavailableDates(
    tenantId: string,
    startDate: string,
    endDate: string
  ): Promise<{ dates: string[] }> {
    const dates = await this.availabilityService.getUnavailableDates(
      tenantId,
      new Date(startDate),
      new Date(endDate)
    );
    return { dates };
  }
}
