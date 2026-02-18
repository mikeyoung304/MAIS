'use client';

import { useState, useRef, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import type { FAQSection as FAQSectionType, TenantPublicDto } from '@macon/contracts';

interface FAQSectionProps extends FAQSectionType {
  tenant: TenantPublicDto;
}

/**
 * FAQ section with interactive accordion
 *
 * Features:
 * - First item open by default
 * - CSS Grid height animation (0fr → 1fr)
 * - Arrow key navigation between items
 * - ARIA: aria-expanded on buttons, aria-controls on panels
 * - prefers-reduced-motion disables transitions
 * - Scroll-reveal entrance animation
 */
export function FAQSection({
  headline = 'Frequently Asked Questions',
  items,
  id: sectionId,
  tenant: _tenant,
}: FAQSectionProps) {
  const safeItems = Array.isArray(items) ? items : [];
  const [openIndex, setOpenIndex] = useState<number>(safeItems.length > 0 ? 0 : -1);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const revealRef = useScrollReveal();

  const handleToggle = useCallback((index: number) => {
    setOpenIndex((prev) => (prev === index ? -1 : index));
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      if (safeItems.length === 0) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = (index + 1) % safeItems.length;
          itemRefs.current[nextIndex]?.focus();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = (index - 1 + safeItems.length) % safeItems.length;
          itemRefs.current[prevIndex]?.focus();
          break;
        }
        case 'Home':
          e.preventDefault();
          itemRefs.current[0]?.focus();
          break;
        case 'End':
          e.preventDefault();
          itemRefs.current[safeItems.length - 1]?.focus();
          break;
      }
    },
    [safeItems.length]
  );

  if (safeItems.length === 0) {
    return null;
  }

  return (
    <section className="py-24 md:py-32">
      <div ref={revealRef} className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-bold text-primary sm:text-4xl">{headline}</h2>
        </div>

        <div className="mt-16 space-y-4" role="region" aria-label="Frequently Asked Questions">
          {safeItems.map((item, index) => {
            const isOpen = openIndex === index;
            const panelId = `faq-panel-${sectionId || 'default'}-${index}`;
            const buttonId = `faq-button-${sectionId || 'default'}-${index}`;

            return (
              <div
                key={index}
                className="overflow-hidden rounded-2xl border border-neutral-100 bg-white transition-shadow duration-300 hover:shadow-lg"
              >
                <button
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  id={buttonId}
                  type="button"
                  onClick={() => handleToggle(index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  <span className="pr-4 font-semibold text-primary">{item.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-300 motion-reduce:transition-none ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                <div
                  id={panelId}
                  aria-labelledby={buttonId}
                  className="grid transition-all duration-300 motion-reduce:transition-none"
                  style={{
                    gridTemplateRows: isOpen ? '1fr' : '0fr',
                  }}
                >
                  <div className="overflow-hidden">
                    <div className="px-6 pb-5">
                      <p className="leading-relaxed text-muted-foreground">{item.answer}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
