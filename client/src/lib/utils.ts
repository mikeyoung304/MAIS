import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { fromCents } from "./api-helpers"
import { BookingDtoSchema, BookingManagementDtoSchema } from "@macon/contracts"
import { z } from "zod"

/**
 * Combines class names intelligently:
 * 1. clsx handles conditional classes
 * 2. tailwind-merge resolves Tailwind conflicts
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format currency in USD
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(fromCents(cents))
}

/**
 * Format date for display (long format with weekday)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + (typeof date === 'string' && !date.includes('T') ? 'T00:00:00' : '')) : date
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

/**
 * Booking status type from BookingDto schema
 * Derived from contracts package to stay in sync with backend
 */
export type BookingStatus = z.infer<typeof BookingDtoSchema>['status'];

/**
 * Refund status type from BookingManagementDto schema
 * Derived from contracts package to stay in sync with backend
 */
export type RefundStatus = NonNullable<z.infer<typeof BookingManagementDtoSchema>['refundStatus']>;

/**
 * Get badge variant for booking status
 */
export function getStatusVariant(status: BookingStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'CONFIRMED':
    case 'FULFILLED':
      return 'default';
    case 'PAID':
    case 'DEPOSIT_PAID':
      return 'secondary';
    case 'CANCELED':
      return 'destructive';
    case 'REFUNDED':
      return 'secondary';
    case 'PENDING':
      return 'outline';
    default: {
      const _exhaustiveCheck: never = status;
      return 'outline'; // Safe fallback
    }
  }
}

/**
 * Get refund status display text
 */
export function getRefundStatusText(status?: RefundStatus): string | null {
  if (!status || status === 'NONE') return null;

  switch (status) {
    case 'PENDING':
      return 'Refund pending';
    case 'PROCESSING':
      return 'Refund processing';
    case 'COMPLETED':
      return 'Refund completed';
    case 'PARTIAL':
      return 'Partial refund issued';
    case 'FAILED':
      return 'Refund failed';
    default: {
      const _exhaustiveCheck: never = status;
      return null; // Safe fallback
    }
  }
}
