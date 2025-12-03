---
status: pending
priority: p2
issue_id: "072"
tags: [code-review, architecture, api-client, technical-debt]
dependencies: ["071"]
---

# P2: Direct fetch() Calls Bypass Centralized API Client

## Problem Statement

Multiple components use direct `fetch()` calls to tenant-admin endpoints instead of the centralized ts-rest API client (`client/src/lib/api.ts`). This bypasses:
- Centralized authentication handling
- Type-safe request/response contracts
- Consistent error handling
- Request interceptors

**Why it matters:** The centralized API client already handles impersonation correctly. Components using direct fetch had to duplicate this logic, leading to the auth bug that required the `getAuthToken()` fix.

## Findings

### Files Using Direct fetch()

1. **`client/src/lib/package-photo-api.ts`** - Entire service bypasses ts-rest
   - Routes: `POST/DELETE/GET /v1/tenant-admin/packages/*`

2. **`client/src/features/photos/hooks/usePhotoUpload.ts`**
   - Routes: `POST/DELETE /v1/tenant-admin/packages/:id/photos`

3. **`client/src/features/tenant-admin/branding/components/LogoUploadButton.tsx`**
   - Route: `POST /v1/tenant-admin/logo`

4. **`client/src/components/ImageUploadField.tsx`**
   - Route: Generic upload endpoint (passed as prop)

5. **`client/src/features/tenant-admin/scheduling/AppointmentsView/index.tsx`**
   - Routes: `GET /v1/tenant-admin/appointments`, `services`, `customers`

### Why They Bypass the Client

**Primary reason:** File uploads using `FormData`. The ts-rest contracts use `body: z.any()` which doesn't provide type safety for multipart uploads.

**Secondary reason:** Missing contracts for some endpoints (appointments, services, customers queries with filters).

### Centralized Client Pattern (Correct)

```typescript
// client/src/lib/api.ts lines 138-154
if (path.includes("/v1/tenant-admin")) {
  const isImpersonating = localStorage.getItem("impersonationTenantKey");
  if (isImpersonating) {
    const token = localStorage.getItem("adminToken");
    // ... handles auth automatically
  }
}
```

## Proposed Solutions

### Solution 1: Add FormData Support to Contracts (RECOMMENDED)

**Description:** Update ts-rest contracts to properly support FormData uploads.

**Pros:**
- Type-safe file uploads
- Uses centralized auth
- Follows established patterns
- Better DX with proper types

**Cons:**
- Requires contract changes
- Need to test ts-rest FormData support

**Effort:** Medium (2-4 hours)
**Risk:** Low-Medium

```typescript
// packages/contracts/src/api.v1.ts
tenantAdminUploadPackagePhoto: {
  method: 'POST',
  path: '/v1/tenant-admin/packages/:id/photos',
  contentType: 'multipart/form-data',
  body: z.instanceof(FormData),
  responses: { 201: PackagePhotoDtoSchema }
}
```

### Solution 2: Create Upload Utility Using API Client

**Description:** Wrap file uploads in a utility that leverages the API client's auth handling.

**Pros:**
- Centralized auth without contract changes
- Incremental migration

**Cons:**
- Still some duplication
- Two patterns for API calls

**Effort:** Small (1-2 hours)
**Risk:** Low

### Solution 3: Add Missing Contracts Only

**Description:** Add contracts for appointments, services, customers endpoints. Keep file uploads as-is.

**Pros:**
- Reduces direct fetch usage by 60%
- Lower risk than changing upload handling

**Cons:**
- File upload problem remains
- Still two patterns

**Effort:** Small (1 hour)
**Risk:** Very Low

## Recommended Action

**Solution 3** first (quick win), then **Solution 1** (complete fix).

## Technical Details

### Missing Contracts to Add
```typescript
// Appointments with filters
tenantAdminGetAppointments: {
  method: 'GET',
  path: '/v1/tenant-admin/appointments',
  query: z.object({
    status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'all']).optional(),
    serviceId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
}

// Services
tenantAdminGetServices: {
  method: 'GET',
  path: '/v1/tenant-admin/services',
}

// Customers
tenantAdminGetCustomers: {
  method: 'GET',
  path: '/v1/tenant-admin/customers',
}
```

### Acceptance Criteria

- [ ] Contracts added for appointments, services, customers
- [ ] AppointmentsView.tsx uses api client instead of fetch
- [ ] File upload contracts support FormData
- [ ] LogoUploadButton uses api.tenantAdminUploadLogo()
- [ ] package-photo-api.ts deprecated or refactored

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-29 | Created | Found during code review |

## Resources

- ts-rest FormData docs: https://ts-rest.com/docs/core/form-data
- Centralized client: `client/src/lib/api.ts`
- Contracts: `packages/contracts/src/api.v1.ts`
