# Admin Tenant Impersonation - Gap Analysis

**Date:** December 27, 2025
**Status:** Feature specification analysis complete
**Priority:** P1 - Required for platform admin onboarding

---

## Executive Summary

The MAIS platform has **fully functional backend impersonation APIs** (`POST /v1/auth/impersonate` and `POST /v1/auth/stop-impersonation`) with comprehensive test coverage, but the **Next.js frontend is completely missing the admin dashboard UI**. Platform admins are currently unable to view tenants or access impersonation features in the production-ready Next.js app (they're stuck in the tenant dashboard).

The legacy Vite admin client has complete impersonation UI (TenantsTab, ImpersonationBanner components) that can serve as a reference implementation. A full feature port to Next.js is required.

---

## Current State

### Backend (Complete)

- **Status:** Production-ready
- **Location:** `server/src/routes/auth.routes.ts:702-784`
- **Endpoints:**
  - `POST /v1/auth/impersonate` - Requires `Authorization` header with admin token + `tenantId` in body
  - `POST /v1/auth/stop-impersonation` - Returns to normal admin token
- **Token Structure:** Includes `impersonating` field with `{tenantId, tenantSlug, tenantEmail, startedAt}`
- **Security:**
  - Validates admin role (`userId` field required)
  - Verifies tenant exists
  - Logs all impersonation events
  - JWT-based with explicit algorithm

### NextAuth.js Configuration (Complete)

- **Status:** Types and session handling ready
- **Location:** `apps/web/src/lib/auth.ts`
- **Session Fields:**
  - `impersonation?: {tenantId, tenantSlug, tenantEmail, startedAt}`
  - `role: 'PLATFORM_ADMIN' | 'TENANT_ADMIN'`
- **Auth Client:** `apps/web/src/lib/auth-client.ts` has helpers:
  - `isPlatformAdmin()` - true only if admin AND not impersonating
  - `isTenantAdmin()` - true if role is TENANT_ADMIN OR impersonating
  - `isImpersonating()` - detects impersonation state

### Middleware (Partial)

- **Status:** Blocks admin routes from impersonating users
- **Location:** `apps/web/src/middleware.ts:66-76`
- **Logic:**
  ```typescript
  if (pathname.startsWith('/admin') && session) {
    if (role !== 'PLATFORM_ADMIN' || isImpersonating) {
      return NextResponse.redirect(new URL('/tenant/dashboard', request.url));
    }
  }
  ```

### Frontend Next.js (Missing)

- **Status:** No admin routes or components exist
- **Missing Components:**
  - `/admin` route structure
  - Admin dashboard page
  - Tenants list page
  - Tenant cards with impersonation buttons
  - Impersonation banner
  - Stop impersonation UI
- **UI Pattern:** AdminSidebar exists at `apps/web/src/components/layouts/AdminSidebar.tsx` with `adminNavItems` defined but no routes implemented

---

## Gap Analysis

### 1. Missing Routes (P0 - Critical)

#### Gap 1.1: Admin Route Structure

**Missing:** Directory structure for admin routes

```
apps/web/src/app/(protected)/admin/
├── layout.tsx                    # Admin layout with sidebar
├── dashboard/
│   ├── page.tsx                 # Admin dashboard
│   └── error.tsx
├── tenants/
│   ├── page.tsx                 # Tenants list
│   ├── [tenantId]/
│   │   ├── page.tsx            # Tenant detail (future: edit, stats)
│   │   └── error.tsx
│   └── error.tsx
├── segments/
│   ├── page.tsx                 # Customer segments (future)
│   └── error.tsx
└── error.tsx
```

**Dependency:** Middleware already has route guard at lines 66-76 that checks role + impersonating status.

**Reference:** Tenant routes at `apps/web/src/app/(protected)/tenant/` use same layout pattern.

---

#### Gap 1.2: Admin Dashboard Page

**Missing:** `/admin/dashboard` page

**Purpose:** Entry point for platform admin showing:

- Quick stats (total tenants, active tenants, revenue)
- Recent activity feed
- Navigation to Tenants, Segments

**Reference:** Legacy at `client/src/features/admin/Dashboard.tsx` shows patterns.

**Design System:** Use HANDLED brand:

- Sage green (#4A7C6F) for CTAs
- Warm surface (#FFFBF8)
- Cards: `rounded-3xl shadow-lg`
- Spacing: `py-32 md:py-40` for sections

---

#### Gap 1.3: Tenants List Page

**Missing:** `/admin/tenants` page with tenant cards

**Functionality:**

1. Fetch all tenants (will need backend endpoint)
2. Display grid/list of tenant cards
3. Show tenant status (active/inactive) + Stripe onboarded badge
4. "Sign In As" button per tenant → calls impersonation API
5. Loading states during impersonation

**Reference:** Legacy `client/src/features/admin/dashboard/tabs/TenantsTab.tsx:37-166`

- Shows 7-element card per tenant: name, slug, commission %, API key, stats, active status, impersonate button
- Loading state while impersonation request is in flight
- Error toast handling

**API Dependency:** Needs `/v1/admin/tenants` endpoint (check if exists)

---

### 2. Missing Components (P1 - High)

#### Gap 2.1: ImpersonationBanner

**Missing:** Banner displayed when admin is impersonating

**Reference:** `client/src/features/admin/dashboard/components/ImpersonationBanner.tsx:1-74`

- Yellow/orange warning design
- Shows "Impersonating" + tenant email
- "Exit Impersonation" button calls `POST /v1/auth/stop-impersonation`

**Brand Update Required:**

- Current legacy: `bg-yellow-900/50 border-2 border-yellow-500` (aggressive yellow)
- Should match HANDLED: Use orange accent (brand-safe) or sage secondary
- Placement: Top of AdminSidebar or page header

**Key Code Pattern:**

```typescript
const handleStopImpersonation = async () => {
  const result = await api.adminStopImpersonation();
  if (result.status === 200) {
    window.location.reload(); // Legacy pattern - migrate to session.update()
  }
};
```

**Integration Points:**

- AdminSidebar already detects impersonation at line 192: `{isImpersonating() && impersonation && (...)`
- Just need to add actual banner component + API call

---

#### Gap 2.2: TenantCard Component

**Missing:** Reusable card showing single tenant

**Props:**

```typescript
interface TenantCardProps {
  tenant: {
    id: string;
    name: string;
    slug: string;
    email: string;
    apiKeyPublic: string;
    commissionPercent: number;
    isActive: boolean;
    stripeOnboarded: boolean;
    stats: { bookings: number; packages: number; addOns: number };
  };
  onImpersonate: (tenantId: string) => Promise<void>;
  isLoading: boolean;
}
```

**Design:**

- Card: `rounded-3xl shadow-lg hover:shadow-xl transition-all`
- Status badges: `isActive` and `stripeOnboarded`
- CTA: "Sign In As" button in sage green
- Stats row: "X bookings, Y packages, Z add-ons"

---

### 3. Missing API Integrations (P1 - High)

#### Gap 3.1: Missing Client API Methods

**Missing:** NextAuth-compatible impersonation methods

**Required additions to `apps/web/src/lib/auth-client.ts`:**

```typescript
export async function startImpersonation(tenantId: string) {
  const session = await getSession();
  const backendToken = await getBackendToken(); // From auth.ts

  if (!backendToken) throw new Error('Not authenticated');

  const response = await fetch('/v1/auth/impersonate', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${backendToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tenantId }),
  });

  if (!response.ok) throw new Error('Impersonation failed');

  const result = await response.json();
  // Update session with new impersonation data
  await session.update(); // NextAuth refresh
  return result;
}

export async function stopImpersonation() {
  const backendToken = await getBackendToken();
  if (!backendToken) throw new Error('Not authenticated');

  const response = await fetch('/v1/auth/stop-impersonation', {
    method: 'POST',
    headers: { Authorization: `Bearer ${backendToken}` },
  });

  if (!response.ok) throw new Error('Stop impersonation failed');

  await session.update(); // NextAuth refresh
  return response.json();
}
```

**Current Issue:** `getBackendToken()` in auth.ts is server-side only. Need server action wrapper for client components.

---

#### Gap 3.2: Backend Tenant Listing Endpoint

**Missing or Not Checked:** `/v1/admin/tenants` endpoint

**Required for admin dashboard:**

- Fetch all tenants with stats
- Filter by active status
- Pagination (future)

**Status:** Needs verification - check if exists in `server/src/routes/`

---

### 4. Edge Cases Not Yet Handled (P2 - Medium)

#### Gap 4.1: Impersonation Timeout

**Issue:** No session timeout handling when impersonating

**Scenario:** Admin impersonates tenant, JWT expires after 24 hours, admin gets kicked out while impersonating.

**Solution:**

- Shorter impersonation-specific timeout (4 hours) vs admin token (24 hours)
- Auto-logout with message: "Your impersonation session has expired. Please sign in again."
- Middleware should detect expired impersonation and redirect to `/login`

**Current State:** Uses same 24-hour timeout for both

---

#### Gap 4.2: Nested Impersonation Prevention

**Issue:** Admin impersonates tenant A, then tries to impersonate tenant B

**Current Behavior:** Backend allows `startImpersonation(token_with_impersonating_field)` - check if prevented

**Test Coverage:** `auth-impersonation.spec.ts` doesn't include this scenario

**Solution:** Add validation in backend:

```typescript
if (payload.impersonating) {
  throw new UnauthorizedError(
    'Cannot impersonate while already impersonating. Stop impersonation first.'
  );
}
```

---

#### Gap 4.3: Impersonation Audit Logging

**Status:** Partially implemented

**Current:** Backend logs start/stop at info level with email + tenant ID

**Missing:**

- Dashboard view of admin activity (who impersonated when)
- Impersonation duration tracking
- Failed impersonation attempts
- Database table for audit events

**Reference:** `server/src/routes/auth.routes.ts:734-742` shows current logging pattern

---

#### Gap 4.4: Concurrent Admin Sessions

**Issue:** What if admin logs in on two devices and impersonates different tenants?

**Scenario:**

1. Admin logs in on browser A, impersonates Tenant 1
2. Admin logs in on browser B, gets fresh admin token (not impersonating)
3. Browser B impersonates Tenant 2
4. Admin has two separate impersonation sessions

**Current Behavior:** Unknown - tokens are stateless, so should be independent

**Solution:** Accept this as valid (admin may need multiple contexts) OR add device tracking

---

#### Gap 4.5: Impersonation in Stored Data

**Issue:** When admin impersonates, what happens to booking creates/edits?

**Scenario:** Admin impersonates Tenant A, creates booking via `/v1/tenant/bookings/create`

**Current Behavior:** Check if middleware properly routes to tenant context

**Validation Needed:**

- Tenant middleware extracts tenant ID from session
- Check if impersonation field is properly handled
- Ensure data doesn't leak between impersonation contexts

---

### 5. UI/UX Gaps (P2 - Medium)

#### Gap 5.1: HANDLED Brand Compliance

**Issue:** Legacy yellow banner doesn't match HANDLED sage + orange palette

**Current Legacy:** `bg-yellow-900/50 border-yellow-500` with AlertCircle icon

**HANDLED Brand Update:**

```tsx
// Option A: Sage secondary + icon
<div className="bg-sage/10 border-l-4 border-sage">
  <AlertCircle className="text-sage" />
</div>

// Option B: Warm accent + icon
<div className="bg-orange-50 border-l-4 border-orange-400">
  <AlertCircle className="text-orange-600" />
</div>
```

**Design Spec:** See `docs/design/BRAND_VOICE_GUIDE.md` for colors + typography

---

#### Gap 5.2: Empty States

**Missing:**

- Empty state when admin has no tenants
- Empty state when tenant has no bookings (after impersonating)
- Error state if tenant list fails to load

**Pattern:** Use HANDLED voice - "Ready to onboard members?" not "No tenants yet"

---

#### Gap 5.3: Loading States

**Missing:**

- Skeleton cards while fetching tenant list
- Loading indicator on "Sign In As" button
- Session update delay during impersonation (NextAuth refresh)

**Current Legacy:** Simple button disabled state + "Loading..." text

---

### 6. Type Safety Gaps (P3 - Low)

#### Gap 6.1: Missing Contracts

**Status:** Impersonation endpoints not in `packages/contracts/`

**Issue:** No type-safe ts-rest contracts for:

- `POST /v1/auth/impersonate`
- `POST /v1/auth/stop-impersonation`
- `GET /v1/admin/tenants` (if not in contracts)

**Impact:** Client code using raw `fetch()` instead of type-safe contract client

**Solution:** Add to `packages/contracts/src/api.v1.ts`:

```typescript
export const auth = {
  impersonate: {
    method: 'POST',
    path: '/auth/impersonate',
    body: z.object({ tenantId: z.string() }),
    responses: {
      200: UnifiedLoginResponse,
      401: ErrorResponse,
    },
  },
  stopImpersonation: {
    method: 'POST',
    path: '/auth/stop-impersonation',
    responses: {
      200: UnifiedLoginResponse,
      401: ErrorResponse,
    },
  },
};
```

---

## Security Considerations

### Current Strengths

1. Backend validates admin role before impersonation
2. Tokens are JWT-based with explicit algorithm (HS256)
3. Impersonation tracked with timestamp + admin email
4. Middleware prevents impersonating users from accessing `/admin`

### Remaining Concerns

#### Concern 1: getBackendToken() Security

**Issue:** `getBackendToken()` (line 241 in auth.ts) is async server-side function

**Current:** Works only in Server Components, not Client Components

**Problem:** Client component needs to call impersonation API - must go through Server Action wrapper

**Solution:** Create `app/api/auth/impersonate/route.ts` and `stop-impersonate/route.ts` that:

1. Get backend token server-side
2. Call Express backend
3. Return response to client
4. Trigger NextAuth session update

---

#### Concern 2: CSRF on Impersonation

**Status:** NextAuth handles CSRF by default (cookies + tokens)

**Verification Needed:** Ensure `POST /auth/impersonate` validates origin/referer

---

#### Concern 3: Rate Limiting

**Status:** No rate limiting on impersonation endpoints

**Risk:** Admin could spam impersonate requests

**Recommendation:** Add to Express auth routes:

```typescript
import rateLimit from 'express-rate-limit';
const impersonateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many impersonation attempts. Please wait.',
});
router.post('/impersonate', impersonateLimiter, ...);
```

---

## Recommended Implementation Order

### Phase 1: Routes & Basic Navigation (2-3 days)

1. Create `/admin` directory structure
2. Create admin layout (copy tenant layout pattern)
3. Create `/admin/dashboard` page (stub with welcome message)
4. Create `/admin/tenants` page (stub with "Tenants Coming Soon")
5. Update AdminSidebar `isActive()` logic to include `/admin` routes

### Phase 2: Tenant Listing (2-3 days)

1. Verify or create `/v1/admin/tenants` backend endpoint
2. Create `TenantCard` component with HANDLED styling
3. Implement `/admin/tenants` page with:
   - Fetch tenants on mount
   - Map to TenantCard grid
   - Error boundary + loading skeleton
4. Create `useAdminTenants()` hook for data fetching + caching

### Phase 3: Impersonation API Integration (1-2 days)

1. Create Server Actions wrapper for impersonation calls
   - `apps/web/src/app/api/auth/impersonate/route.ts`
   - `apps/web/src/app/api/auth/stop-impersonate/route.ts`
2. Add impersonation methods to `auth-client.ts`
3. Integrate with TenantCard "Sign In As" button
4. Add error toast handling

### Phase 4: Impersonation Banner & UX (1-2 days)

1. Create `ImpersonationBanner` component (HANDLED-branded)
2. Add to page header in tenant/admin layouts
3. Implement "Exit Impersonation" button
4. Add session update + navigation after stop
5. Handle impersonation duration display (optional: "impersonating for 45 min")

### Phase 5: Edge Cases & Polish (2-3 days)

1. Add nested impersonation validation (backend)
2. Add impersonation timeout (shorter than admin timeout)
3. Add audit logging (optional: dashboard view)
4. Add empty states + error messages
5. Add skeleton loaders
6. Test concurrent sessions
7. Load `/workflows:review` for multi-agent code review

---

## Testing Strategy

### Unit Tests

- `ImpersonationBanner` component behavior
- `TenantCard` props + callbacks
- Impersonation state detection in hooks

### Integration Tests

- Server Action calls backend impersonate API
- Session updates with impersonation data
- Middleware redirects impersonating admins to tenant dashboard

### E2E Tests (Playwright)

1. Admin logs in → lands on `/admin/dashboard`
2. Navigate to `/admin/tenants`
3. Click "Sign In As" on tenant card
4. Verify impersonation banner appears
5. Verify can access `/tenant/dashboard` (impersonated context)
6. Click "Exit Impersonation"
7. Verify back in `/admin/dashboard`
8. Verify no impersonation banner

### Security Tests

- Cannot impersonate while already impersonating (backend validation)
- Cannot access `/admin/tenants` as TENANT_ADMIN
- Token includes correct impersonation metadata

---

## Known Blockers

### Blocker 1: getBackendToken() in Client Components

**Status:** Architectural limitation

**Impact:** Cannot directly call impersonate API from client component

**Solution:** Use Next.js Server Actions or API Routes as middleware layer

**Effort:** Low (standard Next.js pattern)

---

### Blocker 2: Missing /v1/admin/tenants Endpoint

**Status:** Unknown (needs verification)

**Impact:** Cannot fetch tenant list

**Solution:** Create endpoint if missing, or use alternative data source

**Effort:** Unknown

---

## Files to Create

```
apps/web/src/
├── app/
│   └── (protected)/
│       └── admin/
│           ├── layout.tsx                      # Admin layout
│           ├── error.tsx                        # Error boundary
│           ├── dashboard/
│           │   ├── page.tsx                    # Dashboard home
│           │   └── error.tsx
│           ├── tenants/
│           │   ├── page.tsx                    # Tenants list
│           │   ├── page.client.tsx             # Client component
│           │   └── error.tsx
│           └── segments/
│               ├── page.tsx                    # Segments (stub)
│               └── error.tsx
├── components/
│   ├── admin/
│   │   ├── TenantCard.tsx                     # Tenant card component
│   │   ├── ImpersonationBanner.tsx            # Impersonation banner
│   │   └── TenantGrid.tsx                     # Grid container
│   └── hooks/
│       └── useAdminTenants.ts                 # Data hook
└── api/
    └── auth/
        ├── impersonate/
        │   └── route.ts                       # Server action wrapper
        └── stop-impersonate/
            └── route.ts                       # Server action wrapper
```

---

## Files to Modify

```
apps/web/src/
├── lib/
│   ├── auth.ts                                # Add impersonation timeout constant
│   └── auth-client.ts                         # Add impersonation helper methods
├── components/
│   └── layouts/
│       └── AdminSidebar.tsx                   # Add /admin route handling
└── middleware.ts                              # Already handles admin routes - verify
```

---

## Contracts to Add

```
packages/contracts/src/
└── api.v1.ts                                  # Add impersonate/stop-impersonate contracts
```

---

## Design References

### Brand Standards

- **Guide:** `docs/design/BRAND_VOICE_GUIDE.md`
- **Colors:** Sage (#4A7C6F), Orange accent, Warm surface (#FFFBF8)
- **Typography:** Serif headlines, tight tracking, light weight for subheadings
- **Spacing:** `py-32 md:py-40` for sections, `rounded-3xl` for cards
- **Elevation:** `shadow-lg hover:shadow-xl transition-all duration-300`

### Legacy Reference Components

- **ImpersonationBanner:** `client/src/features/admin/dashboard/components/ImpersonationBanner.tsx`
- **TenantsTab:** `client/src/features/admin/dashboard/tabs/TenantsTab.tsx`
- **Dashboard:** `client/src/features/admin/Dashboard.tsx`

---

## Success Criteria

- [ ] Platform admin can log in and see `/admin/dashboard`
- [ ] Admin can navigate to `/admin/tenants` and see list of all tenants
- [ ] Admin can click "Sign In As" button and impersonate a tenant
- [ ] Impersonation banner displays (HANDLED-branded)
- [ ] Admin can click "Exit Impersonation" and return to admin dashboard
- [ ] Impersonating admins cannot access other `/admin/*` routes (middleware)
- [ ] Impersonation data persists in NextAuth session
- [ ] All impersonation actions are logged (audit trail visible in logs)
- [ ] E2E tests pass for complete impersonation flow
- [ ] Code follows HANDLED brand voice and design standards

---

## Appendix: Token Structure

### Admin Token (Normal)

```json
{
  "userId": "admin_123",
  "email": "admin@gethandled.ai",
  "role": "PLATFORM_ADMIN",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Admin Token (Impersonating)

```json
{
  "userId": "admin_123",
  "email": "admin@gethandled.ai",
  "role": "PLATFORM_ADMIN",
  "impersonating": {
    "tenantId": "tenant_456",
    "tenantSlug": "acme-corp",
    "tenantEmail": "admin@acme.com",
    "startedAt": "2025-12-27T14:30:00Z"
  },
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Session Object (NextAuth)

```typescript
{
  user: {
    id: "admin_123",
    email: "admin@gethandled.ai",
    role: "PLATFORM_ADMIN",
    tenantId: undefined,  // Admin only
    slug: undefined,      // Admin only
    impersonation: {
      tenantId: "tenant_456",
      tenantSlug: "acme-corp",
      tenantEmail: "admin@acme.com",
      startedAt: "2025-12-27T14:30:00Z"
    }  // Only present when impersonating
  }
}
```

---

## Questions for Product/Security Review

1. **Impersonation Duration:** Should impersonating admins have shorter timeout (e.g., 4 hours) than normal admin tokens (24 hours)?

2. **Audit Trail:** Should completed impersonations be visible in an admin audit dashboard? How long to retain?

3. **Concurrent Impersonation:** Can same admin impersonate multiple tenants simultaneously (two browser tabs)?

4. **Data Modification:** When admin impersonates, can they create/delete data? Any restrictions?

5. **Support Access:** Should support team have different impersonation capabilities (read-only vs full access)?

---

## References

- Backend Auth Routes: `/Users/mikeyoung/CODING/MAIS/server/src/routes/auth.routes.ts` (lines 702-784)
- Auth Impersonation Tests: `/Users/mikeyoung/CODING/MAIS/server/test/routes/auth-impersonation.spec.ts`
- NextAuth Config: `/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/auth.ts`
- Legacy Admin Client: `/Users/mikeyoung/CODING/MAIS/client/src/features/admin/`
- AdminSidebar Component: `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/layouts/AdminSidebar.tsx`
- Middleware: `/Users/mikeyoung/CODING/MAIS/apps/web/src/middleware.ts`
