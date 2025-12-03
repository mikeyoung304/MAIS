---
status: pending
priority: p1
issue_id: "167"
tags: [code-review, security, dead-code, batch-5-review]
dependencies: []
---

# Remove customCss Dead Code from useTenantBranding

## Problem Statement

The `useTenantBranding` hook contains dead code for `customCss` processing that is never used. This dead code path poses a CSS injection risk if ever activated and violates the principle of minimal attack surface.

**Why it matters:**
- CSS injection can enable data exfiltration via `url()` properties
- Dead code increases maintenance burden and confusion
- Security-sensitive code paths should not exist if unused

## Findings

**Source:** Security Specialist agent code review

**File:** `client/src/hooks/useTenantBranding.ts`
**Lines:** 117-121 (approximate)

**Current code:**
```typescript
// Dead code - customCss is never passed to this hook
if (branding?.customCss) {
  // This would allow arbitrary CSS injection
  style.textContent += branding.customCss;
}
```

## Proposed Solution

Remove the customCss handling code entirely since:
1. No component passes customCss to this hook
2. TenantBrandingDto schema does not include customCss
3. If CSS customization is needed in future, implement with sanitization

```typescript
// Simply remove lines 117-121
// The hook should only apply the safe CSS variables
```

**Effort:** Minimal (5 minutes)
**Risk:** None - removing dead code

## Acceptance Criteria

- [ ] customCss code block removed from useTenantBranding.ts
- [ ] TypeScript passes
- [ ] Tests pass
- [ ] No regression in branding display

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-12-02 | Created | From batch 5 code review |

## Resources

- Related batch: Batch 5 (TODO 089-092)
- Commit introducing hook: 8ef3a7d
