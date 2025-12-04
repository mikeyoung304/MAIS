# ELOPE MULTI-TENANCY READINESS REPORT

**Comprehensive Architectural Assessment**

**Report Date:** November 6, 2025
**Assessment Team:** Architecture, Database, Backend, Frontend, Security Specialists
**Current Branch:** stack-migration (commit 77783dc)
**Application:** Elope Wedding Booking Platform

---

## EXECUTIVE SUMMARY

### Current State

Elope is a **production-ready, single-tenant wedding booking system** built with modern architectural patterns. The application serves one wedding business operator with a well-structured codebase featuring:

- **Backend:** Express + TypeScript with layered architecture
- **Database:** PostgreSQL via Prisma ORM
- **Frontend:** React + Vite with TanStack Query
- **Architecture Maturity:** HIGH (well-documented, tested, production patterns)

### Multi-Tenancy Assessment

**READINESS SCORE: 4/10 (Medium)**

The application has **excellent foundational architecture** but **zero tenant isolation mechanisms**. Converting to multi-tenancy requires significant but achievable refactoring.

### Key Findings

✅ **STRENGTHS:**

- Clean layered architecture (routes → services → repositories)
- Strong type safety (TypeScript + Zod validation)
- Repository pattern enables easy tenant scoping
- Well-tested codebase (85% coverage)
- Comprehensive documentation

❌ **CRITICAL GAPS:**

- No `Tenant` model or tenant isolation in database
- All unique constraints are global (blocks multi-tenant bookings)
- No tenant context in authentication/authorization
- Frontend has hardcoded branding throughout
- Single payment account (no tenant-specific Stripe)

### Recommendation

**PROCEED WITH CAUTION:** Multi-tenancy is achievable but requires 6-9 weeks of dedicated effort. The architecture is solid enough to support this transformation, but it must be executed carefully with security as the top priority.

---

## ASSESSMENT FINDINGS BY DOMAIN

### 1. ARCHITECTURE ASSESSMENT

**Current Pattern:** Layered Architecture (migrated from hexagonal)

```
Routes (HTTP) → Services (Business Logic) → Adapters (Infrastructure) → Database
```

**Multi-Tenancy Compatibility:** ✅ **GOOD**

The layered architecture naturally supports tenant scoping:

- **Route Layer:** Extract tenant from request (subdomain/header)
- **Service Layer:** Pass tenant context to repositories
- **Repository Layer:** Filter all queries by tenantId

**Required Changes:**

- Add tenant resolution middleware
- Refactor DI container to per-request scoping
- Update all service methods to accept tenantId

**Risk Level:** MEDIUM (manageable with phased approach)

---

### 2. DATABASE ASSESSMENT

**Current Schema:** 11 models, zero tenant awareness

**Critical Issue:** `Booking.date @unique` constraint

This single constraint is the **biggest blocker** for multi-tenancy:

```prisma
model Booking {
  date DateTime @unique  // ❌ BLOCKS: Only ONE booking per date system-wide
}
```

**Required Change:**

```prisma
model Booking {
  tenantId String
  date     DateTime

  @@unique([tenantId, date])  // ✅ ALLOWS: One booking per date PER TENANT
}
```

**Recommended Pattern:** **Row-Level Isolation (Single Database)**

**Rationale:**

- **Simplest to implement** (single database, single connection pool)
- **Cost-effective** (one Supabase instance for 100+ tenants)
- **Optimal for scale** (10-1000 tenants)
- **Prisma native support** (no ORM workarounds)

**Schema Changes Required:**

1. **Add Tenant Model:**

```prisma
model Tenant {
  id              String   @id @default(cuid())
  slug            String   @unique
  name            String
  primaryColor    String
  logoUrl         String?
  stripeAccountId String?  @unique
  // ... branding/config fields

  packages        Package[]
  bookings        Booking[]
  users           User[]
}
```

2. **Add tenantId to 8 models:**
   - Package, AddOn, Booking, Customer, User, Venue, BlackoutDate, Payment

3. **Update unique constraints to composite:**
   - `Package.slug` → `@@unique([tenantId, slug])`
   - `Booking.date` → `@@unique([tenantId, date])`
   - `Customer.email` → `@@unique([tenantId, email])`
   - `User.email` → `@@unique([tenantId, email])`

**Migration Complexity:** MEDIUM (2-3 weeks)

---

