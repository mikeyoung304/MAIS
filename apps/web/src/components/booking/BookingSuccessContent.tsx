import Link from 'next/link';
import { CheckCircle, Calendar, Mail, Users, Package as PackageIcon, Home } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';

interface BookingData {
  id: string;
  email: string;
  coupleName: string;
  eventDate: string;
  tierId: string;
  status: string;
  totalCents: number;
}

interface BookingSuccessContentProps {
  tenant: { name: string };
  booking: BookingData | null;
  tierTitle: string | null;
  homeUrl: string;
  contactUrl: string;
}

/**
 * Shared booking success content used by both [slug] and _domain routes.
 *
 * Each route page resolves the tenant, handles session_id→project redirect,
 * fetches booking details, then delegates all UI rendering to this component.
 */
export function BookingSuccessContent({
  tenant,
  booking,
  tierTitle,
  homeUrl,
  contactUrl,
}: BookingSuccessContentProps) {
  return (
    <div className="min-h-screen bg-neutral-50 py-12 md:py-20">
      <div className="container max-w-3xl mx-auto px-4">
        <Card colorScheme="navy" className="shadow-xl">
          <CardHeader className="text-center space-y-4 pb-8">
            {/* Success Icon */}
            <div className="flex justify-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>
            <CardTitle className="text-4xl md:text-5xl text-white">Booking Confirmed!</CardTitle>
          </CardHeader>

          <CardContent className="space-y-8">
            {/* Success Message */}
            <div className="p-6 border border-white/20 bg-white/5 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 mt-0.5" />
                <div>
                  <p className="text-lg font-medium text-white mb-1">Payment Received!</p>
                  <p className="text-base text-white/90">
                    Thank you for your booking with {tenant.name}.
                    {booking?.email && (
                      <>
                        {' '}
                        We&apos;ll send you a confirmation email shortly at{' '}
                        <span className="font-medium text-white">{booking.email}</span>.
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Booking Details */}
            {booking ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold text-white">Booking Details</h2>
                <div className="space-y-4">
                  {/* Confirmation Number */}
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/20">
                    <span className="text-base text-white/90">Confirmation Number</span>
                    <span className="text-base font-mono font-medium text-white text-right">
                      {booking.id}
                    </span>
                  </div>

                  {/* Customer Name */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 text-base text-white/90">
                      <Users className="w-5 h-5" />
                      <span>Name</span>
                    </div>
                    <span className="text-base font-medium text-white text-right">
                      {booking.coupleName}
                    </span>
                  </div>

                  {/* Email */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 text-base text-white/90">
                      <Mail className="w-5 h-5" />
                      <span>Email</span>
                    </div>
                    <span className="text-base text-white text-right">{booking.email}</span>
                  </div>

                  {/* Event Date */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 text-base text-white/90">
                      <Calendar className="w-5 h-5" />
                      <span>Event Date</span>
                    </div>
                    <span className="text-base font-medium text-white text-right">
                      {formatDate(booking.eventDate)}
                    </span>
                  </div>

                  {/* Service */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 text-base text-white/90">
                      <PackageIcon className="w-5 h-5" />
                      <span>Service</span>
                    </div>
                    <span className="text-base font-medium text-white text-right">
                      {tierTitle || booking.tierId}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="flex items-start justify-between gap-4">
                    <span className="text-base text-white/90">Status</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-500/20 text-green-300 border border-green-500/30">
                      {booking.status}
                    </span>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/20">
                    <span className="font-medium text-white text-xl">Total Paid</span>
                    <span className="text-3xl font-bold text-white">
                      {formatCurrency(booking.totalCents)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-white/70">
                  Your booking has been confirmed. You should receive a confirmation email shortly.
                </p>
              </div>
            )}
          </CardContent>

          {/* Footer with Action Buttons */}
          <CardFooter className="flex-col gap-4 pt-6">
            <Button asChild variant="sage" size="xl">
              <Link href={homeUrl} className="flex items-center gap-2">
                <Home className="w-5 h-5" />
                Back to {tenant.name}
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Additional Info */}
        <div className="mt-8 text-center text-neutral-600 text-sm">
          <p>
            Questions about your booking?{' '}
            <Link href={contactUrl} className="text-sage hover:underline">
              Contact us
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
