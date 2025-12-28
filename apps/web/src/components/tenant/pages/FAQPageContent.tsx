import { FAQAccordion } from '../FAQAccordion';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQPageContentProps {
  faqItems: FAQItem[];
  /** Base path for links (e.g., '/t/slug' for slug routes, '' for domain routes) */
  basePath: string;
  /** Domain query parameter for custom domain routes (e.g., '?domain=example.com') */
  domainParam?: string;
}

/**
 * FAQPageContent - Shared component for FAQ page
 *
 * Used by both [slug]/faq and _domain/faq routes.
 * Wraps the FAQAccordion component for consistent page structure.
 */
export function FAQPageContent({ faqItems, basePath, domainParam }: FAQPageContentProps) {
  return <FAQAccordion faqItems={faqItems} basePath={basePath} domainParam={domainParam} />;
}
