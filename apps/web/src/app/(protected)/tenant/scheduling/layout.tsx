'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock, Calendar, CalendarClock, CalendarX } from 'lucide-react';

interface SubNavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const schedulingSubNav: SubNavItem[] = [
  {
    href: '/tenant/scheduling',
    label: 'Overview',
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    href: '/tenant/scheduling/appointment-types',
    label: 'Appointment Types',
    icon: <CalendarClock className="h-4 w-4" />,
  },
  {
    href: '/tenant/scheduling/availability',
    label: 'Availability',
    icon: <Clock className="h-4 w-4" />,
  },
  {
    href: '/tenant/scheduling/appointments',
    label: 'Appointments',
    icon: <Calendar className="h-4 w-4" />,
  },
  {
    href: '/tenant/scheduling/blackouts',
    label: 'Blackouts',
    icon: <CalendarX className="h-4 w-4" />,
  },
];

/**
 * Scheduling Layout
 *
 * Provides sub-navigation for scheduling-related pages:
 * - Overview: Dashboard with stats
 * - Appointment Types: CRUD for bookable services
 * - Availability: Weekly schedule rules
 * - Appointments: View booked appointments
 * - Blackouts: Block out dates
 */
export default function SchedulingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/tenant/scheduling') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <nav
        className="flex flex-wrap gap-2 border-b border-neutral-200 pb-4"
        aria-label="Scheduling sections"
      >
        {schedulingSubNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              isActive(item.href)
                ? 'bg-sage text-white shadow-md'
                : 'text-text-muted hover:bg-surface-alt hover:text-text-primary'
            }`}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Page content */}
      {children}
    </div>
  );
}