### 3. BACKEND API ASSESSMENT

**Current API:** 17 endpoints, zero tenant context

**Scope of Changes:**

| Layer           | Files Affected  | Lines Changed | Complexity  |
| --------------- | --------------- | ------------- | ----------- |
| Database Schema | 1 file          | ~50 lines     | Medium      |
| DTOs/Contracts  | 2 files         | ~30 lines     | Low         |
| Repositories    | 6 files         | ~150 lines    | Medium      |
| Services        | 4 files         | ~120 lines    | Medium-High |
| Middleware      | 3 files (2 new) | ~100 lines    | Medium      |
| Controllers     | 7 files         | ~80 lines     | Low         |
| DI Container    | 1 file          | ~60 lines     | High        |
| Tests           | 15+ files       | ~200 lines    | Medium      |

**Total Estimate:** ~790 lines changed across 35+ files

**Critical Pattern Changes:**

**1. Tenant Resolution Middleware**

```typescript
// Extract tenant from subdomain: acme.elope.com → "acme"
export function tenantResolverMiddleware() {
  return async (req, res, next) => {
    const subdomain = extractSubdomain(req.hostname);
    const tenant = await tenantRepo.findBySlug(subdomain);

    if (!tenant || !tenant.active) {
      return next(new TenantNotFoundError(subdomain));
    }

    res.locals.tenant = tenant;
    next();
  };
}
```

**2. Tenant-Scoped Repositories**

```typescript
// Before: Global query
async findAll(): Promise<Booking[]> {
  return prisma.booking.findMany();  // ❌ Returns ALL bookings
}

// After: Tenant-scoped query
async findAll(tenantId: string): Promise<Booking[]> {
  return prisma.booking.findMany({
    where: { tenantId }  // ✅ Returns only tenant's bookings
  });
}
```

**3. Authentication Changes**

```typescript
// Current JWT payload
{ userId, email, role: 'admin' }

// Multi-tenant JWT payload
{ userId, email, tenantId, role: 'TENANT_ADMIN' }
```

**API Routing Strategy:** **Subdomain-based** (recommended)

- Customer-facing: `acme.elope.com`
- Admin panel: `acme.elope.com/admin`
- Custom domains: `weddings.acme.com` (future)

**Implementation Effort:** 3-4 weeks

---

### 4. FRONTEND ASSESSMENT

**Current State:** Hardcoded branding in 15+ components

**Critical Files with Hardcoded Content:**

1. **AppShell.tsx** - Logo, navigation, footer
2. **Home.tsx** - Hero headline, stats, testimonials, features
3. **tailwind.config.js** - Navy/lavender color scheme
4. **index.css** - Font definitions

**Customization Requirements:**

Each tenant needs configurable:

- **Visual:** Logo, colors (primary/secondary/accent), fonts
- **Content:** Hero headline, features (4 cards), testimonials (3 items), stats (3 metrics)
- **Business:** Contact email/phone, custom domain
- **Payment:** Stripe account credentials

**Recommended Theming Architecture:** **Database + CSS Variables**

**Implementation:**

1. **Fetch tenant config on mount:**

```typescript
// GET /v1/tenants/:slug/config
{
  slug: "acme",
  brandName: "Acme Weddings",
  primaryColor: "#8B4789",
  heroHeadline: "Your Dream Wedding Awaits",
  // ... more config
}
```

2. **Inject CSS variables:**

```typescript
document.documentElement.style.setProperty('--color-primary', tenant.primaryColor);
document.documentElement.style.setProperty('--font-heading', tenant.headingFont);
```

3. **Update Tailwind to use variables:**

```javascript
// tailwind.config.js
colors: {
  primary: 'var(--color-primary)',
  secondary: 'var(--color-secondary)'
}
```

**Component Refactoring:**

**Before:**

```typescript
<h1>Your Perfect Day, Simplified</h1>  // ❌ Hardcoded
```

**After:**

```typescript
const tenant = useTenant();
<h1>{tenant.heroHeadline}</h1>  // ✅ Dynamic
```

**New Components Needed:**

- `TenantProvider` - Context provider for tenant config
- `TenantNotFound` - Error page for invalid subdomains
- `TenantLogo` - Dynamic logo component
- `DynamicHero`, `DynamicFooter` - Refactored sections

**Performance Impact:** +1 API call on initial load (tenant config)

