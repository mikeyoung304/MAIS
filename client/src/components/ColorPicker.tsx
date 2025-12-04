/**
 * ColorPicker Component
 * Reusable color picker with hex validation and preview
 */

import { useState, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface ColorPickerProps {
  label: string;
  value?: string;
  onChange: (color: string) => void;
  className?: string;
}

/**
 * Validate hex color format
 */
function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Ensure color has # prefix
 */
function normalizeHex(color: string): string {
  const normalized = color.trim();
  if (normalized.startsWith('#')) {
    return normalized.toUpperCase();
  }
  return `#${normalized}`.toUpperCase();
}

export function ColorPicker({
  label,
  value = '#d97706',
  onChange,
  className = '',
}: ColorPickerProps) {
  const [color, setColor] = useState(value);
  const [inputValue, setInputValue] = useState(value);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Sync with external value changes
  useEffect(() => {
    if (value && isValidHex(value)) {
      setColor(value);
      setInputValue(value);
    }
  }, [value]);

  /**
   * Handle color picker change
   */
  const handlePickerChange = (newColor: string) => {
    setColor(newColor);
    setInputValue(newColor);
    onChange(newColor);
  };

  /**
   * Handle manual hex input
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Try to normalize and validate
    const normalized = normalizeHex(newValue);
    if (isValidHex(normalized)) {
      setColor(normalized);
      onChange(normalized);
    }
  };

  /**
   * Handle input blur - ensure valid format
   */
  const handleInputBlur = () => {
    const normalized = normalizeHex(inputValue);
    if (isValidHex(normalized)) {
      setInputValue(normalized);
      setColor(normalized);
      onChange(normalized);
    } else {
      // Reset to last valid color
      setInputValue(color);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-white/90">{label}</Label>

      <div className="flex gap-3 items-center">
        {/* Color preview button */}
        <button
          type="button"
          onClick={() => setIsPickerOpen(!isPickerOpen)}
          className="w-12 h-12 rounded-md border-2 border-white/20 cursor-pointer transition-all hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-macon-navy-500 focus:ring-offset-2 focus:ring-offset-navy-900"
          style={{ backgroundColor: color }}
          aria-label="Open color picker"
        />

        {/* Hex input */}
        <Input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          placeholder="#d97706"
          className="flex-1 bg-macon-navy-900 border-white/20 text-white placeholder:text-white/50 focus:border-white/30 focus:ring-macon-navy-500"
          maxLength={7}
        />
      </div>

      {/* Color picker popover */}
      {isPickerOpen && (
        <div className="relative">
          <div className="absolute z-10 mt-2 p-4 bg-macon-navy-800 border border-white/20 rounded-lg shadow-xl">
            <HexColorPicker color={color} onChange={handlePickerChange} />
            <button
              type="button"
              onClick={() => setIsPickerOpen(false)}
              className="mt-3 w-full px-4 py-2 text-sm bg-macon-orange hover:bg-macon-orange-dark text-white rounded-md transition-colors"
            >
              Done
            </button>
          </div>
          {/* Backdrop to close picker */}
          <div
            className="fixed inset-0 z-0"
            onClick={() => setIsPickerOpen(false)}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Validation hint */}
      {inputValue && !isValidHex(normalizeHex(inputValue)) && (
        <p className="text-sm text-red-400">Invalid hex color format (e.g., #d97706)</p>
      )}
    </div>
  );
}
