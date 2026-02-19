'use client';

import React from 'react';
import type { Section, TenantPublicDto } from '@macon/contracts';
import { logger } from '@/lib/logger';
import {
  HeroSection,
  TextSection,
  GallerySection,
  TestimonialsSection,
  FAQSection,
  ContactSection,
  CTASection,
  PricingSection,
  FeaturesSection,
} from './sections';

/**
 * Map section types to anchor IDs for single-page navigation
 *
 * Issue #6 Fix: These IDs enable #about, #services, etc. anchor links
 * to scroll to the correct section on the landing page.
 *
 * NOTE: 'features' intentionally aliases to 'services' anchor (same scroll target as SegmentTiersSection).
 * navigation.ts SECTION_TYPE_TO_PAGE excludes 'features' to prevent duplicate nav items.
 */
const SECTION_TYPE_TO_ANCHOR_ID: Record<string, string> = {
  hero: 'hero',
  text: 'about', // Text section is typically used for "About" content
  about: 'about', // Canonical name for about/text content
  gallery: 'gallery',
  testimonials: 'testimonials',
  faq: 'faq',
  contact: 'contact',
  pricing: 'pricing',
  services: 'services', // Canonical name for services/features
  features: 'services', // Features section maps to "Services" nav
  custom: 'custom',
  cta: 'cta',
};

/** Minimal error boundary to isolate section crashes */
class SectionErrorBoundary extends React.Component<
  { children: React.ReactNode; sectionType: string; sectionId?: string },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    logger.error('Section render failed', {
      sectionType: this.props.sectionType,
      sectionId: this.props.sectionId,
      error: error.message,
    });
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

interface SectionRendererProps {
  /** Array of sections to render */
  sections: Section[];
  /** Tenant data for section context */
  tenant: TenantPublicDto;
  /** Base path for links (e.g., '/t/slug' for slug routes) */
  basePath?: string;
  /** Whether Build Mode is active (adds data attributes for selection) */
  isEditMode?: boolean;
  /** Starting index offset for sections (for split rendering) */
  indexOffset?: number;
}

/**
 * SectionRenderer - Renders an array of sections based on their type
 *
 * Uses discriminated union to ensure type-safe section rendering.
 * Each section is rendered with the appropriate component and passed
 * its type-specific props along with tenant context.
 *
 * @example
 * ```tsx
 * <SectionRenderer
 *   sections={config.pages.home.sections}
 *   tenant={tenant}
 *   basePath="/t/my-studio"
 * />
 * ```
 */
export function SectionRenderer({
  sections,
  tenant,
  basePath = '',
  isEditMode = false,
  indexOffset = 0,
}: SectionRendererProps) {
  if (!sections || sections.length === 0) {
    return null;
  }

  // Track assigned anchor IDs so that duplicate section types only receive an
  // id attribute on their first occurrence. Subsequent occurrences of the same
  // type get undefined, preventing duplicate DOM ids (HTML validity violation).
  const assignedAnchorIds = new Set<string>();

  return (
    <>
      {sections.map((section, index) => {
        const absoluteIndex = indexOffset + index;
        // Use stable section ID when available to prevent React remounts on reorder
        // This enables smooth transitions during AI agent updates
        const sectionKey =
          'id' in section && section.id ? section.id : `${section.type}-${absoluteIndex}`;

        // Render based on section type
        const sectionComponent = (() => {
          switch (section.type) {
            case 'hero':
              return <HeroSection {...section} tenant={tenant} basePath={basePath} />;
            case 'text':
              return <TextSection {...section} tenant={tenant} />;
            case 'about':
              // About has same shape as text; override type for component compatibility
              return <TextSection {...section} type="text" tenant={tenant} />;
            case 'gallery':
              return <GallerySection {...section} tenant={tenant} />;
            case 'testimonials':
              return <TestimonialsSection {...section} tenant={tenant} />;
            case 'faq':
              return <FAQSection {...section} tenant={tenant} />;
            case 'contact':
              return <ContactSection {...section} tenant={tenant} />;
            case 'cta':
              return <CTASection {...section} tenant={tenant} basePath={basePath} />;
            case 'pricing':
              return <PricingSection {...section} tenant={tenant} />;
            case 'features':
              return <FeaturesSection {...section} tenant={tenant} />;
            case 'services':
              // Services has same shape as features; override type for component compatibility
              return <FeaturesSection {...section} type="features" tenant={tenant} />;
            case 'custom':
              // Custom sections have no dedicated renderer yet — render null
              return null;
            default: {
              if (process.env.NODE_ENV === 'development') {
                console.warn(
                  `[SectionRenderer] Unknown section type: ${(section as { type: string }).type}`
                );
              }
              return null;
            }
          }
        })();

        // Get anchor ID for this section type (Issue #6: single-page navigation).
        // Only assign to the first occurrence of each anchor ID to avoid duplicate
        // DOM ids when a tenant has multiple sections of the same type.
        const candidateAnchorId = SECTION_TYPE_TO_ANCHOR_ID[section.type];
        const anchorId =
          candidateAnchorId && !assignedAnchorIds.has(candidateAnchorId)
            ? candidateAnchorId
            : undefined;
        if (anchorId) assignedAnchorIds.add(anchorId);

        const sectionId = 'id' in section && section.id ? section.id : undefined;

        // Wrap in a div with data attributes for Build Mode selection and highlighting
        if (isEditMode) {
          return (
            <div
              key={sectionKey}
              id={anchorId} // Issue #6: Anchor ID for single-page navigation (#about, #gallery, etc.)
              data-section-index={absoluteIndex}
              data-section-type={section.type}
              // Add section ID for ID-based highlighting (preferred over index-based)
              {...(sectionId ? { 'data-section-id': sectionId } : {})}
            >
              <SectionErrorBoundary sectionType={section.type} sectionId={sectionId}>
                {sectionComponent}
              </SectionErrorBoundary>
            </div>
          );
        }

        // Normal mode - include anchor ID for single-page navigation
        return (
          <div key={sectionKey} id={anchorId}>
            <SectionErrorBoundary sectionType={section.type} sectionId={sectionId}>
              {sectionComponent}
            </SectionErrorBoundary>
          </div>
        );
      })}
    </>
  );
}
