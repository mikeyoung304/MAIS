'use client';

import {
  Check,
  ChevronRight,
  Calendar,
  Clock,
  Package,
  ClipboardList,
  Sparkles,
  Send,
} from 'lucide-react';

/**
 * ClientHubMockupTutor - Post-booking client hub with AI assistant
 *
 * Shows what clients see after booking: upcoming sessions, tasks, messaging.
 * The AI assistant is prominent, continuing the story from Panels 1 & 2.
 *
 * Optimizations:
 * - Compact spacing for better information density
 * - AI assistant given more prominence (continuing the chatbot story)
 * - Clear visual hierarchy
 */
export function ClientHubMockupTutor() {
  return (
    <div className="h-full bg-surface overflow-hidden flex flex-col">
      {/* Compact Header */}
      <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.15)_0%,transparent_70%)] px-3 py-2 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sage to-emerald-600 flex items-center justify-center">
              <span className="text-white font-semibold text-[10px]">AC</span>
            </div>
            <div>
              <h3 className="font-serif text-[11px] font-semibold text-text-primary">
                Your SAT Prep
              </h3>
              <p className="text-[8px] text-text-muted">Alex Chen • SAT Specialist</p>
            </div>
          </div>
          <div className="px-1.5 py-0.5 bg-sage/15 border border-sage/30 rounded-full">
            <span className="text-[8px] text-sage font-semibold flex items-center gap-0.5">
              <Check className="w-2 h-2" />
              Booked
            </span>
          </div>
        </div>
      </div>

      {/* Main content - 55/45 split for better balance */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column - Upcoming + Tasks */}
        <div className="w-[55%] px-2.5 py-2 bg-surface-alt overflow-auto border-r border-neutral-800">
          {/* What's Coming Up */}
          <div className="mb-2.5">
            <h4 className="text-[9px] font-semibold text-text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-sage" />
              Coming Up
            </h4>
            <div className="bg-surface rounded-lg p-2 border border-neutral-800">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold text-text-primary">Diagnostic Session</p>
                <span className="text-[8px] text-sage font-medium">In 3 days</span>
              </div>
              <div className="flex items-center gap-2.5 text-[9px] text-text-muted">
                <span className="flex items-center gap-0.5">
                  <Calendar className="w-2.5 h-2.5" />
                  Mar 15
                </span>
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  4:00 PM
                </span>
                <span className="flex items-center gap-0.5">
                  <Package className="w-2.5 h-2.5" />1 of 8
                </span>
              </div>
            </div>
          </div>

          {/* Things to Do */}
          <div>
            <h4 className="text-[9px] font-semibold text-text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <ClipboardList className="w-3 h-3 text-amber-500" />
              To Do
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-1.5 bg-surface rounded-lg border border-amber-500/30">
                <div className="w-5 h-5 bg-amber-500/15 rounded flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-2.5 h-2.5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-medium text-text-primary truncate">
                    Take practice SAT
                  </p>
                  <p className="text-[7px] text-amber-500">Before session</p>
                </div>
                <ChevronRight className="w-3 h-3 text-amber-500 flex-shrink-0" />
              </div>

              <div className="flex items-center gap-2 p-1.5 bg-surface rounded-lg border border-neutral-800 opacity-60">
                <div className="w-5 h-5 bg-emerald-500/15 rounded flex items-center justify-center flex-shrink-0">
                  <Check className="w-2.5 h-2.5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-medium text-text-primary truncate line-through">
                    Payment completed
                  </p>
                  <p className="text-[7px] text-text-muted">$960 • Mar 10</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: AI Assistant - 45%, more prominent */}
        <div className="w-[45%] flex flex-col bg-surface">
          <div className="px-2.5 py-2 border-b border-neutral-800 bg-sage/5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-sage" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-surface" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-text-primary">Your Assistant</p>
                <p className="text-[8px] text-sage">Always here</p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-2 py-2 overflow-auto space-y-2">
            {/* AI welcome message */}
            <div className="flex gap-1.5">
              <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Sparkles className="w-2.5 h-2.5 text-sage" />
              </div>
              <div className="bg-sage/10 rounded-xl rounded-tl-sm px-2.5 py-1.5 max-w-[90%]">
                <p className="text-[9px] text-text-primary leading-relaxed">
                  You're all set for your first session! 🎉
                </p>
                <p className="text-[9px] text-text-primary leading-relaxed mt-1">
                  Don't forget to take that practice SAT before Saturday.
                </p>
              </div>
            </div>

            {/* Quick action */}
            <div className="pl-6">
              <button className="w-full text-left px-2 py-1.5 bg-sage/10 hover:bg-sage/15 rounded-lg text-[8px] text-sage font-medium transition-colors border border-sage/20">
                📝 Start practice test now
              </button>
            </div>
          </div>

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
