---
title: Missing Server-Side Validation and Segment Ownership Checks in Package Organization
category: security-issues
tags: [multi-tenant, validation, authorization, cross-tenant-vulnerability, zod, package-management]
severity: P1
component: tenant-admin/packages
symptoms: Package tier organization endpoints accepted segmentId, grouping, and groupingOrder without validation or ownership checks, allowing potential cross-tenant data access
root_cause: Server-side routes lacked Zod schema validation and segment ownership verification before processing organization updates
date_solved: 2025-11-27
related_prs: ['#4', '#5']
---

# Missing Server-Side Validation and Segment Ownership Checks in Package Organization

## Problem Statement

Two critical security vulnerabilities were identified in the package tier/segment organization feature:

1. **Missing Server-Side Validation**: The `segmentId`, `grouping`, and `groupingOrder` fields had no Zod schema validation on the backend, allowing malformed or invalid data to bypass validation and potentially reach the database.

2. **Cross-Tenant Segment Assignment**: No ownership verification was performed when assigning a segment to a package. An attacker could craft a request to assign a segment belonging to a different tenant, breaking multi-tenant data isolation and potentially leaking sensitive business information.

These issues violated the project's core security principle: **all database operations must enforce tenant-scoped data isolation**.

## Solution Overview

The fix implemented a three-layer defense:

1. **Schema validation** using Zod to enforce data types and constraints
2. **Ownership validation** to verify segment belongs to the requesting tenant
3. **Client-side constraints** to improve UX and prevent accidental invalid input

## Step-by-Step Implementation

### 1. Add Zod Schema Validation

**File**: `server/src/validation/tenant-admin.schemas.ts`

**Changes**:

```typescript
// Added to both createPackageSchema and updatePackageSchema
segmentId: z.string().min(1).nullable().optional(),
grouping: z.string().min(1).max(100, 'Grouping must be 100 characters or less').nullable().optional(),
groupingOrder: z.number().int().min(0).max(1000, 'Display order must be between 0 and 1000').nullable().optional(),
```

**Why This Was Necessary**:

- **Type Safety**: Ensures `segmentId` is always a valid non-empty string or null/undefined
- **Constraint Enforcement**: Limits `grouping` to 100 characters (matching database schema)
- **Business Logic**: Constrains `groupingOrder` to reasonable values (0-1000), preventing negative values or excessively large numbers
- **Defense in Depth**: Validates at the API boundary before any business logic executes

### 2. Implement Segment Ownership Validation

**File**: `server/src/routes/tenant-admin.routes.ts`

**Changes** (applied to both `POST /packages` and `PUT /packages/:id` handlers):

```typescript
// SECURITY: Validate segment ownership if segmentId is provided
if (data.segmentId && segmentService) {
  try {
    await segmentService.getSegmentById(tenantId, data.segmentId);
  } catch {
    res.status(400).json({
      error: 'Invalid segment: segment not found or does not belong to this tenant',
    });
    return;
  }
}
```

**Why This Was Necessary**:

- **Multi-Tenant Isolation**: Prevents malicious actors from assigning segments they don't own
- **Early Validation**: Fails fast before database mutations occur
- **Security Best Practice**: Follows the "never trust, always verify" principle
- **Consistent with Architecture**: Uses existing service layer method that enforces tenant scoping
- **Graceful Error Handling**: Returns clear error message without exposing internal details

**Implementation Details**:

- Uses `segmentService.getSegmentById(tenantId, segmentId)` which already enforces tenant filtering
- If segment doesn't exist or belongs to another tenant, the service throws an error
- Catches the error and returns `400 Bad Request` with a user-friendly message
- Only validates if `segmentId` is provided (optional field)
- Only validates if `segmentService` is available (graceful handling in mock mode)

### 3. Add Client-Side Constraints

**File**: `client/src/features/tenant-admin/packages/PackageForm/OrganizationSection.tsx`

**Changes**:

```tsx
// Grouping input
<Input
  id="grouping"
  maxLength={100}
  // ...other props
/>

// Grouping Order input
<Input
  id="groupingOrder"
  type="number"
  min="0"
  max="1000"
  // ...other props
/>
```

**Why This Was Necessary**:

- **User Experience**: Prevents accidental input of invalid values
- **Browser Validation**: HTML5 attributes provide instant feedback
- **Not a Security Measure**: These constraints are easily bypassed, so server-side validation (steps 1-2) is critical

## Security Benefits

1. **Prevents Cross-Tenant Data Leakage**: Cannot assign segments from other tenants
2. **Enforces Business Rules**: Validates constraints at API boundary
3. **Defense in Depth**: Multiple validation layers (schema -> ownership -> database constraints)
4. **Fail-Safe Design**: Returns clear errors without exposing internal details
5. **Consistent with Architecture**: Follows existing tenant-scoping patterns

### 4. Add Tier Fields to API Response

**File**: `server/src/routes/tenant-admin.routes.ts`

**Issue Discovered During Testing**: The GET `/packages` endpoint wasn't returning tier fields.

**Changes**:

