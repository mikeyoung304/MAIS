/**
 * Domain entities
 */

// ============================================================================
// Catalog Entities
// ============================================================================

export type BookingType = 'DATE' | 'TIMESLOT';

/**
 * Photo attached to a Tier (or legacy Package)
 */
export interface TierPhoto {
  url: string;
  filename: string;
  size: number;
  order: number;
}

/**
 * Tier - a bookable offering within a segment
 *
 * Replaces the legacy `Package` entity. Tiers represent different service
 * levels or pricing options (e.g., "Essential", "Signature", "Premier").
 */
export interface Tier {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  displayPriceCents?: number | null;
  photoUrl?: string;
  photos?: TierPhoto[];
  active: boolean;
  segmentId?: string | null;
  grouping?: string | null;
  groupingOrder?: number | null;
  bookingType: BookingType;
  depositPercent?: number;
  depositAmount?: number;
  durationMinutes?: number;
  maxGuests?: number | null;
  scalingRules?: import('@macon/contracts').ScalingRules | null;
}

export interface AddOn {
  id: string;
  tierId: string;
  title: string;
  description?: string | null;
  priceCents: number;
  photoUrl?: string;
}

// ============================================================================
// Booking Entities
// ============================================================================

export interface Booking {
  id: string;
  tenantId?: string; // Tenant isolation (optional for backward compatibility)
  tierId: string | null; // Nullable for TIMESLOT bookings (which use serviceId instead)
  customerId?: string; // Customer reference (for timeslot bookings)
  venueId?: string | null; // Venue reference
  coupleName: string;
  email: string;
  phone?: string;
  eventDate: string; // YYYY-MM-DD format
  addOnIds: string[];
  totalCents: number;
  guestCount?: number | null;
  // Scheduling fields - supports both date-only (legacy) and time-slot bookings
  startTime?: string; // ISO 8601 format - for timeslot bookings
  endTime?: string; // ISO 8601 format - for timeslot bookings
  bookingType?: 'DATE' | 'TIMESLOT'; // Booking type
  serviceId?: string; // Service reference (for timeslot bookings)
  clientTimezone?: string | null; // Client timezone for display
  notes?: string | null; // Booking notes
  commissionAmount?: number; // Platform commission in cents
  commissionPercent?: number; // Commission percentage (e.g., 12.5)
  status: 'PENDING' | 'DEPOSIT_PAID' | 'PAID' | 'CONFIRMED' | 'CANCELED' | 'REFUNDED' | 'FULFILLED';
  createdAt: string; // ISO 8601 format
  updatedAt?: string; // ISO 8601 format
  confirmedAt?: string | null; // When payment completed
  cancelledAt?: string | null; // When cancelled
  // Stripe Payment
  stripePaymentIntentId?: string | null; // Stripe PaymentIntent ID
  // Google Calendar sync
  googleEventId?: string | null; // Google Calendar event ID
  // Cancellation fields
  cancelledBy?: 'CUSTOMER' | 'TENANT' | 'ADMIN' | 'SYSTEM';
  cancellationReason?: string;
  // Refund fields
  refundStatus?: 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  refundAmount?: number;
  refundedAt?: string;
  stripeRefundId?: string;
  // Reminder fields (lazy reminders - Phase 2)
  reminderDueDate?: string; // YYYY-MM-DD format - when to send reminder (7 days before event)
  reminderSentAt?: string; // ISO 8601 format - when reminder was sent
  // Deposit fields (Phase 4)
  depositPaidAmount?: number; // Amount paid as deposit
  balanceDueDate?: string; // When balance payment is due
  balancePaidAmount?: number; // Amount paid as balance
  balancePaidAt?: string; // When balance was paid
}

/**
 * Input for creating a booking (before payment)
 */
export interface CreateBookingInput {
  tierId: string;
  eventDate: string;
  email: string;
  coupleName: string;
  addOnIds?: string[];
  bookingType?: BookingType; // DATE for weddings, TIMESLOT for appointments
}

// ============================================================================
// Blackout Entities
// ============================================================================

export interface Blackout {
  date: string; // YYYY-MM-DD format
  reason?: string;
}

// ============================================================================
// Scheduling Entities
// ============================================================================

export interface Service {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferMinutes: number;
  priceCents: number;
  timezone: string;
  active: boolean;
  sortOrder: number;
  segmentId: string | null;
  /** Maximum bookings allowed per day for this service. null = unlimited */
  maxPerDay: number | null;
  createdAt: Date;
  updatedAt: Date;
}
