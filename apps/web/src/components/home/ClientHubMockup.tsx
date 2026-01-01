'use client';

import { CheckCircle2, MessageSquare, Upload, Calendar, RefreshCw, Sparkles } from 'lucide-react';

/**
 * ClientHubMockup - Visual representation of "the one link" concept
 *
 * Shows a calm, static preview of what clients see after booking:
 * - "Your job is confirmed."
 * - "Here's what to expect."
 * - "Message us anytime."
 * - "Upload inspiration / files."
 * - "Rebook this service."
 *
 * Design: Calm panel emphasizing containment and finality.
 */

export function ClientHubMockup() {
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-surface rounded-2xl border border-neutral-800 overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.08)_0%,transparent_70%)] px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
                <span className="text-sage font-semibold text-sm">SW</span>
              </div>
              <div>
                <h3 className="font-serif text-sm font-semibold text-text-primary">
                  Your Wedding Photography
                </h3>
                <p className="text-xs text-text-muted">Sarah Williams Photography</p>
              </div>
            </div>
            <div className="px-2.5 py-1 bg-emerald-500/15 border border-emerald-500/30 rounded-full">
              <span className="text-xs text-emerald-500 font-medium">Confirmed</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 bg-surface-alt">
          {/* Job Confirmed Card */}
          <div className="bg-surface rounded-xl p-4 border border-emerald-500/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-text-primary">Your job is confirmed</h4>
                <p className="text-xs text-text-muted">March 15, 2025 at Rosewood Gardens</p>
              </div>
            </div>
          </div>

          {/* What to Expect */}
          <div className="bg-surface rounded-xl p-4 border border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-sage" />
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Here&apos;s what to expect
              </h4>
            </div>
            <div className="space-y-2 text-sm text-text-muted">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sage" />
                <span>Venue walkthrough call this week</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                <span>Shot list review 2 weeks before</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-600" />
                <span>Gallery delivery 3 weeks after</span>
              </div>
            </div>
          </div>

          {/* Action Buttons Row */}
          <div className="grid grid-cols-3 gap-3">
            <button className="bg-surface rounded-xl p-3 border border-neutral-800 hover:border-sage/50 transition-colors group">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center group-hover:bg-sage/20 transition-colors">
                  <MessageSquare className="w-4 h-4 text-sage" />
                </div>
                <span className="text-xs text-text-muted">Message</span>
              </div>
            </button>
            <button className="bg-surface rounded-xl p-3 border border-neutral-800 hover:border-sage/50 transition-colors group">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center group-hover:bg-sage/20 transition-colors">
                  <Upload className="w-4 h-4 text-sage" />
                </div>
                <span className="text-xs text-text-muted">Upload</span>
              </div>
            </button>
            <button className="bg-surface rounded-xl p-3 border border-neutral-800 hover:border-sage/50 transition-colors group">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-sage/10 flex items-center justify-center group-hover:bg-sage/20 transition-colors">
                  <RefreshCw className="w-4 h-4 text-sage" />
                </div>
                <span className="text-xs text-text-muted">Rebook</span>
              </div>
            </button>
          </div>

          {/* AI Assistant Note */}
          <div className="flex items-center gap-3 pt-2 border-t border-neutral-800">
            <div className="w-6 h-6 rounded-full bg-sage/15 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-sage" />
            </div>
            <p className="text-xs text-text-muted">
              <span className="text-text-primary font-medium">AI assistant</span> — ask questions,
              request changes, anytime
            </p>
          </div>
        </div>
      </div>

      {/* Floating Labels */}
      <div className="relative mt-4">
        <div className="flex flex-wrap justify-center gap-2">
          <span className="text-xs text-text-muted bg-surface-alt px-3 py-1.5 rounded-full border border-neutral-800">
            One link
          </span>
          <span className="text-xs text-text-muted bg-surface-alt px-3 py-1.5 rounded-full border border-neutral-800">
            Everything lives here
          </span>
          <span className="text-xs text-text-muted bg-surface-alt px-3 py-1.5 rounded-full border border-neutral-800">
            Forever
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version for smaller contexts
 */
export function ClientHubMockupCompact() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-surface rounded-xl border border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-800 bg-sage/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-sage" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Your Client Hub</h3>
              <p className="text-xs text-text-muted">One permanent page for everything</p>
            </div>
          </div>
        </div>

        {/* Content Preview */}
        <div className="p-4 space-y-3 bg-surface-alt">
          <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-neutral-800">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary">Job confirmed</p>
              <p className="text-xs text-text-muted">No more email chains</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-neutral-800">
            <div className="w-8 h-8 bg-sage/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-sage" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary">Message anytime</p>
              <p className="text-xs text-text-muted">Real-time thread, always accessible</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-neutral-800">
            <div className="w-8 h-8 bg-sage/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-4 h-4 text-sage" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary">Rebook instantly</p>
              <p className="text-xs text-text-muted">Clients return to the same link</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
