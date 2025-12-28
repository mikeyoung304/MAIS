# MAIS Code Smell & Refactoring Report

**Generated:** 2025-12-26
**Auditor:** Claude Opus 4.5 Code Review Agent (C2)
**Scope:** server/, client/, apps/web/, packages/

---

## Executive Summary

| Severity          | Count | Priority         |
| ----------------- | ----- | ---------------- |
| **Critical (P0)** | 3     | Immediate action |
| **High (P1)**     | 12    | Within sprint    |
| **Medium (P2)**   | 25    | Backlog          |
| **Low (P3)**      | 18    | Nice to have     |

### Key Findings

1. **Type Safety Issues:** 120+ uses of `any` type (excluding generated Prisma files and documented ts-rest library limitations)
2. **Function Complexity:** 5 functions exceed 100 lines; `booking.service.ts` is 1395 lines
3. **Dead Code:** 3 backup files and 18 TODO comments remain in production code
4. **Code Duplication:** Status mapping duplicated in booking.repository.ts (2 locations)
5. **React Anti-patterns:** 50+ inline arrow functions in onClick handlers

---

## TOP 20 Worst Offenders

### 1. `/Users/mikeyoung/CODING/MAIS/server/src/services/booking.service.ts` (1395 lines)

**Severity:** P0 | **Effort:** L

- **Issue:** God class - handles checkout, appointments, cancellation, refunds, reschedule
- **Lines:** 1-1395 (entire file)
- **Recommendation:** Split into BookingService, CheckoutService, AppointmentService, RefundService

### 2. `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/booking.repository.ts` (1219 lines)

**Severity:** P1 | **Effort:** L

- **Issue:** Massive repository with duplicated status mapping logic
- **Lines 954-975 and 1014-1033:** Duplicate `mapStatus` function patterns
- **Recommendation:** Extract status mapper to shared utility

### 3. `/Users/mikeyoung/CODING/MAIS/server/src/routes/index.ts` (660 lines)

**Severity:** P1 | **Effort:** M

- **Issue:** Monolithic route registration with excessive inline logic
- **Lines 156-450:** Single createExpressEndpoints call with 25+ handlers
- **Recommendation:** Split route handlers into separate files

### 4. `/Users/mikeyoung/CODING/MAIS/server/src/routes/auth.routes.ts` (1017 lines)

**Severity:** P1 | **Effort:** M

- **Issue:** Single file handles login, signup, password reset, impersonation, early-access
- **Lines 840-940:** Hardcoded HTML email templates
- **Recommendation:** Extract email templates, split by concern

### 5. `/Users/mikeyoung/CODING/MAIS/server/src/routes/public-booking-management.routes.ts:39`

**Severity:** P0 | **Effort:** S

- **Issue:** Explicit `any` type: `booking: any;`
- **Line 39:** Type-unsafe booking object
- **Recommendation:** Define proper BookingWithCancellation interface

### 6. `/Users/mikeyoung/CODING/MAIS/server/src/routes/public-booking-management.routes.ts:75-79`

**Severity:** P0 | **Effort:** S

- **Issue:** Multiple `as any` type assertions on booking fields
- **Lines 75-79:** `(booking as any).cancelledBy`, `(booking as any).cancellationReason`, etc.
- **Recommendation:** Extend Booking interface with optional cancellation fields

### 7. `/Users/mikeyoung/CODING/MAIS/server/src/controllers/tenant-admin.controller.ts:161`

**Severity:** P1 | **Effort:** S

- **Issue:** Direct Prisma access bypassing repository: `(this.blackoutRepo as any).prisma`
- **Line 161:** Breaks encapsulation
- **Recommendation:** Add `getAllBlackoutsWithIds` to repository interface

### 8. `/Users/mikeyoung/CODING/MAIS/server/src/routes/tenant-admin-calendar.routes.ts:49,140,183,220`

**Severity:** P1 | **Effort:** M

- **Issue:** Repeated `tenant.secrets as any` pattern (4 occurrences)
- **Recommendation:** Define TenantSecrets interface and use type guard

### 9. `/Users/mikeyoung/CODING/MAIS/server/src/services/health-check.service.ts:59,96,170`

**Severity:** P1 | **Effort:** M

- **Issue:** Private property access via `as any`: `(this.deps.stripeAdapter as any).stripe`
- **Recommendation:** Add getter methods to adapters or define test-friendly interfaces

