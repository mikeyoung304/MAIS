'use client';

import { memo } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * ClientHubMockup - Simulated client portal UI for product showcase
 *
 * Shows upcoming appointments, tasks, and AI assistant chat.
 * Memoized since content is static.
 *
 * Accessibility:
 * - All interactive-looking elements are divs with aria-hidden
 * - Input elements have tabIndex={-1} to prevent focus
 */
export const ClientHubMockup = memo(function ClientHubMockup() {
  return (
    <div className="h-full bg-surface overflow-hidden flex flex-col">
      <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.15)_0%,transparent_70%)] px-4 py-2.5 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
              <span className="text-sage font-semibold text-xs">SW</span>
            </div>
            <div>
              <h3 className="font-serif text-xs font-semibold text-text-primary">
                Your Wedding Photos
              </h3>
              <p className="text-[9px] text-text-muted">Sarah Williams Photography</p>
            </div>
          </div>
          <div className="px-2 py-1 bg-sage/15 border border-sage/30 rounded-full">
            <span className="text-[9px] text-sage font-semibold flex items-center gap-1">
              ✓ Confirmed
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 px-3 py-2.5 bg-surface-alt overflow-auto border-r border-neutral-800">
          <div className="mb-3">
            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              📅 What&apos;s Coming Up
            </h4>
            <div className="bg-surface rounded-xl p-2.5 border border-neutral-800">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[11px] font-semibold text-text-primary">Wedding Day</p>
                <span className="text-[9px] text-sage font-medium">In 2 weeks</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <span>📅 Mar 15</span>
                <span>🕐 9:00 AM</span>
                <span>📦 Full Day</span>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              📋 Things to Do
            </h4>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 p-2 bg-surface rounded-lg border border-amber-500/30">
                <div className="w-6 h-6 bg-amber-500/15 rounded-md flex items-center justify-center flex-shrink-0">
                  <span className="text-amber-500 text-[10px]">📋</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-text-primary truncate">
                    Shot list preferences
                  </p>
                  <p className="text-[8px] text-amber-500">3 min • Share your vision</p>
                </div>
                <ChevronRight className="w-3 h-3 text-amber-500" aria-hidden="true" />
              </div>

              <div className="flex items-center gap-2 p-2 bg-surface rounded-lg border border-neutral-800 opacity-60">
                <div className="w-6 h-6 bg-emerald-500/15 rounded-md flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-500 text-[10px]">✓</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-text-primary truncate line-through">
                    Deposit paid
                  </p>
                  <p className="text-[8px] text-text-muted">$1,600 • Mar 1</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="w-[45%] flex flex-col bg-surface">
          <div className="px-3 py-2 border-b border-neutral-800 bg-sage/5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
                  <span className="text-sage text-[10px]">💬</span>
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-surface" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-text-primary">Your Assistant</p>
                <p className="text-[8px] text-emerald-500 font-medium">Online</p>
              </div>
            </div>
          </div>

          <div className="flex-1 px-2.5 py-2 overflow-auto space-y-2">
            <div className="flex gap-1.5">
              <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sage text-[8px] font-semibold">AI</span>
              </div>
              <div className="bg-sage/10 rounded-xl rounded-tl-sm px-2.5 py-1.5 max-w-[90%]">
                <p className="text-[9px] text-text-primary leading-relaxed">
                  Hi! I&apos;m here to help with your session. Need to reschedule? Just ask.
                </p>
              </div>
            </div>
          </div>

          <div className="px-2.5 py-2 border-t border-neutral-800" aria-hidden="true">
            <div className="flex items-center gap-1.5 bg-neutral-800 rounded-full px-3 py-1.5 border border-neutral-700">
              <input
                type="text"
                placeholder="Ask anything..."
                className="flex-1 bg-transparent text-[10px] text-text-primary placeholder-text-muted focus:outline-none"
                readOnly
                tabIndex={-1}
                aria-hidden="true"
              />
              <div className="w-5 h-5 bg-sage rounded-full flex items-center justify-center flex-shrink-0">
                <ChevronRight className="w-3 h-3 text-white" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
ClientHubMockup.displayName = 'ClientHubMockup';
