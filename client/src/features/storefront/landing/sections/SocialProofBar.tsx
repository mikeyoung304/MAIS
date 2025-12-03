/**
 * SocialProofBar Component
 *
 * Horizontal bar displaying trust indicators like ratings, years in business,
 * number of guests served, awards, etc.
 */

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

export function SocialProofBar({ config }: SocialProofBarProps) {
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
}
