'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-client';
import { LivePreview } from './components/LivePreview';
import { useAgentUIStore } from '@/stores/agent-ui-store';

/**
 * Website Tab - Unified Site Editor
 *
 * 2-column layout:
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

  // Initialize preview mode on mount
  useEffect(() => {
    if (tenantId) {
      showPreview();
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
      {/* Center: Live Preview */}
      <main className="flex-1 bg-neutral-800 min-w-0">
        <LivePreview tenantSlug={slug} />
      </main>

      {/* Right: AgentPanel is rendered by parent layout */}
    </div>
  );
}
