import { useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { baseUrl } from '@/lib/api';
import { logger } from '@/lib/logger';
import type { LastCheckout } from '@/lib/types';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { BookingConfirmation } from './BookingConfirmation';
import type { BookingDto, PackageDto } from '@macon/contracts';

interface SuccessContentProps {
  sessionId: string | null;
  bookingDetails: BookingDto | null;
  packageData: PackageDto | null;
  isLoading: boolean;
  error: string | null;
  onBookingCreated: (bookingId: string) => void;
}

/**
 * SuccessContent - Main content area of the success page
 * Handles mock mode simulation, loading states, errors, and booking display
 */
export function SuccessContent({
  sessionId,
  bookingDetails,
  packageData,
  isLoading,
  error,
  onBookingCreated,
}: SuccessContentProps) {
  const [isPaid, setIsPaid] = useState(!!bookingDetails);
  const [isSimulating, setIsSimulating] = useState(false);

  const isMockMode = import.meta.env.VITE_APP_MODE === 'mock';
  const showMockButton = isMockMode && sessionId && !isPaid && !bookingDetails;

  const handleMarkAsPaid = async () => {
    if (!sessionId) return;

    setIsSimulating(true);
    try {
      // Get checkout data from localStorage
      const lastCheckoutStr = localStorage.getItem('lastCheckout');
      if (!lastCheckoutStr) {
        toast.error('No checkout data found', {
          description: 'Please try booking again.',
        });
        return;
      }

      const checkoutData: LastCheckout = JSON.parse(lastCheckoutStr);

      // POST to /v1/dev/simulate-checkout-completed
      const response = await fetch(`${baseUrl}/v1/dev/simulate-checkout-completed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          packageId: checkoutData.packageId,
          eventDate: checkoutData.eventDate,
          email: checkoutData.email,
          coupleName: checkoutData.coupleName,
          addOnIds: checkoutData.addOnIds,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setIsPaid(true);
        // Clear localStorage after successful simulation
        localStorage.removeItem('lastCheckout');

        // Fetch booking details using the returned bookingId
        if (result.bookingId) {
          onBookingCreated(result.bookingId);
        }
      } else {
        toast.error('Failed to simulate payment', {
          description: 'Please try again or contact support.',
        });
      }
    } catch (err) {
      logger.error('Simulation error', { error: err, component: 'SuccessContent', sessionId });
      toast.error('An error occurred during simulation', {
        description: 'Please try again or contact support.',
      });
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mock Mode Button */}
      {showMockButton && (
        <div className="p-6 border border-white/20 bg-macon-navy-700 rounded-lg">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-white/70 mt-0.5" />
            <div>
              <p className="text-lg font-medium text-white mb-1">Mock Mode Active</p>
              <p className="text-base text-white/90">Click below to simulate payment completion</p>
            </div>
          </div>
          <Button
            onClick={handleMarkAsPaid}
            disabled={isSimulating}
            variant="outline"
            className="w-full border-white/20 text-white/90 hover:bg-macon-navy-600 text-lg h-12"
            data-testid="mock-paid"
          >
            {isSimulating ? 'Simulating...' : 'Mark as Paid (mock)'}
          </Button>
        </div>
      )}

      {/* Mock Mode Success Message */}
      {isPaid && isMockMode && !bookingDetails && (
        <div className="p-6 border border-white/20 bg-macon-navy-700 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-white/60 mt-0.5" />
            <div>
              <p className="text-lg font-medium text-white mb-1">
                Payment simulation completed successfully!
              </p>
              <p className="text-base text-white/90">
                Your booking has been created in the system.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && <LoadingState />}

      {/* Error Message */}
      {error && <ErrorState error={error} />}

      {/* Booking Details */}
      {bookingDetails && <BookingConfirmation booking={bookingDetails} packageData={packageData} />}

      {/* Pending Payment Message */}
      {!bookingDetails && !isLoading && !isPaid && (
        <div className="text-center py-8">
          <p className="text-white/90 text-lg">
            Please complete the payment to confirm your booking.
          </p>
        </div>
      )}

      {/* Help Text */}
      {!isPaid && !showMockButton && !bookingDetails && (
        <div className="text-center pt-4">
          <p className="text-base text-white/90">
            If you have any questions, please don't hesitate to contact us.
          </p>
        </div>
      )}
    </div>
  );
}
