import { CheckCircle } from 'lucide-react';

interface SuccessMessageProps {
  message: string;
  className?: string;
}

/**
 * Success message component with check icon
 * Used across admin and tenant-admin features
 */
export function SuccessMessage({ message, className = '' }: SuccessMessageProps) {
  return (
    <div
      className={`flex items-center gap-2 p-4 border border-white/20 bg-macon-navy-700 rounded-lg ${className}`}
    >
      <CheckCircle className="w-5 h-5 text-white/60" />
      <span className="text-lg font-medium text-white/90">{message}</span>
    </div>
  );
}
