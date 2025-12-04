import { AlertCircle } from 'lucide-react';

interface ErrorStateProps {
  error: string;
}

/**
 * ErrorState - Displays error message when booking details cannot be loaded
 */
export function ErrorState({ error }: ErrorStateProps) {
  return (
    <div className="p-6 border border-white/20 bg-macon-navy-700 rounded-lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-white/70 mt-0.5" />
        <p className="text-lg font-medium text-white">{error}</p>
      </div>
    </div>
  );
}
