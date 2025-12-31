---
status: complete
priority: p1
issue_id: '201'
tags: [architecture, contracts, dry-violation, landing-page]
dependencies: []
---

# TODO-201: Schema Duplication Between dto.ts and landing-page.ts

## Priority: P1 (Critical)

## Status: Open

## Source: Code Review - Landing Page Implementation

## Description

The landing page configuration schemas are defined twice:

1. In `packages/contracts/src/landing-page.ts` (the proper location)
2. Inline in `packages/contracts/src/dto.ts` within TenantPublicDtoSchema.branding.landingPage

This violates DRY principle and creates maintenance risk where schemas can drift out of sync.

## Affected Files

- `packages/contracts/src/dto.ts` - Lines 769-838 (inline definitions)
- `packages/contracts/src/landing-page.ts` - Canonical schema location

## Current Problem

```typescript
// dto.ts - DUPLICATED inline definitions
landingPage: z.object({
  sections: z.object({
    hero: z.boolean().default(false),
    // ... more inline definitions
  }).optional(),
  hero: z.object({ headline: z.string(), /*...*/ }).optional(),
  // ... ALL schemas defined inline instead of composed
}).optional(),
```

## Fix Required

Refactor dto.ts to compose from landing-page.ts exports:

```typescript
// dto.ts - CORRECTED composition
import { LandingPageConfigSchema } from './landing-page';

// In TenantPublicDtoSchema.branding:
landingPage: LandingPageConfigSchema.optional(),
```

## Steps

1. Ensure landing-page.ts exports `LandingPageConfigSchema` (the root schema)
2. Import and use it in dto.ts branding definition
3. Remove all inline schema definitions from dto.ts
4. Run `npm run build` in contracts to verify types
5. Run `npm run typecheck` to verify no breaking changes
6. Update any code relying on specific inline types

## Acceptance Criteria

- [ ] dto.ts composes LandingPageConfigSchema from landing-page.ts
- [ ] No duplicate schema definitions exist
- [ ] Contracts build successfully
- [ ] All dependent code type-checks
- [ ] No runtime behavior changes

## Tags

architecture, contracts, dry-violation, landing-page
