# Backlog: Platform Admin Audit Gap

## Priority: Medium (Before Legacy Route Extension)

**Status:** 📋 BACKLOG - To be resolved before any platform admin route usage or extension

**Created:** January 10, 2025
**Sprint:** Post-2.1 Follow-up
**Related:** Sprint 2.1 - Audit Logging System

---

## Issue Summary

Platform admin package routes (`/v1/admin/packages/*`) do not have audit logging, creating a gap in mutation tracking for legacy single-tenant operations.

---

## Affected Routes

**File:** `server/src/routes/admin-packages.routes.ts`

| Route                                  | Method | Line | Impact                                      |
| -------------------------------------- | ------ | ---- | ------------------------------------------- |
| `/v1/admin/packages`                   | POST   | 22   | No audit trail for package creation         |
| `/v1/admin/packages/:id`               | PUT    | 34   | No audit trail for package updates          |
| `/v1/admin/packages/:id`               | DELETE | 46   | No rollback capability for deletions        |
| `/v1/admin/packages/:packageId/addons` | POST   | 50   | No audit trail for add-on creation          |
| `/v1/admin/addons/:id`                 | PUT    | 64   | No audit trail for add-on updates           |
| `/v1/admin/addons/:id`                 | DELETE | 75   | No rollback capability for add-on deletions |

---

## Root Cause

- Uses `DEFAULT_TENANT = 'tenant_default_legacy'` (line 16)
- Pre-dates multi-tenant architecture
- No audit context extraction (no `getAuditContext()` helper)
- Platform admin JWT structure differs from tenant admin JWT

---

## Impact Assessment

**Current Risk:** LOW

- Tenant admin routes have 100% audit coverage (primary use case)
- Platform admin routes are legacy single-tenant mode
- Most production usage goes through tenant admin routes

**Future Risk:** MEDIUM-HIGH if legacy routes are used or extended

- Cannot track who made changes
- Cannot rollback mutations
- No compliance audit trail for platform admin operations

---

## Resolution Options

### Option 1: Add Audit Hooks (Recommended)

**Effort:** 30-60 minutes
**Impact:** Minimal (backward compatible)

**Implementation:**

1. Create platform admin audit context extractor:

```typescript
function getPlatformAdminAuditContext(req: Request): AuditContext {
  const user = res.locals.user; // Platform admin JWT
  if (!user) {
    throw new Error('Missing platform admin authentication');
  }
  return {
    email: user.email,
    role: 'PLATFORM_ADMIN',
    userId: user.id,
  };
}
```

2. Update AdminPackagesController to accept AuditService:

```typescript
export class AdminPackagesController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly auditService: AuditService
  ) {}
}
```

3. Extract audit context in route handlers (admin-packages.routes.ts):

```typescript
router.post('/packages', async (req, res) => {
  const auditCtx = getPlatformAdminAuditContext(req);
  const pkg = await controller.createPackage(data, auditCtx);
  res.json(pkg);
});
```

4. Pass audit context to CatalogService:

```typescript
async createPackage(
  data: CreatePackageDto,
  auditCtx: AuditContext
): Promise<PackageResponseDto> {
  const pkg = await this.catalogService.createPackage(
    DEFAULT_TENANT,
    data,
    auditCtx // ADD THIS
  );
  return pkg;
}
```

5. Add integration tests for platform admin audit logging

**Tests Required:**

- Platform admin package create WITH audit context
- Platform admin package update WITH audit context
- Platform admin package delete WITH audit context
- Verify `role: 'PLATFORM_ADMIN'` in audit logs

---

### Option 2: Deprecate Legacy Routes

**Effort:** 2-4 hours
**Impact:** Breaking change (requires migration)

**Implementation:**

1. Mark routes as deprecated in API documentation
2. Add deprecation warnings to route responses:

```typescript
router.post('/packages', async (req, res) => {
  res.setHeader('Warning', '299 - "Deprecated: Use /v1/tenant/admin/packages instead"');
  // ... existing logic
});
```

3. Update client applications to use tenant admin routes
4. Remove platform admin routes after migration period

**Migration Path:**

- Week 1-2: Add deprecation warnings
- Week 3-4: Migrate all client applications
- Week 5: Remove deprecated routes

---

### Option 3: Document as Known Limitation

**Effort:** 15 minutes (already done)
**Impact:** No change to code

**Implementation:**

- Document in `SPRINT_2_1_AUDIT_QUESTIONS_ANSWERS.md` ✅
- Add to known limitations in API documentation
- Accept risk for legacy single-tenant mode

---

## Recommended Resolution Path

**OPTION 1: Add Audit Hooks**

**Rationale:**

- Minimal effort (30-60 min)
- Backward compatible
- Provides complete audit coverage
- No client migration required
- Maintains safety for any legacy route usage

**Acceptance Criteria:**

- [ ] All 6 platform admin routes pass audit context to CatalogService
- [ ] Platform admin JWT email/role extracted via helper function
- [ ] Integration tests verify audit logs created with `role: 'PLATFORM_ADMIN'`
- [ ] Rollback capability demonstrated for platform admin mutations
- [ ] PR checklist followed (same as tenant admin routes)

---

## References

- **Audit Implementation Guide:** `SPRINT_2_1_AUDIT_QUESTIONS_ANSWERS.md` (Q1, lines 11-77)
- **Tenant Admin Audit Pattern:** `server/src/routes/tenant-admin.routes.ts` (lines 268-278, 352-353)
- **PR Checklist:** `SPRINT_2_1_AUDIT_QUESTIONS_ANSWERS.md` (lines 434-525)
- **Sprint 2.1 Summary:** `SPRINT_2_1_EXECUTIVE_SUMMARY.md`

---

## Resolution Timeline

**Before Extension:** This ticket MUST be resolved before:

- Adding new platform admin routes
- Extending existing platform admin functionality
- Promoting legacy routes to production usage

**Suggested Timeline:**

- Sprint 2.2 or 2.3 (before any platform admin route changes)
- Low priority if tenant admin routes are primary production path
- Medium priority if platform admin routes see active usage

---

## Notes

- Tenant admin routes (9 routes) have 100% audit coverage ✅
- This gap only affects legacy single-tenant mode
- Platform admin authentication uses different JWT structure than tenant admin
- Consider deprecating platform admin routes entirely if not actively used

---

**Last Updated:** January 10, 2025
**Tagged:** `audit-logging`, `technical-debt`, `platform-admin`, `before-extension`
**Assignee:** TBD
**Estimated Effort:** 30-60 minutes (Option 1) or 2-4 hours (Option 2)
