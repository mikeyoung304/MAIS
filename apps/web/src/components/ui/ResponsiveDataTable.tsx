'use client';

import * as React from 'react';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Column definition for ResponsiveDataTable.
 */
export interface Column<T> {
  /** Unique key for the column */
  key: string;
  /** Display header text */
  header: string;
  /** Function to render cell content */
  render: (item: T, index: number) => React.ReactNode;
  /** Priority for mobile display (lower = shown first, undefined = hidden on mobile) */
  mobilePriority?: number;
  /** Whether this column is sortable */
  sortable?: boolean;
  /** Custom width class */
  width?: string;
  /** Alignment */
  align?: 'left' | 'center' | 'right';
}

/**
 * Props for ResponsiveDataTable component.
 */
export interface ResponsiveDataTableProps<T> {
  /** Data items to display */
  data: T[];
  /** Column definitions */
  columns: Column<T>[];
  /** Function to get unique key for each row */
  getRowKey: (item: T, index: number) => string;
  /** Number of columns to show on mobile (default: 2) */
  mobileColumns?: number;
  /** Whether to show expand button on mobile (default: true) */
  showExpandOnMobile?: boolean;
  /** Custom class for the table container */
  className?: string;
  /** Empty state content */
  emptyState?: React.ReactNode;
  /** Current sort key */
  sortKey?: string;
  /** Current sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Callback when sort changes */
  onSort?: (key: string) => void;
  /** Whether to show loading skeleton */
  isLoading?: boolean;
  /** Number of skeleton rows to show */
  skeletonRows?: number;
}

/**
 * Mobile card view for a single row.
 */
function MobileCard<T>({
  item,
  index,
  columns,
  mobileColumns,
  showExpand,
}: {
  item: T;
  index: number;
  columns: Column<T>[];
  mobileColumns: number;
  showExpand: boolean;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Sort columns by mobile priority
  const sortedColumns = React.useMemo(() => {
    return [...columns]
      .filter((col) => col.mobilePriority !== undefined)
      .sort((a, b) => (a.mobilePriority ?? 999) - (b.mobilePriority ?? 999));
  }, [columns]);

  const visibleColumns = isExpanded ? sortedColumns : sortedColumns.slice(0, mobileColumns);
  const hasMoreColumns = sortedColumns.length > mobileColumns;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <dl className="space-y-3">
        {visibleColumns.map((col) => (
          <div key={col.key} className="flex items-start justify-between gap-4">
            <dt className="text-sm font-medium text-text-muted">{col.header}</dt>
            <dd className={cn('text-sm text-text-primary', col.align === 'right' && 'text-right')}>
              {col.render(item, index)}
            </dd>
          </div>
        ))}
      </dl>

      {showExpand && hasMoreColumns && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Show less details' : `Show ${sortedColumns.length - mobileColumns} more details`}
          className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-neutral-200 py-2 text-sm text-text-muted transition-colors hover:bg-neutral-50"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Show more ({sortedColumns.length - mobileColumns})
            </>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Skeleton row for loading state.
 */
function SkeletonRow({ columnCount }: { columnCount: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columnCount }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-neutral-200" />
        </td>
      ))}
    </tr>
  );
}

/**
 * Mobile skeleton card for loading state.
 */
function MobileSkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className="h-4 w-20 rounded bg-neutral-200" />
          <div className="h-4 w-32 rounded bg-neutral-200" />
        </div>
        <div className="flex justify-between">
          <div className="h-4 w-16 rounded bg-neutral-200" />
          <div className="h-4 w-24 rounded bg-neutral-200" />
        </div>
      </div>
    </div>
  );
}

/**
 * ResponsiveDataTable - Adaptive table that transforms to cards on mobile.
 *
 * Features:
 * - Desktop: Traditional table with sortable headers
 * - Mobile: Stacked card layout with expandable details
 * - Column priority system for mobile display
 * - Built-in loading skeletons
 * - Touch-optimized interactions
 *
 * @example
 * ```tsx
 * const columns: Column<User>[] = [
 *   {
 *     key: 'name',
 *     header: 'Name',
 *     render: (user) => user.name,
 *     mobilePriority: 1, // Always shown on mobile
 *   },
 *   {
 *     key: 'email',
 *     header: 'Email',
 *     render: (user) => user.email,
 *     mobilePriority: 2, // Shown second on mobile
 *   },
 *   {
 *     key: 'role',
 *     header: 'Role',
 *     render: (user) => <Badge>{user.role}</Badge>,
 *     mobilePriority: 3, // Expandable on mobile
 *   },
 * ];
 *
 * <ResponsiveDataTable
 *   data={users}
 *   columns={columns}
 *   getRowKey={(user) => user.id}
 *   mobileColumns={2}
 * />
 * ```
 */
export function ResponsiveDataTable<T>({
  data,
  columns,
  getRowKey,
  mobileColumns = 2,
  showExpandOnMobile = true,
  className,
  emptyState,
  sortKey,
  sortDirection,
  onSort,
  isLoading = false,
  skeletonRows = 5,
}: ResponsiveDataTableProps<T>) {
  const breakpoint = useBreakpoint();
  const isMobile = !breakpoint.isAtLeast('md');

  // Empty state
  if (!isLoading && data.length === 0) {
    return (
      <div className={cn('rounded-xl border border-neutral-200 bg-white p-8 text-center', className)}>
        {emptyState ?? (
          <p className="text-text-muted">No data available</p>
        )}
      </div>
    );
  }

  // Mobile card layout
  if (isMobile) {
    return (
      <div className={cn('space-y-3', className)}>
        {isLoading
          ? Array.from({ length: skeletonRows }).map((_, i) => <MobileSkeletonCard key={i} />)
          : data.map((item, index) => (
              <MobileCard
                key={getRowKey(item, index)}
                item={item}
                index={index}
                columns={columns}
                mobileColumns={mobileColumns}
                showExpand={showExpandOnMobile}
              />
            ))}
      </div>
    );
  }

  // Desktop table layout
  return (
    <div className={cn('overflow-hidden rounded-xl border border-neutral-200', className)}>
      <div className="overflow-x-auto">
        <table className="w-full" aria-label="Data table">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-sm font-semibold text-text-primary',
                    col.width,
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right'
                  )}
                  aria-sort={
                    col.sortable && sortKey === col.key
                      ? sortDirection === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={cn(
                        'flex w-full items-center gap-1 hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2',
                        col.align === 'right' && 'justify-end',
                        col.align === 'center' && 'justify-center'
                      )}
                      aria-label={`Sort by ${col.header}`}
                    >
                      {col.header}
                      {sortKey === col.key && (
                        <span className="text-sage">
                          {sortDirection === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      )}
                    </button>
                  ) : (
                    <div className={cn('flex items-center gap-1', col.align === 'right' && 'justify-end')}>
                      {col.header}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {isLoading
              ? Array.from({ length: skeletonRows }).map((_, i) => (
                  <SkeletonRow key={i} columnCount={columns.length} />
                ))
              : data.map((item, index) => (
                  <tr
                    key={getRowKey(item, index)}
                    className="transition-colors hover:bg-neutral-50"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3 text-sm text-text-primary',
                          col.width,
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right'
                        )}
                      >
                        {col.render(item, index)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
