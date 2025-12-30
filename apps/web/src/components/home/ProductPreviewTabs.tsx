'use client';

import { useState } from 'react';
import { Monitor, CalendarCheck, FolderOpen, Check } from 'lucide-react';
import { DemoStorefrontShowcase } from './DemoStorefrontShowcase';

/**
 * ProductPreviewTabs - 3-tab product preview for the landing page proof block
 *
 * Shows visual mockups of:
 * 1. Storefront - Realistic demo with conversion-optimized 3-tier pricing
 * 2. Booking flow - Date picker wizard (based on DateBookingWizard)
 * 3. After booking - Client portal with shared documents
 *
 * The storefront tab features a college tutor demo tenant with
 * psychology-optimized pricing (anchoring, decoy effect, social proof).
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

/** Mockup: Booking flow with date picker */
function BookingMockup() {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dates = [
    [null, null, 1, 2, 3, 4, 5],
    [6, 7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24, 25, 26],
  ];

  return (
    <div className="h-full bg-white overflow-hidden p-4">
      {/* Progress steps */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-sage text-white text-[8px] flex items-center justify-center">
            <Check className="w-2.5 h-2.5" />
          </div>
          <span className="text-[8px] text-neutral-600">Package</span>
        </div>
        <div className="w-4 h-px bg-sage" />
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-sage text-white text-[8px] flex items-center justify-center">
            2
          </div>
          <span className="text-[8px] text-neutral-800 font-medium">Date</span>
        </div>
        <div className="w-4 h-px bg-neutral-300" />
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-neutral-200 text-neutral-500 text-[8px] flex items-center justify-center">
            3
          </div>
          <span className="text-[8px] text-neutral-400">Details</span>
        </div>
        <div className="w-4 h-px bg-neutral-300" />
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-full bg-neutral-200 text-neutral-500 text-[8px] flex items-center justify-center">
            4
          </div>
          <span className="text-[8px] text-neutral-400">Pay</span>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-medium text-neutral-800">January 2025</div>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded bg-neutral-200" />
            <div className="w-4 h-4 rounded bg-neutral-200" />
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {days.map((day, i) => (
            <div key={i} className="text-[8px] text-neutral-400 text-center">
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
                  className={`w-5 h-5 rounded text-[8px] flex items-center justify-center ${
                    date === null
                      ? ''
                      : date === 15
                        ? 'bg-sage text-white font-medium'
                        : date < 10
                          ? 'bg-neutral-100 text-neutral-300'
                          : 'bg-white text-neutral-600 border border-neutral-200 hover:border-sage cursor-pointer'
                  }`}
                >
                  {date}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Time slots hint */}
      <div className="mt-3 flex gap-1.5 justify-center">
        <div className="px-2 py-1 bg-neutral-100 rounded text-[8px] text-neutral-400">9:00 AM</div>
        <div className="px-2 py-1 bg-sage/10 border border-sage rounded text-[8px] text-sage font-medium">
          11:00 AM
        </div>
        <div className="px-2 py-1 bg-neutral-100 rounded text-[8px] text-neutral-400">2:00 PM</div>
      </div>
    </div>
  );
}

/** Mockup: After booking - client portal */
function AfterBookingMockup() {
  return (
    <div className="h-full bg-white overflow-hidden p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-neutral-200">
        <div className="w-8 h-8 rounded-full bg-sage/20 flex items-center justify-center">
          <div className="w-4 h-4 rounded-full bg-sage/40" />
        </div>
        <div>
          <div className="h-2.5 w-24 bg-neutral-800 rounded mb-1" />
          <div className="h-2 w-16 bg-neutral-300 rounded" />
        </div>
        <div className="ml-auto px-2 py-1 bg-sage/10 rounded text-[8px] text-sage font-medium">
          Confirmed
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-neutral-50 rounded-lg p-2 text-center">
          <div className="text-[8px] text-neutral-400 mb-0.5">Date</div>
          <div className="h-2 w-10 bg-neutral-800 rounded mx-auto" />
        </div>
        <div className="bg-neutral-50 rounded-lg p-2 text-center">
          <div className="text-[8px] text-neutral-400 mb-0.5">Time</div>
          <div className="h-2 w-12 bg-neutral-800 rounded mx-auto" />
        </div>
        <div className="bg-neutral-50 rounded-lg p-2 text-center">
          <div className="text-[8px] text-neutral-400 mb-0.5">Package</div>
          <div className="h-2 w-14 bg-neutral-800 rounded mx-auto" />
        </div>
      </div>

      {/* Shared documents */}
      <div className="text-[9px] font-medium text-neutral-700 mb-2">Shared Files</div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200">
          <div className="w-6 h-7 bg-sage/20 rounded flex items-center justify-center">
            <div className="text-[6px] text-sage font-bold">PDF</div>
          </div>
          <div className="flex-1">
            <div className="h-2 w-20 bg-neutral-700 rounded mb-0.5" />
            <div className="h-1.5 w-12 bg-neutral-300 rounded" />
          </div>
          <div className="text-[7px] text-sage">View</div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200">
          <div className="w-6 h-7 bg-amber-100 rounded flex items-center justify-center">
            <div className="text-[6px] text-amber-600 font-bold">$</div>
          </div>
          <div className="flex-1">
            <div className="h-2 w-16 bg-neutral-700 rounded mb-0.5" />
            <div className="h-1.5 w-10 bg-neutral-300 rounded" />
          </div>
          <div className="px-1.5 py-0.5 bg-green-100 rounded text-[6px] text-green-700">Paid</div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-neutral-50 rounded-lg border border-neutral-200">
          <div className="w-6 h-7 bg-blue-100 rounded flex items-center justify-center">
            <div className="text-[6px] text-blue-600 font-bold">?</div>
          </div>
          <div className="flex-1">
            <div className="h-2 w-24 bg-neutral-700 rounded mb-0.5" />
            <div className="h-1.5 w-14 bg-neutral-300 rounded" />
          </div>
          <div className="text-[7px] text-sage">Fill out</div>
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
        {activeTab === 'storefront' &&
          'Conversion-optimized pricing with psychology-backed tier design'}
        {activeTab === 'booking' && 'Guided booking that converts visitors to clients'}
        {activeTab === 'after-booking' && 'Shared space for client details and follow-ups'}
      </p>
    </div>
  );
}
