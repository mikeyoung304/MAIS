'use client';

import { ReactNode } from 'react';

interface BrowserFrameProps {
  children: ReactNode;
}

/**
 * BrowserFrame - Wraps demo in a browser-style chrome
 *
 * Creates the illusion of viewing a real website, adding credibility
 * to the demo. Uses dark theme to match the landing page.
 */
export function BrowserFrame({ children }: BrowserFrameProps) {
  return (
    <div className="bg-surface-alt rounded-2xl border border-neutral-800 overflow-hidden shadow-2xl">
      {/* Browser chrome header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-neutral-800/50 border-b border-neutral-800">
        {/* Traffic lights */}
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
          <div className="w-2.5 h-2.5 rounded-full bg-neutral-600" />
        </div>

        {/* URL bar */}
        <div className="flex-1 mx-3">
          <div className="bg-neutral-800 rounded-md px-3 py-1 text-[11px] text-text-muted max-w-[200px] mx-auto text-center truncate">
            alexchen.gethandled.ai
          </div>
        </div>

        {/* Spacer for symmetry */}
        <div className="w-12" />
      </div>

      {/* Content area */}
      <div className="h-[400px] sm:h-[420px] lg:h-[460px] xl:h-[480px]">{children}</div>
    </div>
  );
}
