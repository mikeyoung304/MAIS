'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-client';
import { PageSwitcher } from './components/PageSwitcher';
import { LivePreview } from './components/LivePreview';
import { useAgentUIStore } from '@/stores/agent-ui-store';

/**
 * Website Tab - Unified Site Editor
 *
 * 3-column layout:
 * - Left: PageSwitcher (240px) - navigate pages, packages, branding
 * - Center: LivePreview (flex-1) - iframe showing /t/{slug}
 * - Right: AgentPanel (400px) - rendered by parent layout
 *
 * This consolidates the previous Branding, Pages, and Packages tabs
 * into a single visual editing experience with AI assistance.
 *
 * @see AdminSidebar.tsx for navigation mapping
 * @see tenant/layout.tsx for AgentPanel integration
 */
export default function WebsitePage() {
  const { tenantId, user } = useAuth();
  const slug = user?.slug;
  const showPreview = useAgentUIStore((state) => state.showPreview);
  const currentPage = useAgentUIStore((state) =>
    state.view.status === 'preview' ? state.view.config.currentPage : 'home'
  );

  // Initialize preview mode on mount
  useEffect(() => {
    if (tenantId) {
      showPreview('home');
    }
  }, [tenantId, showPreview]);

  if (!tenantId || !slug) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <p className="text-text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] -m-6 lg:-m-8">
      {/* Left: Page Switcher */}
      <aside className="w-60 shrink-0 border-r border-neutral-700 bg-surface-alt overflow-y-auto">
        <PageSwitcher currentPage={currentPage} tenantSlug={slug} />
      </aside>

      {/* Center: Live Preview */}
      <main className="flex-1 bg-neutral-800 min-w-0">
        <LivePreview tenantSlug={slug} currentPage={currentPage} />
      </main>

      {/* Right: AgentPanel is rendered by parent layout */}
    </div>
  );
}
