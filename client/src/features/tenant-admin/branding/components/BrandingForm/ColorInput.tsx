/**
 * ColorInput Component
 *
 * Reusable color input field with both text and color picker
 */

import { Palette, HelpCircle } from 'lucide-react';
import { InputEnhanced } from '@/components/ui/input-enhanced';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ColorInputProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  helpText: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function ColorInput({
  id,
  label,
  value,
  placeholder,
  helpText,
  disabled = false,
  onChange,
}: ColorInputProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-white/90 text-lg">
          {label}
        </Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <HelpCircle className="w-4 h-4 text-white/50 cursor-help" />
          </TooltipTrigger>
          <TooltipContent>
            <p>{helpText}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex gap-3">
        <InputEnhanced
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          leftIcon={<Palette className="w-5 h-5" aria-hidden="true" />}
          className="bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30"
          disabled={disabled}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 h-14 rounded border-2 border-white/20 bg-macon-navy-900 cursor-pointer"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