### 10. `/Users/mikeyoung/CODING/MAIS/server/src/adapters/mock/index.ts:531-750`

**Severity:** P2 | **Effort:** M

- **Issue:** 15+ `(booking as any).fieldName = value` assignments
- **Lines:** 531-750
- **Recommendation:** Update Booking entity to include all optional fields

### 11. `/Users/mikeyoung/CODING/MAIS/server/src/di.ts:284-286`

**Severity:** P2 | **Effort:** S

- **Issue:** Type assertions: `adapters.bookingRepo as any`
- **Recommendation:** Fix mock repo type compatibility

### 12. `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/tenant.repository.ts:624`

**Severity:** P2 | **Effort:** M

- **Issue:** Return type uses `any`: `private getLandingPageWrapper(config: any)`
- **Recommendation:** Type the config parameter properly

### 13. `/Users/mikeyoung/CODING/MAIS/client/src/lib/error-handler.ts:73,87`

**Severity:** P2 | **Effort:** S

- **Issue:** `Promise<any>` return type and `errorData: any`
- **Recommendation:** Define APIErrorResponse type

### 14. `/Users/mikeyoung/CODING/MAIS/server/src/adapters/mock/index.ts.bak`

**Severity:** P2 | **Effort:** S

- **Issue:** Backup file in source tree
- **Path:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/mock/index.ts.bak`
- **Recommendation:** Delete or move to .gitignore

### 15. `/Users/mikeyoung/CODING/MAIS/client/src/pages/Home.tsx.backup`

**Severity:** P2 | **Effort:** S

- **Issue:** Backup file in source tree
- **Recommendation:** Delete

### 16. `/Users/mikeyoung/CODING/MAIS/client/src/features/admin/tenants/TenantForm.tsx.backup`

**Severity:** P2 | **Effort:** S

- **Issue:** Backup file in source tree
- **Recommendation:** Delete

### 17. `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/request-context.ts:35-38`

**Severity:** P2 | **Effort:** S

- **Issue:** Logging methods use `meta?: any`
- **Recommendation:** Define LogMetadata interface

### 18. `/Users/mikeyoung/CODING/MAIS/server/src/routes/stripe-connect-webhooks.routes.ts:226,233`

**Severity:** P2 | **Effort:** M

- **Issue:** Express handler typed as `(req: any, res: any) => Promise<void>`
- **Recommendation:** Use proper Request/Response types

### 19. `/Users/mikeyoung/CODING/MAIS/server/src/lib/sanitization.ts:81,96`

**Severity:** P2 | **Effort:** M

- **Issue:** `sanitizeObject(obj: any)` returns `any`
- **Recommendation:** Use generics: `sanitizeObject<T>(obj: T): T`

### 20. `/Users/mikeyoung/CODING/MAIS/server/src/services/booking.service.ts:949,1059`

**Severity:** P2 | **Effort:** S

- **Issue:** Methods return `Promise<any>` and `Promise<any[]>`
- **Lines:** 949, 1059
- **Recommendation:** Define proper return types

---

## Type Safety Issues (Ranked by Risk)

### P0 - Critical (Security/Data Integrity Risk)

| File                                  | Line  | Issue                               | Recommendation                   |
| ------------------------------------- | ----- | ----------------------------------- | -------------------------------- |
| `public-booking-management.routes.ts` | 39    | `booking: any` loses type safety    | Define `BookingWithCancellation` |
| `public-booking-management.routes.ts` | 75-79 | `(booking as any).field`            | Extend Booking type              |
| `tenant-admin.controller.ts`          | 161   | `(this.blackoutRepo as any).prisma` | Add repository method            |

### P1 - High (Maintainability Risk)

| File                              | Line           | Issue                       | Recommendation                           |
| --------------------------------- | -------------- | --------------------------- | ---------------------------------------- |
| `routes/index.ts`                 | 159-267        | 10+ `{ req: any }` patterns | Document as ts-rest limitation (ALLOWED) |
| `tenant-admin-calendar.routes.ts` | 49,140,183,220 | `tenant.secrets as any`     | Define TenantSecrets interface           |
| `health-check.service.ts`         | 59,96,170      | Adapter private access      | Add getter methods                       |
| `booking.repository.ts`           | 304,946,1213   | `isolationLevel as any`     | Type Prisma isolation level              |
| `booking.repository.ts`           | 739            | `where: where as any`       | Define proper where type                 |

### P2 - Medium (Tech Debt)

| File                            | Line         | Count | Issue                                |
| ------------------------------- | ------------ | ----- | ------------------------------------ |
| `mock/index.ts`                 | 531-750      | 15+   | `(booking as any).field` assignments |
| `tenant.repository.ts`          | 23-45        | 6     | `branding?: any`, `secrets?: any`    |
| `audit.service.test.ts`         | 45-450       | 30+   | Mock assertions with `as any`        |
| `lib/errors/request-context.ts` | 35-38,48-111 | 8     | `meta?: any` parameters              |
| `lib/errors/handlers.ts`        | 275,279      | 2     | Generic `...args: any[]`             |

### Documented Exceptions (ALLOWED)

Per `docs/solutions/best-practices/ts-rest-any-type-library-limitations-MAIS-20251204.md`:

- `routes/index.ts` lines 159-267: ts-rest `{ req: any }` pattern is required
- `routes/index.ts` line 412: `} as any)` router cast is library limitation

---

## Duplication Hotspots

### 1. Status Mapping in booking.repository.ts

**Files:** `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/booking.repository.ts`
**LOC:** ~40 lines duplicated
**Lines:** 954-975 (`mapToPrismaStatus`) and 1014-1033 (`mapStatus` inside `toDomainBooking`)

```typescript
// Pattern 1: mapToPrismaStatus (lines 954-975)
private mapToPrismaStatus(status: string) {
  switch (status) {
    case 'PENDING': return 'PENDING';
    // ... 6 more cases
  }
}

