# Missing Main Landmark Element

## Metadata

- **ID:** 441
- **Status:** pending
- **Priority:** P3
- **Tags:** accessibility, frontend, seo
- **Source:** Brand Review - Agent-Native Reviewer

## Problem Statement

The homepage root is a `<div>` instead of properly wrapping content in `<main>`. This affects:

1. Screen reader navigation (users can't jump to main content)
2. Document outline for agents/crawlers
3. Accessibility compliance

## Findings

Current structure in `apps/web/src/app/page.tsx`:

```tsx
<div className="min-h-screen bg-surface">
  <nav>...</nav>
  <section>Hero</section>
  <section>Problem</section>
  ...
  <footer>...</footer>
</div>
```

Should be:

```tsx
<div className="min-h-screen bg-surface">
  <nav>...</nav>
  <main>
    <section>Hero</section>
    <section>Problem</section>
    ...
  </main>
  <footer>...</footer>
</div>
```

## Proposed Solutions

### Option A: Wrap Sections in Main (Recommended)

Add `<main>` element around content sections

**Effort:** Small
**Risk:** None

## Technical Details

**Affected Files:**

- `apps/web/src/app/page.tsx`

**Change:**

```diff
  <div className="min-h-screen bg-surface">
    <nav>...</nav>
+   <main id="main-content">
      <section>Hero</section>
      ...
+   </main>
    <footer>...</footer>
  </div>
```

Also update skip link if present:

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>
```

## Acceptance Criteria

- [ ] `<main>` element wraps all content sections
- [ ] `<main>` has `id="main-content"` for skip link
- [ ] Nav and footer are outside `<main>`

## Work Log

| Date       | Action  | Notes                                     |
| ---------- | ------- | ----------------------------------------- |
| 2025-12-27 | Created | From brand review - Agent-Native Reviewer |