- **Mitigation:** Inline tenant config in HTML via SSR/edge workers

**Implementation Effort:** 3-4 weeks

---

### 5. SECURITY ASSESSMENT

**Current Security Posture:** 6/10 (adequate for single tenant)

**Multi-Tenancy Security Readiness:** 0/10 (architecture incompatible)

**CRITICAL SECURITY GAPS:**

1. **No Tenant Isolation**
   - All data globally accessible
   - No row-level security
   - No tenant context validation

2. **Global Unique Constraints**
   - One tenant's booking blocks all other tenants on same date
   - Email uniqueness prevents shared customer emails

3. **Authentication Lacks Tenant Binding**
   - JWT has no tenantId claim
   - No tenant-level RBAC
   - Admin can theoretically access all data

**Required Security Controls:**

**Layer 1: Database Row-Level Security (RLS)**

```sql
ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "Booking"
  USING (tenantId = current_setting('app.current_tenant_id'));
```

**Layer 2: Application Middleware**

```typescript
// Validate tenant ownership on every request
export function validateTenantAccess(req, res, next) {
  const admin = res.locals.admin;
  const requestedTenant = res.locals.tenant;

  if (admin.tenantId !== requestedTenant.id) {
    throw new ForbiddenError('Access denied');
  }
  next();
}
```

**Layer 3: Repository Enforcement**

```typescript
// Base class forces tenant filtering
abstract class TenantScopedRepository {
  constructor(protected tenantId: string) {}

  protected applyTenantFilter<T>(where: T): T & { tenantId: string } {
    return { ...where, tenantId: this.tenantId };
  }
}
```

**Layer 4: Automated Testing**

```typescript
// Security test: Prevent cross-tenant access
it('should block Tenant A from accessing Tenant B data', async () => {
  const tenantA = await createTenant();
  const tenantB = await createTenant();
  const bookingB = await createBooking({ tenantId: tenantB.id });

  const tokenA = await loginAsTenant(tenantA.id);
  const response = await api.get(`/bookings/${bookingB.id}`).auth(tokenA);

  expect(response.status).toBe(403); // ✅ Blocked
});
```

**Threat Model (Multi-Tenant):**

| Threat                                 | Severity     | Mitigation                           |
| -------------------------------------- | ------------ | ------------------------------------ |
| Data leakage (missing tenantId filter) | **CRITICAL** | Middleware + RLS + tests             |
| Tenant ID manipulation                 | **HIGH**     | Extract from JWT, never trust params |
| Subdomain takeover                     | **MEDIUM**   | Wildcard DNS + monitoring            |
| Payment fraud (wrong Stripe account)   | **HIGH**     | Per-tenant Stripe Connect            |
| Cross-tenant CSRF                      | **LOW**      | JWT immune to CSRF                   |

**Compliance Considerations:**

- **GDPR:** Tenant-scoped data export/deletion
- **PCI DSS:** Per-tenant Stripe accounts (already SAQ-A via Stripe)
- **SOC 2:** Audit logging with tenant context

**Implementation Effort:** 2-3 weeks (security is parallel workstream)

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-2)

**Database Migration:**

- Create `Tenant` table
- Add `tenantId` columns (nullable initially)
- Create default tenant for existing data
- Backfill tenantId for all records

**Deliverables:**

- Prisma migration scripts
- Data validation queries
- Rollback procedures

**Risk:** MEDIUM (schema changes)
**Mitigation:** Test in staging with production data

---

### Phase 2: Backend Tenant Awareness (Weeks 3-4)

**Repository Layer:**

- Create `TenantScopedRepository` base class
- Refactor all repositories to require tenantId
- Update all queries to filter by tenant

**Service Layer:**

- Update service constructors to accept tenant context
- Add tenant validation to all operations
- Update slug uniqueness to be tenant-scoped

**Deliverables:**

- Refactored repositories (6 files)
- Refactored services (4 files)
- Unit tests for tenant isolation

**Risk:** MEDIUM (breaking changes)
**Mitigation:** Feature flag toggle

---

### Phase 3: API & Middleware (Weeks 5-6)

**Request Pipeline:**

- Implement `tenantResolverMiddleware`
- Extend `authMiddleware` with tenant validation
- Refactor DI container to factory pattern

**API Contracts:**

- Add tenant endpoints (`GET /v1/tenants/:slug/config`)
- Extend DTOs with optional tenantId
- Update API documentation

