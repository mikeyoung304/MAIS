/**
 * FontSelector Component
 * Dropdown with font options and live preview
 * Dynamically loads Google Fonts
 */

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';

interface FontOption {
  name: string;
  displayName: string;
  googleFontUrl: string;
}

/**
 * Curated list of professional Google Fonts
 */
const FONT_OPTIONS: FontOption[] = [
  {
    name: 'Inter',
    displayName: 'Inter (Modern Sans-Serif)',
    googleFontUrl:
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  },
  {
    name: 'Playfair Display',
    displayName: 'Playfair Display (Elegant Serif)',
    googleFontUrl:
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
  },
  {
    name: 'Lora',
    displayName: 'Lora (Classic Serif)',
    googleFontUrl:
      'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
  },
  {
    name: 'Montserrat',
    displayName: 'Montserrat (Clean Sans-Serif)',
    googleFontUrl:
      'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap',
  },
  {
    name: 'Cormorant Garamond',
    displayName: 'Cormorant Garamond (Romantic Serif)',
    googleFontUrl:
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&display=swap',
  },
  {
    name: 'Raleway',
    displayName: 'Raleway (Refined Sans-Serif)',
    googleFontUrl:
      'https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap',
  },
  {
    name: 'Crimson Text',
    displayName: 'Crimson Text (Traditional Serif)',
    googleFontUrl:
      'https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&display=swap',
  },
  {
    name: 'Poppins',
    displayName: 'Poppins (Friendly Sans-Serif)',
    googleFontUrl:
      'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
  },
];

interface FontSelectorProps {
  value?: string;
  onChange: (fontFamily: string) => void;
  className?: string;
}

/**
 * Load Google Font dynamically
 */
function loadGoogleFont(fontUrl: string): void {
  // Check if font is already loaded
  const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
  if (existingLink) return;

  // Create and append link element
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fontUrl;
  document.head.appendChild(link);
}

export function FontSelector({ value = 'Inter', onChange, className = '' }: FontSelectorProps) {
  const [selectedFont, setSelectedFont] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  // Load selected font on mount and when it changes
  useEffect(() => {
    const option = FONT_OPTIONS.find((opt) => opt.name === selectedFont);
    if (option) {
      loadGoogleFont(option.googleFontUrl);
    }
  }, [selectedFont]);

  // Sync with external value changes
  useEffect(() => {
    if (value) {
      setSelectedFont(value);
    }
  }, [value]);

  /**
   * Handle font selection
   */
  const handleSelect = (fontName: string) => {
    setSelectedFont(fontName);
    onChange(fontName);
    setIsOpen(false);
  };

  const selectedOption = FONT_OPTIONS.find((opt) => opt.name === selectedFont) || FONT_OPTIONS[0];

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-white/90">Font Family</Label>

      <div className="relative">
        {/* Dropdown button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 bg-macon-navy-900 border border-white/20 rounded-md text-left text-white hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-macon-navy-500 focus:border-white/30 transition-colors"
          style={{ fontFamily: selectedOption.name }}
        >
          <span className="block truncate">{selectedOption.displayName}</span>
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg
              className={`w-5 h-5 text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </span>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <>
            <div className="absolute z-10 w-full mt-1 bg-macon-navy-800 border border-white/20 rounded-md shadow-lg max-h-96 overflow-auto">
              {FONT_OPTIONS.map((option) => {
                // Load font for preview
                loadGoogleFont(option.googleFontUrl);

                return (
                  <button
                    key={option.name}
                    type="button"
                    onClick={() => handleSelect(option.name)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      option.name === selectedFont
                        ? 'bg-macon-orange text-white'
                        : 'text-white/90 hover:bg-macon-navy-700'
                    }`}
                    style={{ fontFamily: option.name }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="block truncate">{option.displayName}</span>
                      {option.name === selectedFont && (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    {/* Preview text */}
                    <span className="block mt-1 text-sm opacity-75">
                      The quick brown fox jumps over the lazy dog
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-0"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
          </>
        )}
      </div>

      {/* Live preview */}
      <div
        className="p-4 bg-macon-navy-900 border border-white/20 rounded-md"
        style={{ fontFamily: selectedOption.name }}
      >
        <p className="text-white/90 text-lg mb-2">Preview:</p>
        <h3 className="text-2xl font-semibold text-white mb-1">Your Business Package</h3>
        <p className="text-white/70">Experience growth with our professional service packages.</p>
      </div>
    </div>
  );
}
