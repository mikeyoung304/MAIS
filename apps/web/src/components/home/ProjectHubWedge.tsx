'use client';

import {
  FileText,
  CheckCircle2,
  Circle,
  MessageSquare,
  DollarSign,
  Calendar,
  Sparkles,
  Clock,
  CalendarCheck,
  Zap,
  Bot,
  User,
  Users,
  ChevronRight,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react';

/**
 * ProjectHubWedge - Shows ONE booking with ALL its details unified
 *
 * Design Philosophy:
 * - Show DEPTH not breadth - everything about ONE client in ONE place
 * - The pain: scattered info across email, DM, texts, calendar, notes
 * - The solution: unified dashboard showing ALL info for this booking
 * - Visual density that feels organized, not chaotic
 *
 * Key sections for one booking:
 * - Client header + status
 * - Payment status
 * - Private notes (only you see)
 * - Unified message feed (emails + DMs + texts in one stream)
 * - Tasks/checklist
 * - Files + calendar sync
 */

export function ProjectHubWedge() {
  return (
    <section className="py-24 md:py-32 lg:py-40 px-6 bg-surface-alt relative overflow-hidden">
      {/* Atmospheric background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/4 w-[900px] h-[700px] bg-sage/[0.03] rounded-full blur-[150px]" />
        <div className="absolute inset-0 opacity-[0.02] bg-[linear-gradient(rgba(69,179,127,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(69,179,127,0.5)_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      <div className="max-w-4xl mx-auto relative">
        {/* Pain Statement */}
        <div className="text-center mb-6">
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-text-primary leading-[1.05] tracking-tight">
            Stop playing detective
            <br />
            <span className="text-text-muted">with your own projects.</span>
          </h2>
        </div>

        {/* Pain Description */}
        <p className="text-lg md:text-xl text-text-muted leading-relaxed max-w-2xl mx-auto text-center mb-6">
          The text. The email thread. The Instagram DM. The voice note you forgot to save.
          <span className="text-text-primary"> Every project becomes an archaeology dig.</span>
        </p>

        {/* Pivot */}
        <p className="text-xl md:text-2xl text-text-primary font-serif text-center mb-14 md:mb-16">
          What if everything about <em className="text-sage">one booking</em> lived in{' '}
          <em className="text-sage">one place</em>?
        </p>

        {/* Dashboard Label */}
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-sage/15 border border-sage/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-sage" />
          </div>
          <div>
            <span className="text-sm font-semibold text-text-primary uppercase tracking-wide">
              One Booking. Everything.
            </span>
          </div>
        </div>

        {/* Single Project Dashboard */}
        <UnifiedProjectDashboard />

        {/* Closing Hook */}
        <div className="text-center mt-14 md:mt-16">
          <p className="text-2xl md:text-3xl text-text-primary font-serif font-medium tracking-tight">
            No more hunting. No more guessing.
            <br />
            <span className="relative inline-block mt-2">
              <span className="text-sage">It&apos;s all here.</span>
              <span className="absolute -bottom-1 left-0 right-0 h-1 bg-sage/30 rounded-full" />
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}

/**
 * UnifiedProjectDashboard - Everything about ONE booking in ONE view
 */
function UnifiedProjectDashboard() {
  return (
    <div className="bg-surface rounded-2xl border border-neutral-800 overflow-hidden shadow-2xl shadow-black/30">
      {/* Header - Client + Status */}
      <div className="px-5 py-4 border-b border-neutral-800 bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.06)_0%,transparent_70%)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-sage/30 to-sage/10 border border-sage/30 flex items-center justify-center">
              <span className="text-sage font-semibold text-sm">S&J</span>
            </div>
            <div>
              <h3 className="font-serif text-base font-semibold text-text-primary">
                Sarah &amp; James
              </h3>
              <p className="text-xs text-text-muted">Full Planning • June 14, 2025</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-text-muted">142 guests</p>
            </div>
            <div className="px-2.5 py-1 bg-sage/15 border border-sage/30 rounded-full">
              <span className="text-xs text-sage font-medium">87 days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column on larger screens */}
      <div className="grid md:grid-cols-2 gap-0 md:gap-0">
        {/* Left Column - Details + Notes + Payment */}
        <div className="p-4 space-y-3 bg-surface-alt border-b md:border-b-0 md:border-r border-neutral-800">
          {/* Wedding Details */}
          <div className="bg-surface rounded-xl p-3.5 border border-neutral-800">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-sage" />
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Details
              </h4>
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Venue</span>
                <span className="text-text-primary">The Manor House</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Budget</span>
                <span className="text-text-primary">$45,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Vendors</span>
                <span className="text-text-primary">8 confirmed</span>
              </div>
            </div>
          </div>

          {/* Private Notes */}
          <div className="bg-surface rounded-xl p-3.5 border border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sage" />
                <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                  Your Notes
                </h4>
              </div>
              <span className="text-[9px] text-neutral-500 bg-neutral-800/80 px-2 py-0.5 rounded">
                Private
              </span>
            </div>
            <p className="text-sm text-text-muted leading-relaxed">
              Bride is decisive, groom goes with the flow. Mom has strong opinions on flowers. They
              want &quot;elegant but not stuffy&quot; — think garden party vibes.
            </p>
          </div>

          {/* Payment Status */}
          <div className="bg-surface rounded-xl p-3.5 border border-neutral-800">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-emerald-500" />
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Your Fee
              </h4>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-lg font-semibold text-text-primary">$4,500</span>
                <span className="text-sm text-emerald-500 ml-1">paid</span>
              </div>
              <div className="text-right">
                <span className="text-sm text-text-muted">$3,000 due</span>
                <span className="text-xs text-amber-500 ml-1">May 1</span>
              </div>
            </div>
            <div className="mt-2 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div className="h-full w-[60%] bg-emerald-500 rounded-full" />
            </div>
          </div>

          {/* Action Needed */}
          <div className="bg-surface rounded-xl p-3.5 border border-amber-500/40 bg-amber-500/[0.03]">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-semibold text-text-primary">Decision Needed</span>
              </div>
            </div>
            <p className="text-sm text-text-muted">
              Florist needs final centerpiece choice by Friday
            </p>
            <p className="text-xs text-amber-500 mt-1">2 options sent • Awaiting their pick</p>
          </div>
        </div>

        {/* Right Column - Messages + Tasks */}
        <div className="p-4 space-y-3 bg-surface-alt">
          {/* AI Conversation */}
          <div className="bg-surface rounded-xl border border-neutral-800 overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sage" />
                <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                  Chat
                </h4>
              </div>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] text-emerald-500">Online</span>
              </span>
            </div>
            <div className="px-3.5 py-3 space-y-2.5">
              <ChatBubble
                role="user"
                message="We finally picked the tall centerpieces! Can you let the florist know?"
              />
              <ChatBubble
                role="assistant"
                message="Done! I've emailed the florist and updated the timeline. They'll confirm delivery by end of day."
              />
              <ChatBubble
                role="user"
                message="Also — James' mom wants to add 4 more guests. Is that okay?"
              />
              <ChatBubble
                role="assistant"
                message="I've added them to the guest list (now 146). Updated the caterer and seating chart. Want me to send them the RSVP link?"
              />
            </div>
            <div className="px-3.5 py-2 border-t border-neutral-800 bg-surface-alt">
              <p className="text-[10px] text-text-muted text-center">
                Your AI handles client requests and vendor coordination
              </p>
            </div>
          </div>

          {/* Documents & Resources */}
          <div className="bg-surface rounded-xl p-3.5 border border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-sage" />
              <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                Resources
              </h4>
            </div>
            <div className="space-y-2">
              <DocumentButton icon={Users} label="Guest List" status="142 guests • 98 RSVPs" />
              <DocumentButton icon={Clock} label="Day-of Timeline" status="Ceremony to send-off" />
              <DocumentButton icon={ClipboardList} label="Vendor Contacts" status="8 vendors" />
            </div>
          </div>

          {/* Tasks/Checklist */}
          <div className="bg-surface rounded-xl p-3.5 border border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-sage" />
                <h4 className="text-xs font-semibold text-text-primary uppercase tracking-wide">
                  Checklist
                </h4>
              </div>
              <span className="text-xs text-text-muted">14 of 22</span>
            </div>
            <div className="space-y-2">
              <TaskRow done text="Venue contract signed" />
              <TaskRow done text="Catering deposit paid" />
              <TaskRow done text="Save-the-dates sent" />
              <TaskRow text="Final menu tasting" />
              <TaskRow text="Rehearsal dinner venue" />
            </div>
          </div>

          {/* Footer Stats */}
          <div className="flex items-center justify-between pt-2 text-xs text-text-muted">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-sage" />
              <span className="text-sage">Calendar synced</span>
            </div>
            <span className="text-[10px]">Updated 2 min ago</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ChatBubble - Shows a message in the AI conversation
 */
function ChatBubble({ role, message }: { role: 'user' | 'assistant'; message: string }) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
          isUser ? 'bg-neutral-700' : 'bg-sage/20'
        }`}
      >
        {isUser ? (
          <User className="w-2.5 h-2.5 text-neutral-400" />
        ) : (
          <Bot className="w-2.5 h-2.5 text-sage" />
        )}
      </div>
      <div
        className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-[11px] leading-relaxed ${
          isUser
            ? 'bg-sage text-white rounded-br-sm'
            : 'bg-neutral-800 text-text-primary border border-neutral-700 rounded-bl-sm'
        }`}
      >
        <p>{message}</p>
      </div>
    </div>
  );
}

/**
 * DocumentButton - Clickable resource button with status
 */
function DocumentButton({
  icon: Icon,
  label,
  status,
}: {
  icon: LucideIcon;
  label: string;
  status: string;
}) {
  return (
    <button className="w-full flex items-center gap-3 p-2 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-700/50 transition-colors group">
      <div className="w-7 h-7 rounded-lg bg-sage/15 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-sage" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-xs font-medium text-text-primary">{label}</p>
        <p className="text-[10px] text-text-muted">{status}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-sage transition-colors" />
    </button>
  );
}

/**
 * TaskRow - Checklist item
 */
function TaskRow({ done = false, text }: { done?: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-neutral-600 flex-shrink-0" />
      )}
      <span className={`text-sm ${done ? 'text-text-muted line-through' : 'text-text-primary'}`}>
        {text}
      </span>
    </div>
  );
}
