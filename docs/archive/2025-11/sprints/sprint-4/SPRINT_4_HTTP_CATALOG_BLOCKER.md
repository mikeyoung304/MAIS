# Sprint 4: HTTP Catalog Architectural Decision Blocker

**Date:** 2025-11-10
**Status:** ⏸️ **BLOCKED** - Awaiting architectural decision
**Priority:** HIGH
**Impact:** 3 HTTP tests blocked, widget integration unclear

---

## 🚧 Decision Required

**Question:** Should catalog endpoints (`GET /v1/packages`, `GET /v1/packages/:slug`) be:

- **Option A:** Public with tenant context (subdomain/header)
- **Option B:** Protected with API key authentication
- **Option C:** Hybrid (public list, protected details)

**Decision Maker:** Product Owner / Technical Lead
**Timeline:** Sprint 4 start (required before HTTP catalog implementation)

---

## 📋 Current State

### Blocked HTTP Tests

**File:** `test/http/packages.test.ts`
**Status:** 3/4 tests failing with 401 Unauthorized

**Expected Behavior (Pre-Multi-Tenant):**

- `GET /v1/packages` - Public list endpoint
- `GET /v1/packages/:slug` - Public package details
- Widget embeds catalog on client websites

**Actual Behavior (Post-Multi-Tenant):**

- All routes return 401 Unauthorized
- Tenant middleware blocks public access
- Widget integration broken

---

## 🎯 Architectural Options

### Option A: Public Catalog with Tenant Context (Recommended)

**Approach:** Tenant identified by subdomain or `X-Tenant-Slug` header

**Example:**

```
GET https://macon.elope.app/v1/packages
GET https://demo.elope.app/v1/packages
GET https://api.elope.app/v1/packages
  Headers: X-Tenant-Slug: macon
```

**Pros:**

- ✅ Maintains public widget access (no auth required)
- ✅ Aligns with standard SaaS multi-tenant pattern
- ✅ Backward compatible for existing widget
- ✅ SEO-friendly (crawlable public catalog)
- ✅ Clean separation of tenant data

**Cons:**

- ⚠️ Requires subdomain routing OR tenant header
- ⚠️ Need tenant resolution logic in middleware
- ⚠️ Subdomain DNS setup for each tenant

**Implementation:** 3-4 hours

- Update tenant middleware to allow public catalog routes
- Extract tenant context from subdomain or header
- Update catalog routes to use tenant context
- Restore and fix HTTP catalog tests
- Update widget integration documentation

**Code Changes:**

```typescript
// middleware/tenant.ts
app.use((req, res, next) => {
  // Public routes bypass tenant auth
  if (req.path.startsWith('/v1/packages')) {
    // Extract tenant from subdomain or header
    const tenant = extractTenantContext(req);
    if (!tenant) {
      return res.status(400).json({ error: 'Tenant not specified' });
    }
    req.tenantId = tenant.id;
    return next();
  }

  // Protected routes require auth...
});
```

**Widget Impact:** ✅ No breaking changes

---

### Option B: Tenant-Scoped Catalog with Auth

**Approach:** Require API key for all catalog access

**Example:**

```
GET https://api.elope.app/v1/packages
  Headers: X-Tenant-API-Key: pk_live_abc123
```

**Pros:**

- ✅ More secure (explicit authentication)
- ✅ Easier to implement (reuse existing auth)
- ✅ Clear audit trail of who accessed catalog

**Cons:**

- ❌ Breaks existing widget integration
- ❌ Adds friction to public catalog browsing
- ❌ Requires API key distribution to widget clients
- ❌ Less SEO-friendly (not crawlable)

**Implementation:** 1-2 hours

- Update routes to require API key
- Update widget to include API key
- Fix HTTP tests with auth headers

**Widget Impact:** ⚠️ **Breaking change** - Requires widget update

---

### Option C: Hybrid (Public List, Protected Details)

**Approach:** List endpoint public, individual packages require auth

**Example:**

```
GET /v1/packages           (public, tenant from header)
GET /v1/packages/:slug     (requires API key)
```

**Pros:**

- ✅ Balance security and accessibility
- ✅ Browsing doesn't require auth
- ✅ Details protected behind auth

**Cons:**

- ❌ Inconsistent API contract
- ❌ Complex to maintain
- ❌ Unclear when to use which approach
- ❌ More middleware logic

**Implementation:** 3-4 hours

**Widget Impact:** ⚠️ Depends on widget needs

---

## 🎯 Recommendation: Option A

**Rationale:**

