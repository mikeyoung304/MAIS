/**
 * Booking Details Card Component
 * Displays booking information in a styled card
 */

import { Calendar, Mail, User, Package, DollarSign, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, getStatusVariant, getRefundStatusText } from '@/lib/utils';
import type { BookingDetails } from './hooks/useBookingManagement';

interface BookingDetailsCardProps {
  bookingDetails: BookingDetails;
}

export function BookingDetailsCard({ bookingDetails }: BookingDetailsCardProps) {
  const { booking, packageTitle, addOnTitles } = bookingDetails;
  const refundStatusText = getRefundStatusText(booking.refundStatus);

  return (
    <Card className="bg-macon-navy-800 border-white/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl text-white">Booking Details</CardTitle>
          <Badge variant={getStatusVariant(booking.status)}>{booking.status}</Badge>
        </div>
        {refundStatusText && <p className="text-sm text-yellow-400">{refundStatusText}</p>}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Event Date - Highlighted */}
        <div className="bg-macon-navy-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-macon-gold" />
            <div>
              <p className="text-sm text-white/60">Event Date</p>
              <p className="text-xl font-semibold text-white">
                {formatDate(booking.eventDate.toString())}
              </p>
            </div>
          </div>
        </div>

        {/* Customer Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-white/60" />
            <div>
              <p className="text-sm text-white/60">Names</p>
              <p className="text-white">{booking.coupleName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-white/60" />
            <div>
              <p className="text-sm text-white/60">Email</p>
              <p className="text-white">{booking.email}</p>
            </div>
          </div>
        </div>

        {/* Package Info */}
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-white/60" />
          <div>
            <p className="text-sm text-white/60">Package</p>
            <p className="text-white font-medium">{packageTitle}</p>
          </div>
        </div>

        {/* Add-ons */}
        {addOnTitles.length > 0 && (
          <div className="flex items-start gap-3">
            <Package className="w-5 h-5 text-white/60 mt-1" />
            <div>
              <p className="text-sm text-white/60">Add-ons</p>
              <ul className="text-white">
                {addOnTitles.map((title, i) => (
                  <li key={i}>{title}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/10">
          <DollarSign className="w-5 h-5 text-white/60" />
          <div>
            <p className="text-sm text-white/60">Total Paid</p>
            <p className="text-xl font-semibold text-white">{formatCurrency(booking.totalCents)}</p>
          </div>
        </div>

        {/* Refund Amount if applicable */}
        {booking.refundAmount && (
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-sm text-white/60">Refund Amount</p>
              <p className="text-lg font-semibold text-green-400">
                {formatCurrency(booking.refundAmount)}
              </p>
            </div>
          </div>
        )}

        {/* Booking ID */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/10">
          <Clock className="w-5 h-5 text-white/40" />
          <div>
            <p className="text-xs text-white/40">Booking ID: {booking.id}</p>
          </div>
        </div>

        {/* Cancellation Info */}
        {booking.status === 'CANCELED' && (
          <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/30">
            <p className="text-sm text-red-300">
              This booking was cancelled
              {booking.cancelledBy && ` by ${booking.cancelledBy.toLowerCase()}`}
              {booking.cancellationReason && `: "${booking.cancellationReason}"`}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
