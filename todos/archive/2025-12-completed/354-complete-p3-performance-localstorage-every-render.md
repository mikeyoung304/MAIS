---
status: complete
priority: p3
issue_id: '354'
tags: [code-review, performance, react]
dependencies: []
---

# Performance: LocalStorage Access on Every Render

## Problem Statement

`localStorage.getItem('impersonationTenantKey')` is called on every render to get the tenant key for cache isolation.

**Why it matters:** LocalStorage is synchronous and blocks the main thread. Minor impact but unnecessary repeated calls.

## Findings

**File:** `client/src/features/storefront/DateBookingWizard.tsx:327`

```typescript
// Called on every render
const tenantKey = localStorage.getItem('impersonationTenantKey') || 'default';
```

**Agent:** performance-oracle

## Proposed Solutions

### Option A: Use useMemo (Recommended)

- **Pros:** Single read at component mount
- **Cons:** Won't pick up changes during session
- **Effort:** Small
- **Risk:** Low

```typescript
const tenantKey = useMemo(() => localStorage.getItem('impersonationTenantKey') || 'default', []);
```

### Option B: Use useState with initializer

- **Pros:** Can add setter if needed
- **Cons:** Slightly more code
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A - Wrap in useMemo with empty dependency array.

## Technical Details

- **Affected files:** `client/src/features/storefront/DateBookingWizard.tsx`
- **Components:** DateBookingWizard
- **Database changes:** None

## Acceptance Criteria

- [ ] LocalStorage only read once at mount
- [ ] Cache isolation still works correctly
- [ ] Impersonation mode still works

## Work Log

| Date       | Action                   | Learnings                        |
| ---------- | ------------------------ | -------------------------------- |
| 2024-12-24 | Created from code review | performance-oracle agent finding |

## Resources

- LocalStorage performance: https://web.dev/storage-for-the-web/
