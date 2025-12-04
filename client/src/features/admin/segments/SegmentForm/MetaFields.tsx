/**
 * MetaFields Component
 *
 * SEO metadata fields for segment form
 */

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const CharCount = ({ current, max }: { current: number; max: number }) => (
  <p className={cn('text-sm', current > max ? 'text-destructive' : 'text-white/60')}>
    {current} / {max} characters
  </p>
);

interface MetaFieldsProps {
  description: string;
  metaTitle: string;
  metaDescription: string;
  disabled?: boolean;
  onDescriptionChange: (value: string) => void;
  onMetaTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
}

export function MetaFields({
  description,
  metaTitle,
  metaDescription,
  disabled = false,
  onDescriptionChange,
  onMetaTitleChange,
  onMetaDescriptionChange,
}: MetaFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="description" className="text-white/90 text-lg">
          Description
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={3}
          placeholder="A comprehensive description for SEO..."
          disabled={disabled}
          className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="metaTitle" className="text-white/90 text-lg">
            Meta Title
          </Label>
          <Input
            id="metaTitle"
            type="text"
            value={metaTitle}
            onChange={(e) => onMetaTitleChange(e.target.value)}
            placeholder="Wellness Retreat Packages | Your Company"
            disabled={disabled}
            className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
          />
          <CharCount current={metaTitle.length} max={60} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="metaDescription" className="text-white/90 text-lg">
          Meta Description
        </Label>
        <Textarea
          id="metaDescription"
          value={metaDescription}
          onChange={(e) => onMetaDescriptionChange(e.target.value)}
          rows={3}
          placeholder="Discover our wellness retreat packages..."
          disabled={disabled}
          className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg"
        />
        <CharCount current={metaDescription.length} max={160} />
      </div>
    </>
  );
}
