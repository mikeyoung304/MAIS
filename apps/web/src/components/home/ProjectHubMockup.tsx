'use client';

import { FileText, Clock, CheckCircle2, MessageSquare, ArrowRight, Sparkles } from 'lucide-react';

/**
 * ProjectHubMockup - Visual representation of the Project Hub wedge
 *
 * Shows a calm, static preview of the Project Hub that emphasizes:
 * - Project Summary (continuity)
 * - Latest update (AI summary)
 * - Request card (change request detected → proposed → awaiting approval)
 *
 * Design: Calm panel, not a chatbot widget. Emphasizes memory and organization.
 */

export function ProjectHubMockup() {
  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="bg-surface rounded-2xl border border-neutral-800 overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.08)_0%,transparent_70%)] px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
                <span className="text-sage font-semibold text-sm">JM</span>
              </div>
              <div>
                <h3 className="font-serif text-sm font-semibold text-text-primary">
                  Sarah&apos;s Wedding Photography
                </h3>
                <p className="text-xs text-text-muted">Project Hub • 3rd booking together</p>
              </div>
            </div>
            <div className="px-2.5 py-1 bg-sage/15 border border-sage/30 rounded-full">
              <span className="text-xs text-sage font-medium">Active</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 bg-surface-alt">
          {/* Project Summary */}
          <div className="bg-surface rounded-xl p-4 border border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-sage" />
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Project Summary
              </h4>
            </div>
            <div className="space-y-2 text-sm text-text-muted">
              <p>
                <span className="text-text-primary font-medium">Event:</span> Wedding ceremony &
                reception
              </p>
              <p>
                <span className="text-text-primary font-medium">Date:</span> March 15, 2025 •
                Rosewood Gardens
              </p>
              <p>
                <span className="text-text-primary font-medium">From last time:</span> Prefers
                candid shots, loves golden hour lighting
              </p>
            </div>
          </div>

          {/* Latest Update - AI Summary */}
          <div className="bg-surface rounded-xl p-4 border border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-sage" />
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Latest Update
              </h4>
              <span className="text-xs text-text-muted ml-auto">AI Summary</span>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              Sarah confirmed the venue walkthrough for next Tuesday. She mentioned adding 30
              minutes of couple portraits at sunset — you might want to check your golden hour
              timing.
            </p>
          </div>

          {/* Request Card - The key differentiator */}
          <div className="bg-surface rounded-xl p-4 border border-amber-500/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-amber-500/15 rounded-md flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                </div>
                <h4 className="text-xs font-semibold text-text-primary">Change Request Detected</h4>
              </div>
              <span className="text-xs text-amber-500 font-medium">Awaiting approval</span>
            </div>
            <div className="bg-amber-500/5 rounded-lg p-3 border border-amber-500/20">
              <p className="text-sm text-text-muted mb-2">
                &quot;Can we add 30 minutes for couple portraits at sunset?&quot;
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-text-muted">Proposed:</span>
                <span className="text-text-primary font-medium">+$150 add-on</span>
                <ArrowRight className="w-3 h-3 text-text-muted" />
                <span className="text-amber-500 font-medium">Review & approve</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs text-text-muted">3 items resolved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-sage" />
                <span className="text-xs text-text-muted">12 messages</span>
              </div>
            </div>
            <span className="text-xs text-text-muted">History preserved</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact version for inline use
 */
export function ProjectHubMockupCompact() {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-surface rounded-xl border border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-neutral-800 bg-sage/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
              <FileText className="w-4 h-4 text-sage" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Project Hub</h3>
              <p className="text-xs text-text-muted">Shared workspace for every client</p>
            </div>
          </div>
        </div>

        {/* Content Preview */}
        <div className="p-4 space-y-3 bg-surface-alt">
          <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-neutral-800">
            <div className="w-8 h-8 bg-sage/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-sage" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary">AI-organized updates</p>
              <p className="text-xs text-text-muted">Summaries, not noise</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-amber-500/30">
            <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary">Change requests as proposals</p>
              <p className="text-xs text-text-muted">Clear, actionable, approved by you</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-neutral-800">
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs font-medium text-text-primary">History that compounds</p>
              <p className="text-xs text-text-muted">Every project builds on the last</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
