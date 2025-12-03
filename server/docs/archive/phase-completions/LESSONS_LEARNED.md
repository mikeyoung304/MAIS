# Lessons Learned - MAIS Platform

## Critical Authentication Bug - Platform Admin Login (Nov 2025)

### Issue Summary
Platform admin login was failing with "Invalid credentials" error despite correct credentials being used. The authentication succeeded at the API level (returned 200 with valid JWT), but the client couldn't parse or use the token.

### Root Cause Analysis

**Two-Part Bug:**

#### Bug #1: Server-Side Role Mismatch
**File:** `server/src/adapters/prisma/user.repository.ts:16`

```typescript
// ❌ BROKEN - Checking for legacy role
if (!user || user.role !== 'ADMIN') {
  return null;
}

// ✅ FIXED - Checking for current role
if (!user || user.role !== 'PLATFORM_ADMIN') {
  return null;
}
```

**Impact:** Server couldn't find users with `PLATFORM_ADMIN` role, returning null even though user existed in database.

#### Bug #2: Client-Side JWT Parsing Failure
**File:** `client/src/lib/auth.ts:118`

```typescript
// ❌ BROKEN - Missing PLATFORM_ADMIN variant
return 'role' in payload && (payload.role === 'admin' || payload.role === 'ADMIN');

// ✅ FIXED - Includes all variants
return 'role' in payload && (payload.role === 'admin' || payload.role === 'ADMIN' || payload.role === 'PLATFORM_ADMIN');
```

**Impact:** Client couldn't parse JWT tokens from server because type guard failed. Token was never stored in localStorage, so subsequent API requests had no Authorization header.

### Detection Process

1. ✅ Login API returned 200 status (success)
2. ✅ JWT token was generated and returned
3. ✅ Direct bcrypt password verification worked
4. ❌ Client showed "Invalid credentials" error
5. ❌ Browser localStorage had no `adminToken` stored
6. ❌ Subsequent API requests returned 401 "Missing Authorization header"

### Key Lessons

#### 1. **Test Full Authentication Flow End-to-End**
- Don't just test API endpoints in isolation
- Verify client can parse and use tokens
- Check browser localStorage after login
- Monitor network requests for Authorization headers

#### 2. **String Constants Are Dangerous**
- Role strings existed in 3 different places:
  - Database enum: `PLATFORM_ADMIN`
  - Server code: Legacy `ADMIN` → Current `PLATFORM_ADMIN`
  - Client type guards: `admin`, `ADMIN` (missing `PLATFORM_ADMIN`)
- **Solution:** Use TypeScript enums or const objects shared between client/server

#### 3. **Migration Pain Points**
- This bug was introduced during migration from `ADMIN` → `PLATFORM_ADMIN`
- Server repository wasn't updated
- Client type guard wasn't updated
- **Solution:** Global search for all role references when renaming

#### 4. **Debugging JWT Issues**
- Check these in order:
  1. Does API return 200 with token?
  2. Can client decode token? (Check browser console for errors)
  3. Is token stored in localStorage?
  4. Do subsequent requests include Authorization header?
  5. Does server successfully verify token?

#### 5. **Type Guards Must Match Server Reality**
- TypeScript type guards give false confidence
- If server changes enum values, client type guards must update
- **Test:** Manually verify JWT payload structure matches type guard expectations

### Prevention Strategies

#### Immediate Actions
- [ ] Create shared TypeScript types package for roles
- [ ] Add E2E tests for full login flow (including localStorage checks)
- [ ] Add integration tests that verify JWT payload structure

#### Long-Term
- [ ] Use GraphQL Code Generator or similar to ensure client/server type parity
- [ ] Add linting rules to detect hardcoded role strings
- [ ] Implement runtime validation of JWT payload structure

### Related Files
- `server/src/adapters/prisma/user.repository.ts`
- `server/prisma/schema.prisma` (UserRole enum)
- `client/src/lib/auth.ts` (isPlatformAdminPayload)
- `client/src/types/auth.ts`
- `packages/contracts/src/dto.ts`

### Testing Checklist for Auth Changes
- [ ] Backend: User can be found in database
- [ ] Backend: Password verification succeeds
- [ ] Backend: JWT is generated with correct role
- [ ] Backend: API returns 200 with token
- [ ] Frontend: Token can be decoded
- [ ] Frontend: Type guard correctly identifies role
- [ ] Frontend: Token is stored in localStorage
- [ ] Frontend: Subsequent requests include Authorization header
- [ ] Frontend: User can access protected routes
- [ ] E2E: Full login flow works in browser

---

## UI/UX Accessibility - Text Visibility (Nov 2025)

