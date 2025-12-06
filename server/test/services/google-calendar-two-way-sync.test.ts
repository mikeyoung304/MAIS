/**
 * Two-Way Calendar Sync Test
 *
 * Verifies that Google Calendar busy times are correctly integrated
 * with MAIS scheduling availability.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SchedulingAvailabilityService } from '../../src/services/scheduling-availability.service';
import { GoogleCalendarService } from '../../src/services/google-calendar.service';
import type {
  ServiceRepository,
  AvailabilityRuleRepository,
  BookingRepository,
  CalendarProvider,
  BusyTimeBlock,
  CacheServicePort,
} from '../../src/lib/ports';

describe('Two-Way Calendar Sync', () => {
  let schedulingService: SchedulingAvailabilityService;
  let mockCalendarProvider: CalendarProvider;
  let mockServiceRepo: ServiceRepository;
  let mockAvailabilityRuleRepo: AvailabilityRuleRepository;
  let mockBookingRepo: BookingRepository;
  let mockCache: CacheServicePort;

  beforeEach(() => {
    // Mock service repository
    mockServiceRepo = {
      getById: async (tenantId: string, id: string) => ({
        id,
        tenantId,
        name: 'Test Service',
        durationMinutes: 30,
        bufferMinutes: 15,
        timezone: 'America/New_York',
        active: true,
        slug: 'test-service',
        description: 'Test service',
        priceAmount: 10000,
        depositAmount: null,
        requiresDeposit: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    } as ServiceRepository;

    // Mock availability rule repository
    mockAvailabilityRuleRepo = {
      getEffectiveRules: async (tenantId: string, date: Date, serviceId?: string) => [
        {
          id: 'rule1',
          tenantId,
          serviceId: serviceId || null,
          dayOfWeek: date.getDay(),
          startTime: '09:00',
          endTime: '17:00',
          effectiveFrom: new Date('2025-01-01'),
          effectiveTo: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    } as AvailabilityRuleRepository;

    // Mock booking repository
    mockBookingRepo = {
      findTimeslotBookings: async () => [],
    } as BookingRepository;

    // Mock cache
    mockCache = {
      get: async () => null,
      set: async () => {},
      del: async () => {},
    } as CacheServicePort;
  });

  it('should filter slots that conflict with Google Calendar busy times', async () => {
    // Mock calendar provider that returns busy times
    const busyTimes: BusyTimeBlock[] = [
      {
        start: new Date('2025-06-15T14:00:00Z'), // 10:00 AM EDT
        end: new Date('2025-06-15T15:00:00Z'), // 11:00 AM EDT
      },
    ];

    mockCalendarProvider = {
      isDateAvailable: async () => true,
      getBusyTimes: async () => busyTimes,
    };

    const googleCalendarService = new GoogleCalendarService(mockCalendarProvider);
    schedulingService = new SchedulingAvailabilityService(
      mockServiceRepo,
      mockAvailabilityRuleRepo,
      mockBookingRepo,
      googleCalendarService,
      mockCache
    );

    // Get available slots for the date
    const slots = await schedulingService.getAvailableSlots({
      tenantId: 'test-tenant',
      serviceId: 'test-service',
      date: new Date('2025-06-15'),
    });

    // Verify that slots overlapping with busy times are marked unavailable
    const conflictingSlots = slots.filter(
      (slot) =>
        slot.startTime >= new Date('2025-06-15T14:00:00Z') &&
        slot.startTime < new Date('2025-06-15T15:00:00Z')
    );

    conflictingSlots.forEach((slot) => {
      expect(slot.available).toBe(false);
    });
  });

  it('should gracefully degrade when Google Calendar API is unavailable', async () => {
    // Mock calendar provider that throws an error
    mockCalendarProvider = {
      isDateAvailable: async () => true,
      getBusyTimes: async () => {
        throw new Error('Google Calendar API unavailable');
      },
    };

    const googleCalendarService = new GoogleCalendarService(mockCalendarProvider);
    schedulingService = new SchedulingAvailabilityService(
      mockServiceRepo,
      mockAvailabilityRuleRepo,
      mockBookingRepo,
      googleCalendarService,
      mockCache
    );

    // Should not throw, should return slots
    const slots = await schedulingService.getAvailableSlots({
      tenantId: 'test-tenant',
      serviceId: 'test-service',
      date: new Date('2025-06-15'),
    });

    // Should have slots (graceful degradation)
    expect(slots.length).toBeGreaterThan(0);
  });

  it('should work without Google Calendar service (backward compatibility)', async () => {
    // Create service without Google Calendar integration
    schedulingService = new SchedulingAvailabilityService(
      mockServiceRepo,
      mockAvailabilityRuleRepo,
      mockBookingRepo
      // No googleCalendarService, no cache
    );

    // Should not throw, should return slots
    const slots = await schedulingService.getAvailableSlots({
      tenantId: 'test-tenant',
      serviceId: 'test-service',
      date: new Date('2025-06-15'),
    });

    // Should have slots (no filtering)
    expect(slots.length).toBeGreaterThan(0);
  });
});
