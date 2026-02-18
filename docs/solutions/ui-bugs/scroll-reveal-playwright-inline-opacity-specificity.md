---
title: 'Scroll-Reveal Sections Invisible in Playwright Full-Page Screenshots'
category: ui-bugs
tags:
  - scroll-reveal
  - playwright
  - css-specificity
  - intersectionobserver
  - testing
date: 2026-02-18
severity: P3
status: documented
---

# Scroll-Reveal Sections Invisible in Playwright Full-Page Screenshots

## Problem Symptom

During Playwright full-page screenshot testing, scroll-reveal sections (components using the `useScrollReveal` hook) appear completely invisible (opacity: 0). The captured screenshot shows blank space where sections should render.

Attempting to force visibility by adding the `reveal-visible` CSS class alone **has no effect**:

```javascript
// THIS DOES NOT WORK
document.querySelectorAll('.reveal-on-scroll').forEach((el) => el.classList.add('reveal-visible'));
```

## Root Cause

**Inline style specificity defeats CSS class-based animation styles.**

Two factors combine:

1. **`useScrollReveal` sets inline opacity** (`apps/web/src/hooks/useScrollReveal.ts` lines 39, 54):

   ```typescript
   el.style.opacity = '0'; // Inline style — specificity: 1000
   ```

2. **IntersectionObserver never fires in Playwright screenshots.** Below-fold elements are never in the viewport during a full-page capture, so the observer never adds `reveal-visible` or removes the inline opacity.

3. **CSS specificity hierarchy** prevents the class from winning:
   - Inline styles (`style="opacity: 0"`) — specificity 1000
   - CSS animation via `.reveal-visible` class — specificity 10
   - The animation keyframes include `opacity: 1`, but the inline style takes precedence

## Working Solution

Must **both** clear the inline style **and** add the class:

```javascript
await page.evaluate(() => {
  document.querySelectorAll('.reveal-on-scroll').forEach((el) => {
    el.style.opacity = '1'; // Override inline opacity
    el.classList.add('reveal-visible'); // Trigger animation end state
  });
});
```

Alternative — clear inline style entirely so the class cascade wins:

```javascript
await page.evaluate(() => {
  document.querySelectorAll('.reveal-on-scroll').forEach((el) => {
    el.style.opacity = ''; // Remove inline style from cascade
    el.classList.add('reveal-visible'); // Animation fillMode: both applies final keyframe
  });
});
```

## Prevention Strategies

1. **Reusable Playwright helper** — create a `revealScrollSections(page)` utility in test fixtures
2. **`data-reveal` attribute** — mark elements for test automation, making selectors more reliable
3. **Document in test setup** — add a comment block explaining the specificity trap for future test authors
4. **Consider `!important` in animation** — could add `opacity: 1 !important` to `.reveal-visible` but this is a specificity arms race; prefer the JS override approach

## Key Takeaway

> When a JS hook sets inline styles for progressive enhancement, CSS class additions alone cannot override them. Always clear or override the inline style directly when testing.

## Related Files

| File                                            | Role                                                        |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `apps/web/src/hooks/useScrollReveal.ts`         | Sets inline `opacity: 0` (lines 39, 54)                     |
| `apps/web/src/styles/globals.css`               | `.reveal-on-scroll` / `.reveal-visible` animation keyframes |
| `apps/web/src/components/tenant/sections/*.tsx` | All section components using the hook                       |
