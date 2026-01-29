'use client';

import { Check, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * BookingMockup - Booking flow mockup for journey carousel
 *
 * Shows the booking experience: package selection → date picking → payment.
 * Hardcoded to Alex Chen "Grade Boost" package for consistency with hero.
 *
 * Extracted from JourneyShowcase for reusability and cleaner code organization.
 */
export function BookingMockup() {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dates = [
    [null, null, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24, 25, 26],
  ];

  return (
    <div className="h-full bg-surface overflow-hidden flex flex-col">
      {/* Header with selected package */}
      <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.12)_0%,transparent_70%)] px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sage to-emerald-600 flex items-center justify-center">
              <span className="text-white font-semibold text-[10px]">AC</span>
            </div>
            <div>
              <p className="text-[10px] text-text-muted">Booking with</p>
              <p className="text-xs font-medium text-text-primary">Alex Chen</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-sage font-medium">Grade Boost</p>
            <p className="text-xs font-bold text-text-primary">$320</p>
          </div>
        </div>
      </div>

      {/* Progress steps */}
      <div className="px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center justify-center gap-1">
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-sage text-white text-[9px] flex items-center justify-center">
              <Check className="w-3 h-3" />
            </div>
            <span className="text-[9px] text-sage font-medium">Package</span>
          </div>
          <div className="w-6 h-px bg-sage" />
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-sage text-white text-[9px] flex items-center justify-center font-medium">
              2
            </div>
            <span className="text-[9px] text-text-primary font-medium">Date</span>
          </div>
          <div className="w-6 h-px bg-neutral-700" />
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-500 text-[9px] flex items-center justify-center">
              3
            </div>
            <span className="text-[9px] text-text-muted">Details</span>
          </div>
          <div className="w-6 h-px bg-neutral-700" />
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-500 text-[9px] flex items-center justify-center">
              4
            </div>
            <span className="text-[9px] text-text-muted">Pay</span>
          </div>
        </div>
      </div>

      {/* Calendar section */}
      <div className="flex-1 px-4 py-3 bg-surface-alt">
        <div className="bg-surface rounded-xl p-3 border border-neutral-800">
          {/* Month header */}
          <div className="flex items-center justify-between mb-3">
            <button className="w-6 h-6 rounded-lg bg-neutral-800 flex items-center justify-center">
              <ChevronLeft className="w-3.5 h-3.5 text-text-muted" />
            </button>
            <span className="text-sm font-serif font-semibold text-text-primary">March 2025</span>
            <button className="w-6 h-6 rounded-lg bg-neutral-800 flex items-center justify-center">
              <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {days.map((day, i) => (
              <div key={i} className="text-[9px] text-text-muted text-center font-medium py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Date grid */}
          <div className="space-y-1">
            {dates.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {week.map((date, di) => (
                  <div
                    key={di}
                    className={`w-6 h-6 rounded-lg text-[10px] flex items-center justify-center ${
                      date === null
                        ? ''
                        : date === 15
                          ? 'bg-sage text-white font-semibold shadow-md shadow-sage/30'
                          : date < 10
                            ? 'text-neutral-600'
                            : 'bg-neutral-800 text-text-primary border border-neutral-700'
                    }`}
                  >
                    {date}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Time slots */}
        <div className="mt-3">
          <p className="text-[10px] text-text-muted mb-2 text-center">Available on March 15</p>
          <div className="flex gap-2 justify-center">
            <div className="px-3 py-1.5 bg-sage/15 border border-sage rounded-lg text-[10px] text-sage font-medium">
              All Day
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="px-4 py-2.5 bg-surface border-t border-neutral-800">
        <button className="w-full py-2 bg-sage text-white text-[11px] font-semibold rounded-full flex items-center justify-center gap-1.5">
          Continue to Details
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
