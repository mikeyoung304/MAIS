/**
 * Tenant Branding Hook
 *
 * Shared hook for applying tenant branding (colors, fonts).
 * Used by both TenantStorefrontLayout and WidgetApp to maintain consistent
 * branding application across all tenant-facing surfaces.
 *
 * @module useTenantBranding
 */

import { useEffect } from 'react';
import type { TenantBrandingDto } from '@macon/contracts';

/**
 * Tenant branding configuration
 * Supports both storefront and widget branding needs
 */
export interface TenantBranding {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  logoUrl?: string;
}

/**
 * Apply tenant branding to the document
 *
 * Maps branding properties to CSS variables used across the application:
 *
 * **Storefront Variables:**
 * - `--color-primary`, `--macon-navy` ← primaryColor
 * - `--color-secondary`, `--macon-orange` ← secondaryColor
 * - `--color-accent`, `--macon-teal` ← accentColor
 * - `--color-background` ← backgroundColor
 *
 * **Widget Variables:**
 * - `--primary-color` ← primaryColor
 * - `--secondary-color` ← secondaryColor
 * - `--font-family` ← fontFamily
 *
 * @param branding - Tenant branding configuration (null/undefined = no branding)
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { data: tenant } = useQuery(['tenant']);
 *   useTenantBranding(tenant?.branding);
 *   return <div>Branded content</div>;
 * }
 * ```
 */
export function useTenantBranding(branding?: TenantBranding | TenantBrandingDto | null): void {
  // Destructure specific branding properties to avoid unnecessary re-renders
  // when the branding object reference changes but values remain the same
  const {
    primaryColor,
    secondaryColor,
    accentColor,
    backgroundColor,
    fontFamily,
  } = branding || {};

  useEffect(() => {
    // Early return if no branding values are present
    if (!primaryColor && !secondaryColor && !accentColor && !backgroundColor && !fontFamily) {
      return;
    }

    const root = document.documentElement;
    const appliedVariables: string[] = [];

    // ========================================================================
    // Color Mappings
    // ========================================================================

    // Primary color: Navy in storefront, primary in widget
    if (primaryColor) {
      const primaryVars = ['--color-primary', '--macon-navy', '--primary-color'];
      primaryVars.forEach((varName) => {
        root.style.setProperty(varName, primaryColor);
        appliedVariables.push(varName);
      });
    }

    // Secondary color: Orange in storefront, secondary in widget
    if (secondaryColor) {
      const secondaryVars = ['--color-secondary', '--macon-orange', '--secondary-color'];
      secondaryVars.forEach((varName) => {
        root.style.setProperty(varName, secondaryColor);
        appliedVariables.push(varName);
      });
    }

    // Accent color: Teal in storefront (success color mapping)
    if (accentColor) {
      const accentVars = ['--color-accent', '--macon-teal'];
      accentVars.forEach((varName) => {
        root.style.setProperty(varName, accentColor);
        appliedVariables.push(varName);
      });
    }

    // Background color: Applies to body element as well
    if (backgroundColor) {
      root.style.setProperty('--color-background', backgroundColor);
      appliedVariables.push('--color-background');
      document.body.style.backgroundColor = backgroundColor;
    }

    // ========================================================================
    // Font Family
    // ========================================================================

    if (fontFamily) {
      root.style.setProperty('--font-family', fontFamily);
      appliedVariables.push('--font-family');
    }

    // ========================================================================
    // Cleanup
    // ========================================================================

    return () => {
      // Remove all applied CSS variables
      appliedVariables.forEach((varName) => {
        root.style.removeProperty(varName);
      });

      // Reset body background if it was set
      if (backgroundColor) {
        document.body.style.backgroundColor = '';
      }
    };
  }, [primaryColor, secondaryColor, accentColor, backgroundColor, fontFamily]);
}
