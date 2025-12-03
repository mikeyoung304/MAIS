import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * EmptyState Component
 *
 * A reusable empty state component with consistent styling
 * Design: Matches landing page aesthetic with sage accents
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`bg-surface-alt rounded-2xl border border-sage-light/20 p-12 text-center ${className || ""}`}>
      <div className="max-w-sm mx-auto space-y-4">
        <div className="w-16 h-16 bg-sage/10 rounded-2xl flex items-center justify-center mx-auto">
          <Icon className="w-8 h-8 text-sage" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h3 className="font-serif text-xl font-bold text-text-primary">{title}</h3>
          <p className="text-text-muted leading-relaxed">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}
