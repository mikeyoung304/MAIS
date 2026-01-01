'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cva, type VariantProps } from 'class-variance-authority';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { usePrefersReducedMotion } from '@/hooks/useBreakpoint';

/**
 * Navigation item definition.
 */
export interface NavItem {
  /** Type of navigation action */
  type: 'link' | 'action';
  /** URL for link type items */
  href?: string;
  /** Click handler for action type items */
  onClick?: () => void;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Display label */
  label: string;
  /** Optional notification badge count */
  badge?: number;
  /** How to determine active state - 'exact' matches path exactly, 'prefix' matches if path starts with href */
  matchMode?: 'exact' | 'prefix';
}

const bottomNavigationVariants = cva(
  'fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-neutral-200/50 md:hidden',
  {
    variants: {
      variant: {
        default: 'w-full',
        floating: 'mx-4 mb-4 rounded-2xl shadow-elevation-3 border border-neutral-200/50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BottomNavigationProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof bottomNavigationVariants> {
  /** Navigation items to display (max 5 recommended) */
  items: NavItem[];
}

/**
 * Mobile bottom navigation component with animated active indicator.
 *
 * Features:
 * - Fixed position at bottom of viewport
 * - Animated sliding indicator using Framer Motion layoutId
 * - Badge support for notification counts
 * - Haptic feedback on tap
 * - Safe area padding for notched devices
 * - WCAG 44x44px touch targets
 * - Hidden on desktop (md:hidden)
 *
 * @example
 * ```tsx
 * <BottomNavigation
 *   items={[
 *     { type: 'link', href: '/', icon: Home, label: 'Home', matchMode: 'exact' },
 *     { type: 'link', href: '/services', icon: Briefcase, label: 'Services', matchMode: 'prefix' },
 *     { type: 'link', href: '/messages', icon: MessageSquare, label: 'Messages', badge: 3 },
 *     { type: 'action', onClick: handleSettings, icon: Settings, label: 'Settings' },
 *   ]}
 * />
 * ```
 */
export function BottomNavigation({
  items,
  variant,
  className,
  ...props
}: BottomNavigationProps) {
  const pathname = usePathname();
  const haptics = useHapticFeedback();
  const prefersReducedMotion = usePrefersReducedMotion();

  // Determine which item is active
  const activeIndex = React.useMemo(() => {
    return items.findIndex((item) => {
      if (item.type !== 'link' || !item.href) return false;

      const matchMode = item.matchMode ?? 'prefix';
      if (matchMode === 'exact') {
        return pathname === item.href;
      }
      // Prefix matching - must match exactly or start with href followed by /
      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    });
  }, [items, pathname]);

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={cn(bottomNavigationVariants({ variant }), className)}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      {...props}
    >
      <ul className="flex items-center justify-around px-2 py-2 relative">
        {items.map((item, index) => {
          const isActive = index === activeIndex;
          const Icon = item.icon;

          const handleClick = () => {
            haptics.selection();
            if (item.type === 'action' && item.onClick) {
              item.onClick();
            }
          };

          const content = (
            <>
              {/* Active indicator background */}
              {isActive && (
                prefersReducedMotion ? (
                  <div className="absolute inset-0 bg-sage/10 rounded-xl" />
                ) : (
                  <motion.div
                    layoutId="bottomNavIndicator"
                    className="absolute inset-0 bg-sage/10 rounded-xl"
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 35,
                    }}
                  />
                )
              )}

              {/* Icon container */}
              <span className="relative flex items-center justify-center">
                <Icon
                  className={cn(
                    'h-6 w-6 motion-safe:transition-colors motion-safe:duration-200',
                    isActive ? 'text-sage' : 'text-neutral-500'
                  )}
                  aria-hidden="true"
                />

                {/* Badge */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={cn(
                      'absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1',
                      'flex items-center justify-center',
                      'text-[10px] font-bold text-white',
                      'bg-danger-500 rounded-full',
                      'shadow-sm'
                    )}
                    aria-label={`${item.badge} notifications`}
                  >
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>

              {/* Label */}
              <span
                className={cn(
                  'text-xs font-medium mt-1 motion-safe:transition-colors motion-safe:duration-200',
                  isActive ? 'text-sage' : 'text-neutral-500'
                )}
              >
                {item.label}
              </span>
            </>
          );

          const sharedClasses = cn(
            'relative flex flex-col items-center justify-center',
            'min-w-[64px] min-h-[44px] px-3 py-2',
            'touch-manipulation select-none',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2',
            'rounded-xl motion-safe:transition-transform motion-safe:duration-150',
            'motion-safe:active:scale-95'
          );

          if (item.type === 'link' && item.href) {
            return (
              <li key={item.label} className="flex-1 flex justify-center">
                <Link
                  href={item.href}
                  onClick={handleClick}
                  className={sharedClasses}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {content}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.label} className="flex-1 flex justify-center">
              <button
                type="button"
                onClick={handleClick}
                className={sharedClasses}
              >
                {content}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

BottomNavigation.displayName = 'BottomNavigation';
