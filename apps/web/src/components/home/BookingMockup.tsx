'use client';

import { Check, ChevronLeft, ChevronRight, Sparkles, Send } from 'lucide-react';

/**
 * BookingMockup - Booking flow with AI assistant chatbot
 *
 * Shows the booking experience with the AI chatbot OPEN and helping.
 * This continues the story from Panel 1 where the chat button was visible.
 *
 * Layout: Side-by-side (60% calendar, 40% chatbot)
 * The chatbot proactively offers to help with booking decisions.
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
    <div className="h-full bg-surface overflow-y-auto flex flex-col">
      {/* Header with selected package */}
      <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.12)_0%,transparent_70%)] px-4 py-2.5 border-b border-neutral-800">
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
            <p className="text-[10px] text-sage font-medium">Score Boost</p>
            <p className="text-xs font-bold text-text-primary">$960</p>
          </div>
        </div>
      </div>

      {/* Progress steps - more compact */}
      <div className="px-4 py-2 border-b border-neutral-800">
        <div className="flex items-center justify-center gap-1">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-sage text-white text-[8px] flex items-center justify-center">
              <Check className="w-2.5 h-2.5" />
            </div>
            <span className="text-[8px] text-sage font-medium">Package</span>
          </div>
          <div className="w-4 h-px bg-sage" />
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-sage text-white text-[8px] flex items-center justify-center font-medium">
              2
            </div>
            <span className="text-[8px] text-text-primary font-medium">Date</span>
          </div>
          <div className="w-4 h-px bg-neutral-700" />
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-500 text-[8px] flex items-center justify-center">
              3
            </div>
            <span className="text-[8px] text-text-muted">Details</span>
          </div>
          <div className="w-4 h-px bg-neutral-700" />
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-500 text-[8px] flex items-center justify-center">
              4
            </div>
            <span className="text-[8px] text-text-muted">Pay</span>
          </div>
        </div>
      </div>

      {/* Main content: Calendar + Chatbot side by side */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left side: Calendar (60%) */}
        <div className="w-[60%] px-3 py-2.5 bg-surface-alt border-r border-neutral-800">
          <div className="bg-surface rounded-xl p-2.5 border border-neutral-800">
            {/* Month header */}
            <div className="flex items-center justify-between mb-2">
              <button className="w-5 h-5 rounded-lg bg-neutral-800 flex items-center justify-center">
                <ChevronLeft className="w-3 h-3 text-text-muted" />
              </button>
              <span className="text-xs font-serif font-semibold text-text-primary">March 2025</span>
              <button className="w-5 h-5 rounded-lg bg-neutral-800 flex items-center justify-center">
                <ChevronRight className="w-3 h-3 text-text-muted" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {days.map((day, i) => (
                <div key={i} className="text-[8px] text-text-muted text-center font-medium py-0.5">
                  {day}
                </div>
              ))}
            </div>

            {/* Date grid */}
            <div className="space-y-0.5">
              {dates.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-0.5">
                  {week.map((date, di) => (
                    <div
                      key={di}
                      className={`w-5 h-5 rounded-md text-[9px] flex items-center justify-center ${
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

          {/* Time slot */}
          <div className="mt-2">
            <p className="text-[9px] text-text-muted mb-1.5 text-center">March 15</p>
            <div className="flex gap-1.5 justify-center">
              <div className="px-2.5 py-1 bg-sage/15 border border-sage rounded-lg text-[9px] text-sage font-medium">
                All Day
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Chatbot panel (40%) - OPEN */}
        <div className="w-[40%] flex flex-col bg-surface">
          {/* Chatbot header */}
          <div className="px-2.5 py-2 border-b border-neutral-800 bg-sage/5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-sage" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-surface" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-text-primary">Booking Assistant</p>
                <p className="text-[8px] text-sage">Here to help</p>
              </div>
            </div>
          </div>

          {/* Chat messages */}
          <div className="flex-1 px-2 py-2 overflow-auto space-y-2">
            {/* AI message */}
            <div className="flex gap-1.5">
              <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-2.5 h-2.5 text-sage" />
              </div>
              <div className="bg-sage/10 rounded-xl rounded-tl-sm px-2.5 py-2 max-w-[95%]">
                <p className="text-[9px] text-text-primary leading-relaxed">
                  Hey! I see you're booking with Alex. 👋
                </p>
                <p className="text-[9px] text-text-primary leading-relaxed mt-1.5">
                  Any questions about the Score Boost package? I can help you pick the perfect time.
                </p>
              </div>
            </div>

            {/* Suggested questions */}
            <div className="pl-6 space-y-1">
              <button className="w-full text-left px-2 py-1.5 bg-neutral-800/50 hover:bg-neutral-800 rounded-lg text-[8px] text-text-muted transition-colors border border-neutral-700/50">
                What's included in 8 sessions?
              </button>
              <button className="w-full text-left px-2 py-1.5 bg-neutral-800/50 hover:bg-neutral-800 rounded-lg text-[8px] text-text-muted transition-colors border border-neutral-700/50">
                Can I reschedule if needed?
              </button>
            </div>
          </div>

          {/* Chat input */}
          <div className="px-2 py-2 border-t border-neutral-800">
            <div className="flex items-center gap-1.5 bg-neutral-800 rounded-full px-2.5 py-1.5 border border-neutral-700">
              <input
                type="text"
                placeholder="Ask anything..."
                className="flex-1 bg-transparent text-[9px] text-text-primary placeholder-text-muted focus:outline-none min-w-0"
                readOnly
              />
              <button className="w-5 h-5 bg-sage rounded-full flex items-center justify-center flex-shrink-0">
                <Send className="w-2.5 h-2.5 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
