---
status: complete
priority: p1
issue_id: "207"
tags: [accessibility, a11y, keyboard, landing-page, wcag]
dependencies: []
---

# TODO-207: FAQ Accordion Missing Full Keyboard Accessibility

## Priority: P1 (Critical)

## Status: Open

## Source: Code Review - Landing Page Implementation

## Description

The FAQ accordion has basic ARIA attributes but is missing full keyboard navigation per WAI-ARIA accordion pattern. Users should be able to navigate between accordion items using arrow keys.

## Current Implementation

```typescript
// FaqSection.tsx - Current
<button
  type="button"
  aria-expanded={isOpen}
  aria-controls={answerId}
  onClick={onToggle}
  className="..."
>
```

## Missing Features

1. **Arrow key navigation** - Up/Down arrows should move between accordion headers
2. **Home/End keys** - Jump to first/last accordion item
3. **Focus management** - Focus should follow keyboard navigation
4. **role="region"** on content panel

## Fix Required

```typescript
// FaqSection.tsx - Enhanced
function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    const lastIndex = items.length - 1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = index === lastIndex ? 0 : index + 1;
        buttonRefs.current[nextIndex]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = index === 0 ? lastIndex : index - 1;
        buttonRefs.current[prevIndex]?.focus();
        break;
      case 'Home':
        e.preventDefault();
        buttonRefs.current[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        buttonRefs.current[lastIndex]?.focus();
        break;
    }
  };

  return (
    <div role="presentation">
      {items.map((item, index) => (
        <div key={item.id || index}>
          <h3>
            <button
              ref={(el) => (buttonRefs.current[index] = el)}
              type="button"
              id={`faq-button-${index}`}
              aria-expanded={openIndex === index}
              aria-controls={`faq-panel-${index}`}
              onClick={() => setOpenIndex(openIndex === index ? null : index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className="..."
            >
              {item.question}
              <ChevronDown
                className={`transform transition-transform ${
                  openIndex === index ? 'rotate-180' : ''
                }`}
              />
            </button>
          </h3>
          <div
            id={`faq-panel-${index}`}
            role="region"
            aria-labelledby={`faq-button-${index}`}
            hidden={openIndex !== index}
          >
            {item.answer}
          </div>
        </div>
      ))}
    </div>
  );
}
```

## Alternative: Use Radix UI Accordion

Since the project already uses Radix UI, consider using their accessible Accordion component:

```typescript
import * as Accordion from '@radix-ui/react-accordion';

function FaqSection({ config }: FaqSectionProps) {
  return (
    <Accordion.Root type="single" collapsible>
      {config.faqs.map((item, index) => (
        <Accordion.Item key={item.id || index} value={`item-${index}`}>
          <Accordion.Trigger>{item.question}</Accordion.Trigger>
          <Accordion.Content>{item.answer}</Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
```

## Acceptance Criteria

- [ ] Arrow Up/Down navigates between FAQ items
- [ ] Home/End jumps to first/last item
- [ ] Focus is visible on active item
- [ ] Screen readers announce expanded/collapsed state
- [ ] Content panels have role="region"
- [ ] Manual testing with keyboard-only navigation

## Resources

- WAI-ARIA Accordion Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/accordion/
- Radix UI Accordion: https://www.radix-ui.com/docs/primitives/components/accordion

## Tags

accessibility, a11y, keyboard, landing-page, wcag