// Pattern 2: mapStatus inside toDomainBooking (lines 1014-1033)
const mapStatus = (prismaStatus: string): Booking['status'] => {
  switch (prismaStatus) {
    case 'PENDING': return 'PENDING';
    // ... 6 more cases
  }
}
```

**Recommendation:** Create shared `BookingStatusMapper` utility

### 2. Email HTML Templates in auth.routes.ts

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/auth.routes.ts`
**LOC:** ~100 lines of inline HTML
**Lines:** 840-940 (customer email), 899-940 (internal email)

**Recommendation:** Extract to `templates/` directory with a template engine

### 3. Tenant Resolution Pattern

**Files:** Multiple route files
**Pattern:** `const tenantId = getTenantId(req as TenantRequest);`
**Occurrences:** 15+

**Recommendation:** Already using middleware pattern - consider typed request interface

### 4. Reminder Due Date Calculation

**Files:**

- `booking.service.ts` lines 727-736
- `booking.repository.ts` lines 913-921
- `mock/index.ts` lines 623-630

**LOC:** ~30 lines duplicated
**Recommendation:** Extract to `calculateReminderDueDate(eventDate: Date): Date | null`

---

## React Anti-Pattern List

### Inline Arrow Functions in onClick (50+ occurrences)

Most critical files with inline handlers:

| File                                         | Line        | Pattern                                              | Fix                         |
| -------------------------------------------- | ----------- | ---------------------------------------------------- | --------------------------- |
| `client/src/pages/PackageCatalog.tsx`        | 126,180     | `onClick={() => refetch()}`                          | Extract to handler          |
| `client/src/layouts/AdminLayout.tsx`         | 85,100,127  | `onClick={() => setMobileMenuOpen(!mobileMenuOpen)}` | useCallback                 |
| `client/src/features/admin/AddOnManager.tsx` | 161,171     | `onClick={() => onEdit(addOn)}`                      | Extract handler             |
| `client/src/components/ColorPicker.tsx`      | 101,126,135 | `onClick={() => setIsPickerOpen(!isPickerOpen)}`     | useCallback                 |
| `client/src/components/FontSelector.tsx`     | 129,163,195 | Multiple inline handlers                             | Refactor to handler methods |

**Impact:** Creates new function reference on every render, can cause unnecessary re-renders in child components when passed as props.

**Recommendation:** Use `useCallback` for event handlers passed to child components, or define handlers at module level when they don't depend on component state.

### Missing useCallback for Passed Handlers

| File                 | Component            | Issue                   |
| -------------------- | -------------------- | ----------------------- |
| `SegmentsList.tsx`   | `onEdit`, `onDelete` | Inline callbacks in map |
| `PhotoGrid.tsx`      | `onDeleteClick`      | Inline in map           |
| `TimeSlotPicker.tsx` | `handleSlotClick`    | Inline in map           |

