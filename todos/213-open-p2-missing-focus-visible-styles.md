# TODO-213: Missing :focus-visible Styles on Interactive Elements

## Priority: P2 (Important)

## Status: Open

## Source: Code Review - Landing Page Implementation

## Description

Interactive elements in landing page sections may not have visible focus indicators, making keyboard navigation difficult for users relying on keyboard or assistive devices.

## Affected Components

- `HeroSection.tsx` - CTA button
- `FaqSection.tsx` - Accordion buttons
- `FinalCtaSection.tsx` - CTA button
- `GallerySection.tsx` - Lightbox buttons (if any)

## Current Pattern

```typescript
// Relies on Tailwind defaults which may be insufficient
<button className="bg-primary text-white px-6 py-3 rounded-lg">
  {config.ctaText}
</button>
```

## Fix Required

Add explicit focus-visible styles:

```typescript
// Consistent focus style
const focusClasses = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary';

// HeroSection.tsx
<button
  onClick={scrollToExperiences}
  className={`bg-primary text-white px-8 py-4 rounded-lg ${focusClasses}`}
>
  {config.ctaText}
</button>

// FaqSection.tsx accordion buttons
<button
  type="button"
  aria-expanded={isOpen}
  className={`w-full text-left flex justify-between items-center p-4 ${focusClasses}`}
>
  {item.question}
</button>
```

## Centralized Approach

Create shared button component or utility:

```typescript
// client/src/lib/focus-styles.ts
export const focusRingClasses =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary';

// Or in tailwind.config.js
module.exports = {
  theme: {
    extend: {
      // Custom focus ring utility
    },
  },
  plugins: [
    // Add focus-visible plugin if needed
  ],
};
```

## Testing

Use keyboard navigation to verify:
1. Tab through all interactive elements
2. Confirm focus indicator is visible
3. Test with high contrast mode
4. Verify focus ring color meets contrast requirements

## Acceptance Criteria

- [ ] All buttons have visible focus indicators
- [ ] Focus indicators meet WCAG 2.1 contrast requirements
- [ ] Consistent focus style across all sections
- [ ] Keyboard-only navigation test passes

## Tags

accessibility, a11y, focus, keyboard, landing-page
