'use client';

import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * BookingMockup - Simulated booking flow UI for product showcase
 *
 * Shows a calendar date picker with package selection and progress steps.
 * Memoized since content is static.
 *
 * Accessibility:
 * - All interactive-looking elements are divs with aria-hidden
 * - Input elements have tabIndex={-1} to prevent focus
 */
export const BookingMockup = memo(function BookingMockup() {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dates = [
    [null, null, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24, 25, 26],
  ];

  return (
    <div className="h-full bg-surface overflow-hidden flex flex-col">
      <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.12)_0%,transparent_70%)] px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
              <span className="text-sage font-semibold text-[10px]">SW</span>
            </div>
            <div>
              <p className="text-[10px] text-text-muted">Booking with</p>
              <p className="text-xs font-medium text-text-primary">Sarah Williams</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-sage font-medium">Full Day Coverage</p>
            <p className="text-xs font-bold text-text-primary">$3,200</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center justify-center gap-1">
          {[
            { num: '✓', label: 'Package', done: true, active: false },
            { num: '2', label: 'Date', done: false, active: true },
            { num: '3', label: 'Details', done: false, active: false },
            { num: '4', label: 'Pay', done: false, active: false },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && (
                <div
                  className={`w-6 h-px ${step.active || step.done ? 'bg-sage' : 'bg-neutral-700'}`}
                />
              )}
              <div className="flex items-center gap-1">
                <div
                  className={`w-5 h-5 rounded-full text-[9px] flex items-center justify-center font-medium ${
                    step.done
                      ? 'bg-sage text-white'
                      : step.active
                        ? 'bg-sage text-white'
                        : 'bg-neutral-800 border border-neutral-700 text-neutral-500'
                  }`}
                >
                  {step.done ? '✓' : step.num}
                </div>
                <span
                  className={`text-[9px] ${step.active ? 'text-text-primary font-medium' : step.done ? 'text-sage font-medium' : 'text-text-muted'}`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 py-3 bg-surface-alt">
        <div className="bg-surface rounded-xl p-3 border border-neutral-800">
          <div className="flex items-center justify-between mb-3" aria-hidden="true">
            <div className="w-6 h-6 rounded-lg bg-neutral-800 flex items-center justify-center">
              <ChevronLeft className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
            </div>
            <span className="text-sm font-serif font-semibold text-text-primary">March 2025</span>
            <div className="w-6 h-6 rounded-lg bg-neutral-800 flex items-center justify-center">
              <ChevronRight className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {days.map((day, i) => (
              <div key={i} className="text-[9px] text-text-muted text-center font-medium py-1">
                {day}
              </div>
            ))}
          </div>

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

        <div className="mt-3">
          <p className="text-[10px] text-text-muted mb-2 text-center">Available on March 15</p>
          <div className="flex gap-2 justify-center">
            <div className="px-3 py-1.5 bg-sage/15 border border-sage rounded-lg text-[10px] text-sage font-medium">
              All Day
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-2.5 bg-surface border-t border-neutral-800" aria-hidden="true">
        <div className="w-full py-2 bg-sage text-white text-[11px] font-semibold rounded-full flex items-center justify-center gap-1.5">
          Continue to Details
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </div>
        {/* Stripe trust badge */}
        <div className="flex items-center justify-center gap-1.5 mt-2 text-[9px] text-text-muted">
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>Secure payments via</span>
          <span className="font-semibold text-text-primary">Stripe</span>
        </div>
      </div>
    </div>
  );
});
BookingMockup.displayName = 'BookingMockup';
