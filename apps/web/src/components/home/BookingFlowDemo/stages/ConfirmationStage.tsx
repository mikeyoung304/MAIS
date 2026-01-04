'use client';

import {
  Sparkles,
  Calendar,
  MessageSquare,
  FileText,
  CheckCircle,
  Clock,
  Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StageProps } from '../types';

/**
 * ConfirmationStage - The Session Space (Post-Booking Hub)
 *
 * This is NOT a receipt - it's where the client relationship lives.
 * Key differentiators to showcase:
 *
 * 1. REASSURE - "What's coming up" (project summary)
 * 2. COORDINATE - "Things to do" (action items, changes)
 * 3. CONVERSE - "I can talk to someone" (AI assistant)
 * 4. REMEMBER - "From last time..." (memory carries forward)
 *
 * The "one link forever" philosophy - everything lives here.
 */
export function ConfirmationStage({ active }: StageProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 p-2.5 transition-all duration-500 overflow-hidden',
        active ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4 pointer-events-none'
      )}
    >
      {/* Project Hub Header - Active status, not just "confirmed" */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-sage/20 flex items-center justify-center">
            <span className="text-[9px] font-bold text-sage">SJ</span>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-text-primary">Sarah&apos;s Session</p>
            <p className="text-[8px] text-text-muted">Essential Package • Jan 9</p>
          </div>
        </div>
        <span className="text-[8px] font-medium text-emerald-400 bg-emerald-400/15 px-1.5 py-0.5 rounded-full flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
          Active
        </span>
      </div>

      {/* AI Summary Card - Latest update with intelligence */}
      <div className="bg-sage/10 border border-sage/20 rounded-lg p-2 mb-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Brain className="w-3 h-3 text-sage" />
          <span className="text-[9px] font-medium text-sage">AI Summary</span>
        </div>
        <p className="text-[9px] text-text-primary leading-relaxed">
          Session confirmed for Thursday 2pm. Sarah prefers natural lighting based on her previous
          booking. She asked about bringing props — I let her know that&apos;s welcome.
        </p>
      </div>

      {/* Memory Element - Key differentiator */}
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 mb-2">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span className="text-[9px] font-medium text-amber-400">From last time</span>
        </div>
        <p className="text-[8px] text-text-muted">
          Prefers candid shots • Loves golden hour • Usually runs 5min late
        </p>
      </div>

      {/* Action Items - Coordinate */}
      <div className="bg-neutral-800/50 rounded-lg p-2 mb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-medium text-text-primary">Things to do</span>
          <span className="text-[8px] text-text-muted">2 of 4 done</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3 h-3 text-sage" />
            <span className="text-[8px] text-text-muted line-through">Payment confirmed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3 h-3 text-sage" />
            <span className="text-[8px] text-text-muted line-through">Added to calendar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-sage bg-sage/20 flex items-center justify-center">
              <Clock className="w-2 h-2 text-sage" />
            </div>
            <span className="text-[8px] text-text-primary">Confirm location</span>
            <span className="text-[7px] text-amber-400 ml-auto">Awaiting</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-neutral-600" />
            <span className="text-[8px] text-text-primary">Share outfit ideas</span>
          </div>
        </div>
      </div>

      {/* One Link Forever - The philosophy */}
      <div className="flex items-center justify-center gap-3 mt-1.5">
        <div className="flex items-center gap-1">
          <MessageSquare className="w-2.5 h-2.5 text-sage" />
          <span className="text-[7px] text-text-muted">3 messages</span>
        </div>
        <span className="text-neutral-600">•</span>
        <div className="flex items-center gap-1">
          <FileText className="w-2.5 h-2.5 text-sage" />
          <span className="text-[7px] text-text-muted">1 file</span>
        </div>
        <span className="text-neutral-600">•</span>
        <div className="flex items-center gap-1">
          <Calendar className="w-2.5 h-2.5 text-sage" />
          <span className="text-[7px] text-text-muted">Synced</span>
        </div>
      </div>

      {/* "Everything lives here" tagline */}
      <p className="text-[7px] text-text-muted text-center mt-1.5 italic">
        One link. Everything lives here. Forever.
      </p>
    </div>
  );
}