**Deliverables:**

- Middleware (3 files)
- Updated contracts (2 files)
- Integration tests

**Risk:** HIGH (authentication changes)
**Mitigation:** Phased rollout, backward compatibility

---

### Phase 4: Frontend Multi-Tenancy (Weeks 7-8)

**Theme System:**

- Build `TenantProvider` context
- Implement tenant resolution from hostname
- Apply CSS variables on mount

**Component Refactoring:**

- Replace hardcoded branding in AppShell, Home
- Add dynamic logo, hero, footer components
- Update routing for tenant context

**Deliverables:**

- Tenant context provider
- Refactored components (10+ files)
- E2E tests with multiple tenants

**Risk:** MEDIUM (UX changes)
**Mitigation:** A/B testing, gradual rollout

---

### Phase 5: Stripe Connect & Payments (Weeks 9-10)

**Payment Isolation:**

- Integrate Stripe Connect (Standard Accounts)
- Add per-tenant Stripe account management
- Update webhook routing and validation

**Tenant Provisioning:**

- Build tenant onboarding flow
- Add Stripe account linking
- Implement webhook routing by tenant

**Deliverables:**

- Stripe Connect integration
- Tenant admin UI for payment setup
- Payment isolation tests

**Risk:** HIGH (financial transactions)
**Mitigation:** Extensive testing in Stripe test mode

---

### Phase 6: Admin Theme Editor (Weeks 11-12)

**Self-Service Customization:**

- Build theme editor UI
- Add color picker, logo upload, font selector
- Implement live preview

**Content Management:**

- Add editors for hero, features, testimonials
- Image upload (logo, hero background)
- Save/publish workflow

**Deliverables:**

- Theme editor UI
- Image upload to S3/R2
- Preview mode

**Risk:** LOW (admin-only feature)
**Mitigation:** Beta testing with early tenants

---

### Phase 7: Testing & Hardening (Week 13)

**Security Validation:**

- Penetration testing (cross-tenant access attempts)
- SQL injection testing (tenant context)
- Rate limiting per tenant

**Performance Testing:**

- Load test with 100 simulated tenants
- Query performance with composite indexes
- Cache hit rates for tenant configs

**Compliance Validation:**

- GDPR data export/deletion workflows
- Audit log verification
- Tenant isolation verification

**Deliverables:**

- Security audit report
- Performance benchmarks
- Compliance checklist

---

### Phase 8: Deployment & Monitoring (Week 14)

**Production Rollout:**

- Blue-green deployment with feature flag
- Gradual tenant migration to multi-tenant schema
- Monitoring dashboards (per-tenant metrics)

**Documentation:**

- Tenant onboarding guide
- API documentation updates
- Security best practices

**Deliverables:**

- Production deployment
- Monitoring setup
- Updated documentation

---

## EFFORT SUMMARY

| Phase         | Duration | Complexity  | Risk   |
| ------------- | -------- | ----------- | ------ |
| 1. Foundation | 2 weeks  | Medium      | Medium |
| 2. Backend    | 2 weeks  | Medium-High | Medium |
| 3. API & Auth | 2 weeks  | High        | High   |
| 4. Frontend   | 2 weeks  | Medium      | Medium |
| 5. Payments   | 2 weeks  | High        | High   |
| 6. Admin UI   | 2 weeks  | Medium      | Low    |
| 7. Testing    | 1 week   | High        | High   |
| 8. Deployment | 1 week   | Medium      | Medium |

**TOTAL: 14 weeks (3.5 months)**

**Team Size Assumption:** 2-3 developers + 1 designer

**Buffer:** +20% for unknowns = **16-17 weeks (4 months)**

---

## CRITICAL DECISIONS REQUIRED

### Decision 1: Tenant Identification Strategy

**Options:**

- ✅ **Subdomain** (acme.elope.com) - RECOMMENDED
- ❌ Path prefix (/acme/packages)
- ❌ Header-based (X-Tenant-ID)

**Recommendation:** Subdomain for UX, with custom domain support later

**Impact:** Routing, DNS, SSL certificates

---

### Decision 2: Database Isolation Model

**Options:**

- ✅ **Row-level isolation** (tenantId column) - RECOMMENDED
- ❌ Schema-per-tenant (PostgreSQL schemas)
- ❌ Database-per-tenant (separate databases)

**Recommendation:** Row-level for simplicity and cost

