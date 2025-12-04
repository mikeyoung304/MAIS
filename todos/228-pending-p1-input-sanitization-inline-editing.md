---
status: resolved
priority: p1
issue_id: '228'
tags: [security, code-review, landing-page, xss, sanitization]
dependencies: []
source: 'code-review-landing-page-visual-editor'
resolved_at: '2025-12-04'
resolved_by: 'feat/landing-page-editor-p1-security branch'
---

# TODO-228: Add Input Sanitization for Inline Text Editing

## Priority: P1 (Critical - Blocks Merge)

## Status: Pending

## Source: Security Review - Landing Page Visual Editor Plan

## Problem Statement

The plan's `EditableText.tsx` component receives user input via `onChange` callbacks and immediately updates state without sanitization. While React escapes text nodes, stored payloads could enable XSS if rendered in non-React contexts.

**Why It Matters:**

- XSS vulnerability via stored content
- Malicious headline content persists in database
- Landing page public viewing could inject malicious scripts

## Findings

**Attack Vector:**

1. Attacker enters XSS payload in headline: `<img src=x onerror="alert('xss')">`
2. Component state updates without sanitization
3. Auto-save sends to backend without validation
4. Payload stored in database
5. Rendered in contexts without React escaping → XSS

**Evidence:**

- Plan (lines 436-450): `EditableText` uses `onChange` directly without sanitization
- `sanitization.ts` (lines 15-37): Sanitization functions exist but not integrated
- `tenant-admin-landing-page.routes.ts` (line 85): Route validates schema but does NOT sanitize

**Existing Good Pattern:**

```typescript
// sanitization.ts line 35
export function sanitizePlainText(input: string): string {
  return validator.escape(validator.stripLow(input));
}
```

## Proposed Solutions

### Option A: Sanitize in Route Handler (Recommended)

Add sanitization after schema validation in the API route.

**Pros:** Server-side protection, catches all inputs
**Cons:** Requires integration
**Effort:** Small (30 min)
**Risk:** Low

```typescript
import { sanitizeObject } from '../lib/sanitization';

router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  const data = LandingPageConfigSchema.parse(req.body);
  const sanitized = sanitizeObject(data, { allowHtml: [] });
  const updated = await tenantRepo.updateLandingPageConfig(tenantId, sanitized);
  res.json(updated);
});
```

### Option B: Sanitize Client-Side + Server-Side

Add sanitization in EditableText on blur, plus server-side validation.

**Pros:** Defense in depth
**Cons:** More code, client-side sanitization can be bypassed
**Effort:** Medium (1 hour)
**Risk:** Low

## Recommended Action

**Option A** with defense-in-depth from Option B.

## Technical Details

**Affected Files:**

- `server/src/routes/tenant-admin-landing-page.routes.ts` - Add sanitization
- `client/src/features/tenant-admin/landing-page-editor/components/EditableText.tsx` - Client validation

## Acceptance Criteria

- [ ] All text fields sanitized before database storage
- [ ] Script tags, event handlers stripped from input
- [ ] Unit test: XSS payload stored as escaped text
- [ ] E2E test: Malicious input rendered safely

## Work Log

| Date       | Action  | Notes                                              |
| ---------- | ------- | -------------------------------------------------- |
| 2025-12-04 | Created | Security review of landing page visual editor plan |

## Tags

security, code-review, landing-page, xss, sanitization
