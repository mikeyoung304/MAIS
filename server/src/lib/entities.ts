/**
 * Domain entities
 */

// ============================================================================
// Catalog Entities
// ============================================================================

export interface PackagePhoto {
  url: string;
  filename?: string;
  size?: number;
  order?: number;
  altText?: string; // Alt text for accessibility
}

export interface Package {
  id: string;
  tenantId: string; // Multi-tenant isolation
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  photoUrl?: string;
  photos?: PackagePhoto[]; // Photo gallery
  // Segment and grouping fields
  segmentId?: string | null;
  grouping?: string | null;
  groupingOrder?: number | null;
  active?: boolean; // Package active status (maps to DB 'active' field)
}

export interface AddOn {
  id: string;
  packageId: string;
  title: string;
  priceCents: number;
  photoUrl?: string;
}

// ============================================================================
// Booking Entities
// ============================================================================

export interface Booking {
  id: string;
  packageId: string;
  coupleName: string;
  email: string;
  phone?: string;
  eventDate: string; // YYYY-MM-DD format
  addOnIds: string[];
  totalCents: number;
  commissionAmount?: number; // Platform commission in cents
  commissionPercent?: number; // Commission percentage (e.g., 12.5)
  status: 'PENDING' | 'DEPOSIT_PAID' | 'PAID' | 'CONFIRMED' | 'CANCELED' | 'REFUNDED' | 'FULFILLED';
  createdAt: string; // ISO 8601 format
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
  packageId: string;
  eventDate: string;
  email: string;
  coupleName: string;
  addOnIds?: string[];
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
  createdAt: Date;
  updatedAt: Date;
}
