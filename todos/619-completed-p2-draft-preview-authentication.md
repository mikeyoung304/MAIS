---
status: complete
priority: p2
issue_id: '619'
tags: [code-review, security, build-mode]
dependencies: []
completed_date: '2026-01-05'
---

# Draft Preview Access May Not Be Authenticated

## Problem Statement

The Build Mode iframe loads the tenant storefront with `?preview=draft` parameter, but it's unclear if draft access requires authentication. Unpublished content could be visible to anyone who guesses the URL pattern.

**What's broken:** Potential unauthorized access to draft content
**Why it matters:** Unpublished pricing, marketing copy, or business info could leak

## Findings

### Source: Security Review Agent

**File:** `apps/web/src/components/build-mode/BuildModePreview.tsx` (line 45)

**Current Code:**

```typescript
const iframeUrl = `/t/${tenantSlug}/${currentPage === 'home' ? '' : currentPage}?preview=draft&edit=true`;
```

**Concern:** If `?preview=draft` can be added to any tenant URL, anyone could see unpublished changes.

**Needs Investigation:**

- Does `apps/web/src/app/t/[slug]/(site)/page.tsx` check authentication for draft preview?
- Is there a middleware that restricts `?preview=draft`?

## Proposed Solutions

### Option A: Signed preview tokens (Recommended)

**Description:** Generate a short-lived signed token for preview access

```typescript
const previewToken = signPreviewToken(tenantId, userId, expiry);
const iframeUrl = `/t/${slug}?preview=draft&token=${previewToken}`;
```

Server validates token before serving draft content.

- **Pros:** Secure, time-limited, audit-friendly
- **Cons:** Requires token generation/validation logic
- **Effort:** Medium (2-3 hours)
- **Risk:** Low

### Option B: Session-based authentication

**Description:** Check NextAuth session on draft preview requests

```typescript
// In tenant page
if (searchParams.preview === 'draft') {
  const session = await auth();
  if (!session?.user?.tenantId === tenantId) {
    return notFound(); // or redirect to login
  }
}
```

- **Pros:** Uses existing auth, simple
- **Cons:** Relies on cookies (may not work in iframe context)
- **Effort:** Small (1 hour)
- **Risk:** Medium (iframe cookie issues)

### Option C: Verify current implementation first

**Description:** Investigate existing code before adding protection

- **Pros:** May already be handled
- **Cons:** Takes investigation time
- **Effort:** Small (30 min investigation)
- **Risk:** None

## Recommended Action

Option C first - investigate existing draft preview security before implementing fixes.

## Technical Details

**Files to Investigate:**

- `apps/web/src/app/t/[slug]/(site)/page.tsx`
- `apps/web/src/middleware.ts`
- `apps/web/src/lib/tenant.ts`

## Acceptance Criteria

- [ ] Verify whether `?preview=draft` is already protected
- [ ] If not protected, implement signed token or session check
- [ ] Draft preview inaccessible without authentication
- [ ] Add test case for unauthorized draft access (should 404 or redirect)

## Work Log

| Date       | Action                            | Learnings                                                                                                                                                                                             |
| ---------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-01-05 | Created from code review          | Security: Always verify draft preview access control                                                                                                                                                  |
| 2026-01-05 | RESOLVED - Investigation complete | Draft is SECURE. URL param is cosmetic - actual draft data transmitted via authenticated PostMessage from parent Build Mode page. Origin validation + iframe requirement prevent unauthorized access. |

## Resources

- PR: N/A (current branch)
