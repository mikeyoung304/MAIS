import type { FAQSection as FAQSectionType, TenantPublicDto } from '@macon/contracts';

interface FAQSectionProps extends FAQSectionType {
  tenant: TenantPublicDto;
}

/**
 * FAQ section component for questions and answers
 *
 * Features:
 * - Accordion-style Q&A display
 * - Clean card design
 */
export function FAQSection({
  headline = 'FAQ',
  items,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  tenant: _tenant,
}: FAQSectionProps) {
  const safeItems = Array.isArray(items) ? items : [];
  // Don't render if no FAQ items
  if (safeItems.length === 0) {
    return null;
  }

  return (
    <section className="py-32 md:py-40">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-bold text-primary sm:text-4xl">{headline}</h2>
        </div>

        <div className="mt-16 space-y-6">
          {safeItems.map((faq, i) => (
            <div key={i} className="rounded-2xl border border-neutral-100 bg-white p-6">
              <h3 className="font-semibold text-primary">{faq.question}</h3>
              <p className="mt-2 text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
