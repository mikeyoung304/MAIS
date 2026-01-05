'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';

/**
 * Build Mode Layout
 *
 * Full-screen layout for the Build Mode editor.
 * Does NOT include the normal admin sidebar or Growth Assistant panel.
 * This allows the split-screen editor to use the full viewport.
 */
export default function BuildModeLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={['TENANT_ADMIN']}>
      <div className="h-screen w-screen overflow-hidden">{children}</div>
    </ProtectedRoute>
  );
}
