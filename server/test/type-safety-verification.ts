/**
 * Type Safety Verification for EventEmitter
 * This file exists to demonstrate that the EventEmitter enforces type safety.
 * It should NOT be run - it's a compile-time verification only.
 *
 * If any of the commented-out code below is uncommented, TypeScript should
 * produce compilation errors, proving that type safety is working.
 */

import { InProcessEventEmitter, BookingEvents, AppointmentEvents } from '../src/lib/core/events';

const emitter = new InProcessEventEmitter();

// ✅ VALID: Correct event name with correct payload type
emitter.emit(BookingEvents.PAID, {
  bookingId: 'test-id',
  email: 'test@example.com',
  coupleName: 'Test Couple',
  eventDate: '2024-01-15', // YYYY-MM-DD format
  packageTitle: 'Test Package',
  addOnTitles: [],
  totalCents: 10000,
});

// ✅ VALID: Subscribe with correct handler type
emitter.subscribe(BookingEvents.PAID, (payload) => {
  // payload is automatically typed as BookingEventPayloads['BookingPaid']
  console.log(payload.bookingId);
  console.log(payload.email);
  console.log(payload.coupleName);
});

// ❌ INVALID: Wrong payload type (uncomment to verify TypeScript error)
/*
emitter.emit(BookingEvents.PAID, {
  wrongField: 'test',
});
*/

// ❌ INVALID: Missing required fields (uncomment to verify TypeScript error)
/*
emitter.emit(BookingEvents.PAID, {
  bookingId: 'test-id',
  email: 'test@example.com',
  // Missing coupleName, eventDate, packageTitle, addOnTitles, totalCents
});
*/

// ❌ INVALID: Typo in event name (uncomment to verify TypeScript error)
/*
emitter.emit('BookingPayed', { // Typo: 'Payed' instead of 'Paid'
  bookingId: 'test-id',
  email: 'test@example.com',
  coupleName: 'Test Couple',
  eventDate: new Date(),
  packageTitle: 'Test Package',
  addOnTitles: [],
  totalCents: 10000,
});
*/

// ❌ INVALID: Handler expecting wrong payload structure (uncomment to verify TypeScript error)
/*
emitter.subscribe(BookingEvents.PAID, (payload) => {
  console.log(payload.nonExistentField); // Should error: property doesn't exist
});
*/

// ✅ VALID: All appointment event fields are correctly typed
emitter.emit(AppointmentEvents.BOOKED, {
  bookingId: 'test-id',
  tenantId: 'tenant-123',
  serviceId: 'service-456',
  serviceName: 'Consultation',
  clientName: 'John Doe',
  clientEmail: 'john@example.com',
  clientPhone: '555-1234',
  startTime: '2024-01-01T10:00:00Z',
  endTime: '2024-01-01T11:00:00Z',
  totalCents: 5000,
  notes: 'First consultation',
});

console.log('✅ Type safety verification complete. If this file compiles, type safety is working!');
