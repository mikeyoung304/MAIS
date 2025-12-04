/**
 * BasicInfoFields Component
 *
 * Basic information fields for segment form (slug, name)
 */

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface BasicInfoFieldsProps {
  slug: string;
  name: string;
  disabled?: boolean;
  onSlugChange: (value: string) => void;
  onNameChange: (value: string) => void;
}

export function BasicInfoFields({
  slug,
  name,
  disabled = false,
  onSlugChange,
  onNameChange,
}: BasicInfoFieldsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label htmlFor="slug" className="text-white/90 text-lg">
          Slug <span className="text-destructive">*</span>
        </Label>
        <Input
          id="slug"
          type="text"
          value={slug}
          onChange={(e) => onSlugChange(e.target.value.toLowerCase())}
          placeholder="wellness-retreat"
          disabled={disabled}
          className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
          required
        />
        <p className="text-base text-white/70">
          Lowercase alphanumeric and hyphens only (e.g., 'wellness-retreat')
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name" className="text-white/90 text-lg">
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="Wellness Retreat"
          disabled={disabled}
          className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
          required
        />
      </div>
    </div>
  );
}
