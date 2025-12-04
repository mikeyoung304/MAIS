import { Edit, Trash2, Loader2, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MobileActionDropdown } from '@/components/shared/MobileActionDropdown';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import type { SegmentDto } from '@macon/contracts';

interface SegmentsListProps {
  segments: SegmentDto[];
  onEdit: (segment: SegmentDto) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

/**
 * SegmentsList Component
 * Design: Matches landing page aesthetic with sage accents
 */
export function SegmentsList({ segments, onEdit, onDelete, isLoading = false }: SegmentsListProps) {
  if (isLoading) {
    return (
      <div className="bg-surface-alt rounded-2xl border border-sage-light/20 p-12 text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-sage" />
        <p className="text-text-muted mt-3">Loading segments...</p>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="Ready to organize your services"
        description="Create segments to group related packages together. Segments help clients find exactly what they need."
      />
    );
  }

  return (
    <div className="space-y-3">
      {segments.map((segment, index) => (
        <div
          key={segment.id}
          className="group bg-surface-alt rounded-2xl border border-sage-light/20 hover:border-sage-light/40 p-5 transition-all duration-200 hover:shadow-soft"
          style={{ animationDelay: `${index * 0.05}s` }}
        >
          <div className="flex items-center gap-4">
            {/* Drag Handle / Order Indicator */}
            <div className="w-10 h-10 bg-sage/10 rounded-xl flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-sage">
                <span className="sr-only">Sort order: </span>
                {segment.sortOrder}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-serif text-lg font-bold text-text-primary">{segment.name}</h3>
                <StatusBadge status={segment.active ? 'Active' : 'Inactive'} />
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-sm text-text-muted">
                <span className="font-mono text-xs bg-surface px-2 py-0.5 rounded border border-sage-light/10">
                  <span className="sr-only">URL path: </span>/{segment.slug}
                </span>
                {segment.heroTitle && (
                  <span className="truncate max-w-[200px]">{segment.heroTitle}</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Desktop actions */}
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  onClick={() => onEdit(segment)}
                  variant="ghost"
                  size="sm"
                  className="text-text-muted hover:text-sage hover:bg-sage/10 transition-colors"
                  aria-label={`Edit segment: ${segment.name}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => onDelete(segment.id)}
                  variant="ghost"
                  size="sm"
                  className="text-text-muted hover:text-danger-600 hover:bg-danger-50 transition-colors"
                  aria-label={`Delete segment: ${segment.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Mobile dropdown */}
              <MobileActionDropdown
                actions={[
                  {
                    label: 'Edit',
                    icon: Edit,
                    onClick: () => onEdit(segment),
                  },
                  {
                    label: 'Delete',
                    icon: Trash2,
                    onClick: () => onDelete(segment.id),
                    variant: 'danger',
                  },
                ]}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