**Impact:** Migration complexity, query performance

---

### Decision 3: User-Tenant Relationship

**Options:**

- ✅ **One user per tenant** (simple) - RECOMMENDED
- ❌ Multiple tenants per user (complex)

**Recommendation:** Start with one-to-one, add multi-tenant users later if needed

**Impact:** Authentication model, JWT structure

---

### Decision 4: Existing Data Handling

**Options:**

- ✅ **Create "default" tenant** - RECOMMENDED
- ❌ Migrate to first real tenant
- ❌ Archive and start fresh

**Recommendation:** Default tenant for safe migration

**Impact:** Data integrity, backward compatibility

---

### Decision 5: Payment Model

**Options:**

- ✅ **Stripe Connect (Standard)** - RECOMMENDED
- ❌ Single Stripe account with metadata
- ❌ Stripe Connect (Custom)

**Recommendation:** Stripe Connect for tenant autonomy and financial isolation

**Impact:** Revenue flow, payout complexity, platform fees

---

## OPEN QUESTIONS FOR PRODUCT TEAM

### Business Model Questions

1. **Tenant Signup Flow:**
   - Self-service signup or admin-provisioned?
   - Free trial period? How long?
   - Payment plans (free, pro, enterprise)?

2. **Tenant Lifecycle:**
   - What happens to suspended/deleted tenant data?
   - Soft delete or hard delete?
   - Data retention policy?

3. **Platform Revenue Model:**
   - Per-tenant subscription?
   - Commission on bookings?
   - Freemium model?

4. **Tenant Limits:**
   - Max packages per tenant?
   - Max bookings per month?
   - Storage limits for images?

### Feature Scope Questions

5. **Custom Domains:**
   - Launch with custom domains or later?
   - How to handle DNS verification?
   - SSL certificate automation?

6. **Shared Catalog:**
   - Should tenants share package templates?
   - "Marketplace" of wedding packages?
   - Franchise/multi-location support?

7. **Cross-Tenant Users:**
   - Can a user admin multiple tenants?
   - Platform admin role needed?
   - Tenant switching UI?

8. **White-Labeling:**
   - Should "Powered by Elope" be removable?
   - Premium feature?
   - Branding guidelines for tenants?

### Technical Questions

9. **Performance SLA:**
   - Target page load time?
   - Concurrent tenant limit?
   - Database size expectations?

10. **Compliance Requirements:**
    - GDPR only or also CCPA?
    - Data residency requirements (EU tenants)?
    - SOC 2 needed for enterprise tenants?

---

## RISK ASSESSMENT

### High-Risk Areas

| Risk                            | Impact       | Likelihood | Mitigation                             |
| ------------------------------- | ------------ | ---------- | -------------------------------------- |
| Data leakage (missing tenantId) | **CRITICAL** | MEDIUM     | Multi-layer validation + RLS           |
| Unique constraint violations    | **CRITICAL** | LOW        | Careful migration testing              |
| Payment routing errors          | **HIGH**     | MEDIUM     | Stripe test mode + extensive testing   |
| JWT secret rotation             | **HIGH**     | LOW        | Phased rollout, old token grace period |
| Performance degradation         | MEDIUM       | MEDIUM     | Load testing, proper indexing          |
| Migration downtime              | MEDIUM       | MEDIUM     | Blue-green deployment                  |

### Mitigation Strategies

**Data Leakage Prevention:**

- Implement 4-layer defense (middleware → service → repository → RLS)
- Automated security tests in CI/CD
- Regular penetration testing
- Audit all database queries for tenantId filtering

**Payment Security:**

- Extensive testing in Stripe test mode
- Webhook signature validation per tenant
- Separate Stripe accounts (no shared credentials)
- Manual verification for first 10 tenant onboardings

**Migration Safety:**

- Full database backup before migration
- Test migration on staging with production data clone
- Phased rollout with feature flags
- Rollback procedures documented and tested

---

## SUCCESS METRICS

### Technical Metrics

✅ **Zero cross-tenant data leaks** in penetration testing
✅ **< 100ms P95 latency** for tenant-scoped queries
✅ **100% test coverage** for tenant isolation logic
✅ **Zero downtime** during migration
✅ **< 5 minutes** to provision new tenant

### Business Metrics

✅ **10 beta tenants** onboarded in first month
✅ **50 tenants** within 6 months
✅ **95% customer satisfaction** with tenant branding
✅ **< 5% churn rate** for tenants

