---
status: resolved
resolution_date: 2025-12-06
priority: p2
issue_id: '301'
tags: [code-review, testing, e2e, playwright, early-access]
dependencies: []
---

# E2E Tests Have Flaky Selectors Due to Duplicate Forms

## Problem Statement

The early-access E2E tests use `getByRole('form', { name: 'Early access request form' })` but there are TWO forms on the homepage with the same aria-label:

1. HeroSection form (top of page)
2. WaitlistCTASection form (bottom of page)

This causes test failures because Playwright finds multiple elements matching the selector.

**Why it matters:** 4 out of 12 E2E tests may fail or behave unpredictably due to selector ambiguity.

## Findings

**E2E Test File:** `e2e/tests/early-access-waitlist.spec.ts`

```typescript
// Current selector - AMBIGUOUS (matches 2 forms)
const form = page.getByRole('form', { name: 'Early access request form' });
```

**Two forms with same aria-label:**

1. `client/src/pages/Home/HeroSection.tsx` - Hero form (line ~90)
2. `client/src/pages/Home/WaitlistCTASection.tsx` - CTA form (line ~74)

**Test failures observed:**

- Tests expecting single form get multiple matches
- Route interception may not work correctly
- Flaky behavior depending on viewport scroll position

## Proposed Solutions

### Option A: Use Unique Test IDs (Recommended)

**Pros:** Explicit, reliable, follows Playwright best practices
**Cons:** Adds data attributes to production HTML
**Effort:** Small (20 min)
**Risk:** Low

```typescript
// In HeroSection.tsx
<form data-testid="hero-waitlist-form" aria-label="Early access request form">

// In WaitlistCTASection.tsx
<form data-testid="cta-waitlist-form" aria-label="Early access request form">

// In E2E tests
const ctaForm = page.getByTestId('cta-waitlist-form');
```

### Option B: Use Section-Based Scoping

**Pros:** No HTML changes, uses existing structure
**Cons:** Depends on page structure, may break if layout changes
**Effort:** Small (15 min)
**Risk:** Medium

```typescript
// Scope to the CTA section by finding parent first
const ctaSection = page.locator('section').filter({ hasText: 'Ready to get started?' });
const form = ctaSection.getByRole('form', { name: 'Early access request form' });
```

### Option C: Use Different aria-labels

**Pros:** Semantically correct, accessible
**Cons:** May confuse screen readers if forms serve same purpose
**Effort:** Small (10 min)
**Risk:** Low

```typescript
// In HeroSection.tsx
<form aria-label="Hero early access form">

// In WaitlistCTASection.tsx
<form aria-label="Footer early access form">
```

## Recommended Action

Implement Option A - add `data-testid` attributes for explicit test targeting while preserving accessibility labels.

## Technical Details

**Affected files:**

- `client/src/pages/Home/HeroSection.tsx` (add data-testid)
- `client/src/pages/Home/WaitlistCTASection.tsx` (add data-testid)
- `e2e/tests/early-access-waitlist.spec.ts` (update selectors)

## Acceptance Criteria

- [ ] Each waitlist form has unique data-testid
- [ ] E2E tests use data-testid selectors
- [ ] All 12 E2E tests pass consistently
- [ ] No test flakiness in CI (5 consecutive runs)
- [ ] aria-labels preserved for accessibility

## Work Log

| Date       | Action                   | Learnings                                    |
| ---------- | ------------------------ | -------------------------------------------- |
| 2025-12-06 | Created from code review | Testing-expert identified selector ambiguity |

## Resources

- Playwright Best Practices: https://playwright.dev/docs/locators#locate-by-test-id
- Related: TODO-302 (route mocking failures)

## Resolution

**Status:** Resolved on 2025-12-06

**Implementation Summary:**
Added unique `data-testid` attributes to both waitlist forms to eliminate selector ambiguity and fix flaky E2E tests. Implemented Option A as recommended.

**Files Modified:**

- `client/src/pages/Home/HeroSection.tsx` - Added `data-testid="hero-waitlist-form"`
- `client/src/pages/Home/WaitlistCTASection.tsx` - Added `data-testid="cta-waitlist-form"`
- `e2e/tests/early-access-waitlist.spec.ts` - Updated selectors to use specific `data-testid` attributes

**Changes Made:**

```typescript
// HeroSection form now has unique identifier
<form data-testid="hero-waitlist-form" aria-label="Early access request form">

// CTA form now has unique identifier
<form data-testid="cta-waitlist-form" aria-label="Early access request form">

// E2E tests updated to target specific forms
const heroForm = page.getByTestId('hero-waitlist-form');
const ctaForm = page.getByTestId('cta-waitlist-form');
```

**Benefits:**

- Eliminates selector ambiguity (no more multiple matches)
- Tests now reliable and deterministic
- Accessibility labels preserved for screen readers
- Follows Playwright testing best practices
- No more flaky test failures due to selector issues

**Test Results:**
All 12 E2E tests now pass consistently with explicit form targeting.
