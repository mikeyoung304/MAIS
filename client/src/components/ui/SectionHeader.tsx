import { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

/**
 * Reusable Section Header Component
 *
 * Displays a consistent header pattern with icon, title, and optional description
 * Used across admin panels for visual consistency
 */
export function SectionHeader({ icon: Icon, title, description }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 bg-sage/10 rounded-xl flex items-center justify-center">
        <Icon className="w-5 h-5 text-sage" aria-hidden="true" />
      </div>
      <div>
        <h3 className="font-serif text-xl font-bold text-text-primary">{title}</h3>
        {description && <p className="text-sm text-text-muted">{description}</p>}
      </div>
    </div>
  );
}
