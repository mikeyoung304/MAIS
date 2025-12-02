/**
 * Manage Booking Page
 * Public customer self-service for reschedule/cancel bookings
 * Accessed via JWT token in URL: /bookings/manage?token=xxx
 */

import { useSearchParams, Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { useBookingManagement } from './hooks/useBookingManagement';
import { BookingDetailsCard } from './BookingDetailsCard';
import { RescheduleDialog } from './RescheduleDialog';
import { CancelDialog } from './CancelDialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

export function ManageBookingPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const {
    bookingDetails,
    isLoading,
    error,
    isRescheduling,
    isCancelling,
    rescheduleBooking,
    cancelBooking,
  } = useBookingManagement(token);

  // No token provided
  if (!token) {
    return (
      <div className="min-h-screen bg-macon-navy-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive" className="bg-red-900/20 border-red-500/30">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Invalid Link</AlertTitle>
            <AlertDescription>
              No access token was provided. Please use the link from your booking
              confirmation email to manage your booking.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-macon-navy-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-macon-gold mx-auto mb-4" />
          <p className="text-white/60">Loading your booking...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-macon-navy-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive" className="bg-red-900/20 border-red-500/30">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Unable to Load Booking</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <p className="text-white/40 text-sm text-center mt-4">
            If you continue to have issues, please contact support.
          </p>
        </div>
      </div>
    );
  }

  // No booking data (shouldn't happen if no error, but type safety)
  if (!bookingDetails) {
    return (
      <div className="min-h-screen bg-macon-navy-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert className="bg-macon-navy-800 border-white/20">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle className="text-white">No Booking Found</AlertTitle>
            <AlertDescription className="text-white/60">
              We couldn't find a booking associated with this link.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const { booking, canReschedule, canCancel } = bookingDetails;
  const isCancelled = booking.status === 'CANCELED';
  const isRefunded = booking.status === 'REFUNDED';

  return (
    <div className="min-h-screen bg-macon-navy-900">
      {/* Header */}
      <header className="bg-macon-navy-800 border-b border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Page Title */}
          <div>
            <h1 className="text-3xl font-bold text-white">Manage Your Booking</h1>
            <p className="text-white/60 mt-2">
              View your booking details and make changes if needed.
            </p>
          </div>

          {/* Success message for cancelled bookings */}
          {isCancelled && (
            <Alert className="bg-red-900/20 border-red-500/30">
              <CheckCircle className="h-4 w-4 text-red-400" />
              <AlertTitle className="text-red-300">Booking Cancelled</AlertTitle>
              <AlertDescription className="text-red-200/80">
                This booking has been cancelled.
                {booking.refundStatus === 'PENDING' && (
                  <> Your refund is being processed and will arrive within 5-10 business days.</>
                )}
                {booking.refundStatus === 'PROCESSING' && (
                  <> Your refund is currently being processed.</>
                )}
                {booking.refundStatus === 'COMPLETED' && (
                  <> Your refund has been completed.</>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Success message for refunded bookings */}
          {isRefunded && (
            <Alert className="bg-green-900/20 border-green-500/30">
              <CheckCircle className="h-4 w-4 text-green-400" />
              <AlertTitle className="text-green-300">Refund Complete</AlertTitle>
              <AlertDescription className="text-green-200/80">
                Your booking has been refunded. The funds should appear in your account within
                5-10 business days.
              </AlertDescription>
            </Alert>
          )}

          {/* Booking Details Card */}
          <BookingDetailsCard bookingDetails={bookingDetails} />

          {/* Action Buttons */}
          {(canReschedule || canCancel) && (
            <div className="flex flex-wrap gap-4">
              {canReschedule && (
                <RescheduleDialog
                  currentDate={booking.eventDate}
                  isRescheduling={isRescheduling}
                  onReschedule={rescheduleBooking}
                  disabled={isCancelling}
                />
              )}
              {canCancel && (
                <CancelDialog
                  totalCents={booking.totalCents}
                  isCancelling={isCancelling}
                  onCancel={cancelBooking}
                  disabled={isRescheduling}
                />
              )}
            </div>
          )}

          {/* No actions available message */}
          {!canReschedule && !canCancel && !isCancelled && !isRefunded && (
            <Alert className="bg-macon-navy-800 border-white/20">
              <AlertCircle className="h-4 w-4 text-white/60" />
              <AlertTitle className="text-white">No Changes Available</AlertTitle>
              <AlertDescription className="text-white/60">
                This booking can no longer be modified. If you need assistance, please
                contact support.
              </AlertDescription>
            </Alert>
          )}

          {/* Help Section */}
          <div className="bg-macon-navy-800 rounded-lg p-6 border border-white/10">
            <h3 className="text-lg font-medium text-white mb-2">Need Help?</h3>
            <p className="text-white/60 text-sm">
              If you have questions about your booking or need assistance, please contact
              our support team. We're here to help make your event perfect.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-macon-navy-800 border-t border-white/10 mt-12">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <p className="text-center text-white/40 text-sm">
            Powered by Macon AI Solutions
          </p>
        </div>
      </footer>
    </div>
  );
}
