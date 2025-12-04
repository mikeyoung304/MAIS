/**
 * Loading component with accessibility support
 * P0/P1 Implementation
 */

interface LoadingProps {
  label?: string;
}

export const Loading = ({ label = 'Loading' }: LoadingProps) => (
  <div role="status" aria-live="polite" aria-busy="true" className="text-center py-8">
    {label}...
  </div>
);
