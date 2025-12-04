import { memo, useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { Container } from '@/ui/Container';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqConfig {
  headline: string;
  items: FaqItem[];
}

interface FaqSectionProps {
  config: FaqConfig;
}

interface FaqAccordionItemProps {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>, index: number) => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}

function FaqAccordionItem({
  item,
  isOpen,
  onToggle,
  index,
  onKeyDown,
  buttonRef,
}: FaqAccordionItemProps) {
  const answerId = `faq-answer-${index}`;
  const questionId = `faq-question-${index}`;

  // Defensive: handle missing/malformed answer
  const paragraphs = item?.answer?.split('\n\n').filter(Boolean) ?? [];

  return (
    <div className="border-b border-neutral-200 last:border-b-0">
      <h3>
        <button
          ref={buttonRef}
          id={questionId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={answerId}
          onClick={onToggle}
          onKeyDown={(e) => onKeyDown(e, index)}
          className="w-full py-6 text-left flex items-start justify-between gap-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg -mx-2 px-2"
        >
          <span className="text-lg font-semibold text-neutral-900 group-hover:text-primary transition-colors">
            {item?.question ?? ''}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`w-6 h-6 flex-shrink-0 text-neutral-400 transition-transform duration-300 ${
              isOpen ? 'rotate-180 text-primary' : ''
            }`}
          />
        </button>
      </h3>
      <div
        id={answerId}
        role="region"
        aria-labelledby={questionId}
        hidden={!isOpen}
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[1000px] opacity-100 pb-6' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="prose prose-neutral max-w-none">
          {paragraphs.map((paragraph, idx) => (
            <p key={idx} className="text-neutral-600 leading-relaxed mb-3 last:mb-0">
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * FAQ section for landing pages
 *
 * Displays frequently asked questions in an accessible accordion-style interface.
 * Only one FAQ item can be open at a time. Answers support multi-paragraph text
 * by splitting on double newlines.
 *
 * Implements full keyboard navigation following the WAI-ARIA accordion pattern:
 * - Enter/Space: Toggle accordion item open/closed
 * - Arrow Down: Move focus to next question (wraps to first)
 * - Arrow Up: Move focus to previous question (wraps to last)
 * - Home: Jump to first question
 * - End: Jump to last question
 *
 * Uses proper ARIA attributes (aria-expanded, aria-controls, aria-labelledby) and
 * semantic HTML for screen reader compatibility. Focus management ensures keyboard
 * users can efficiently navigate between questions.
 *
 * @example
 * ```tsx
 * <FaqSection
 *   config={{
 *     headline: "Frequently Asked Questions",
 *     items: [
 *       {
 *         question: "What's included in the tour?",
 *         answer: "All tours include a guided walk...\n\nWe also provide complimentary refreshments."
 *       },
 *       {
 *         question: "Do you accommodate dietary restrictions?",
 *         answer: "Yes! Please inform us of any dietary needs when booking."
 *       }
 *     ]
 *   }}
 * />
 * ```
 *
 * @param props.config - FAQ section configuration from tenant branding
 * @param props.config.headline - Section headline (required)
 * @param props.config.items - Array of FAQ items to display (required)
 * @param props.config.items[].question - FAQ question text (required)
 * @param props.config.items[].answer - FAQ answer text, use \n\n to separate paragraphs (required)
 *
 * @see FaqSectionConfigSchema in @macon/contracts for Zod validation
 * @see https://www.w3.org/WAI/ARIA/apg/patterns/accordion/ - WAI-ARIA accordion pattern
 */
export const FaqSection = memo(function FaqSection({ config }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Defensive: ensure items is an array
  const items = config?.items ?? [];
  if (items.length === 0) return null;

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  /**
   * Keyboard navigation handler per WAI-ARIA accordion pattern
   * @see https://www.w3.org/WAI/ARIA/apg/patterns/accordion/
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
      const lastIndex = items.length - 1;
      let targetIndex: number | null = null;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          // Move to next item, wrap to first
          targetIndex = index === lastIndex ? 0 : index + 1;
          break;
        case 'ArrowUp':
          e.preventDefault();
          // Move to previous item, wrap to last
          targetIndex = index === 0 ? lastIndex : index - 1;
          break;
        case 'Home':
          e.preventDefault();
          // Jump to first item
          targetIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          // Jump to last item
          targetIndex = lastIndex;
          break;
        default:
          // Let other keys pass through (Enter/Space handled by onClick)
          return;
      }

      // Focus the target button
      if (targetIndex !== null) {
        buttonRefs.current[targetIndex]?.focus();
      }
    },
    [items.length]
  );

  // Create ref callback for each button
  const getButtonRef = useCallback(
    (index: number) => (el: HTMLButtonElement | null) => {
      buttonRefs.current[index] = el;
    },
    []
  );

  return (
    <section className="py-16 md:py-24 bg-neutral-50">
      <Container>
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900">
              {config?.headline ?? 'FAQ'}
            </h2>
          </div>

          {/* FAQ Accordion */}
          <div
            role="presentation"
            className="bg-white rounded-2xl shadow-lg border border-neutral-100 px-6 md:px-8"
          >
            {items.map((item, index) => (
              <FaqAccordionItem
                key={index}
                item={item}
                index={index}
                isOpen={openIndex === index}
                onToggle={() => handleToggle(index)}
                onKeyDown={handleKeyDown}
                buttonRef={getButtonRef(index)}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
});
