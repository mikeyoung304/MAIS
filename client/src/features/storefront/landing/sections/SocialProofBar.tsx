import { memo } from 'react';
import { Star, Calendar, Users, Award, Heart, Check } from 'lucide-react';
import { Container } from '@/ui/Container';

type SocialProofIcon = 'star' | 'calendar' | 'users' | 'award' | 'heart' | 'check';

interface SocialProofItem {
  icon: SocialProofIcon;
  text: string;
}

interface SocialProofBarConfig {
  items: SocialProofItem[];
}

interface SocialProofBarProps {
  config: SocialProofBarConfig;
}

const iconMap: Record<SocialProofIcon, React.ComponentType<{ className?: string }>> = {
  star: Star,
  calendar: Calendar,
  users: Users,
  award: Award,
  heart: Heart,
  check: Check,
};

/**
 * Social proof bar for landing pages
 *
 * Displays a horizontal bar of trust indicators and statistics to build credibility.
 * Common uses include displaying ratings, years in business, number of customers served,
 * awards won, and other social proof metrics. Icons and text are fully configurable.
 *
 * The bar uses a responsive flexbox layout that wraps gracefully on smaller screens.
 *
 * @example
 * ```tsx
 * <SocialProofBar
 *   config={{
 *     items: [
 *       { icon: 'star', text: '4.9/5 Rating' },
 *       { icon: 'calendar', text: '15+ Years' },
 *       { icon: 'users', text: '10,000+ Guests' },
 *       { icon: 'award', text: 'Award Winning' }
 *     ]
 *   }}
 * />
 * ```
 *
 * @param props.config - Social proof bar configuration from tenant branding
 * @param props.config.items - Array of social proof items to display
 * @param props.config.items[].icon - Icon type (star, calendar, users, award, heart, check)
 * @param props.config.items[].text - Text to display next to the icon
 *
 * @see SocialProofBarConfigSchema in @macon/contracts for Zod validation
 */
export const SocialProofBar = memo(function SocialProofBar({ config }: SocialProofBarProps) {
  return (
    <section className="bg-neutral-100 py-4 border-y border-neutral-200">
      <Container>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {config.items.map((item, index) => {
            const IconComponent = iconMap[item.icon];
            return (
              <div
                key={index}
                className="flex items-center gap-2 text-neutral-700"
              >
                <IconComponent className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-sm md:text-base font-medium whitespace-nowrap">
                  {item.text}
                </span>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
});
