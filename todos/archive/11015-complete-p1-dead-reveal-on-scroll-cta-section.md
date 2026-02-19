---
status: pending
priority: p1
issue_id: '11015'
tags: [code-review, frontend, dead-code, css, cta]
---

# P1-02 — Dead `reveal-on-scroll` CSS Class Left in CTASection

## Problem Statement

`CTASection.tsx:31` still has `reveal-on-scroll` in its className. This class has no definition in `globals.css`. Commit `24a37db7` removed it from `TestimonialsSection.tsx` but missed `CTASection.tsx`. It's a clear PR oversight — the CTA section still animates correctly (via `sectionRef` + `useScrollReveal`), but the class is dead code.

## Findings

- **File:** `apps/web/src/components/tenant/sections/CTASection.tsx:31`
- **Code:** `<section ref={sectionRef} className="reveal-on-scroll bg-accent py-32 md:py-40">`
- **Agents:** code-simplicity-reviewer (P1), architecture-strategist (confirmed)
- **Confirmed dead:** `globals.css` defines `.reveal-visible`, `.reveal-delay-1/2/3`, and the `storefront-reveal` keyframe — but NOT `reveal-on-scroll`

## Proposed Solution

Remove `reveal-on-scroll` from the `className`:

```tsx
<section ref={sectionRef} className="bg-accent py-32 md:py-40">
```

- **Effort:** Small (1-line change)
- **Risk:** None — animation still works via `useScrollReveal` hook

## Acceptance Criteria

- [ ] `reveal-on-scroll` class removed from `CTASection.tsx`
- [ ] CTA section still animates on scroll (verify visually in dev)
- [ ] `grep -r "reveal-on-scroll" apps/web/src/` returns zero results

## Work Log

- 2026-02-18: Created from 5-agent code review; missed in PR `b0c536ce`
