import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  message: string | null;
}

export function ErrorAlert({ message }: ErrorAlertProps) {
  if (!message) return null;

  return (
    <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <span className="text-sm text-red-700">{message}</span>
    </div>
  );
}
