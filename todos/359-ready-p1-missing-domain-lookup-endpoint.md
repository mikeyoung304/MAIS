---
status: ready
priority: p1
issue_id: "359"
tags: [code-review, architecture, custom-domains]
dependencies: []
---

# Missing Domain Lookup Endpoint in Backend

## Problem Statement

The Next.js middleware rewrites custom domains to `/t/_domain?domain=X`, but the backend API endpoint `GET /v1/public/tenants/by-domain/:domain` does not exist.

**Why it matters:** Custom domain feature is completely non-functional. Frontend expects this endpoint but backend returns 404/501.

## Findings

**File:** `apps/web/src/lib/tenant.ts:85`
```typescript
// TODO: Implement domain lookup endpoint in Express API
const url = `${API_BASE_URL}/v1/public/tenants/by-domain/${encodeURIComponent(domain)}`;
```

**File:** `apps/web/src/middleware.ts:49-50`
- Middleware correctly rewrites to `/t/_domain?domain=janephotography.com`
- But tenant lookup will always fail

**Impact:** P1 - Custom domains broken in production

## Proposed Solutions

### Option 1: Implement Backend Endpoint (Required)
- **Description:** Create `GET /v1/public/tenants/by-domain/:domain` in Express
- **Pros:** Completes feature, follows existing patterns
- **Cons:** Requires backend work
- **Effort:** Small (1-2 hours)
- **Risk:** Low

**Implementation:**
```typescript
// server/src/routes/public-tenant.routes.ts
router.get('/by-domain/:domain', async (req, res) => {
  const { domain } = req.params;
  const tenant = await tenantRepository.findByDomainPublic(domain);
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  return res.json(tenant);
});
```

## Recommended Action

**FIX NOW** - Implement the backend endpoint. The repository method `findByDomainPublic` already exists - just need to wire up the route in `public-tenant.routes.ts`.

## Technical Details

**Files to Modify:**
- `server/src/routes/public-tenant.routes.ts` - Add route
- `server/src/routes/index.ts` - Register route

**Existing Implementation:**
- `tenantRepository.findByDomainPublic()` already exists
- Just needs route wiring

## Acceptance Criteria

- [ ] `GET /v1/public/tenants/by-domain/:domain` returns tenant public data
- [ ] Returns 404 for unverified domains
- [ ] Returns 404 for inactive tenants
- [ ] Custom domain routing works end-to-end

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2025-12-25 | Created during code review | Backend endpoint missing for custom domains |

## Resources

- Related: `server/src/adapters/prisma/tenant.repository.ts` (findByDomainPublic exists)
