/**
 * SectionCard - Individual section card for sidebar
 *
 * Features:
 * - Toggle button to add/remove section
 * - Visual distinction for active vs available
 * - Lock indicator for required sections (segmentSelector)
 */

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Plus,
  Minus,
  Lock,
  Layout,
  Star,
  User,
  MessageSquare,
  Home,
  ImageIcon,
  HelpCircle,
  ArrowRight,
  Users,
} from 'lucide-react';
import type { SectionType } from '../hooks/useLandingPageEditor';

// Section icons
const SECTION_ICONS: Record<SectionType, typeof Layout> = {
  hero: Layout,
  socialProofBar: Star,
  segmentSelector: Users,
  about: User,
  testimonials: MessageSquare,
  accommodation: Home,
  gallery: ImageIcon,
  faq: HelpCircle,
  finalCta: ArrowRight,
};

interface SectionCardProps {
  section: SectionType;
  name: string;
  isActive: boolean;
  isLocked?: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function SectionCard({
  section,
  name,
  isActive,
  isLocked = false,
  onToggle,
  disabled = false,
}: SectionCardProps) {
  const Icon = SECTION_ICONS[section];

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-colors',
        isActive
          ? 'bg-background border-border'
          : 'bg-muted/30 border-transparent hover:bg-muted/50'
      )}
    >
      <div
        className={cn(
          'p-2 rounded-md',
          isActive ? 'bg-sage/10 text-sage' : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <span className={cn('flex-1 text-sm font-medium', !isActive && 'text-muted-foreground')}>
        {name}
      </span>
      {isLocked ? (
        <div className="p-2 text-muted-foreground" title="Required section">
          <Lock className="h-4 w-4" />
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onToggle}
          disabled={disabled}
          title={isActive ? `Remove ${name}` : `Add ${name}`}
        >
          {isActive ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}
