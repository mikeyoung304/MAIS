---
status: complete
priority: p2
issue_id: '700'
tags: [code-review, security, preview, authorization]
dependencies: ['698']
---

# Missing Tenant Ownership Verification for Draft Preview

## Resolution

**Resolved as part of #698 implementation.** The preview token system includes comprehensive tenant ownership verification.

### How Ownership is Verified

1. **Token Generation** (`POST /v1/tenant-admin/preview-token`)
   - Requires authenticated tenant session
   - Embeds `tenantId` and `slug` into JWT payload
   - Only the authenticated tenant can generate tokens for their own data

2. **Token Validation** (`GET /v1/public/tenants/:slug/preview`)
   - Validates token signature and expiry
   - Validates token's `slug` matches requested URL slug
   - Returns `tenant_mismatch` error for cross-tenant attempts
   - Rejects requests without valid token (401)

3. **Key Security Code**

```typescript
// preview-tokens.ts:156-166 - Slug validation
if (expectedSlug && payload.slug !== expectedSlug) {
  logger.warn({ expectedSlug, actualSlug: payload.slug }, 'Preview token slug mismatch');
  return {
    valid: false,
    error: 'tenant_mismatch',
    message: 'Token does not match requested tenant',
  };
}
```

### Attack Scenario Resolution

Original scenario: Tenant A tries to access `/t/tenant-b?preview=draft`

**Now prevented because:**
1. Tenant A can only generate preview tokens with their own `tenantId` and `slug`
2. If Tenant A's token is used on `/t/tenant-b/preview`, validation fails with `tenant_mismatch`
3. Without a valid token, the preview endpoint returns 401

## Acceptance Criteria

- [x] Authenticated user can only preview their own tenant's draft
- [x] Cross-tenant preview attempts redirect to published version (returns 401, falls back to published)
- [x] Unauthenticated users cannot access any draft content
- [x] Audit log records preview access attempts

### Audit Logging Evidence

- Token generation: `logger.info({ tenantId, slug }, 'Preview token generated')`
- Validation failure: `logger.info({ slug, error }, 'Preview token validation failed')`
- Successful preview: `logger.info({ tenantId, slug, hasDraft }, 'Preview data served')`

## Original Problem Statement

If/when draft preview is implemented (see #698), there's no server-side verification that the authenticated user actually owns the tenant whose draft they're trying to preview.

**Attack Scenario:**

1. Tenant A is authenticated
2. Tenant A navigates to `/t/tenant-b?preview=draft`
3. Without ownership check, Tenant A could see Tenant B's unpublished draft content

**Current State:** RESOLVED - Preview token system prevents this attack.

## Work Log

| Date       | Action              | Learnings                                                         |
| ---------- | ------------------- | ----------------------------------------------------------------- |
| 2026-01-10 | **Triage: APPROVED** | Security issue - must be implemented with #698 to prevent cross-tenant access. |
| 2026-01-10 | **Verified COMPLETE** | Ownership verification implemented via Option B (Scoped Preview Token) as part of #698. Token includes tenantId + slug, validated server-side before returning any draft data. |

## Files Implementing This Security

- `server/src/lib/preview-tokens.ts` - Token generation and validation
- `server/src/routes/tenant-admin.routes.ts` - Authenticated token generation endpoint
- `server/src/routes/public-tenant.routes.ts` - Token-validated preview endpoint

## Resources

- Security review: agent a68b7ce
- Implemented in: #698 (preview token system)
- Tests: `server/test/lib/preview-tokens.test.ts` (includes slug mismatch test)