```typescript
const packagesDto = packages.map((pkg) => ({
  id: pkg.id,
  slug: pkg.slug,
  title: pkg.title,
  description: pkg.description,
  priceCents: pkg.priceCents,
  photoUrl: pkg.photoUrl,
  photos: pkg.photos,
  // Tier/segment organization fields
  segmentId: pkg.segmentId,
  grouping: pkg.grouping,
  groupingOrder: pkg.groupingOrder,
}));
```

### 5. Fix Segments Endpoint URL in Contracts

**File**: `packages/contracts/src/api.v1.ts`

**Issue Discovered During Testing**: Contract paths used `/v1/tenant/admin/segments` but server routes are mounted at `/v1/tenant-admin/segments`.

**Changes**: Updated all segment endpoint paths from `/v1/tenant/admin/segments` to `/v1/tenant-admin/segments`.

### 6. Add Tier Fields to Repository Methods

**File**: `server/src/adapters/prisma/catalog.repository.ts`

**Issue Discovered During Testing**: The `createPackage` and `updatePackage` methods weren't saving tier fields to the database.

**Changes to `createPackage`**:

```typescript
const pkg = await this.prisma.package.create({
  data: {
    tenantId,
    slug: data.slug,
    name: data.title,
    description: data.description,
    basePrice: data.priceCents,
    // Tier/segment organization fields
    segmentId: data.segmentId ?? null,
    grouping: data.grouping ?? null,
    groupingOrder: data.groupingOrder ?? null,
  },
});
```

**Changes to `updatePackage`**:

```typescript
const pkg = await this.prisma.package.update({
  where: { id, tenantId },
  data: {
    ...(data.slug !== undefined && { slug: data.slug }),
    ...(data.title !== undefined && { name: data.title }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.priceCents !== undefined && { basePrice: data.priceCents }),
    ...(data.photos !== undefined && { photos: data.photos }),
    // Tier/segment organization fields
    ...(data.segmentId !== undefined && { segmentId: data.segmentId }),
    ...(data.grouping !== undefined && { grouping: data.grouping }),
    ...(data.groupingOrder !== undefined && { groupingOrder: data.groupingOrder }),
  },
});
```

## Testing Verification

**Server Tests**: All 773 tests pass, including:

- Existing package creation/update tests continue to work
- Validation catches invalid `segmentId`, `grouping`, and `groupingOrder` values
- Ownership validation prevents cross-tenant segment assignment

**TypeScript Compilation**: Clean compilation with no new errors

**Manual Testing Checklist**:

- Create package with valid segment -> Success
- Create package with invalid segment ID -> 400 error
- Create package with segment from another tenant -> 400 error
- Create package with grouping > 100 chars -> 400 error
- Create package with negative groupingOrder -> 400 error
- Create package without segmentId -> Success (optional field)
- Edit existing package, tier fields load correctly -> Success
- Update tier fields and save, changes persist -> Success

## Prevention Strategies

### Checklist for Adding New Fields to Existing APIs

**Before writing any code:**

- [ ] Identify if the new field references another tenant-scoped entity (foreign key)
- [ ] Check if the field accepts user input or is system-generated
- [ ] Determine if the field requires validation constraints (min/max, format, etc.)

**Implementation:**

- [ ] Add field to Zod validation schema with appropriate constraints
- [ ] If field references another entity, add ownership validation in route handler
- [ ] Add client-side constraints for UX (not security)
- [ ] Write tests for validation and ownership checks

### Multi-Tenant Ownership Validation Pattern

**CRITICAL RULE:** Any time a user-provided ID references a tenant-scoped entity, you MUST verify ownership.

```typescript
// Standard ownership validation pattern
if (data.foreignKeyId && relatedService) {
  try {
    await relatedService.getById(tenantId, data.foreignKeyId);
  } catch {
    res.status(400).json({
      error: 'Invalid reference: entity not found or does not belong to this tenant',
    });
    return;
  }
}
```

### Code Review Checklist

When reviewing PRs that add new fields:

- [ ] All foreign key references validate ownership before mutation
- [ ] Zod schemas include all new fields with proper validation
- [ ] Error messages don't leak tenant information
- [ ] Both CREATE and UPDATE endpoints validate ownership

## Related Documentation

- [Segment Repository Cross-Tenant Security Fix](../../security/SEGMENT_CROSS_TENANT_FIX.md) - Similar vulnerability pattern
- [Multi-Tenant Implementation Guide](../../multi-tenant/MULTI_TENANT_IMPLEMENTATION_GUIDE.md) - Database isolation patterns
- [CLAUDE.md - Multi-Tenant Data Isolation](../../../CLAUDE.md) - Core patterns and rules
- [Security Best Practices](../../security/SECURITY.md) - Security architecture

## Lessons Learned

1. **Always validate referenced entities**: Any foreign key reference must verify ownership
2. **Schema validation is not enough**: Must also validate business rules (ownership, constraints)
3. **Service layer is your friend**: Reuse existing tenant-scoped methods for validation
4. **Test tenant isolation explicitly**: Verify cross-tenant data access is blocked
5. **Client-side constraints improve UX**: But never rely on them for security

---

**Status**: Resolved
**PRs**: #4 (feature), #5 (security fix)
**Date**: 2025-11-27
