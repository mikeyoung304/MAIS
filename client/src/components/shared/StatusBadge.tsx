import { Check, Clock, X, AlertCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatusVariant = 'success' | 'warning' | 'danger' | 'neutral';

interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
}

const variantStyles: Record<StatusVariant, string> = {
  success: 'bg-sage/10 text-sage',
  warning: 'bg-warning-100 text-warning-700',
  danger: 'bg-danger-50 text-danger-600',
  neutral: 'bg-text-muted/10 text-text-muted',
};

const variantIcons: Record<StatusVariant, LucideIcon> = {
  success: Check,
  warning: Clock,
  danger: X,
  neutral: AlertCircle,
};

/**
 * Auto-detect variant from common status strings
 */
function getVariantFromStatus(status: string): StatusVariant {
  const lower = status.toLowerCase();
  if (['active', 'confirmed', 'paid', 'success', 'connected'].includes(lower)) return 'success';
  if (['pending', 'warning'].includes(lower)) return 'warning';
  if (['inactive', 'cancelled', 'canceled', 'refunded', 'error'].includes(lower)) return 'danger';
  return 'neutral';
}

/**
 * StatusBadge Component
 *
 * A shared status badge component that provides consistent styling
 * for status indicators across the application.
 *
 * Design: Matches landing page aesthetic with sage accents
 *
 * Features:
 * - Auto-detects variant from common status strings
 * - Supports custom variant override
 * - Capitalizes status text automatically
 * - Consistent pill-shaped design with color-coded backgrounds
 * - Icons for WCAG 1.4.1 compliance (not relying solely on color)
 *
 * Accessibility:
 * - Icons have aria-hidden="true" (text provides the meaning)
 * - Status information conveyed through both icon and text
 *
 * Usage:
 * ```tsx
 * <StatusBadge status="active" />
 * <StatusBadge status="pending" />
 * <StatusBadge status="cancelled" />
 * <StatusBadge status="custom" variant="success" />
 * ```
 */
export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const resolvedVariant = variant || getVariantFromStatus(status);
  const displayText = status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const Icon = variantIcons[resolvedVariant];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full',
        variantStyles[resolvedVariant],
        className
      )}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span>{displayText}</span>
    </span>
  );
}
