'use client';

import { useState } from 'react';
import {
  Monitor,
  CalendarCheck,
  FolderOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MessageSquare,
  Calendar,
  Clock,
  Package,
} from 'lucide-react';
import { DemoStorefrontShowcase } from './DemoStorefrontShowcase';

/**
 * ProductPreviewTabs - 3-tab product preview for the landing page proof block
 *
 * Shows visual mockups of:
 * 1. Storefront - Realistic demo with conversion-optimized 3-tier pricing
 * 2. Booking flow - Date picker wizard (based on DateBookingWizard)
 * 3. After booking - Client portal with shared documents
 *
 * Design: Dark theme matching DemoStorefrontShowcase with sage accents,
 * realistic content for the Alex Chen tutor persona.
 */

const tabs = [
  {
    id: 'storefront',
    label: 'Storefront',
    icon: Monitor,
  },
  {
    id: 'booking',
    label: 'Booking flow',
    icon: CalendarCheck,
  },
  {
    id: 'after-booking',
    label: 'After booking',
    icon: FolderOpen,
  },
];

/** Mockup: Booking flow with date picker - Dark theme */
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
            <div className="w-7 h-7 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
              <span className="text-sage font-semibold text-[10px]">AC</span>
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
            <span className="text-[9px] text-text-primary font-medium">Date & Time</span>
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
            <button className="w-6 h-6 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition-colors">
              <ChevronLeft className="w-3.5 h-3.5 text-text-muted" />
            </button>
            <span className="text-sm font-serif font-semibold text-text-primary">January 2025</span>
            <button className="w-6 h-6 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center transition-colors">
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
                    className={`w-6 h-6 rounded-lg text-[10px] flex items-center justify-center transition-all ${
                      date === null
                        ? ''
                        : date === 15
                          ? 'bg-sage text-white font-semibold shadow-md shadow-sage/30'
                          : date < 10
                            ? 'text-neutral-600 cursor-not-allowed'
                            : 'bg-neutral-800 text-text-primary hover:bg-sage/20 hover:text-sage cursor-pointer border border-neutral-700 hover:border-sage/50'
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
          <p className="text-[10px] text-text-muted mb-2 text-center">Available times for Jan 15</p>
          <div className="flex gap-2 justify-center flex-wrap">
            <div className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-[10px] text-text-muted hover:border-sage/50 hover:text-sage cursor-pointer transition-all">
              9:00 AM
            </div>
            <div className="px-3 py-1.5 bg-sage/15 border border-sage rounded-lg text-[10px] text-sage font-medium shadow-sm">
              11:00 AM
            </div>
            <div className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-[10px] text-text-muted hover:border-sage/50 hover:text-sage cursor-pointer transition-all">
              2:00 PM
            </div>
            <div className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-[10px] text-text-muted hover:border-sage/50 hover:text-sage cursor-pointer transition-all">
              4:00 PM
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="px-4 py-2.5 bg-surface border-t border-neutral-800">
        <button className="w-full py-2 bg-sage hover:bg-sage-hover text-white text-[11px] font-semibold rounded-full transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 focus:ring-offset-surface">
          Continue to Details
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/** Mockup: After booking - Your Session Workspace - Dark theme
 *
 * Reframed from "booking confirmation" to "relationship workspace"
 * Three jobs: Reassure (what's coming), Coordinate (things to do), Converse (assistant)
 */
function AfterBookingMockup() {
  return (
    <div className="h-full bg-surface overflow-hidden flex flex-col">
      {/* Header - Workspace framing, not just confirmation */}
      <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.15)_0%,transparent_70%)] px-4 py-2.5 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
              <span className="text-sage font-semibold text-xs">AC</span>
            </div>
            <div>
              <h3 className="font-serif text-xs font-semibold text-text-primary">
                Your Session Space
              </h3>
              <p className="text-[9px] text-text-muted">Grade Boost with Alex Chen</p>
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

      {/* Main content - Two column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column: What's happening + Things to do */}
        <div className="flex-1 px-3 py-2.5 bg-surface-alt overflow-auto border-r border-neutral-800">
          {/* What's Coming Up - Reassure */}
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
                  Jan 15
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  11:00 AM
                </span>
                <span className="flex items-center gap-1">
                  <Package className="w-3 h-3" />1 of 4
                </span>
              </div>
            </div>
          </div>

          {/* Things to Do - Coordinate */}
          <div>
            <h4 className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <ClipboardList className="w-3 h-3 text-amber-500" />
              Things to Do
            </h4>
            <div className="space-y-1.5">
              {/* Action item - needs attention */}
              <div className="flex items-center gap-2 p-2 bg-surface rounded-lg border border-amber-500/30 hover:border-amber-500/50 transition-colors cursor-pointer">
                <div className="w-6 h-6 bg-amber-500/15 rounded-md flex items-center justify-center flex-shrink-0">
                  <ClipboardList className="w-3 h-3 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-text-primary truncate">
                    Learning Goals Questionnaire
                  </p>
                  <p className="text-[8px] text-amber-500">5 min • Helps Alex prepare</p>
                </div>
                <ChevronRight className="w-3 h-3 text-amber-500" />
              </div>

              {/* Completed item */}
              <div className="flex items-center gap-2 p-2 bg-surface rounded-lg border border-neutral-800 opacity-60">
                <div className="w-6 h-6 bg-emerald-500/15 rounded-md flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-text-primary truncate line-through">
                    Payment completed
                  </p>
                  <p className="text-[8px] text-text-muted">$320 • Jan 10</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Your Assistant - Converse (elevated, not buried) */}
        <div className="w-[45%] flex flex-col bg-surface">
          {/* Assistant header - friendly, always-there presence */}
          <div className="px-3 py-2 border-b border-neutral-800 bg-sage/5">
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-7 h-7 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
                  <MessageSquare className="w-3.5 h-3.5 text-sage" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-surface" />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-text-primary">Your Assistant</p>
                <p className="text-[8px] text-sage">Always here to help</p>
              </div>
            </div>
          </div>

          {/* Chat preview - shows the assistant is engaged */}
          <div className="flex-1 px-2.5 py-2 overflow-auto space-y-2">
            {/* Assistant message */}
            <div className="flex gap-1.5">
              <div className="w-5 h-5 rounded-full bg-sage/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sage text-[8px] font-semibold">AC</span>
              </div>
              <div className="bg-sage/10 rounded-xl rounded-tl-sm px-2.5 py-1.5 max-w-[90%]">
                <p className="text-[9px] text-text-primary leading-relaxed">
                  Hi! I&apos;m here whenever you need me. Questions about your session? Need to
                  reschedule? Want to add something? Just ask.
                </p>
              </div>
            </div>

            {/* Quick suggestions */}
            <div className="pl-6 space-y-1">
              <p className="text-[8px] text-text-muted">Quick questions:</p>
              <div className="flex flex-wrap gap-1">
                <span className="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded-full text-[8px] text-text-muted hover:border-sage/50 hover:text-sage cursor-pointer transition-colors">
                  What should I bring?
                </span>
                <span className="px-2 py-0.5 bg-neutral-800 border border-neutral-700 rounded-full text-[8px] text-text-muted hover:border-sage/50 hover:text-sage cursor-pointer transition-colors">
                  Can I reschedule?
                </span>
              </div>
            </div>
          </div>

          {/* Chat input - always visible, inviting */}
          <div className="px-2.5 py-2 border-t border-neutral-800">
            <div className="flex items-center gap-1.5 bg-neutral-800 rounded-full px-3 py-1.5 border border-neutral-700 focus-within:border-sage/50 transition-colors">
              <input
                type="text"
                placeholder="Ask anything..."
                className="flex-1 bg-transparent text-[10px] text-text-primary placeholder-text-muted focus:outline-none"
                readOnly
              />
              <button className="w-5 h-5 bg-sage rounded-full flex items-center justify-center hover:bg-sage-hover transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-1 focus:ring-offset-surface">
                <ChevronRight className="w-3 h-3 text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductPreviewTabs() {
  const [activeTab, setActiveTab] = useState('storefront');

  return (
    <div className="w-full">
      {/* Tab buttons */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex bg-surface-alt rounded-full p-1 border border-neutral-800">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-sage text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview area */}
      <div className="bg-surface-alt rounded-2xl border border-neutral-800 overflow-hidden">
        {/* Browser-like header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-neutral-800/50 border-b border-neutral-800">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-neutral-700" />
            <div className="w-3 h-3 rounded-full bg-neutral-700" />
            <div className="w-3 h-3 rounded-full bg-neutral-700" />
          </div>
          <div className="flex-1 mx-4">
            <div className="bg-neutral-800 rounded-md px-3 py-1 text-xs text-text-muted max-w-xs mx-auto text-center">
              {activeTab === 'storefront' ? 'alexchen.gethandled.ai' : 'yourname.gethandled.ai'}
            </div>
          </div>
        </div>

        {/* Preview content - mockups */}
        <div className="aspect-[16/10]">
          {activeTab === 'storefront' && <DemoStorefrontShowcase compact />}
          {activeTab === 'booking' && <BookingMockup />}
          {activeTab === 'after-booking' && <AfterBookingMockup />}
        </div>
      </div>

      {/* Description below preview */}
      <p className="text-center text-text-muted text-sm mt-4">
        {activeTab === 'storefront' && 'Clear offerings and pricing that make sense the first time'}
        {activeTab === 'booking' && 'Choose a tier, get answers, pay, and book—without a thread'}
        {activeTab === 'after-booking' &&
          'Questions, changes, files—one shared place that stays organized'}
      </p>
    </div>
  );
}