### Issue
White text on white background made hero section content completely invisible after switching from dark theme to light theme.

### Root Cause
When migrating from navy background to white background:
```typescript
// ❌ BROKEN
<h1 className="text-white">Your Perfect Day, Simplified</h1>
// White text on white background = invisible

// ✅ FIXED
<h1 className="text-gray-900">Your Perfect Day, Simplified</h1>
// Dark gray text on white background = 17.8:1 contrast (WCAG AAA)
```

### Key Lessons
1. **Always check contrast ratios** when changing background colors
2. **Use design tokens** instead of hardcoded colors
3. **Test in real browser** - don't rely on code review alone
4. **WCAG AA minimum:** 4.5:1 contrast for normal text
5. **WCAG AAA recommended:** 7:1 contrast for normal text

### Prevention
- [ ] Add automated contrast ratio checking in CI
- [ ] Use CSS custom properties for theme colors
- [ ] Create visual regression tests

---

## General Development Lessons

### Database Seeding Confusion
**Issue:** Seed script runs on every server start, could overwrite manual changes.

**Lessons:**
- Use `upsert` with caution in seed scripts
- Document when seed scripts run (dev only vs. all environments)
- Consider separate scripts for initial setup vs. dev data

### MCP Playwright Usage
**Issue:** MCP Playwright kept loading blank pages instead of actual application.

**Lessons:**
- Kill existing browser instances before starting new ones
- Use standalone Playwright scripts for complex testing
- MCP tools have limitations - know when to use alternatives

---

## Refactoring Phases 3-4: Error Handling & Code Quality (Nov 22, 2025)

### Phase 3a: Backend Error Consolidation

**Issue:** Three duplicate error handling systems existed across the codebase with inconsistent patterns.

**Locations:**
- `server/src/lib/errors.ts` (primary)
- `server/src/lib/core/errors.ts` (duplicate)
- `server/src/routes/errors.ts` (duplicate)

**Solution:**
1. Consolidated into single `lib/errors/` directory
2. Created 40+ domain-specific error classes (e.g., `BookingConflictError`, `PackageNotFoundError`)
3. Updated 51 files (38 source + 13 test)
4. Deleted 321 lines of duplicate code

**Key Lessons:**
1. **Single Source of Truth:** Maintain ONE error handling system, not three
2. **Domain-Specific Errors:** Create typed error classes instead of generic errors with string messages
3. **HTTP Mapping Consistency:** Each error class knows its HTTP status code
4. **Gradual Migration:** Updated files incrementally, tested after each batch
5. **Delete with Confidence:** If tests pass, delete the duplicate code immediately

**Prevention:**
- ✅ Added linting rule to detect duplicate error patterns
- ✅ Documented error handling pattern in CLAUDE.md
- ✅ Created ADR-006 for centralized error handling

### Phase 3b: API Error Response Schemas

**Issue:** API contracts didn't document error responses, making client-side error handling fragile.

**Example Before:**
```typescript
// Contract only documented success case
export const getPackages = {
  method: 'GET',
  path: '/packages',
  responses: {
    200: z.array(PackageSchema),
  },
};

// Client had no type information for errors
const result = await apiClient.getPackages();
// What if it returns 404? 500? Unknown!
```

**Solution:**
1. Created `ErrorResponseSchema` with field-level validation support
2. Created 7 convenience schemas (400, 401, 403, 404, 409, 422, 500)
3. Added error responses to all 44 API endpoints
4. Type-safe error handling in client

**Example After:**
```typescript
export const getPackages = {
  method: 'GET',
  path: '/packages',
  responses: {
    200: z.array(PackageSchema),
    401: UnauthorizedResponseSchema,
    500: InternalServerErrorResponseSchema,
  },
};

// Client now has type-safe error handling
const result = await apiClient.getPackages();
if (result.status === 401) {
  toast.error(result.body.error); // Type-safe!
}
```

**Key Lessons:**
1. **Document All Responses:** Errors are part of the contract, not exceptions
2. **Field-Level Validation:** Return specific field errors for 422 responses
3. **Consistent Schema:** Reuse error schemas across endpoints
4. **Client Type Safety:** ts-rest generates type-safe error handlers
5. **Better UX:** Specific error messages > generic "Something went wrong"

**Prevention:**
- ✅ Added contract linting to require error responses
- ✅ Created error schema templates in contracts package
- ✅ Documented pattern in CLAUDE.md

### Phase 3c: React Error Boundaries & Toast Notifications

**Issue:** 10 production `alert()` calls and no error boundaries meant:
- Blocking error dialogs (bad UX)
- Feature errors crashed entire app
- No error reporting to monitoring services

