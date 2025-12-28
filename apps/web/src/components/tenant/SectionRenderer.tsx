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
export function SectionRenderer({ sections, tenant, basePath = '' }: SectionRendererProps) {
  if (!sections || sections.length === 0) {
    return null;
  }

  return (
    <>
      {sections.map((section, index) => {
        // Render based on section type
        switch (section.type) {
          case 'hero':
            return (
              <HeroSection key={`hero-${index}`} {...section} tenant={tenant} basePath={basePath} />
            );
          case 'text':
            return <TextSection key={`text-${index}`} {...section} tenant={tenant} />;
          case 'gallery':
            return <GallerySection key={`gallery-${index}`} {...section} tenant={tenant} />;
          case 'testimonials':
            return (
              <TestimonialsSection key={`testimonials-${index}`} {...section} tenant={tenant} />
            );
          case 'faq':
            return <FAQSection key={`faq-${index}`} {...section} tenant={tenant} />;
          case 'contact':
            return <ContactSection key={`contact-${index}`} {...section} tenant={tenant} />;
          case 'cta':
            return (
              <CTASection key={`cta-${index}`} {...section} tenant={tenant} basePath={basePath} />
            );
          case 'pricing':
            return <PricingSection key={`pricing-${index}`} {...section} tenant={tenant} />;
          case 'features':
            return <FeaturesSection key={`features-${index}`} {...section} tenant={tenant} />;
          default: {
            const _exhaustive: never = section;
            return _exhaustive;
          }
        }
      })}
    </>
  );
}