### Security Metrics

✅ **Zero security incidents** in first 3 months
✅ **100% audit log coverage** for admin actions
✅ **SOC 2 Type II** certification within 12 months
✅ **< 24 hours** to detect and respond to anomalies

---

## STRATEGIC RECOMMENDATIONS

### 1. Proceed with Phased Approach

**DO NOT attempt big-bang migration.** The architecture is solid but the scope is large. A phased approach with feature flags allows:

- Testing in production with limited exposure
- Rollback capability at each stage
- Learning from early tenants
- Budget spreading over 4 months

### 2. Prioritize Security from Day 1

**DO NOT retrofit security later.** Multi-tenancy security must be baked into the architecture:

- RLS policies in initial migration
- Tenant context validation in all queries
- Automated security testing in CI/CD
- Regular penetration testing

### 3. Design for Self-Service

**Target State:** Tenant admin can fully configure their site without developer intervention.

**Required:**

- Intuitive theme editor
- Live preview of changes
- Stripe Connect onboarding flow
- Documentation and video tutorials

### 4. Monitor Per-Tenant Performance

**Prevent "noisy neighbor" problem:**

- Per-tenant rate limiting
- Per-tenant database query monitoring
- Alerts for tenants exceeding resource quotas
- Graceful degradation (throttling vs. blocking)

### 5. Plan for Scale

**Target Capacity:** 1,000 tenants within 2 years

**Required:**

- Horizontal scaling (database sharding strategy)
- Caching strategy (Redis per-tenant namespaces)
- CDN for tenant assets (logos, images)
- Multi-region deployment (if data residency needed)

---

## ALTERNATIVE APPROACHES (NOT RECOMMENDED)

### Alternative 1: White-Label Deployments

**Pattern:** Deploy separate instance per tenant (e.g., acme.elope.com is entire separate deployment)

**Pros:**

- Complete isolation (zero cross-tenant risk)
- Custom scaling per tenant
- Tenant can choose cloud provider/region

**Cons:**

- Operational nightmare (manage N deployments)
- Cost prohibitive ($50-100/month per tenant minimum)
- No shared improvements (must deploy to all tenants)
- Complex CI/CD pipeline

**Verdict:** ❌ Overkill for wedding booking system

---

### Alternative 2: Franchise Model (No Multi-Tenancy)

**Pattern:** Sell codebase to each venue as standalone product

**Pros:**

- No architectural changes needed
- Maximum tenant customization
- One-time revenue vs. recurring

**Cons:**

- No recurring SaaS revenue
- Can't push updates to all customers
- Each customer needs hosting/maintenance
- Support burden (N different versions in wild)

**Verdict:** ❌ Doesn't match SaaS business model

---

### Alternative 3: Marketplace Model

**Pattern:** One shared catalog, tenants just configure pricing/availability

**Pros:**

- Minimal changes (add vendor field to Package)
- Shared package templates
- Network effects (customers discover multiple venues)

**Cons:**

