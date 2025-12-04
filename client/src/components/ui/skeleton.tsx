import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Accessible label for screen readers */
  label?: string;
}

export function Skeleton({ className, label = 'Loading...', ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-700', className)}
      {...props}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Shimmer effect skeleton with gradient animation
 * Use this for a more polished loading experience
 */
export function SkeletonShimmer({ className, label = 'Loading...', ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        'relative overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-700',
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * Package Card Skeleton
 * Matches the dimensions and layout of PackageCard component
 */
export function PackageCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-macon-navy-200 bg-white shadow-sm dark:border-macon-navy-700 dark:bg-macon-navy-800">
      {/* Image skeleton */}
      <SkeletonShimmer className="h-48 w-full rounded-none" />

      <div className="p-6">
        {/* Title */}
        <SkeletonShimmer className="mb-3 h-6 w-3/4" />

        {/* Description lines */}
        <SkeletonShimmer className="mb-2 h-4 w-full" />
        <SkeletonShimmer className="mb-4 h-4 w-5/6" />

        {/* Price and button row */}
        <div className="flex items-center justify-between">
          <SkeletonShimmer className="h-8 w-24" />
          <SkeletonShimmer className="h-10 w-28 rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * Table Skeleton
 * Generic table loading skeleton with configurable rows
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {/* Table header */}
      <div className="flex items-center gap-4 border-b border-macon-navy-200 pb-3 dark:border-macon-navy-700">
        <SkeletonShimmer className="h-4 w-32" />
        <SkeletonShimmer className="h-4 w-48" />
        <SkeletonShimmer className="h-4 w-24" />
        <SkeletonShimmer className="ml-auto h-4 w-20" />
      </div>

      {/* Table rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-3">
          <SkeletonShimmer className="h-4 w-32" />
          <SkeletonShimmer className="h-4 w-48" />
          <SkeletonShimmer className="h-4 w-24" />
          <SkeletonShimmer className="ml-auto h-8 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/**
 * Metric Card Skeleton
 * Matches the DashboardMetrics card layout
 */
export function MetricCardSkeleton() {
  return (
    <div className="rounded-lg border border-macon-navy-700 bg-macon-navy-800 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Label */}
          <SkeletonShimmer className="mb-2 h-4 w-24" />

          {/* Value */}
          <SkeletonShimmer className="mb-1 h-8 w-32" />
        </div>

        {/* Icon */}
        <SkeletonShimmer className="h-12 w-12 rounded-md" />
      </div>
    </div>
  );
}

/**
 * Form Skeleton
 * Generic form loading state
 */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <SkeletonShimmer className="h-4 w-24" />
          <SkeletonShimmer className="h-10 w-full rounded-md" />
        </div>
      ))}

      {/* Submit button skeleton */}
      <SkeletonShimmer className="h-10 w-32 rounded-md" />
    </div>
  );
}
