/**
 * LogoSection Component
 *
 * Logo upload section with help tooltip
 */

import { HelpCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LogoUploadButton } from '../LogoUploadButton';

interface LogoSectionProps {
  logoUrl: string;
  disabled?: boolean;
  onLogoUrlChange: (url: string) => void;
}

export function LogoSection({ logoUrl, disabled = false, onLogoUrlChange }: LogoSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label className="text-white/90 text-lg">Logo (Optional)</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="w-4 h-4 text-white/50 cursor-help" />
          </TooltipTrigger>
          <TooltipContent>
            <p>Upload your logo image (PNG, JPG, SVG, or WebP format, max 2MB)</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <LogoUploadButton
        currentLogoUrl={logoUrl}
        onUploadSuccess={(url) => onLogoUrlChange(url)}
        onUploadError={(errorMsg) => {
          // Error will be shown in the component itself
          if (import.meta.env.DEV) {
            console.error('Logo upload error:', errorMsg);
          }
        }}
        disabled={disabled}
      />
    </div>
  );
}