- Not "unique landing page" per requirement
- Weak branding differentiation
- Competitive concerns (venues see each other's pricing)

**Verdict:** ❌ Doesn't meet "custom landing page" requirement

---

## FINAL VERDICT

### Is Multi-Tenancy the Right Choice?

**YES, with caveats:**

✅ **Scalable Business Model:** SaaS recurring revenue vs. one-time sales
✅ **Market Opportunity:** 1000+ wedding venues/photographers could benefit
✅ **Technical Feasibility:** Architecture can support it with 4 months effort
✅ **Competitive Advantage:** Most wedding booking tools are single-tenant

⚠️ **Requires Commitment:**

- 4 months development time
- $100K+ development cost (assuming 2 devs @ $150K salary)
- Ongoing security maintenance
- Customer success team for tenant onboarding

### When to Start?

**Option A: Now** (if)

- Committed to SaaS model
- Budget for 4 months development
- Have 5-10 beta tenants lined up
- Runway to go 4 months without new revenue

**Option B: Later** (if)

- Still validating market fit
- Want to acquire 10+ customers first
- Budget constraints
- Can acquire customers with current single-tenant model

**Recommendation:** **Validate demand first, then invest in multi-tenancy.**

Suggested approach:

1. **Month 1-2:** Manually onboard 5 wedding venues on separate single-tenant deployments
2. **Month 3:** If all 5 are paying customers, commit to multi-tenancy
3. **Month 4-7:** Execute multi-tenancy migration (4 months)
4. **Month 8+:** Onboard tenants to multi-tenant platform, sunset individual deployments

This de-risks the investment by proving demand before architectural commitment.

---

## NEXT STEPS

### Immediate (Next 2 Weeks)

1. **Product Decision:** Validate multi-tenancy aligns with business strategy
2. **Answer Open Questions:** Work through business model and feature scope
3. **Technical Spike:** Build proof-of-concept tenant resolution middleware
4. **Design Review:** Finalize tenant schema and migration approach
5. **Resource Planning:** Allocate team for 4-month project

### Short-Term (Weeks 3-4)

6. **Kickoff Phase 1:** Database migration planning
7. **Security Design:** Document threat model and mitigation strategies
8. **Frontend Mockups:** Design tenant theme editor UI
9. **Stripe Connect Research:** Validate payment isolation approach
10. **Beta Tenant Recruiting:** Line up 5-10 venues for beta testing

### Long-Term (Months 2-4)

11. **Execute Phases 2-8:** Follow implementation roadmap
12. **Beta Testing:** Onboard beta tenants to new architecture
13. **Security Audit:** Third-party penetration testing
14. **Documentation:** Tenant onboarding guides, API docs
15. **Launch:** Public release of multi-tenant platform

---

## APPENDICES

### Appendix A: File Change Inventory

**High-Priority (Breaking Changes):**

- `/server/prisma/schema.prisma` - Add Tenant model, tenantId columns
- `/server/src/di.ts` - Refactor to factory pattern
- `/server/src/middleware/tenant.ts` - NEW: Tenant resolution
- `/server/src/services/*.ts` - Add tenantId parameters (4 files)
- `/client/src/app/AppShell.tsx` - Dynamic branding
- `/client/src/pages/Home.tsx` - Dynamic content
- `/client/src/lib/api.ts` - Tenant header injection

**Medium-Priority:**

- `/server/src/adapters/prisma/*.ts` - Tenant-scoped queries (6 files)
- `/packages/contracts/src/api.v1.ts` - Tenant endpoints
- `/client/src/features/**/*.tsx` - Tenant context usage (10+ files)

**Low-Priority (Admin-Only):**

- `/client/src/features/admin/**/*.tsx` - Tenant-scoped admin (7 files)

### Appendix B: Database Migration Scripts

See `MULTI_TENANCY_MIGRATION_PLAN.md` (to be created)

### Appendix C: Testing Strategy

See `MULTI_TENANCY_TESTING_PLAN.md` (to be created)

### Appendix D: Security Checklist

See security assessment section above

### Appendix E: Cost-Benefit Analysis

**Investment:**

- 4 months dev time (2 developers): ~$100K
- Infrastructure (Supabase scale-up): +$50/month
- Stripe Connect fees: 0.25% per transaction
- Ongoing maintenance: ~10 hrs/month

**Return:**

- Tenant 1-10: $99/month = $990/month
- Tenant 11-50: $99/month = $4,950/month
- Tenant 51-100: $99/month = $9,900/month

**Break-even:** 10 paying tenants = $990/month → 101 months to recoup $100K
**With 50 tenants:** 20 months to break even
**With 100 tenants:** 10 months to break even

**Conclusion:** Needs minimum 30-50 tenants to justify investment

---

## CONCLUSION

The Elope application is **technically capable of becoming multi-tenant** with 4 months of focused development effort. The architecture is solid, the team is competent (evidenced by clean codebase), and the market opportunity exists.

**However, success depends on:**

1. **Business commitment** to SaaS model
2. **Validated demand** from 10+ potential tenants
3. **Security-first implementation** (no shortcuts)
4. **Patient rollout** (phased migration, not big bang)

**If these conditions are met, proceed with confidence.** The roadmap is clear, risks are manageable, and the technical foundation is strong.

**If demand is uncertain, validate first.** Manually onboard 5-10 customers on single-tenant deployments, prove willingness to pay, then commit to multi-tenancy migration.

---

**Report Compiled By:** Architecture Assessment Team
**Report Date:** November 6, 2025
**Codebase Analyzed:** Elope (stack-migration branch, commit 77783dc)
**Classification:** INTERNAL STRATEGIC PLANNING

**End of Report**
