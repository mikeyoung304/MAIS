'use client';

import { useState } from 'react';
import { Monitor, CalendarCheck, FolderOpen } from 'lucide-react';

/**
 * ProductPreviewTabs - 3-tab product preview for the landing page proof block
 *
 * Shows: Storefront | Booking flow | After booking
 * Uses placeholder frames until screenshot/video assets are available.
 */

const tabs = [
  {
    id: 'storefront',
    label: 'Storefront',
    icon: Monitor,
    placeholder: 'Preview coming soon',
    description: 'Your professional storefront with clear offerings',
  },
  {
    id: 'booking',
    label: 'Booking flow',
    icon: CalendarCheck,
    placeholder: 'Preview coming soon',
    description: 'Guided booking that converts visitors to clients',
  },
  {
    id: 'after-booking',
    label: 'After booking',
    icon: FolderOpen,
    placeholder: 'Preview coming soon',
    description: 'Shared space for client details and follow-ups',
  },
];

export function ProductPreviewTabs() {
  const [activeTab, setActiveTab] = useState('storefront');
  const activeTabData = tabs.find((t) => t.id === activeTab) || tabs[0];

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
              yourname.gethandled.ai
            </div>
          </div>
        </div>

        {/* Preview content - placeholder */}
        <div className="aspect-[16/10] flex flex-col items-center justify-center p-8">
          <activeTabData.icon className="w-12 h-12 text-sage/30 mb-4" />
          <p className="text-text-muted/70 text-sm font-medium mb-2">{activeTabData.placeholder}</p>
          <p className="text-text-muted/50 text-xs text-center max-w-xs">
            {activeTabData.description}
          </p>
        </div>
      </div>
    </div>
  );
}
