/**
 * Simple in-process event emitter with typed events
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

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

export interface EventEmitter {
  subscribe<T>(event: string, handler: EventHandler<T>): void;
  emit<T>(event: string, payload: T): Promise<void>;
  clearAll(): void;
}

export class InProcessEventEmitter implements EventEmitter {
  private handlers: Map<string, EventHandler[]> = new Map();

  subscribe<T>(event: string, handler: EventHandler<T>): void {
    const existing = this.handlers.get(event) || [];
    this.handlers.set(event, [...existing, handler as EventHandler]);
  }

  async emit<T>(event: string, payload: T): Promise<void> {
    const handlers = this.handlers.get(event) || [];

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
