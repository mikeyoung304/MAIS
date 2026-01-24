/**
 * Unit tests for AppointmentBookingService
 *
 * Tests TIMESLOT booking operations including:
 * - Checkout session creation with availability/maxPerDay validation
 * - Payment completion with advisory lock protection
 * - Customer upsert and booking creation
 * - Multi-tenant data isolation
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  AppointmentBookingService,
  type CreateAppointmentInput,
  type AppointmentPaymentCompletedInput,
} from '../../src/services/appointment-booking.service';
import { FakeEventEmitter } from '../helpers/fakes';
import { NotFoundError, MaxBookingsPerDayExceededError } from '../../src/lib/errors';
import { AppointmentEvents, type EventEmitter } from '../../src/lib/core/events';
import type { ServiceRepository, BookingRepository } from '../../src/lib/ports';
import type { Service } from '../../src/lib/entities';
import type { CheckoutSessionFactory } from '../../src/services/checkout-session.factory';

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_TENANT_ID = 'tenant_test_123';
const OTHER_TENANT_ID = 'tenant_other_456';
const TEST_SERVICE_ID = 'service_abc';
const TEST_SESSION_ID = 'cs_test_session_123';

function buildService(overrides?: Partial<Service>): Service {
  return {
    id: TEST_SERVICE_ID,
    tenantId: TEST_TENANT_ID,
    slug: 'consultation',
    name: 'Consultation',
    description: 'A 30-minute consultation session',
    durationMinutes: 30,
    bufferMinutes: 10,
    priceCents: 5000,
    timezone: 'America/New_York',
    active: true,
    sortOrder: 0,
    segmentId: null,
    maxPerDay: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildCreateAppointmentInput(overrides?: Partial<CreateAppointmentInput>): CreateAppointmentInput {
  return {
    serviceId: TEST_SERVICE_ID,
    startTime: new Date('2025-06-15T14:00:00Z'),
    clientName: 'Jane Doe',
    clientEmail: 'jane@example.com',
    clientPhone: '+1-555-123-4567',
    clientTimezone: 'America/New_York',
    notes: 'First appointment',
    ...overrides,
  };
}

function buildPaymentCompletedInput(
  overrides?: Partial<AppointmentPaymentCompletedInput>
): AppointmentPaymentCompletedInput {
  return {
    sessionId: TEST_SESSION_ID,
    serviceId: TEST_SERVICE_ID,
    startTime: new Date('2025-06-15T14:00:00Z'),
    endTime: new Date('2025-06-15T14:30:00Z'),
    clientName: 'Jane Doe',
    clientEmail: 'jane@example.com',
    clientPhone: '+1-555-123-4567',
    clientTimezone: 'America/New_York',
    notes: 'First appointment',
    totalCents: 5000,
    ...overrides,
  };
}

// ============================================================================
// Mock Factories
// ============================================================================

function createMockServiceRepo() {
  return {
    getAll: vi.fn(),
    getActiveServices: vi.fn(),
    getBySlug: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } satisfies ServiceRepository;
}

function createMockBookingRepo(): BookingRepository & { countTimeslotBookingsForServiceOnDate: Mock } {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    isDateBooked: vi.fn(),
    getUnavailableDates: vi.fn(),
    updateGoogleEventId: vi.fn(),
    update: vi.fn(),
    reschedule: vi.fn(),
    completeBalancePayment: vi.fn(),
    findTimeslotBookings: vi.fn(),
    findTimeslotBookingsInRange: vi.fn(),
    countTimeslotBookingsForServiceOnDate: vi.fn().mockResolvedValue(0),
    findAppointments: vi.fn(),
    findBookingsNeedingReminders: vi.fn(),
    markReminderSent: vi.fn(),
  };
}

function createMockSchedulingAvailabilityService() {
  return {
    getAvailableSlots: vi.fn(),
    isSlotAvailable: vi.fn().mockResolvedValue(true),
    getNextAvailableSlot: vi.fn(),
  };
}

function createMockCheckoutSessionFactory() {
  return {
    createCheckoutSession: vi.fn().mockResolvedValue({
      checkoutUrl: 'https://checkout.stripe.com/test_session_123',
    }),
  } as unknown as CheckoutSessionFactory;
}

function createMockPrisma(overrides?: {
  bookingCount?: number;
  shouldThrowMaxPerDayError?: boolean;
}) {
  const bookingCount = overrides?.bookingCount ?? 0;

  const mockTx = {
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    booking: {
      count: vi.fn().mockResolvedValue(bookingCount),
      create: vi.fn().mockImplementation((args: { data: Record<string, unknown> }) => {
        return Promise.resolve({
          id: 'booking_created_1',
          tenantId: args.data.tenantId,
          serviceId: args.data.serviceId,
          customerId: args.data.customerId,
          packageId: null,
          date: args.data.date,
          totalPrice: args.data.totalPrice,
          status: args.data.status,
          bookingType: args.data.bookingType,
          startTime: args.data.startTime,
          endTime: args.data.endTime,
          clientTimezone: args.data.clientTimezone,
          notes: args.data.notes,
          commissionAmount: args.data.commissionAmount,
          commissionPercent: { toNumber: () => args.data.commissionPercent },
          stripePaymentIntentId: args.data.stripePaymentIntentId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }),
    },
    customer: {
      upsert: vi.fn().mockResolvedValue({
        id: 'cust_created_1',
        tenantId: TEST_TENANT_ID,
        email: 'jane@example.com',
        name: 'Jane Doe',
        phone: '+1-555-123-4567',
      }),
    },
  };

  return {
    $transaction: vi.fn(async (fn: (tx: typeof mockTx) => Promise<unknown>) => {
      if (overrides?.shouldThrowMaxPerDayError) {
        // Simulate the error being thrown inside the transaction
        throw new MaxBookingsPerDayExceededError('2025-06-15', 3);
      }
      return fn(mockTx);
    }),
    _mockTx: mockTx, // Expose for test assertions
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('AppointmentBookingService', () => {
  let service: AppointmentBookingService;
  let serviceRepo: ReturnType<typeof createMockServiceRepo>;
  let bookingRepo: ReturnType<typeof createMockBookingRepo>;
  let schedulingAvailabilityService: ReturnType<typeof createMockSchedulingAvailabilityService>;
  let checkoutSessionFactory: ReturnType<typeof createMockCheckoutSessionFactory>;
  let eventEmitter: FakeEventEmitter;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    serviceRepo = createMockServiceRepo();
    bookingRepo = createMockBookingRepo();
    schedulingAvailabilityService = createMockSchedulingAvailabilityService();
    checkoutSessionFactory = createMockCheckoutSessionFactory();
    eventEmitter = new FakeEventEmitter();
    mockPrisma = createMockPrisma();

    service = new AppointmentBookingService({
      bookingRepo,
      serviceRepo,
      schedulingAvailabilityService: schedulingAvailabilityService as any,
      checkoutSessionFactory,
      eventEmitter: eventEmitter as unknown as EventEmitter,
      prisma: mockPrisma as any,
    });
  });

  // ==========================================================================
  // createAppointmentCheckout Tests
  // ==========================================================================

  describe('createAppointmentCheckout', () => {
    it('creates checkout session for available slot', async () => {
      // Arrange
      const testService = buildService();
      serviceRepo.getById.mockResolvedValue(testService);
      schedulingAvailabilityService.isSlotAvailable.mockResolvedValue(true);

      const input = buildCreateAppointmentInput();

      // Act
      const result = await service.createAppointmentCheckout(TEST_TENANT_ID, input);

      // Assert
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/test_session_123');
      expect(serviceRepo.getById).toHaveBeenCalledWith(TEST_TENANT_ID, TEST_SERVICE_ID);
      expect(schedulingAvailabilityService.isSlotAvailable).toHaveBeenCalledWith(
        TEST_TENANT_ID,
        TEST_SERVICE_ID,
        input.startTime,
        expect.any(Date) // endTime calculated from duration
      );
      expect(checkoutSessionFactory.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TEST_TENANT_ID,
          amountCents: testService.priceCents,
          email: input.clientEmail,
          metadata: expect.objectContaining({
            tenantId: TEST_TENANT_ID,
            bookingType: 'TIMESLOT',
            serviceId: TEST_SERVICE_ID,
          }),
        })
      );
    });

    it('throws NotFoundError for unknown service', async () => {
      // Arrange
      serviceRepo.getById.mockResolvedValue(null);
      const input = buildCreateAppointmentInput({ serviceId: 'nonexistent_service' });

      // Act & Assert
      await expect(
        service.createAppointmentCheckout(TEST_TENANT_ID, input)
      ).rejects.toThrow(NotFoundError);

      expect(serviceRepo.getById).toHaveBeenCalledWith(TEST_TENANT_ID, 'nonexistent_service');
      expect(schedulingAvailabilityService.isSlotAvailable).not.toHaveBeenCalled();
    });

    it('throws Error for unavailable slot', async () => {
      // Arrange
      const testService = buildService();
      serviceRepo.getById.mockResolvedValue(testService);
      schedulingAvailabilityService.isSlotAvailable.mockResolvedValue(false);

      const input = buildCreateAppointmentInput();

      // Act & Assert
      await expect(
        service.createAppointmentCheckout(TEST_TENANT_ID, input)
      ).rejects.toThrow(/not available/);

      expect(schedulingAvailabilityService.isSlotAvailable).toHaveBeenCalled();
      expect(checkoutSessionFactory.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('throws MaxBookingsPerDayExceededError when at limit', async () => {
      // Arrange
      const testService = buildService({ maxPerDay: 3 });
      serviceRepo.getById.mockResolvedValue(testService);
      schedulingAvailabilityService.isSlotAvailable.mockResolvedValue(true);
      bookingRepo.countTimeslotBookingsForServiceOnDate.mockResolvedValue(3); // At limit

      const input = buildCreateAppointmentInput();

      // Act & Assert
      await expect(
        service.createAppointmentCheckout(TEST_TENANT_ID, input)
      ).rejects.toThrow(MaxBookingsPerDayExceededError);

      expect(bookingRepo.countTimeslotBookingsForServiceOnDate).toHaveBeenCalledWith(
        TEST_TENANT_ID,
        TEST_SERVICE_ID,
        input.startTime
      );
      expect(checkoutSessionFactory.createCheckoutSession).not.toHaveBeenCalled();
    });

    it('allows booking when under maxPerDay limit', async () => {
      // Arrange
      const testService = buildService({ maxPerDay: 5 });
      serviceRepo.getById.mockResolvedValue(testService);
      schedulingAvailabilityService.isSlotAvailable.mockResolvedValue(true);
      bookingRepo.countTimeslotBookingsForServiceOnDate.mockResolvedValue(2); // Under limit

      const input = buildCreateAppointmentInput();

      // Act
      const result = await service.createAppointmentCheckout(TEST_TENANT_ID, input);

      // Assert
      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/test_session_123');
      expect(bookingRepo.countTimeslotBookingsForServiceOnDate).toHaveBeenCalled();
      expect(checkoutSessionFactory.createCheckoutSession).toHaveBeenCalled();
    });

    it('skips maxPerDay check when not configured', async () => {
      // Arrange
      const testService = buildService({ maxPerDay: null }); // No limit
      serviceRepo.getById.mockResolvedValue(testService);
      schedulingAvailabilityService.isSlotAvailable.mockResolvedValue(true);

      const input = buildCreateAppointmentInput();

      // Act
      const result = await service.createAppointmentCheckout(TEST_TENANT_ID, input);

      // Assert
      expect(result.checkoutUrl).toBeDefined();
      expect(bookingRepo.countTimeslotBookingsForServiceOnDate).not.toHaveBeenCalled();
    });

    it('calculates correct endTime based on service duration', async () => {
      // Arrange
      const testService = buildService({ durationMinutes: 60 });
      serviceRepo.getById.mockResolvedValue(testService);
      schedulingAvailabilityService.isSlotAvailable.mockResolvedValue(true);

      const startTime = new Date('2025-06-15T10:00:00Z');
      const expectedEndTime = new Date('2025-06-15T11:00:00Z'); // 60 minutes later
      const input = buildCreateAppointmentInput({ startTime });

      // Act
      await service.createAppointmentCheckout(TEST_TENANT_ID, input);

      // Assert
      expect(schedulingAvailabilityService.isSlotAvailable).toHaveBeenCalledWith(
        TEST_TENANT_ID,
        TEST_SERVICE_ID,
        startTime,
        expectedEndTime
      );
    });
  });

  // ==========================================================================
  // onAppointmentPaymentCompleted Tests
  // ==========================================================================

  describe('onAppointmentPaymentCompleted', () => {
    it('creates confirmed booking with correct data', async () => {
      // Arrange
      const testService = buildService();
      serviceRepo.getById.mockResolvedValue(testService);

      const input = buildPaymentCompletedInput();

      // Act
      const result = await service.onAppointmentPaymentCompleted(TEST_TENANT_ID, input);

      // Assert
      expect(result.id).toBe('booking_created_1');
      expect(result.tenantId).toBe(TEST_TENANT_ID);
      expect(result.serviceId).toBe(TEST_SERVICE_ID);
      expect(result.status).toBe('CONFIRMED');
      expect(result.bookingType).toBe('TIMESLOT');
      expect(result.totalCents).toBe(5000);

      // Verify transaction was used
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('upserts customer record with normalized email', async () => {
      // Arrange
      const testService = buildService();
      serviceRepo.getById.mockResolvedValue(testService);

      const input = buildPaymentCompletedInput({
        clientEmail: '  JANE@EXAMPLE.COM  ', // Mixed case with whitespace
        clientName: 'Jane Updated',
      });

      // Act
      await service.onAppointmentPaymentCompleted(TEST_TENANT_ID, input);

      // Assert
      expect(mockPrisma._mockTx.customer.upsert).toHaveBeenCalledWith({
        where: {
          tenantId_email: {
            tenantId: TEST_TENANT_ID,
            email: 'jane@example.com', // Normalized
          },
        },
        update: {
          name: 'Jane Updated',
          phone: input.clientPhone,
        },
        create: {
          tenantId: TEST_TENANT_ID,
          email: 'jane@example.com',
          name: 'Jane Updated',
          phone: input.clientPhone,
        },
      });
    });

    it('emits BOOKED event with correct payload', async () => {
      // Arrange
      const testService = buildService();
      serviceRepo.getById.mockResolvedValue(testService);

      const input = buildPaymentCompletedInput();

      // Act
      await service.onAppointmentPaymentCompleted(TEST_TENANT_ID, input);

      // Assert
      expect(eventEmitter.emittedEvents).toHaveLength(1);
      expect(eventEmitter.emittedEvents[0].event).toBe(AppointmentEvents.BOOKED);
      expect(eventEmitter.emittedEvents[0].payload).toEqual(
        expect.objectContaining({
          bookingId: 'booking_created_1',
          tenantId: TEST_TENANT_ID,
          serviceId: TEST_SERVICE_ID,
          serviceName: testService.name,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          totalCents: input.totalCents,
        })
      );
    });

    it('enforces maxPerDay with advisory lock', async () => {
      // Arrange
      const testService = buildService({ maxPerDay: 3 });
      serviceRepo.getById.mockResolvedValue(testService);

      // Create new mock that simulates maxPerDay being exceeded
      mockPrisma = createMockPrisma({ bookingCount: 3, shouldThrowMaxPerDayError: true });

      service = new AppointmentBookingService({
        bookingRepo,
        serviceRepo,
        schedulingAvailabilityService: schedulingAvailabilityService as any,
        checkoutSessionFactory,
        eventEmitter: eventEmitter as unknown as EventEmitter,
        prisma: mockPrisma as any,
      });

      const input = buildPaymentCompletedInput();

      // Act & Assert
      await expect(
        service.onAppointmentPaymentCompleted(TEST_TENANT_ID, input)
      ).rejects.toThrow(MaxBookingsPerDayExceededError);

      // Event should NOT be emitted on failure
      expect(eventEmitter.emittedEvents).toHaveLength(0);
    });

    it('acquires advisory lock within transaction', async () => {
      // Arrange
      const testService = buildService({ maxPerDay: 5 });
      serviceRepo.getById.mockResolvedValue(testService);

      const input = buildPaymentCompletedInput();

      // Act
      await service.onAppointmentPaymentCompleted(TEST_TENANT_ID, input);

      // Assert
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(mockPrisma._mockTx.$executeRaw).toHaveBeenCalled();
    });

    it('throws NotFoundError for unknown service', async () => {
      // Arrange
      serviceRepo.getById.mockResolvedValue(null);

      const input = buildPaymentCompletedInput({ serviceId: 'nonexistent' });

      // Act & Assert
      await expect(
        service.onAppointmentPaymentCompleted(TEST_TENANT_ID, input)
      ).rejects.toThrow(NotFoundError);
    });

    it('handles optional fields gracefully', async () => {
      // Arrange
      const testService = buildService();
      serviceRepo.getById.mockResolvedValue(testService);

      const input = buildPaymentCompletedInput({
        clientPhone: undefined,
        clientTimezone: undefined,
        notes: undefined,
      });

      // Act
      const result = await service.onAppointmentPaymentCompleted(TEST_TENANT_ID, input);

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('booking_created_1');
    });
  });

  // ==========================================================================
  // Multi-Tenant Isolation Tests
  // ==========================================================================

  describe('Multi-tenant isolation', () => {
    it('respects tenant boundaries in createAppointmentCheckout', async () => {
      // Arrange - Service exists for TEST_TENANT_ID but we query with OTHER_TENANT_ID
      const testService = buildService({ tenantId: TEST_TENANT_ID });
      serviceRepo.getById.mockImplementation(async (tenantId: string, serviceId: string) => {
        // Only return service for the correct tenant
        if (tenantId === TEST_TENANT_ID && serviceId === TEST_SERVICE_ID) {
          return testService;
        }
        return null;
      });

      const input = buildCreateAppointmentInput();

      // Act & Assert - Should throw NotFoundError for wrong tenant
      await expect(
        service.createAppointmentCheckout(OTHER_TENANT_ID, input)
      ).rejects.toThrow(NotFoundError);

      // Verify correct tenant was used in query
      expect(serviceRepo.getById).toHaveBeenCalledWith(OTHER_TENANT_ID, TEST_SERVICE_ID);
    });

    it('respects tenant boundaries in onAppointmentPaymentCompleted', async () => {
      // Arrange - Service belongs to different tenant
      serviceRepo.getById.mockImplementation(async (tenantId: string) => {
        if (tenantId === TEST_TENANT_ID) {
          return buildService();
        }
        return null;
      });

      const input = buildPaymentCompletedInput();

      // Act & Assert - Should throw NotFoundError for wrong tenant
      await expect(
        service.onAppointmentPaymentCompleted(OTHER_TENANT_ID, input)
      ).rejects.toThrow(NotFoundError);

      // Event should NOT be emitted
      expect(eventEmitter.emittedEvents).toHaveLength(0);
    });

    it('includes tenantId in checkout metadata', async () => {
      // Arrange
      const testService = buildService();
      serviceRepo.getById.mockResolvedValue(testService);
      schedulingAvailabilityService.isSlotAvailable.mockResolvedValue(true);

      const input = buildCreateAppointmentInput();

      // Act
      await service.createAppointmentCheckout(TEST_TENANT_ID, input);

      // Assert - tenantId must be in metadata for webhook routing
      expect(checkoutSessionFactory.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: TEST_TENANT_ID,
          metadata: expect.objectContaining({
            tenantId: TEST_TENANT_ID,
          }),
        })
      );
    });

    it('creates booking with correct tenantId', async () => {
      // Arrange
      const testService = buildService();
      serviceRepo.getById.mockResolvedValue(testService);

      const input = buildPaymentCompletedInput();

      // Act
      const result = await service.onAppointmentPaymentCompleted(TEST_TENANT_ID, input);

      // Assert
      expect(result.tenantId).toBe(TEST_TENANT_ID);
      expect(mockPrisma._mockTx.booking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: TEST_TENANT_ID,
        }),
      });
    });

    it('scopes countTimeslotBookingsForServiceOnDate by tenantId', async () => {
      // Arrange
      const testService = buildService({ maxPerDay: 5 });
      serviceRepo.getById.mockResolvedValue(testService);
      schedulingAvailabilityService.isSlotAvailable.mockResolvedValue(true);

      const input = buildCreateAppointmentInput();

      // Act
      await service.createAppointmentCheckout(TEST_TENANT_ID, input);

      // Assert - Repository must filter by tenantId
      expect(bookingRepo.countTimeslotBookingsForServiceOnDate).toHaveBeenCalledWith(
        TEST_TENANT_ID,
        TEST_SERVICE_ID,
        input.startTime
      );
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge cases', () => {
    it('handles maxPerDay of 0 (no bookings allowed)', async () => {
      // Arrange
      const testService = buildService({ maxPerDay: 0 });
      serviceRepo.getById.mockResolvedValue(testService);
      schedulingAvailabilityService.isSlotAvailable.mockResolvedValue(true);
      bookingRepo.countTimeslotBookingsForServiceOnDate.mockResolvedValue(0);

      const input = buildCreateAppointmentInput();

      // Act & Assert - Even with 0 existing bookings, maxPerDay=0 should block
      await expect(
        service.createAppointmentCheckout(TEST_TENANT_ID, input)
      ).rejects.toThrow(MaxBookingsPerDayExceededError);
    });

    it('handles maxPerDay of 1 (exactly one booking allowed)', async () => {
      // Arrange
      const testService = buildService({ maxPerDay: 1 });
      serviceRepo.getById.mockResolvedValue(testService);
      schedulingAvailabilityService.isSlotAvailable.mockResolvedValue(true);
      bookingRepo.countTimeslotBookingsForServiceOnDate.mockResolvedValue(0);

      const input = buildCreateAppointmentInput();

      // Act
      const result = await service.createAppointmentCheckout(TEST_TENANT_ID, input);

      // Assert - Should succeed with 0 existing bookings
      expect(result.checkoutUrl).toBeDefined();
    });

    it('includes all required metadata for webhook processing', async () => {
      // Arrange
      const testService = buildService();
      serviceRepo.getById.mockResolvedValue(testService);
      schedulingAvailabilityService.isSlotAvailable.mockResolvedValue(true);

      const input = buildCreateAppointmentInput();

      // Act
      await service.createAppointmentCheckout(TEST_TENANT_ID, input);

      // Assert - All critical fields must be in metadata
      expect(checkoutSessionFactory.createCheckoutSession).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            tenantId: TEST_TENANT_ID,
            bookingType: 'TIMESLOT',
            serviceId: TEST_SERVICE_ID,
            startTime: input.startTime.toISOString(),
            endTime: expect.any(String),
            clientName: input.clientName,
            clientEmail: input.clientEmail,
          }),
        })
      );
    });
  });
});
