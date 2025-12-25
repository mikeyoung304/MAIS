---
status: pending
priority: p3
issue_id: '384'
tags: [code-review, code-quality, cleanup]
dependencies: []
---

# P3: Unused tenantName Prop in FAQAccordion

**Priority:** P3 (Nice-to-Have)
**Category:** Code Quality
**Source:** Code Review - Code Quality Review Agent
**Created:** 2025-12-25
**PR:** #18 - feat(web): add multi-page tenant sites with navigation

## Problem

The FAQAccordion component accepts a `tenantName` prop but doesn't appear to use it anywhere in the component. This creates dead code and confusion about the component's API.

## Location

- `apps/web/src/app/t/[slug]/(site)/faq/FAQAccordion.tsx` - props interface and usage

## Risk

- Minor code cleanliness issue
- Confusion for future developers about prop usage
- Unnecessary data passing through component tree

## Solution

Either:
1. Remove the unused prop if it's truly not needed
2. Use it for something meaningful (e.g., "Contact {tenantName}" in CTA)

```typescript
// Option 1: Remove if unused
interface FAQAccordionProps {
  faqItems: FaqItem[];
  basePath: string;
  // tenantName: string; // REMOVED
}

// Option 2: Use it in the CTA section
<p>
  Still have questions? Contact {tenantName} directly.
</p>
```

## Acceptance Criteria

- [ ] Verify if tenantName is actually used
- [ ] Remove prop if unused, or use it meaningfully
- [ ] Update prop interface documentation

## Related Files

- `apps/web/src/app/t/[slug]/(site)/faq/FAQAccordion.tsx`
- `apps/web/src/app/t/[slug]/(site)/faq/page.tsx`
- `apps/web/src/app/t/_domain/faq/page.tsx`
