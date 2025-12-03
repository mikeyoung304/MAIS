/**
 * Type-safe in-process event emitter with typed events
 *
 * This module provides a fully type-safe event system where:
 * - Event names are defined as constants to prevent typos
 * - Event payloads are strictly typed based on the event name
 * - TypeScript enforces correct payload types at compile time
 *
 * @example Basic Usage
 * ```typescript
 * const emitter = new InProcessEventEmitter();
 *
 * // Subscribe to events with automatic type inference
 * emitter.subscribe(BookingEvents.PAID, (payload) => {
 *   // payload is typed as BookingEventPayloads['BookingPaid']
 *   console.log(`Booking ${payload.bookingId} paid: ${payload.totalCents} cents`);
 * });
 *
 * // Emit events with type-safe payloads
 * await emitter.emit(BookingEvents.PAID, {
 *   bookingId: 'bkg_123',
 *   email: 'customer@example.com',
 *   coupleName: 'John & Jane Doe',
 *   eventDate: '2024-06-15',
 *   packageTitle: 'Wedding Photography',
 *   addOnTitles: ['Album', 'Drone Shots'],
 *   totalCents: 250000,
 * });
 * ```
 *
 * @example Error Handling
 * ```typescript
 * // Errors in one handler don't affect others
 * emitter.subscribe(BookingEvents.PAID, async (payload) => {
 *   throw new Error('Handler 1 failed'); // Logged but doesn't crash
 * });
 *
 * emitter.subscribe(BookingEvents.PAID, async (payload) => {
 *   console.log('Handler 2 still executes'); // This runs despite Handler 1 error
 * });
 * ```
 *
 * @example Type Safety
 * ```typescript
 * // ❌ Compile error: Wrong payload type
 * emitter.emit(BookingEvents.PAID, {
 *   wrongField: 'test'
 * });
 *
 * // ❌ Compile error: Missing required fields
 * emitter.emit(BookingEvents.PAID, {
 *   bookingId: 'bkg_123',
 *   email: 'test@example.com'
 *   // Missing: coupleName, eventDate, etc.
 * });
 *
 * // ❌ Compile error: Typo in event name
 * emitter.emit('BookingPayed', payload); // Should be BookingEvents.PAID
 * ```
 */

import { logger } from './logger';

// ============================================================================
// Event Name Constants - Prevents typos in event names
// ============================================================================
// All event names are defined as constants to prevent silent delivery failures
// caused by typos in string literals.

export const BookingEvents = {
  PAID: 'BookingPaid',
  RESCHEDULED: 'BookingRescheduled',
  CANCELLED: 'BookingCancelled',
  REMINDER_DUE: 'BookingReminderDue',
  REFUNDED: 'BookingRefunded',
  BALANCE_PAYMENT_COMPLETED: 'BalancePaymentCompleted',
} as const;

export const AppointmentEvents = {
  BOOKED: 'AppointmentBooked',
} as const;

// Type exports for type-safe event name handling
export type BookingEventName = typeof BookingEvents[keyof typeof BookingEvents];
export type AppointmentEventName = typeof AppointmentEvents[keyof typeof AppointmentEvents];

export type EventName = BookingEventName | AppointmentEventName;

// ============================================================================
// Event Payload Type Definitions - Enforces type safety
// ============================================================================

/**
 * Payload types for booking-related events
 * Maps event names to their expected payload structures
 */
