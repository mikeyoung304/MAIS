'use client';

import {
  Check,
  ChevronRight,
  Calendar,
  Clock,
  Package,
  ClipboardList,
  MessageSquare,
} from 'lucide-react';

/**
 * ClientHubMockupTutor - Alex Chen themed client hub mockup
 *
 * Shows what clients see after booking: upcoming sessions, tasks, messaging.
 * Themed for Alex Chen tutoring to maintain visual consistency across
 * all 3 carousel slides (storefront → booking → hub).
 *
 * Note: There's also a wedding-themed ClientHubMockup for Sarah Williams,
 * but this component specifically shows the tutoring use case.
 */
export function ClientHubMockupTutor() {
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
