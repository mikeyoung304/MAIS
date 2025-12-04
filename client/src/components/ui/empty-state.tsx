import { LucideIcon } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'compact' | 'large';
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className = '',
}: EmptyStateProps) {
  const variants = {
    compact: {
      container: 'py-8 px-4',
      iconWrapper: 'p-4 mb-3',
      icon: 'h-8 w-8',
      title: 'text-base mb-1',
      description: 'text-sm mb-4',
    },
    default: {
      container: 'py-12 px-4',
      iconWrapper: 'p-6 mb-4',
      icon: 'h-12 w-12',
      title: 'text-lg mb-2',
      description: 'text-sm mb-6',
    },
    large: {
      container: 'py-16 px-6',
      iconWrapper: 'p-8 mb-6',
      icon: 'h-16 w-16',
      title: 'text-xl mb-3',
      description: 'text-base mb-8',
    },
  };

  const v = variants[variant];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        v.container,
        className
      )}
    >
      {/* Icon with animated gradient background */}
      <div
        className={cn(
          'rounded-full bg-gradient-to-br from-macon-navy-50 to-macon-navy-100/50',
          'ring-1 ring-macon-navy-100',
          'dark:from-macon-navy-900/30 dark:to-macon-navy-800/20 dark:ring-macon-navy-700',
          'transition-transform duration-300 hover:scale-105',
          v.iconWrapper
        )}
      >
        <Icon className={cn('text-macon-navy dark:text-white/50', v.icon)} strokeWidth={1.5} />
      </div>

      {/* Title */}
      <h3 className={cn('font-semibold text-neutral-900 dark:text-neutral-100', v.title)}>
        {title}
      </h3>

      {/* Description */}
      <p className={cn('max-w-sm text-neutral-600 dark:text-neutral-400', v.description)}>
        {description}
      </p>

      {/* Optional CTA with animation */}
      {action && (
        <Button
          onClick={action.onClick}
          variant="default"
          className="animate-in fade-in-50 slide-in-from-bottom-2 duration-300"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
