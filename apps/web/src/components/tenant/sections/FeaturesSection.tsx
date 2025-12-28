import {
  Globe,
  Calendar,
  CreditCard,
  Sparkles,
  Users,
  Phone,
  Check,
  Star,
  Heart,
  Zap,
  Shield,
  Award,
  Mail,
  MessageCircle,
  Camera,
  FileText,
  Settings,
  TrendingUp,
  Clock,
  MapPin,
  type LucideIcon,
} from 'lucide-react';

import type { FeaturesSection as FeaturesSectionType, TenantPublicDto } from '@macon/contracts';

interface FeaturesSectionProps extends FeaturesSectionType {
  tenant: TenantPublicDto;
}

/**
 * Icon mapping from string names to Lucide icons
 * Supports common icons for feature grids
 */
const iconMap: Record<string, LucideIcon> = {
  Globe,
  Calendar,
  CreditCard,
  Sparkles,
  Users,
  Phone,
  Check,
  Star,
  Heart,
  Zap,
  Shield,
  Award,
  Mail,
  MessageCircle,
  Camera,
  FileText,
  Settings,
  TrendingUp,
  Clock,
  MapPin,
};

/**
 * Features section component for tenant landing pages
 *
 * Features:
 * - Icon + title + description grid
 * - Configurable 2, 3, or 4 column layout
 * - Hover effects with shadow and transform
 * - Dynamic icon rendering from Lucide
 */
export function FeaturesSection({
  headline,
  subheadline,
  features,
  columns = 3,
  backgroundColor = 'white',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tenant: _tenant,
}: FeaturesSectionProps) {
  const bgClass =
    backgroundColor === 'neutral'
      ? 'bg-neutral-50 dark:bg-neutral-900'
      : 'bg-white dark:bg-neutral-950';
  const gridCols = {
    2: 'md:grid-cols-2',
    3: 'md:grid-cols-2 lg:grid-cols-3',
    4: 'md:grid-cols-2 lg:grid-cols-4',
  }[columns];

  return (
    <section className={`${bgClass} py-32 md:py-40 px-6`} aria-labelledby="features-heading">
      <div className="max-w-3xl mx-auto text-center mb-16">
        <h2
          id="features-heading"
          className="font-serif text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary leading-[1.15] tracking-tight"
        >
          {headline}
        </h2>
        {subheadline && (
          <p className="mt-8 text-xl md:text-2xl font-light leading-relaxed text-text-muted">
            {subheadline}
          </p>
        )}
      </div>

      <div className={`max-w-5xl mx-auto grid gap-6 ${gridCols}`}>
        {features.map((feature) => {
          const IconComponent = iconMap[feature.icon] || Globe;

          return (
            <div
              key={feature.title}
              className="bg-white dark:bg-neutral-900 rounded-3xl p-8 shadow-lg border border-neutral-100 dark:border-neutral-800 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-2xl bg-sage/10 flex items-center justify-center mb-6">
                <IconComponent className="h-6 w-6 text-sage" />
              </div>
              <h3 className="font-semibold text-lg text-text-primary mb-2">{feature.title}</h3>
              <p className="text-text-muted">{feature.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
