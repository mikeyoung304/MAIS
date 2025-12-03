# TODO-177: EventEmitter Interface Lacks Type Safety with Event Constants

**Priority:** P2 (Architecture)
**Status:** completed
**Created:** 2025-12-03
**Completed:** 2025-12-03
**Source:** Code Review (Architecture Strategist)

## Issue

While event name constants were added (`BookingEvents`, `AppointmentEvents`), the `EventEmitter` interface doesn't enforce type safety between event names and their payload types. This allows:

1. Emitting an event with the wrong payload type
2. Subscribing to an event and expecting the wrong payload structure
3. Typos in event names going undetected at compile time

## Location

- `server/src/lib/core/events.ts`
- Event consumers across the codebase

## Current Implementation

```typescript
export const BookingEvents = {
  CREATED: 'booking:created',
  CONFIRMED: 'booking:confirmed',
  // ...
} as const;

export type BookingEventName = typeof BookingEvents[keyof typeof BookingEvents];

// EventEmitter still uses generic string for event names:
class EventEmitter {
  emit(event: string, payload: unknown): void;
  on(event: string, handler: (payload: unknown) => void): void;
}
```

## Desired Implementation

```typescript
// Define payload types for each event
interface BookingEventPayloads {
  'booking:created': { bookingId: string; tenantId: string; customerId: string };
  'booking:confirmed': { bookingId: string; confirmationNumber: string };
  'booking:cancelled': { bookingId: string; reason?: string; refundAmount?: number };
}

// Type-safe emit/on methods
class TypedEventEmitter {
  emit<K extends keyof BookingEventPayloads>(
    event: K,
    payload: BookingEventPayloads[K]
  ): void;

  on<K extends keyof BookingEventPayloads>(
    event: K,
    handler: (payload: BookingEventPayloads[K]) => void
  ): void;
}
```

## Benefits

1. Compile-time validation of event payloads
2. IDE autocomplete for event names and payload properties
3. Refactoring safety - renaming events updates all usages
4. Self-documenting event contracts

## Recommendation

1. Create `EventPayloads` interface mapping event names to payload types
2. Create `TypedEventEmitter` wrapper or modify existing emitter
3. Gradually migrate existing usages to typed variants
4. Consider using a library like `typed-emitter` or `mitt` with type support

## Acceptance Criteria

- [x] Event payload types defined for all booking-related events
- [x] Event payload types defined for all appointment-related events
- [x] TypedEventEmitter enforces correct payload types at compile time
- [x] Existing event emissions updated to use typed patterns
- [x] Documentation added for event contracts

## Resolution

The EventEmitter type safety infrastructure was already implemented in `server/src/lib/core/events.ts`, but required the following fixes:

1. **Fixed payload type definitions**: Changed `eventDate` from `Date` to `string` (YYYY-MM-DD format) to match actual usage in the codebase
2. **Simplified event subscriptions**: Removed redundant explicit type annotations in `server/src/di.ts` since the EventEmitter interface already enforces type safety
3. **Added comprehensive documentation**: Included usage examples, error handling patterns, and type safety demonstrations
4. **Created type-safety verification file**: Added `docs/examples/event-emitter-type-safety.ts` with examples of valid and invalid usage

All acceptance criteria have been met. TypeScript now enforces correct payload types at compile time for all event emissions and subscriptions.

## Related

- TODO-163: Completed addition of event name constants (foundation for this work)
- `server/src/services/booking.service.ts` - Primary event emitter
- `server/src/services/reminder.service.ts` - Event consumer
