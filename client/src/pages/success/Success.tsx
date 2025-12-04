import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Container } from '@/ui/Container';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useBookingConfirmation } from './hooks/useBookingConfirmation';
import { SuccessContent } from './SuccessContent';

/**
 * Success Page - Displays booking confirmation after checkout
 * Supports both real Stripe payments and mock mode simulation
 * Handles loading states, errors, and displays booking details
 */
export function Success() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const bookingIdParam = searchParams.get('booking_id');

  const [bookingId, setBookingId] = useState<string | null>(bookingIdParam);

  const { bookingDetails, packageData, isLoading, error } = useBookingConfirmation({
    bookingId,
  });

  const handleBookingCreated = (newBookingId: string) => {
    setBookingId(newBookingId);
  };

  const showSuccessIcon = !!bookingDetails;
  const isPaidOrConfirmed = bookingDetails || bookingId;

  return (
    <Container className="py-12 md:py-20">
      <Card className="max-w-3xl mx-auto bg-macon-navy-800 border-white/20 shadow-lg">
        <CardHeader className="text-center space-y-4 pb-8">
          <div className="flex justify-center">
            <div
              className={cn(
                'inline-flex items-center justify-center w-16 h-16 rounded-full transition-colors bg-macon-navy-700'
              )}
            >
              {showSuccessIcon ? (
                <CheckCircle className="w-8 h-8 text-white/60" />
              ) : (
                <AlertCircle className="w-8 h-8 text-white/70" />
              )}
            </div>
          </div>
          <CardTitle className="font-heading text-4xl md:text-5xl text-white">
            {bookingDetails
              ? 'Booking Confirmed!'
              : isPaidOrConfirmed
                ? 'Booking Confirmed!'
                : 'Almost There!'}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <SuccessContent
            sessionId={sessionId}
            bookingDetails={bookingDetails}
            packageData={packageData}
            isLoading={isLoading}
            error={error}
            onBookingCreated={handleBookingCreated}
          />
        </CardContent>

        {/* Footer with Action Button */}
        {isPaidOrConfirmed && (
          <CardFooter className="justify-center pt-6">
            <Button
              asChild
              className="bg-macon-navy hover:bg-macon-navy-dark text-white text-xl h-14 px-8"
            >
              <Link to="/">Back to Home</Link>
            </Button>
          </CardFooter>
        )}
      </Card>
    </Container>
  );
}