---

## Dead Code Patterns

### Backup Files (Should Delete)

1. `/Users/mikeyoung/CODING/MAIS/server/src/adapters/mock/index.ts.bak`
2. `/Users/mikeyoung/CODING/MAIS/client/src/pages/Home.tsx.backup`
3. `/Users/mikeyoung/CODING/MAIS/client/src/features/admin/tenants/TenantForm.tsx.backup`

### Unresolved TODOs (18 total)

| File                            | Line       | TODO                                                        |
| ------------------------------- | ---------- | ----------------------------------------------------------- |
| `booking.service.ts`            | 711        | `TODO: Rename in input type in future refactor`             |
| `booking.service.ts`            | 968        | `TODO: Integrate with Customer management`                  |
| `app.ts`                        | 63         | `TODO: Replace with nonce in Phase 3`                       |
| `app.ts`                        | 157        | `TODO-273 FIX: Apply rate limiting BEFORE parsing`          |
| `routes/index.ts`               | 614        | `TODO-329: Pass cacheAdapter for request-level idempotency` |
| `public-date-booking.routes.ts` | 91,112,140 | `TODO-329, TODO-330` idempotency/bot protection             |
| `public-scheduling.routes.ts`   | 47         | `TODO-057: 100 requests/minute rate limit`                  |

### Commented Code Blocks

No significant commented-out code blocks found (good practice maintained).

---

## Refactoring Priority Queue

### P0 - Immediate (Before Next Release)

| Item                                     | File                                  | Effort | Impact         |
| ---------------------------------------- | ------------------------------------- | ------ | -------------- |
| Fix type-unsafe booking in public routes | `public-booking-management.routes.ts` | S      | Security       |
| Remove backup files                      | 3 files                               | S      | Clean codebase |
| Define TenantSecrets interface           | `tenant-admin-calendar.routes.ts`     | S      | Type safety    |

### P1 - Within Sprint

| Item                                         | File                         | Effort | Impact          |
| -------------------------------------------- | ---------------------------- | ------ | --------------- |
| Split BookingService                         | `booking.service.ts`         | L      | Maintainability |
| Extract status mapper                        | `booking.repository.ts`      | S      | DRY             |
| Add repository method for blackouts with IDs | `tenant-admin.controller.ts` | S      | Encapsulation   |
| Extract email templates                      | `auth.routes.ts`             | M      | Maintainability |
| Define LogMetadata interface                 | `request-context.ts`         | S      | Type safety     |

### P2 - Backlog

| Item                                | File                   | Effort | Impact          |
| ----------------------------------- | ---------------------- | ------ | --------------- |
| Type mock booking repository        | `mock/index.ts`        | M      | Type safety     |
| Type tenant branding/secrets fields | `tenant.repository.ts` | M      | Type safety     |
| Split route index                   | `routes/index.ts`      | M      | Maintainability |
| Add useCallback to React handlers   | Multiple               | M      | Performance     |
| Extract reminder date calculation   | Multiple               | S      | DRY             |
| Resolve remaining TODOs             | Multiple               | M      | Tech debt       |

---

## Effort Estimates

| Size           | Time      | Examples                                       |
| -------------- | --------- | ---------------------------------------------- |
| **S** (Small)  | 1-2 hours | Delete files, add interface, extract utility   |
| **M** (Medium) | 4-8 hours | Split module, refactor types, add useCallback  |
| **L** (Large)  | 2-5 days  | Split service class, major architecture change |

---

## Appendix: Scan Methodology

1. **Grep patterns used:**
   - `: any\b|as any|<any>|\bany\[` - any type usage
   - `// TODO|// FIXME|// HACK|// XXX` - unresolved todos
   - `onClick=\{\(\)\s*=>` - inline arrow handlers
   - `console\.(log|warn|error)` - console statements
   - `\.bak$|\.old$|\.backup$` - backup files

2. **Manual review of:**
   - Files > 500 lines
   - Service and repository layers
   - Route handler complexity
   - React component patterns

3. **Excluded from audit:**
   - `server/src/generated/` (Prisma generated files)
   - `node_modules/`
   - Test files (_.test.ts, _.spec.ts) - except for type safety patterns
   - Documentation files (\*.md)
