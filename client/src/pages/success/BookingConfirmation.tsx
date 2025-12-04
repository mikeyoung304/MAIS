import { useEffect } from 'react';
import { Calendar, Mail, Users, Package, Plus, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils';
import type { BookingDto, PackageDto } from '@macon/contracts';

interface BookingConfirmationProps {
  booking: BookingDto;
  packageData: PackageDto | null;
}

/**
 * BookingConfirmation - Displays detailed booking information after successful payment
 * Includes confirmation message, booking details, package info, and add-ons
 */
export function BookingConfirmation({ booking, packageData }: BookingConfirmationProps) {
  // Helper to format date with proper timezone handling
  const formatEventDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Celebration animation on mount
  useEffect(() => {
    // Create confetti effect using emoji
    const createConfetti = () => {
      const confettiCount = 50;
      const confettiContainer = document.createElement('div');
      confettiContainer.style.cssText =
        'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden';
      document.body.appendChild(confettiContainer);

      const emojis = ['🎉', '✨', '💍', '💐', '🎊', '💕', '🥂'];

      for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        confetti.style.cssText = `position:absolute;font-size:${20 + Math.random() * 20}px;left:${Math.random() * 100}%;top:-20px;opacity:${0.6 + Math.random() * 0.4};animation:confetti-fall ${2 + Math.random() * 3}s linear forwards`;
        confettiContainer.appendChild(confetti);
      }

      // Add animation keyframes if not already added
      if (!document.getElementById('confetti-animation')) {
        const style = document.createElement('style');
        style.id = 'confetti-animation';
        style.textContent = `
          @keyframes confetti-fall {
            to {
              transform: translateY(100vh) rotate(${360 + Math.random() * 360}deg);
              opacity: 0;
            }
          }
        `;
        document.head.appendChild(style);
      }

      // Clean up after animation
      setTimeout(() => {
        document.body.removeChild(confettiContainer);
      }, 5000);
    };

    createConfetti();
  }, []);

  return (
    <div className="space-y-8">
      {/* Success Message with celebration animation */}
      <div className="p-6 border border-white/20 bg-macon-navy-700 rounded-lg animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 animate-in zoom-in-50 duration-700" />
          <div>
            <p className="text-lg font-medium text-white mb-1">Payment Received!</p>
            <p className="text-base text-white/90">
              Thank you for your booking. We'll send you a confirmation email shortly at{' '}
              <span className="font-medium text-white">{booking.email}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Booking Information */}
      <div className="space-y-6">
        <div>
          <h2 className="font-heading text-2xl font-semibold mb-4 text-white">Booking Details</h2>
          <div className="space-y-4">
            {/* Confirmation Number */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/20">
              <span className="text-base text-white/90">Confirmation Number</span>
              <span className="text-base font-mono font-medium text-white text-right">
                {booking.id}
              </span>
            </div>

            {/* Couple Name */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-base text-white/90">
                <Users className="w-5 h-5" />
                <span>Couple Name</span>
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
                {formatEventDate(booking.eventDate)}
              </span>
            </div>

            {/* Package */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2 text-base text-white/90">
                <Package className="w-5 h-5" />
                <span>Package</span>
              </div>
              <span className="text-base font-medium text-white text-right">
                {packageData ? packageData.title : booking.packageId}
              </span>
            </div>

            {/* Add-ons */}
            {booking.addOnIds.length > 0 && (
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-base text-white/90">
                  <Plus className="w-5 h-5" />
                  <span>Add-ons</span>
                </div>
                <div className="flex flex-col gap-1.5 text-right">
                  {booking.addOnIds.map((addOnId) => {
                    const addOn = packageData?.addOns.find((a) => a.id === addOnId);
                    return (
                      <span key={addOnId} className="text-base text-white">
                        {addOn ? addOn.title : addOnId}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status */}
            <div className="flex items-start justify-between gap-4">
              <span className="text-base text-white/90">Status</span>
              <Badge
                variant="outline"
                className="text-white/70 border-white/30 bg-macon-navy-700 text-base"
              >
                {booking.status}
              </Badge>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-white/20">
              <span className="font-medium text-white text-xl">Total Paid</span>
              <span className="text-3xl font-heading font-semibold text-white">
                {formatCurrency(booking.totalCents)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
