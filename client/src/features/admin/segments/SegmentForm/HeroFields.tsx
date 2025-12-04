/**
 * HeroFields Component
 *
 * Hero section fields for segment form
 */

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ImageUploadField } from '@/components/ImageUploadField';
import { baseUrl } from '@/lib/api';

interface HeroFieldsProps {
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  disabled?: boolean;
  onHeroTitleChange: (value: string) => void;
  onHeroSubtitleChange: (value: string) => void;
  onHeroImageChange: (value: string) => void;
}

export function HeroFields({
  heroTitle,
  heroSubtitle,
  heroImage,
  disabled = false,
  onHeroTitleChange,
  onHeroSubtitleChange,
  onHeroImageChange,
}: HeroFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="heroTitle" className="text-white/90 text-lg">
            Hero Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="heroTitle"
            type="text"
            value={heroTitle}
            onChange={(e) => onHeroTitleChange(e.target.value)}
            placeholder="Welcome to Your Wellness Journey"
            disabled={disabled}
            className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="heroSubtitle" className="text-white/90 text-lg">
            Hero Subtitle
          </Label>
          <Input
            id="heroSubtitle"
            type="text"
            value={heroSubtitle}
            onChange={(e) => onHeroSubtitleChange(e.target.value)}
            placeholder="Transform your special day"
            disabled={disabled}
            className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 text-lg h-12"
          />
        </div>
      </div>

      <ImageUploadField
        label="Hero Image"
        value={heroImage}
        onChange={onHeroImageChange}
        uploadEndpoint={`${baseUrl}/v1/tenant-admin/segment-image`}
        disabled={disabled}
        maxSizeMB={5}
      />
    </>
  );
}
