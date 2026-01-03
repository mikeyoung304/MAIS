'use client';

import { ReactNode } from 'react';

interface BrowserFrameProps {
  children: ReactNode;
  url?: string;
  height?: string;
}

/**
 * BrowserFrame - Fake browser chrome wrapper for mockup displays
 *
 * Provides a consistent browser window appearance with:
 * - Traffic light dots (macOS style)
 * - URL bar with customizable domain
 * - Content area with configurable height
 */
export function BrowserFrame({
  children,
  url = 'yourname.gethandled.ai',
  height = 'h-[400px] md:h-[480px]',
}: BrowserFrameProps) {
  return (
    <div className="bg-surface-alt rounded-2xl border border-neutral-800 overflow-hidden max-w-lg mx-auto shadow-xl">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 bg-neutral-800/50 border-b border-neutral-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-neutral-700" />
          <div className="w-3 h-3 rounded-full bg-neutral-700" />
          <div className="w-3 h-3 rounded-full bg-neutral-700" />
        </div>
        <div className="flex-1 mx-4">
          <div className="bg-neutral-800 rounded-md px-3 py-1 text-xs text-text-muted max-w-xs mx-auto text-center">
            {url}
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className={height}>{children}</div>
    </div>
  );
}
