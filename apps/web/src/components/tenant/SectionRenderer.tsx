import type { Section, TenantPublicDto } from '@macon/contracts';
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

  return (
    <>
      {sections.map((section, index) => {
        const absoluteIndex = indexOffset + index;
        const sectionKey = `${section.type}-${absoluteIndex}`;

        // Render based on section type
        const sectionComponent = (() => {
          switch (section.type) {
            case 'hero':
              return <HeroSection {...section} tenant={tenant} basePath={basePath} />;
            case 'text':
              return <TextSection {...section} tenant={tenant} />;
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
            default: {
              const _exhaustive: never = section;
              return _exhaustive;
            }
          }
        })();

        // Wrap in a div with data attributes for Build Mode selection and highlighting
        if (isEditMode) {
          return (
            <div
              key={sectionKey}
              data-section-index={absoluteIndex}
              data-section-type={section.type}
              // Add section ID for ID-based highlighting (preferred over index-based)
              {...('id' in section && section.id ? { 'data-section-id': section.id } : {})}
            >
              {sectionComponent}
            </div>
          );
        }

        // Normal mode - no wrapper needed
        return <div key={sectionKey}>{sectionComponent}</div>;
      })}
    </>
  );
}
