---
status: pending
priority: p2
issue_id: '700'
tags: [code-review, security, preview, authorization]
dependencies: ['698']
---

# Missing Tenant Ownership Verification for Draft Preview

## Problem Statement

If/when draft preview is implemented (see #698), there's no server-side verification that the authenticated user actually owns the tenant whose draft they're trying to preview.

**Attack Scenario:**

1. Tenant A is authenticated
2. Tenant A navigates to `/t/tenant-b?preview=draft`
3. Without ownership check, Tenant A could see Tenant B's unpublished draft content

**Current State:** Safe because draft preview isn't implemented - public endpoint never serves draft.

## Findings

Preview URL construction uses only tenant slug:

```typescript
// PreviewPanel.tsx:117
const iframeUrl = `/t/${slug}/${currentPage}?preview=draft&edit=true`;
```

No server-side ownership verification exists in the page component or API.

## Proposed Solutions

### Option A: Server-Side Ownership Check in Page Component

**Effort:** Medium
**Risk:** Low

```typescript
// page.tsx
if (searchParams.preview === 'draft') {
  const session = await auth();
  const userTenantId = session?.user?.tenantId;
  const requestedTenantId = tenant.id;

  if (userTenantId !== requestedTenantId) {
    // Reject cross-tenant draft access
    redirect(`/t/${slug}`); // Fall back to published
  }
}
```

### Option B: Scoped Preview Token

**Effort:** Medium
**Risk:** Low

Include tenant ID in preview token JWT, validate on server.

## Recommended Action

Implement as part of #698 (preview draft parameter implementation).

## Acceptance Criteria

- [ ] Authenticated user can only preview their own tenant's draft
- [ ] Cross-tenant preview attempts redirect to published version
- [ ] Unauthenticated users cannot access any draft content
- [ ] Audit log records preview access attempts

## Resources

- Security review: agent a68b7ce
- Depends on: #698 (preview implementation)
