/**
 * Branding Hook
 * Fetches and applies tenant branding (colors, fonts, logo)
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../lib/api';
import type { TenantBrandingDto } from '@macon/contracts';

/**
 * Load Google Font dynamically
 */
function loadGoogleFont(fontFamily: string): void {
  if (!fontFamily || fontFamily === 'Inter') return; // Inter is default

  // Map common font families to Google Fonts URLs
  const fontUrlMap: Record<string, string> = {
    'Playfair Display':
      'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap',
    Lora: 'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap',
    Montserrat:
      'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap',
    'Cormorant Garamond':
      'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&display=swap',
    Raleway:
      'https://fonts.googleapis.com/css2?family=Raleway:wght@300;400;500;600;700&display=swap',
    'Crimson Text':
      'https://fonts.googleapis.com/css2?family=Crimson+Text:wght@400;600;700&display=swap',
    Poppins:
      'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
  };

  const fontUrl = fontUrlMap[fontFamily];
  if (!fontUrl) return;

  // Check if font is already loaded
  const existingLink = document.querySelector(`link[href="${fontUrl}"]`);
  if (existingLink) return;

  // Create and append link element
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = fontUrl;
  document.head.appendChild(link);
}

/**
 * Hook to fetch and apply tenant branding
 */
export function useBranding() {
  const {
    data: branding,
    isLoading,
    error,
  } = useQuery<TenantBrandingDto>({
    queryKey: ['tenant', 'branding'],
    queryFn: async () => {
      const response = await api.getTenantBranding();
      if (response.status === 200) {
        return response.body;
      }
      throw new Error('Failed to fetch branding');
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: false, // Don't retry on auth errors
  });

  // Apply branding CSS variables when branding is loaded
  useEffect(() => {
    if (branding) {
      const root = document.documentElement;

      // Apply color scheme
      if (branding.primaryColor) {
        root.style.setProperty('--color-primary', branding.primaryColor);
        root.style.setProperty('--macon-navy', branding.primaryColor);
      }

      if (branding.secondaryColor) {
        root.style.setProperty('--color-secondary', branding.secondaryColor);
        root.style.setProperty('--macon-orange', branding.secondaryColor);
      }

      if (branding.accentColor) {
        root.style.setProperty('--color-success', branding.accentColor);
        root.style.setProperty('--macon-teal', branding.accentColor);
      }

      if (branding.backgroundColor) {
        root.style.setProperty('--color-background', branding.backgroundColor);
        document.body.style.backgroundColor = branding.backgroundColor;
      }

      // Apply font family
      if (branding.fontFamily) {
        root.style.setProperty('--font-family', branding.fontFamily);
        loadGoogleFont(branding.fontFamily);
      }
    }
  }, [branding]);

  return {
    branding,
    isLoading,
    error,
  };
}
