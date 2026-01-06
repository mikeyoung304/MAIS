# Prompt: Resolve Segment/Package System Todos

Copy everything below this line and paste into a new Claude Code chat:

---

## Task: Resolve Tenant Package/Segment System Fixes

I need you to implement 4 triaged todos that fix gaps in our tenant onboarding and package management system. These have been reviewed by 3 specialized agents (DHH architecture, TypeScript implementation, code simplicity) and the recommended solutions are documented in each file.

### Priority: Quality and Stability

- Do NOT cut corners on cost or scope
- Defense-in-depth is valued
- Thorough, well-tested solutions preferred
- All changes should have tests

### Todos to Resolve (in order)

**Implementation Order:**

1. `todos/631-pending-p1-service-layer-segmentid-validation.md` — Foundation (do first)
2. `todos/629-pending-p1-upsert-package-creates-orphaned-packages.md` — Agent tool fix
3. `todos/630-pending-p1-admin-api-skips-tenant-onboarding.md` — Admin API + shared service
4. `todos/632-pending-p2-stricter-signup-error-handling.md` — Auth signup (uses shared service from #630)

### Key Architectural Decisions (from triage)

1. **Create `TenantProvisioningService`** with `createFullyProvisioned()` method
   - Used by both admin API and auth signup
   - Wraps tenant creation + onboarding in transaction
   - Atomic: all succeed or all roll back

2. **Service-layer validation in `CatalogService.createPackage()`**
   - Auto-assign to "General" segment if `segmentId` not provided
   - Validate segment ownership (tenant isolation)
   - Create default segment if it doesn't exist

3. **Agent tool `upsert_package`** should:
   - Accept optional `segmentId` parameter
   - Fall back to default segment if not provided
   - Log when auto-fallback is used

### Files You'll Likely Touch

```
server/src/services/
├── tenant-provisioning.service.ts  (NEW - shared service)
├── catalog.service.ts              (add segmentId validation)
└── tenant-onboarding.service.ts    (may need transaction support)

server/src/routes/
├── admin/tenants.routes.ts         (use TenantProvisioningService)
└── auth.routes.ts                  (use TenantProvisioningService)

server/src/agent/
├── tools/write-tools.ts            (add segmentId to upsert_package)
└── executors/index.ts              (use segmentId in package creation)

server/src/di.ts                    (wire up new service)
```

### Acceptance Criteria Summary

- [ ] `TenantProvisioningService` exists with `createFullyProvisioned()` method
- [ ] Admin API and auth signup both use `TenantProvisioningService`
- [ ] Transactions wrap tenant + onboarding (atomic operations)
- [ ] `CatalogService.createPackage()` auto-assigns segment if missing
- [ ] `CatalogService.createPackage()` validates segment ownership
- [ ] `upsert_package` tool accepts optional `segmentId`
- [ ] All existing tests pass
- [ ] New tests for each acceptance criterion

### How to Proceed

1. Read all 4 todo files first to understand the full scope
2. Start with #631 (service-layer validation) - it's the foundation
3. Then #629 (agent tool) - it can now rely on service validation
4. Then #630 (create TenantProvisioningService, wire to admin API)
5. Finally #632 (refactor auth signup to use same service)

Run tests after each todo to ensure no regressions.

### Reference Commands

```bash
# Run all tests
npm test

# Run specific test file
npm test -- server/src/services/catalog.service.test.ts

# Check for orphaned packages (should return 0 after fixes)
npx tsx scripts/fix-orphaned-packages-sql.ts --dry-run
```

---

When complete, update each todo file's status from `pending` to `complete` and rename the file (e.g., `631-complete-p1-...`).