**Solution:**
1. Created `FeatureErrorBoundary` component with Sentry integration
2. Wrapped 5 critical features (Catalog, Package, Admin, TenantDashboard, Booking)
3. Replaced all 10 `alert()` calls with `toast.error()`
4. Integrated Sonner toast library

**Before:**
```tsx
// Crashes entire app on error
<PackageCatalog />

// Blocks user interaction
alert("Failed to delete package");
```

**After:**
```tsx
// Isolated failure with fallback UI
<FeatureErrorBoundary featureName="Package Catalog">
  <PackageCatalog />
</FeatureErrorBoundary>

// Non-blocking notification
toast.error("Failed to delete package", {
  description: "Please try again or contact support.",
});
```

**Key Lessons:**
1. **Isolated Failures:** Error boundaries prevent cascade failures
2. **Non-Blocking Errors:** Toast notifications > alert() dialogs
3. **Error Reporting:** Error boundaries integrate with Sentry/monitoring
4. **Better UX:** User can continue using app even if one feature fails
5. **Graceful Degradation:** Show fallback UI instead of white screen

**Prevention:**
- ✅ Added ESLint rule to ban `alert()` usage
- ✅ Created error boundary template for new features
- ✅ Documented pattern in CLAUDE.md (ADR-007)

### Phase 4a: Cache Helper Extraction

**Issue:** ~100 lines of duplicated caching logic across services with subtle differences.

**Locations:**
- `CatalogService.ts` - 6 methods with duplicate cache patterns
- `SegmentService.ts` - 4 methods with duplicate cache patterns
- Inconsistent cache key formats
- Repeated TTL logic

**Before (12 lines per method):**
```typescript
async getAllPackages(tenantId: string): Promise<Package[]> {
  const cacheKey = `catalog:${tenantId}:all-packages`;
  const cached = this.cache?.get<Package[]>(cacheKey);
  if (cached) {
    return cached;
  }
  const packages = await this.repository.getAllPackages(tenantId);
  this.cache?.set(cacheKey, packages, 900); // 15 min
  return packages;
}
```

**After (4 lines per method):**
```typescript
async getAllPackages(tenantId: string): Promise<Package[]> {
  return cachedOperation(this.cache, {
    prefix: 'catalog', keyParts: [tenantId, 'all-packages'], ttl: 900
  }, () => this.repository.getAllPackages(tenantId));
}
```

**Solution:**
1. Created `lib/cache-helpers.ts` with reusable utilities
2. Extracted `cachedOperation()` helper
3. Refactored 10+ methods across 2 services
4. Eliminated ~100 lines of duplication

**Key Lessons:**
1. **DRY Cache Patterns:** Extract repeated try-get-set logic
2. **Consistent Key Format:** Helper enforces standard `prefix:tenant:...` format
3. **Type Safety:** Generic helper maintains type information
4. **Tenant Isolation:** Helper makes tenant scoping mandatory
5. **Maintainability:** One place to update cache logic

**Prevention:**
- ✅ Documented caching pattern in CLAUDE.md (ADR-008)
- ✅ Created cache helper template
- ✅ Added code review checklist for cache usage

### Phase 4b: Shared UI Components

**Issue:** Inline UI patterns duplicated across 10+ files:
- Success messages (5+ files)
- Error alerts (8+ files)
- Form fields (multiple variants)
- Inconsistent styling and behavior

**Solution:**
1. Created `SuccessMessage` component (used in 5+ files)
2. Created `ErrorAlert` component (used in 8+ files)
3. Created `FormField` component with variants
4. Deleted deprecated `PackagesManager.tsx` (444 lines)
5. Established reusable UI patterns

**Before:**
```tsx
// Duplicated in 8 files with slight variations
<div className="flex items-center gap-2 p-4 border border-red-600 bg-red-700">
  <AlertCircle className="w-5 h-5 text-red-200" />
  <span className="text-base text-red-100">{error}</span>
</div>
```

**After:**
```tsx
<ErrorAlert message={error} />
```

**Key Lessons:**
1. **Component Extraction Threshold:** Extract after 3+ usages
2. **Consistent Styling:** Shared components enforce design system
3. **Prop API Design:** Keep simple (1-3 props), extend with className
4. **Delete Old Code:** Remove 444-line deprecated file after refactoring
5. **Progressive Migration:** Extract components, then migrate incrementally

**Prevention:**
- ✅ Created component library in `client/src/components/ui/`
- ✅ Documented component patterns in CURRENT_STATUS.md
- ✅ Added Storybook for component catalog (planned)

---

*Last Updated: November 22, 2025*
