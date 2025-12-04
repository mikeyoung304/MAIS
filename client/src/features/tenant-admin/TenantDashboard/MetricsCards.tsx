/**
 * MetricsCards Component
 *
 * Displays dashboard metrics in elegant card format
 * Design: Matches landing page aesthetic with sage accents,
 * soft borders, and subtle hover states
 */

import { Package, CalendarOff, Calendar, Palette, TrendingUp, Check } from 'lucide-react';

interface MetricsCardsProps {
  packagesCount: number;
  blackoutsCount: number;
  bookingsCount: number;
  hasBranding: boolean;
}

export function MetricsCards({
  packagesCount,
  blackoutsCount,
  bookingsCount,
  hasBranding,
}: MetricsCardsProps) {
  const metrics = [
    {
      label: 'Packages',
      value: packagesCount,
      icon: Package,
      description: 'Active offerings',
      accent: 'sage',
    },
    {
      label: 'Bookings',
      value: bookingsCount,
      icon: Calendar,
      description: 'Total confirmed',
      accent: 'sage',
      highlight: bookingsCount > 0,
    },
    {
      label: 'Blackouts',
      value: blackoutsCount,
      icon: CalendarOff,
      description: 'Blocked dates',
      accent: 'muted',
    },
    {
      label: 'Branding',
      value: hasBranding ? 'Set' : 'Not Set',
      icon: hasBranding ? Check : Palette,
      description: hasBranding ? 'Configured' : 'Needs setup',
      accent: hasBranding ? 'sage' : 'muted',
      isStatus: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => (
        <div
          key={metric.label}
          className="group relative bg-surface-alt rounded-2xl p-6 border border-sage-light/20 hover:border-sage-light/40 transition-all duration-300 hover:shadow-soft"
          style={{
            animationDelay: `${0.1 + index * 0.05}s`,
          }}
        >
          {/* Icon */}
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors ${
              metric.accent === 'sage'
                ? 'bg-sage/10 group-hover:bg-sage/15'
                : 'bg-text-muted/5 group-hover:bg-text-muted/10'
            }`}
          >
            <metric.icon
              className={`w-5 h-5 ${metric.accent === 'sage' ? 'text-sage' : 'text-text-muted'}`}
              aria-hidden="true"
            />
          </div>

          {/* Value */}
          <div className="space-y-1">
            {metric.isStatus ? (
              <div
                className={`text-lg font-semibold ${
                  metric.accent === 'sage' ? 'text-sage' : 'text-text-muted'
                }`}
              >
                {metric.value}
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-3xl font-bold text-text-primary">
                  {metric.value}
                </span>
                {metric.highlight && (
                  <TrendingUp className="w-4 h-4 text-sage" aria-hidden="true" />
                )}
              </div>
            )}
            <div className="text-sm font-medium text-text-primary">{metric.label}</div>
            <div className="text-xs text-text-muted">{metric.description}</div>
          </div>

          {/* Subtle corner accent */}
          <div
            className={`absolute top-0 right-0 w-16 h-16 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none ${
              metric.accent === 'sage' ? 'bg-sage/5' : 'bg-text-muted/5'
            }`}
            style={{
              borderRadius: '0 1rem 0 100%',
            }}
          />
        </div>
      ))}
    </div>
  );
}
