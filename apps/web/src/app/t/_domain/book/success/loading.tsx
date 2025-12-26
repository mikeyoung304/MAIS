import { Loader2 } from 'lucide-react';

/**
 * Loading state for the custom domain booking success page
 * Displayed while fetching booking confirmation data
 */
export default function DomainSuccessLoading() {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-macon-orange animate-spin mx-auto" />
        <p className="mt-4 text-neutral-600 text-lg">Loading confirmation...</p>
      </div>
    </div>
  );
}
