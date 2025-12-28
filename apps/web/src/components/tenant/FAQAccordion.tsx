'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQAccordionProps {
  faqItems: FAQItem[];
  basePath: string;
  /** Domain query parameter for custom domain routes (e.g., '?domain=example.com') */
  domainParam?: string;
}

/**
 * FAQAccordion - Accessible accordion component
 *
 * Features:
 * - First item open by default
 * - Arrow key navigation between items
 * - Smooth animations with reduced motion support
 * - Empty state when no FAQs configured
 */
export function FAQAccordion({ faqItems, basePath, domainParam }: FAQAccordionProps) {
  // Build contact link with optional domain param
  const contactHref = domainParam ? `/contact${domainParam}` : `${basePath}/contact`;
  // Accordion state - first item open by default
  const [openIndex, setOpenIndex] = useState<number>(faqItems.length > 0 ? 0 : -1);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleToggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? -1 : index));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (faqItems.length === 0) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = (index + 1) % faqItems.length;
          itemRefs.current[nextIndex]?.focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = (index - 1 + faqItems.length) % faqItems.length;
          itemRefs.current[prevIndex]?.focus();
          break;
        }
        case 'Home':
          e.preventDefault();
          itemRefs.current[0]?.focus();
          break;
        case 'End':
          e.preventDefault();
          itemRefs.current[faqItems.length - 1]?.focus();
          break;
      }
    },
    [faqItems.length]
  );

  return (
    <div>
      {/* Hero Section */}
      <section className="py-32 md:py-40">
        <div className="mx-auto max-w-3xl px-6">
          <div className="text-center">
            <h1 className="font-serif text-4xl font-bold text-text-primary sm:text-5xl md:text-6xl leading-[1.1] tracking-tight">
              Frequently Asked Questions.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted md:text-xl">
              Find answers to common questions about our services.
            </p>
          </div>

          {/* FAQ Accordion */}
          {faqItems.length === 0 ? (
            <div className="mt-16 text-center py-16 rounded-3xl border border-neutral-100 bg-white">
              <p className="text-lg text-text-muted">No FAQs available yet. Have a question?</p>
              <Button asChild variant="sage" className="mt-6">
                <Link href={contactHref}>Contact Us</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-16 space-y-4" role="region" aria-label="Frequently Asked Questions">
              {faqItems.map((item, index) => {
                const isOpen = openIndex === index;
                const panelId = `faq-panel-${index}`;
                const buttonId = `faq-button-${index}`;

                return (
                  <div
                    key={index}
                    className="rounded-2xl border border-neutral-100 bg-white overflow-hidden transition-shadow duration-300 hover:shadow-lg"
                  >
                    <button
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      id={buttonId}
                      type="button"
                      onClick={() => handleToggle(index)}
                      onKeyDown={(e) => handleKeyDown(e, index)}
                      className="flex w-full items-center justify-between px-6 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-inset"
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                    >
                      <span className="font-semibold text-text-primary pr-4">{item.question}</span>
                      <ChevronDown
                        className={`h-5 w-5 flex-shrink-0 text-text-muted transition-transform duration-300 motion-reduce:transition-none ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                    <div
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      className="grid transition-all duration-300 motion-reduce:transition-none"
                      style={{
                        gridTemplateRows: isOpen ? '1fr' : '0fr',
                      }}
                    >
                      <div className="overflow-hidden">
                        <div className="px-6 pb-5">
                          <p className="text-text-muted leading-relaxed">{item.answer}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-surface-alt py-32 md:py-40">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-serif text-3xl font-bold text-text-primary sm:text-4xl">
            Still have questions?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-text-muted">
            We&apos;re here to help. Reach out and we&apos;ll get back to you as soon as possible.
          </p>
          <Button asChild variant="sage" size="xl" className="mt-10">
            <Link href={contactHref}>Contact Us</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
