import { Loader2 } from 'lucide-react';

/**
 * Build Mode Loading State
 *
 * Shown while the Build Mode page is loading.
 */
export default function BuildModeLoading() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-neutral-50">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-sage" />
        <span className="text-sm text-neutral-500">Loading Build Mode...</span>
      </div>
    </div>
  );
}