1. **Widget Use Case:** Existing embeddable widget requires public access
2. **Standard Pattern:** Subdomain-based tenancy is industry standard (Stripe, Shopify, Heroku)
3. **Backward Compatibility:** Maintains existing widget integration
4. **SEO & Marketing:** Public catalog improves discoverability

**Example Multi-Tenant SaaS:**

- Stripe: `dashboard.stripe.com` (tenant context from auth)
- Shopify: `{shop-name}.myshopify.com` (subdomain routing)
- Heroku: `dashboard.heroku.com` (tenant context from auth)

---

## 📝 Implementation Plan (Option A)

### Phase 1: Middleware Updates (1 hour)

**File:** `server/src/middleware/tenant.ts`

**Changes:**

1. Add public route whitelist
2. Implement `extractTenantContext()` helper
3. Support subdomain AND header-based tenant resolution
4. Return 400 if tenant not specified on public routes

### Phase 2: Route Updates (1 hour)

**Files:**

- `server/src/http/packages.routes.ts`
- `server/src/http/packages.controller.ts`

**Changes:**

1. Update routes to use `req.tenantId` from middleware
2. Remove auth requirements for catalog routes
3. Add tenant validation

### Phase 3: Test Updates (1 hour)

**File:** `server/test/http/packages.test.ts`

**Changes:**

1. Add `X-Tenant-Slug` header to test requests
2. Restore 3 failing HTTP tests
3. Add multi-tenant test cases

### Phase 4: Documentation (30 minutes)

**Files:**

- `docs/architecture/CATALOG_ROUTING.md` (new)
- `docs/api/PUBLIC_ENDPOINTS.md` (update)
- `README.md` (widget integration)

**Content:**

- Document tenant resolution strategy
- Update API documentation
- Update widget integration guide

---

## 🧪 Acceptance Criteria

**Must-Have:**

- [ ] Architectural decision documented
- [ ] HTTP catalog tests passing (4/4)
- [ ] Widget integration validated (manual test or demo)
- [ ] Tenant resolution strategy documented
- [ ] API docs updated

**Nice-to-Have:**

- [ ] Subdomain routing configured (if Option A chosen)
- [ ] Rate limiting per tenant
- [ ] Catalog endpoint monitoring

---

## ⚠️ Risks & Considerations

### Security

**Risk:** Public endpoints could be abused (scraping, DDoS)
**Mitigation:**

- Implement rate limiting per tenant
- Add CDN caching (Cloudflare, Fastly)
- Monitor for unusual traffic patterns

### Performance

**Risk:** Public catalog endpoints could receive high traffic
**Mitigation:**

- Add HTTP cache middleware with short TTL (1 minute)
- Implement CDN caching
- Database read replicas for catalog queries

### Multi-Tenancy

**Risk:** Tenant resolution could fail or be ambiguous
**Mitigation:**

- Validate tenant exists before serving catalog
- Clear error messages for invalid tenants
- Fallback to header if subdomain not found

---

## 📞 Questions for Decision Maker

1. **Widget Usage:** Is the widget currently deployed? How critical is backward compatibility?
2. **Subdomain Strategy:** Do we want tenant-specific subdomains (e.g., `macon.elope.app`)?
3. **Public Access:** Should catalog always be publicly accessible, or only for specific tenants?
4. **Future Routes:** Will other endpoints need public access (e.g., availability, booking)?

---

## 🚀 Next Steps

**Immediate (This Sprint):**

1. ⏸️ **HOLD** all HTTP catalog implementation until decision made
2. 📞 Schedule architectural decision meeting with product owner
3. 📋 Prepare demo/mockup of each option if needed

**After Decision:**

1. Document decision in `docs/architecture/CATALOG_ROUTING.md`
2. Create Sprint 4 task: "Implement HTTP Catalog Routing"
3. Proceed with 3-4 hour implementation
4. Restore HTTP tests
5. Update widget integration docs

---

## 📚 Related Documentation

- **Sprint 4 Plan:** `/SPRINT_4_PLAN.md`
- **Cache Isolation:** `/.claude/CACHE_WARNING.md`
- **Multi-Tenant Patterns:** `/.claude/PATTERNS.md`
- **HTTP Tests:** `/server/test/http/packages.test.ts`

---

**Status:** ⏸️ **BLOCKED** - Requires product/engineering decision before proceeding

**Estimated Unblock Time:** 1 hour meeting + decision documentation

**Estimated Implementation Time (after decision):** 3-4 hours

---

_Created: 2025-11-10_
_Sprint: Sprint 4 - Cache Isolation & Test Infrastructure_
_Blocker Type: Architectural Decision Required_
