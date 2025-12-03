/**
 * Hook for booking management API operations
 * Handles token-based authentication for public booking management
 */

import { useState, useEffect, useCallback } from 'react';
import { baseUrl } from '@/lib/api';
import type { BookingStatus, RefundStatus } from '@/lib/utils';

/**
 * Booking details with management status
 */
export interface BookingDetails {
  booking: {
    id: string;
    packageId: string;
    coupleName: string;
    email: string;
    phone?: string;
    eventDate: string;
    addOnIds: string[];
    totalCents: number;
    status: BookingStatus;
    createdAt: string;
    cancelledBy?: 'CUSTOMER' | 'TENANT' | 'ADMIN' | 'SYSTEM';
    cancellationReason?: string;
    refundStatus?: RefundStatus;
    refundAmount?: number;
    refundedAt?: string;
  };
  canReschedule: boolean;
  canCancel: boolean;
  packageTitle: string;
  addOnTitles: string[];
}

/**
 * Error response structure
 */
interface ErrorResponse {
  status: 'error';
  statusCode: number;
  error: string;
  message: string;
}

/**
 * Hook state
 */
interface UseBookingManagementState {
  bookingDetails: BookingDetails | null;
  isLoading: boolean;
  error: string | null;
  isRescheduling: boolean;
  isCancelling: boolean;
}

/**
 * Hook return type
 */
interface UseBookingManagementReturn extends UseBookingManagementState {
  fetchBookingDetails: () => Promise<void>;
  rescheduleBooking: (newDate: string) => Promise<boolean>;
  cancelBooking: (reason?: string) => Promise<boolean>;
}

/**
 * Hook for managing booking operations with JWT token authentication
 */
export function useBookingManagement(token: string | null): UseBookingManagementReturn {
  const [state, setState] = useState<UseBookingManagementState>({
    bookingDetails: null,
    isLoading: false,
    error: null,
    isRescheduling: false,
    isCancelling: false,
  });

  /**
   * Fetch booking details using the JWT token
   */
  const fetchBookingDetails = useCallback(async () => {
    if (!token) {
      setState(prev => ({ ...prev, error: 'No access token provided' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(
        `${baseUrl}/v1/public/bookings/manage?token=${encodeURIComponent(token)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ErrorResponse;
        let errorMessage = errorData.message;

        // User-friendly error messages
        if (errorData.error === 'TOKEN_EXPIRED') {
          errorMessage = 'Your access link has expired. Please request a new one from your confirmation email.';
        } else if (errorData.error === 'INVALID_TOKEN') {
          errorMessage = 'Invalid access link. Please use the link from your confirmation email.';
        } else if (errorData.error === 'NOT_FOUND') {
          errorMessage = 'Booking not found. It may have been cancelled or the link is incorrect.';
        }

        throw new Error(errorMessage);
      }

      setState(prev => ({
        ...prev,
        bookingDetails: data as BookingDetails,
        isLoading: false,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to load booking details',
        isLoading: false,
      }));
    }
  }, [token]);

  /**
   * Reschedule booking to a new date
   */
  const rescheduleBooking = useCallback(async (newDate: string): Promise<boolean> => {
    if (!token) {
      setState(prev => ({ ...prev, error: 'No access token provided' }));
      return false;
    }

    setState(prev => ({ ...prev, isRescheduling: true, error: null }));

    try {
      const response = await fetch(
        `${baseUrl}/v1/public/bookings/reschedule?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ newDate }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ErrorResponse;
        let errorMessage = errorData.message;

        if (errorData.error === 'BOOKING_CONFLICT') {
          errorMessage = 'That date is not available. Please choose a different date.';
        } else if (errorData.error === 'BOOKING_ALREADY_CANCELLED') {
          errorMessage = 'This booking has already been cancelled.';
        } else if (errorData.error === 'TOKEN_EXPIRED') {
          errorMessage = 'Your access link has expired. Please request a new one.';
        }

        throw new Error(errorMessage);
      }

      // Update local state with new booking details
      setState(prev => ({
        ...prev,
        bookingDetails: prev.bookingDetails ? {
          ...prev.bookingDetails,
          booking: {
            ...prev.bookingDetails.booking,
            eventDate: newDate,
          },
        } : null,
        isRescheduling: false,
      }));

      return true;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to reschedule booking',
        isRescheduling: false,
      }));
      return false;
    }
  }, [token]);

  /**
   * Cancel booking
   */
  const cancelBooking = useCallback(async (reason?: string): Promise<boolean> => {
    if (!token) {
      setState(prev => ({ ...prev, error: 'No access token provided' }));
      return false;
    }

    setState(prev => ({ ...prev, isCancelling: true, error: null }));

    try {
      const response = await fetch(
        `${baseUrl}/v1/public/bookings/cancel?token=${encodeURIComponent(token)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ErrorResponse;
        let errorMessage = errorData.message;

        if (errorData.error === 'BOOKING_ALREADY_CANCELLED') {
          errorMessage = 'This booking has already been cancelled.';
        } else if (errorData.error === 'TOKEN_EXPIRED') {
          errorMessage = 'Your access link has expired. Please request a new one.';
        }

        throw new Error(errorMessage);
      }

      // Update local state with cancelled status
      setState(prev => ({
        ...prev,
        bookingDetails: prev.bookingDetails ? {
          ...prev.bookingDetails,
          booking: {
            ...prev.bookingDetails.booking,
            status: 'CANCELED',
            cancelledBy: 'CUSTOMER',
            cancellationReason: reason,
            refundStatus: prev.bookingDetails.booking.status === 'PAID' ? 'PENDING' : 'NONE',
          },
          canReschedule: false,
          canCancel: false,
        } : null,
        isCancelling: false,
      }));

      return true;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to cancel booking',
        isCancelling: false,
      }));
      return false;
    }
  }, [token]);

  // Fetch booking details on mount
  useEffect(() => {
    if (token) {
      fetchBookingDetails();
    }
  }, [token, fetchBookingDetails]);

  return {
    ...state,
    fetchBookingDetails,
    rescheduleBooking,
    cancelBooking,
  };
}
