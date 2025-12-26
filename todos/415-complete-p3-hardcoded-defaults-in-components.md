---
status: complete
priority: p3
issue_id: "415"
tags:
  - code-review
  - code-quality
  - consistency
  - locked-template-system
dependencies: []
---

# Hardcoded Defaults in Section Components

## Problem Statement

Section components hardcode default values instead of importing from contracts, creating potential inconsistency between schema defaults and component defaults.

**Why This Matters:**
- Single source of truth principle violated
- Defaults could diverge between schema and components
- Harder to change defaults globally

## Findings

**Location:** Multiple section components

**Evidence:**
- `HeroSection`: `ctaText = 'View Packages'`
- `GallerySection`: `headline = 'Our Work'`
- `TestimonialsSection`: `headline = 'What Clients Say'`
- `FAQSection`: `headline = 'FAQ'`
- `ContactSection`: `headline = 'Get in Touch'`
- `CTASection`: `ctaText = 'Get Started'`

**Schema defaults exist** in `packages/contracts/src/landing-page.ts` (e.g., line 254):
```typescript
headline: z.string().max(60).default('Our Work'),
```

**Agent:** Code Simplicity Reviewer, Pattern Recognition Specialist

## Proposed Solutions

### Solution 1: Keep Hardcoded (Accept Current State)

The component defaults serve as fallbacks when props aren't provided. Schema defaults apply during parsing.

**Pros:**
- No change needed
- Defensive programming

**Cons:**
- Could diverge

**Effort:** None
**Risk:** Low

### Solution 2: Remove Component Defaults

Trust Zod schema to provide defaults during parse.

**Pros:**
- Single source of truth

**Cons:**
- Components less defensive
- May need changes if data path skips schema

**Effort:** Small
**Risk:** Low

## Technical Details

**Affected Files:**
- All section components in `apps/web/src/components/tenant/sections/`

## Acceptance Criteria

- [x] Decision made on which approach to use
- [x] Keep both defaults (defense-in-depth) - industry standard practice
- [x] No code changes needed

## Resolution

**WON'T FIX** - Keeping both schema defaults and component defaults is the industry standard "defense-in-depth" approach. Schema provides validation-time defaults, components provide runtime fallbacks. This is acceptable.

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created from code review | Default value inconsistency noted |
