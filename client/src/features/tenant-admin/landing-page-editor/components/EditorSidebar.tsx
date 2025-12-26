/**
 * EditorSidebar - Sidebar for landing page editor
 *
 * Features:
 * - Active sections list (can be toggled off)
 * - Available sections list (can be added)
 * - Visual indicator for unsaved changes
 */

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { SectionCard } from './SectionCard';
import type { SectionType } from '../hooks/useLandingPageEditor';

interface EditorSidebarProps {
  activeSections: SectionType[];
  availableSections: SectionType[];
  sectionNames: Record<SectionType, string>;
  onToggleSection: (section: SectionType, enabled: boolean) => void;
  hasChanges: boolean;
  disabled?: boolean;
}

export function EditorSidebar({
  activeSections,
  availableSections,
  sectionNames,
  onToggleSection,
  hasChanges,
  disabled = false,
}: EditorSidebarProps) {
  return (
    <aside className="w-72 bg-background border-r flex flex-col h-full">
      {/* Header with status */}
      <div className="p-4 border-b">
        <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground mb-3">
          Sections
        </h2>
        {hasChanges ? (
          <Badge
            variant="outline"
            className="w-full justify-center gap-1 bg-amber-50 text-amber-700 border-amber-300"
          >
            <AlertTriangle className="h-3 w-3" />
            Unsaved changes
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="w-full justify-center gap-1 bg-green-50 text-green-700 border-green-300"
          >
            <CheckCircle className="h-3 w-3" />
            Published
          </Badge>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Active sections */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Active Sections
            </h3>
            {activeSections.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No sections active</p>
            ) : (
              <div className="space-y-2">
                {activeSections.map((section) => (
                  <SectionCard
                    key={section}
                    section={section}
                    name={sectionNames[section]}
                    isActive={true}
                    isLocked={section === 'segmentSelector'}
                    onToggle={() => onToggleSection(section, false)}
                    disabled={disabled}
                  />
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Available sections */}
          <div>
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Available Sections
            </h3>
            {availableSections.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">All sections active</p>
            ) : (
              <div className="space-y-2">
                {availableSections.map((section) => (
                  <SectionCard
                    key={section}
                    section={section}
                    name={sectionNames[section]}
                    isActive={false}
                    onToggle={() => onToggleSection(section, true)}
                    disabled={disabled}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