export interface BookingEventPayloads {
  [BookingEvents.PAID]: {
    bookingId: string;
    email: string;
    coupleName: string;
    eventDate: string; // YYYY-MM-DD format
    packageTitle: string;
    addOnTitles: string[];
    totalCents: number;
  };
  [BookingEvents.RESCHEDULED]: {
    bookingId: string;
    tenantId: string;
    email: string;
    coupleName: string;
    oldDate: string; // YYYY-MM-DD format
    newDate: string; // YYYY-MM-DD format
  };
  [BookingEvents.CANCELLED]: {
    bookingId: string;
    tenantId: string;
    email: string;
    coupleName: string;
    eventDate: string; // YYYY-MM-DD format
    totalCents: number;
    cancelledBy: string;
    reason?: string;
    needsRefund: boolean;
  };
  [BookingEvents.REMINDER_DUE]: {
    bookingId: string;
    tenantId: string;
    email: string;
    coupleName: string;
    eventDate: string; // YYYY-MM-DD format
    packageTitle: string;
    daysUntilEvent: number;
    manageUrl: string;
  };
  [BookingEvents.REFUNDED]: {
    bookingId: string;
    tenantId: string;
    email: string;
    coupleName: string;
    refundAmount: number;
    isPartial: boolean;
  };
  [BookingEvents.BALANCE_PAYMENT_COMPLETED]: {
    bookingId: string;
    tenantId: string;
    email: string;
    coupleName: string;
    eventDate: string; // YYYY-MM-DD format
    balanceAmountCents: number;
  };
}

/**
 * Payload types for appointment-related events
 * Maps event names to their expected payload structures
 */
export interface AppointmentEventPayloads {
  [AppointmentEvents.BOOKED]: {
    bookingId: string;
    tenantId: string;
    serviceId: string;
    serviceName: string;
    clientName: string;
    clientEmail: string;
    clientPhone?: string;
    startTime: string;
    endTime: string;
    totalCents: number;
    notes?: string;
  };
}

/**
 * Combined event payload map for all application events
 */
export type AllEventPayloads = BookingEventPayloads & AppointmentEventPayloads;

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

/**
 * Type-safe EventEmitter interface
 * Enforces correct payload types for each event name at compile time
 */
export interface EventEmitter {
  /**
   * Subscribe to a typed event
   * @param event - Event name (must be a key of AllEventPayloads)
   * @param handler - Handler function that receives the correctly typed payload
   * @returns Unsubscribe function to remove this specific handler
   */
  subscribe<K extends keyof AllEventPayloads>(
    event: K,
    handler: EventHandler<AllEventPayloads[K]>
  ): () => void;

  /**
   * Emit a typed event
   * @param event - Event name (must be a key of AllEventPayloads)
   * @param payload - Event payload (must match the type for the event name)
   */
  emit<K extends keyof AllEventPayloads>(
    event: K,
    payload: AllEventPayloads[K]
  ): Promise<void>;

  /**
   * Clear all event subscriptions
   */
  clearAll(): void;
}

export class InProcessEventEmitter implements EventEmitter {
  private handlers: Map<string, EventHandler[]> = new Map();

  subscribe<K extends keyof AllEventPayloads>(
    event: K,
    handler: EventHandler<AllEventPayloads[K]>
  ): () => void {
    const existing = this.handlers.get(event as string) || [];
    this.handlers.set(event as string, [...existing, handler as EventHandler]);

    // Return unsubscribe function that removes this specific handler
    return () => {
      const handlers = this.handlers.get(event as string) || [];
      const filtered = handlers.filter((h) => h !== handler);
      if (filtered.length > 0) {
        this.handlers.set(event as string, filtered);
      } else {
        this.handlers.delete(event as string);
      }
    };
  }

  async emit<K extends keyof AllEventPayloads>(
    event: K,
    payload: AllEventPayloads[K]
  ): Promise<void> {
    const handlers = this.handlers.get(event as string) || [];

    // Execute all handlers with error isolation
    // Errors in one listener should not prevent other listeners from executing
    await Promise.allSettled(
      handlers.map(async (handler) => {
        try {
          await handler(payload);
        } catch (error) {
          logger.error(
            {
              event,
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
            'Event handler error'
          );
        }
      })
    );
  }

  /**
   * Clear all event subscriptions
   * Call this during application shutdown to prevent memory leaks
   */
  clearAll(): void {
    this.handlers.clear();
  }
}
