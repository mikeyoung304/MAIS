'use client';

import { useRef } from 'react';
import { DemoStorefrontShowcase } from './DemoStorefrontShowcase';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Package,
  ClipboardList,
  MessageSquare,
  ArrowDown,
} from 'lucide-react';

/**
 * JourneyShowcase - Scrolling showcase of the complete client journey
 *
 * Shows three stages vertically:
 * 1. Storefront - "They find you"
 * 2. Booking - "They book you"
 * 3. Client Hub - "Everything lives here"
 *
 * Reuses existing mockups from ProductPreviewTabs for consistency.
 */

/** Booking flow mockup - extracted from ProductPreviewTabs */
function BookingMockup() {
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

/** Client Hub mockup - shows what clients see after booking */
function ClientHubMockup() {
  return (
    <div className="h-full bg-surface overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.15)_0%,transparent_70%)] px-4 py-2.5 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sage to-emerald-600 flex items-center justify-center">
              <span className="text-white font-semibold text-xs">AC</span>
            </div>
            <div>
              <h3 className="font-serif text-xs font-semibold text-text-primary">
                Your Tutoring Sessions
              </h3>
              <p className="text-[9px] text-text-muted">Alex Chen • Math &amp; Science</p>
            </div>
          </div>
          <div className="px-2 py-1 bg-sage/15 border border-sage/30 rounded-full">
            <span className="text-[9px] text-sage font-semibold flex items-center gap-1">
              <Check className="w-2.5 h-2.5" />
              Confirmed
            </span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column */}
        <div className="flex-1 px-3 py-2.5 bg-surface-alt overflow-auto border-r border-neutral-800">
          {/* What's Coming Up */}
          <div className="mb-3">
            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-sage" />
              What&apos;s Coming Up
            </h4>
            <div className="bg-surface rounded-xl p-2.5 border border-neutral-800">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold text-text-primary">First Session</p>
                <span className="text-[9px] text-sage font-medium">In 5 days</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Mar 15
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  4:00 PM
                </span>
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3" />1 of 4
                </span>
              </div>
            </div>
          </div>

          {/* Things to Do */}
          <div>
            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <ClipboardList className="w-3 h-3 text-amber-500" />
              Things to Do
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-2 bg-surface rounded-lg border border-amber-500/30">
                <div className="w-6 h-6 bg-amber-500/15 rounded-md flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-3 h-3 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-text-primary truncate">
                    Learning goals questionnaire
                  </p>
                  <p className="text-[8px] text-amber-500">3 min • Helps Alex prepare</p>
                </div>
                <ChevronRight className="w-3 h-3 text-amber-500" />
              </div>

              <div className="flex items-center gap-2 p-2 bg-surface rounded-lg border border-neutral-800 opacity-60">
                <div className="w-6 h-6 bg-emerald-500/15 rounded-md flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-text-primary truncate line-through">
                    Payment completed
                  </p>
                  <p className="text-[8px] text-text-muted">$320 • Mar 10</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Assistant */}
        <div className="w-[45%] flex flex-col bg-surface">
          <div className="px-3 py-2 border-b border-neutral-800 bg-sage/5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-sage" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-surface" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-text-primary">Message</p>
                <p className="text-[8px] text-sage">Always here</p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-2.5 py-2 overflow-auto space-y-2">
            <div className="flex gap-1.5">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-sage to-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-[8px] font-semibold">AC</span>
              </div>
              <div className="bg-sage/10 rounded-xl rounded-tl-sm px-2.5 py-1.5 max-w-[90%]">
                <p className="text-[9px] text-text-primary leading-relaxed">
                  Hi! Questions about the session? Need to reschedule? I&apos;m here anytime.
                </p>
              </div>
            </div>
          </div>

          <div className="px-2.5 py-2 border-t border-neutral-800">
            <div className="flex items-center gap-1.5 bg-neutral-800 rounded-full px-3 py-1.5 border border-neutral-700">
              <input
                type="text"
                placeholder="Ask anything..."
                className="flex-1 bg-transparent text-[10px] text-text-primary placeholder-text-muted focus:outline-none"
                readOnly
              />
              <button className="w-5 h-5 bg-sage rounded-full flex items-center justify-center flex-shrink-0">
                <ChevronRight className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StageProps {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
  isLast?: boolean;
}

function Stage({ number, title, description, children, isLast = false }: StageProps) {
  return (
    <div className="relative">
      {/* Stage header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-sage/10 border border-sage/30 flex items-center justify-center">
            <span className="text-sage font-serif text-lg font-bold">{number}</span>
          </div>
          <h3 className="font-serif text-2xl font-bold text-text-primary">{title}</h3>
        </div>
        <p className="text-text-muted max-w-md mx-auto">{description}</p>
      </div>

      {/* Mockup in browser frame */}
      <div className="bg-surface-alt rounded-2xl border border-neutral-800 overflow-hidden max-w-lg mx-auto">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 bg-neutral-800/50 border-b border-neutral-800">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-neutral-700" />
            <div className="w-3 h-3 rounded-full bg-neutral-700" />
            <div className="w-3 h-3 rounded-full bg-neutral-700" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-neutral-800 rounded-md px-3 py-1 text-xs text-text-muted max-w-xs mx-auto text-center">
              yourname.gethandled.ai
            </div>
          </div>
        </div>

        {/* Mockup content - taller aspect ratio to avoid cropping vertically-oriented content */}
        <div className="aspect-[4/5]">{children}</div>
      </div>

      {/* Arrow connector */}
      {!isLast && (
        <div className="flex justify-center py-8">
          <div className="w-10 h-10 rounded-full bg-surface-alt border border-neutral-800 flex items-center justify-center">
            <ArrowDown className="w-5 h-5 text-sage" />
          </div>
        </div>
      )}
    </div>
  );
}

export function JourneyShowcase() {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={scrollRef} className="space-y-4">
      <Stage
        number="1"
        title="They find your storefront"
        description="A polished page that showcases your work and makes pricing clear."
      >
        <DemoStorefrontShowcase compact />
      </Stage>

      <Stage
        number="2"
        title="They book you"
        description="Select a package, pick a date, pay—all in one smooth flow."
      >
        <BookingMockup />
      </Stage>

      <Stage
        number="3"
        title="Everything lives in one hub"
        description="Questions, files, updates, rebooking—clients return here forever."
        isLast
      >
        <ClientHubMockup />
      </Stage>
    </div>
  );
}
