/**
 * Tenant Branding Hook
 *
 * Shared hook for applying tenant branding (colors, fonts, custom CSS).
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
  customCss?: string; // For WidgetApp custom CSS injection
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
 * **Custom CSS:**
 * - If `customCss` is provided, injects a `<style>` element into document head
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
  useEffect(() => {
    if (!branding) return;

    const root = document.documentElement;
    const appliedVariables: string[] = [];

    // ========================================================================
    // Color Mappings
    // ========================================================================

    // Primary color: Navy in storefront, primary in widget
    if (branding.primaryColor) {
      const primaryVars = ['--color-primary', '--macon-navy', '--primary-color'];
      primaryVars.forEach((varName) => {
        root.style.setProperty(varName, branding.primaryColor!);
        appliedVariables.push(varName);
      });
    }

    // Secondary color: Orange in storefront, secondary in widget
    if (branding.secondaryColor) {
      const secondaryVars = ['--color-secondary', '--macon-orange', '--secondary-color'];
      secondaryVars.forEach((varName) => {
        root.style.setProperty(varName, branding.secondaryColor!);
        appliedVariables.push(varName);
      });
    }

    // Accent color: Teal in storefront (success color mapping)
    if (branding.accentColor) {
      const accentVars = ['--color-accent', '--macon-teal'];
      accentVars.forEach((varName) => {
        root.style.setProperty(varName, branding.accentColor!);
        appliedVariables.push(varName);
      });
    }

    // Background color: Applies to body element as well
    if (branding.backgroundColor) {
      root.style.setProperty('--color-background', branding.backgroundColor);
      appliedVariables.push('--color-background');
      document.body.style.backgroundColor = branding.backgroundColor;
    }

    // ========================================================================
    // Font Family
    // ========================================================================

    if (branding.fontFamily) {
      root.style.setProperty('--font-family', branding.fontFamily);
      appliedVariables.push('--font-family');
    }

    // ========================================================================
    // Custom CSS Injection (for widget advanced customization)
    // ========================================================================

    let customStyleEl: HTMLStyleElement | null = null;
    if (branding.customCss) {
      customStyleEl = document.createElement('style');
      customStyleEl.id = 'tenant-custom-css';
      customStyleEl.textContent = branding.customCss;
      document.head.appendChild(customStyleEl);
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
      if (branding.backgroundColor) {
        document.body.style.backgroundColor = '';
      }

      // Remove custom CSS if it was injected
      if (customStyleEl) {
        customStyleEl.remove();
      } else {
        // Fallback: remove by ID in case element was created differently
        const existingStyle = document.getElementById('tenant-custom-css');
        if (existingStyle) {
          existingStyle.remove();
        }
      }
    };
  }, [branding]);
}
