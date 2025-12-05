/**
 * TabNavigation Component
 *
 * Elegant pill-style tab navigation for dashboard sections
 * Design: Minimal, rounded pills with sage accent on active state
 */

import {
  Package,
  CalendarOff,
  Calendar,
  Palette,
  CreditCard,
  Bell,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ANIMATION_TRANSITION } from '@/lib/animation-constants';

export type DashboardTab =
  | 'packages'
  | 'blackouts'
  | 'bookings'
  | 'branding'
  | 'payments'
  | 'reminders'
  | 'settings';

interface TabNavigationProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs: { id: DashboardTab; label: string; icon: typeof Package }[] = [
    { id: 'packages', label: 'Packages', icon: Package },
    { id: 'blackouts', label: 'Blackouts', icon: CalendarOff },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'payments', label: 'Payments', icon: CreditCard },
    { id: 'reminders', label: 'Reminders', icon: Bell },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="relative">
      {/* Subtle background container */}
      <div className="bg-surface-alt/50 rounded-2xl p-1.5 border border-sage-light/10">
        <nav className="flex flex-wrap gap-1" role="tablist" aria-label="Dashboard sections">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                id={`${tab.id}-tab`}
                onClick={() => onTabChange(tab.id)}
                role="tab"
                aria-selected={isActive}
                aria-controls={`${tab.id}-panel`}
                className={cn(
                  `relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium ${ANIMATION_TRANSITION.DEFAULT} min-h-[44px]`,
                  isActive
                    ? 'bg-white text-text-primary shadow-soft'
                    : 'text-text-muted hover:text-text-primary hover:bg-white/50'
                )}
              >
                <Icon
                  className={cn(
                    `w-4 h-4 ${ANIMATION_TRANSITION.COLORS}`,
                    isActive ? 'text-sage' : 'text-text-muted'
                  )}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>

                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-sage rounded-full" />
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
