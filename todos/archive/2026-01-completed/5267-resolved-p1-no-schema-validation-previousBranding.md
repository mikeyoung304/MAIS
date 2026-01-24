---
status: resolved
priority: p1
triage_date: '2026-01-12'
triage_by: master-architect-triage
verified: true
effort: 20min
resolved_date: '2026-01-12'
resolved_by: claude-code
commit: f033e3b5
---

# P1: No Schema Validation for `_previousBranding` History

**Source:** Code Review - Data Integrity
**PR:** #28 feat/agent-system-integrity-fixes
**Date:** 2026-01-12
**Reviewer:** data-integrity-guardian

## Issue

The `_previousBranding` array is stored directly in the `branding` JSON field without any Zod schema validation. The structure is only enforced via TypeScript type assertions, which provides no runtime validation.

## Location

- `server/src/agent/executors/storefront-executors.ts:581-605` (storage)
- `server/src/agent/executors/storefront-executors.ts:665-673` (read with type assertion)

## Current Code

```typescript
// No schema - just type assertion
const history = branding._previousBranding as Array<{
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  timestamp: number;
}>;
```

## Attack/Corruption Scenario

1. An external process (migration script, direct DB edit, admin tool) writes malformed data to `branding._previousBranding`
2. User triggers `revert_branding` tool
3. Code attempts to read `history[0].timestamp` but the data is corrupted
4. Branding revert fails silently or partially applies, potentially corrupting live branding

## Recommended Fix

Create a Zod schema for `_previousBranding` history and validate on read before using:

```typescript
import { z } from 'zod';

const PreviousBrandingEntrySchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logoUrl: z.string().optional(),
  timestamp: z.number(),
});

const PreviousBrandingHistorySchema = z.array(PreviousBrandingEntrySchema);

// In revert_branding executor:
const historyResult = PreviousBrandingHistorySchema.safeParse(branding._previousBranding);
if (!historyResult.success) {
  return { success: false, error: 'Branding history is corrupted. Cannot revert.' };
}
const history = historyResult.data;
```

## Severity Justification

P1 because data corruption could cause partial branding state, breaking the tenant's storefront appearance.
