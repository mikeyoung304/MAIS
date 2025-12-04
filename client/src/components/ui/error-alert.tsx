import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  className?: string;
}

/**
 * Error alert component with warning icon
 * Used across admin and tenant-admin features for displaying error messages
 */
export function ErrorAlert({ message, className = '' }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className={`flex items-center gap-2 p-4 border border-white/20 bg-macon-navy-700 rounded-lg ${className}`}
    >
      <AlertCircle className="w-5 h-5 text-white/70" />
      <span className="text-base text-white/90">{message}</span>
    </div>
  );
}
