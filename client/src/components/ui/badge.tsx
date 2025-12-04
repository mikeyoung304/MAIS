import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 ease-out ' +
    'relative overflow-hidden isolate focus:outline-none focus-visible:ring-2 focus-visible:ring-macon-navy/30 focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'bg-macon-navy-50 text-macon-navy ring-1 ring-inset ring-macon-navy/20 ' +
          'hover:bg-macon-navy-100 hover:ring-macon-navy/30',
        secondary:
          'bg-macon-orange-50 text-macon-orange-dark ring-1 ring-inset ring-macon-orange/20 ' +
          'hover:bg-macon-orange-100 hover:ring-macon-orange/30',
        destructive:
          'bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-600/20 ' +
          'hover:bg-danger-100 hover:ring-danger-600/30',
        outline:
          'bg-transparent text-neutral-700 ring-1 ring-inset ring-neutral-300 ' +
          'hover:bg-neutral-50 hover:ring-neutral-400',
        success:
          'bg-success-50 text-success-700 ring-1 ring-inset ring-success-600/20 ' +
          'hover:bg-success-100 hover:ring-success-600/30',
        warning:
          'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-600/20 ' +
          'hover:bg-warning-100 hover:ring-warning-600/30',
        info:
          'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20 ' +
          'hover:bg-blue-100 hover:ring-blue-600/30',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/**
 * StatusBadge - A badge with a status indicator dot
 * Used for displaying entity states (active, inactive, pending, etc.)
 */
export type StatusType = 'active' | 'inactive' | 'pending' | 'error' | 'warning';

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: StatusType;
  showDot?: boolean;
}

const statusConfig: Record<
  StatusType,
  { variant: BadgeProps['variant']; label: string; dotColor: string }
> = {
  active: { variant: 'success', label: 'Active', dotColor: 'bg-success-500' },
  inactive: { variant: 'outline', label: 'Inactive', dotColor: 'bg-neutral-400' },
  pending: { variant: 'warning', label: 'Pending', dotColor: 'bg-warning-500' },
  error: { variant: 'destructive', label: 'Error', dotColor: 'bg-danger-500' },
  warning: { variant: 'warning', label: 'Warning', dotColor: 'bg-warning-500' },
};

function StatusBadge({ status, showDot = true, className, children, ...props }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} className={cn('gap-1.5', className)} {...props}>
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full', config.dotColor)} aria-hidden="true" />
      )}
      {children || config.label}
    </Badge>
  );
}

export { Badge, StatusBadge, badgeVariants };
