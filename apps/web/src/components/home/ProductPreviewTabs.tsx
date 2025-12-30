'use client';

import { useState } from 'react';
import {
  Monitor,
  CalendarCheck,
  FolderOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  CreditCard,
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

/** Mockup: After booking - client portal - Dark theme */
function AfterBookingMockup() {
  return (
    <div className="h-full bg-surface overflow-hidden flex flex-col">
      {/* Header with confirmation */}
      <div className="bg-[radial-gradient(ellipse_at_center,rgba(69,179,127,0.15)_0%,transparent_70%)] px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-sage/20 border border-sage/30 flex items-center justify-center">
            <span className="text-sage font-semibold text-sm">AC</span>
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-sm font-semibold text-text-primary">
              Session with Alex Chen
            </h3>
            <p className="text-[10px] text-text-muted">Grade Boost • 4 sessions</p>
          </div>
          <div className="px-2.5 py-1 bg-sage/15 border border-sage/30 rounded-full">
            <span className="text-[10px] text-sage font-semibold">Confirmed</span>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="px-4 py-3 border-b border-neutral-800 bg-surface-alt">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-surface rounded-xl p-2.5 border border-neutral-800 text-center">
            <Calendar className="w-3.5 h-3.5 text-sage mx-auto mb-1" />
            <p className="text-[9px] text-text-muted mb-0.5">First Session</p>
            <p className="text-[11px] font-semibold text-text-primary">Jan 15, 2025</p>
          </div>
          <div className="bg-surface rounded-xl p-2.5 border border-neutral-800 text-center">
            <Clock className="w-3.5 h-3.5 text-sage mx-auto mb-1" />
            <p className="text-[9px] text-text-muted mb-0.5">Time</p>
            <p className="text-[11px] font-semibold text-text-primary">11:00 AM</p>
          </div>
          <div className="bg-surface rounded-xl p-2.5 border border-neutral-800 text-center">
            <Package className="w-3.5 h-3.5 text-sage mx-auto mb-1" />
            <p className="text-[9px] text-text-muted mb-0.5">Sessions Left</p>
            <p className="text-[11px] font-semibold text-text-primary">4 of 4</p>
          </div>
        </div>
      </div>

      {/* Shared files section */}
      <div className="flex-1 px-4 py-3 bg-surface-alt overflow-auto">
        <h4 className="text-[11px] font-semibold text-text-primary mb-2 flex items-center gap-1.5">
          <FolderOpen className="w-3.5 h-3.5 text-sage" />
          Shared Files
        </h4>
        <div className="space-y-2">
          {/* Study Plan */}
          <div className="flex items-center gap-2.5 p-2.5 bg-surface rounded-xl border border-neutral-800 hover:border-sage/30 transition-colors cursor-pointer">
            <div className="w-8 h-9 bg-sage/15 rounded-lg flex items-center justify-center border border-sage/20">
              <FileText className="w-4 h-4 text-sage" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-text-primary truncate">
                Personalized Study Plan
              </p>
              <p className="text-[9px] text-text-muted">PDF • Shared by Alex</p>
            </div>
            <span className="text-[9px] text-sage font-medium">View</span>
          </div>

          {/* Receipt */}
          <div className="flex items-center gap-2.5 p-2.5 bg-surface rounded-xl border border-neutral-800 hover:border-sage/30 transition-colors cursor-pointer">
            <div className="w-8 h-9 bg-emerald-500/15 rounded-lg flex items-center justify-center border border-emerald-500/20">
              <CreditCard className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-text-primary truncate">Payment Receipt</p>
              <p className="text-[9px] text-text-muted">$320.00 • Jan 10, 2025</p>
            </div>
            <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/20 rounded text-[8px] text-emerald-500 font-semibold">
              Paid
            </span>
          </div>

          {/* Intake form */}
          <div className="flex items-center gap-2.5 p-2.5 bg-surface rounded-xl border border-sage/30 hover:border-sage/50 transition-colors cursor-pointer">
            <div className="w-8 h-9 bg-amber-500/15 rounded-lg flex items-center justify-center border border-amber-500/20">
              <ClipboardList className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-text-primary truncate">
                Learning Goals Questionnaire
              </p>
              <p className="text-[9px] text-amber-500">Action needed • 5 min</p>
            </div>
            <span className="text-[9px] text-sage font-medium">Fill out →</span>
          </div>
        </div>
      </div>

      {/* Footer with chat option */}
      <div className="px-4 py-2.5 bg-surface border-t border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-text-muted">
          <MessageSquare className="w-3.5 h-3.5" />
          <span className="text-[10px]">Questions? Chat with Alex</span>
        </div>
        <button className="px-3 py-1.5 bg-sage/15 border border-sage/30 text-sage text-[10px] font-medium rounded-full hover:bg-sage/25 transition-colors focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2 focus:ring-offset-surface">
          Send Message
        </button>
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
        {activeTab === 'storefront' &&
          'Conversion-optimized pricing with psychology-backed tier design'}
        {activeTab === 'booking' && 'Guided booking that converts visitors to clients'}
        {activeTab === 'after-booking' && 'Shared space for client details and follow-ups'}
      </p>
    </div>
  );
}
