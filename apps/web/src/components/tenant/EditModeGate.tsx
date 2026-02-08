'use client';

import { useSearchParams } from 'next/navigation';

interface EditModeGateProps {
  children: React.ReactNode;
}

/**
 * Suppresses storefront chrome (nav, chat, CTA, footer) when in edit mode.
 *
 * Gate: BOTH `?edit=true` AND `?token=<present>` AND inside an iframe.
 * - edit=true alone is not sufficient (public URL degradation vector)
 * - token presence confirms this is a legitimate preview from the dashboard
 * - iframe check confirms this is embedded, not a direct visit
 */
export function EditModeGate({ children }: EditModeGateProps) {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const hasToken = !!searchParams.get('token');
  const isInIframe = typeof window !== 'undefined' && window.parent !== window;

  // All three conditions must be true to suppress chrome
  if (isEditMode && hasToken && isInIframe) {
    return null;
  }

  return <>{children}</>;
}
