---
status: complete
priority: p2
issue_id: "056"
tags: [code-review, scheduling, api, ux]
dependencies: []
resolved_date: 2025-12-02
---

# No Update Endpoint for Availability Rules

## Problem Statement

The API has endpoints to create and delete availability rules, but no endpoint to UPDATE an existing rule. Users must delete and recreate rules to make changes, losing history and creating poor UX.

**Why this matters:** Common workflow (changing rule start time) requires delete+create instead of simple update.

## Resolution

✅ **RESOLVED**: The update endpoint has been fully implemented in the backend.

### Implemented Components

1. **API Contract** (`packages/contracts/src/api.v1.ts`):
   - ✅ `tenantAdminUpdateAvailabilityRule` endpoint defined
   - ✅ Method: PUT `/v1/tenant-admin/availability-rules/:id`
   - ✅ Body validation: `UpdateAvailabilityRuleDtoSchema`
   - ✅ Proper response schemas (200, 400, 401, 403, 404, 500)

2. **DTO Schema** (`packages/contracts/src/dto.ts`):
   - ✅ `UpdateAvailabilityRuleDtoSchema` with all fields optional for partial updates
   - ✅ Fields: `serviceId`, `dayOfWeek`, `startTime`, `endTime`, `effectiveFrom`, `effectiveTo`

3. **Repository Interface** (`server/src/lib/ports.ts`):
   - ✅ `AvailabilityRuleRepository.update(tenantId, id, data)` method signature
   - ✅ `UpdateAvailabilityRuleData` type definition

4. **Repository Implementation** (`server/src/adapters/prisma/availability-rule.repository.ts`):
   - ✅ `update()` method with tenant scoping
   - ✅ Partial update support (only updates provided fields)
   - ✅ Uses `updateMany` with tenant isolation
   - ✅ Returns updated entity
   - ✅ Throws error if rule not found or belongs to different tenant

5. **HTTP Route** (`server/src/routes/tenant-admin-scheduling.routes.ts`):
   - ✅ PUT `/availability-rules/:id` endpoint (lines 428-523)
   - ✅ Authentication check (tenant admin JWT required)
   - ✅ Request body validation with Zod
   - ✅ Service verification if `serviceId` is being updated
   - ✅ Tenant scoping (verifies rule belongs to tenant)
   - ✅ ISO date conversion for `effectiveFrom` and `effectiveTo`
   - ✅ Error handling (404 for not found, 400 for validation)
   - ✅ Audit logging
   - ✅ DTO format response mapping

## Implementation Details

### Route Handler Pattern
```typescript
router.put('/availability-rules/:id', async (req, res, next) => {
  const tenantId = res.locals.tenantAuth.tenantId;
  const { id } = req.params;

  // Validate with Zod
  const data = UpdateAvailabilityRuleDtoSchema.parse(req.body);

  // Convert ISO strings to Date objects
  const updateData: any = {};
  if (data.effectiveFrom) updateData.effectiveFrom = new Date(data.effectiveFrom);
  if (data.effectiveTo !== undefined) {
    updateData.effectiveTo = data.effectiveTo ? new Date(data.effectiveTo) : null;
  }

  // Verify service exists if serviceId is being updated
  if (data.serviceId) {
    const service = await serviceRepo.getById(tenantId, data.serviceId);
    if (!service) return res.status(404).json({ error: 'Service not found' });
  }

  // Update with tenant scoping
  const rule = await availabilityRuleRepo.update(tenantId, id, updateData);

  // Return DTO with ISO dates
  res.json({ ...rule, effectiveFrom: rule.effectiveFrom.toISOString(), ... });
});
```

### Key Features
- **Tenant Isolation**: All updates scoped by `tenantId` (security requirement)
- **Partial Updates**: Only provided fields are updated
- **Rule ID Preservation**: Rule ID remains unchanged on update
- **Service Validation**: Verifies service exists before assigning
- **Date Handling**: Converts ISO strings to Date objects for database
- **Error Handling**: Proper 404 for not found, 400 for validation errors
- **Audit Trail**: Logs all updates with tenant/rule context

## Acceptance Criteria Status

- ✅ PUT /v1/tenant-admin/availability-rules/:id endpoint added
- ✅ Partial updates supported
- ✅ Rule ID preserved on update
- ⚠️ Frontend uses update instead of delete+create (NOT YET - see notes below)

## Frontend Status

**NOT IMPLEMENTED**: The frontend (`client/src/features/tenant-admin/scheduling/AvailabilityRulesManager/`) currently only supports:
- Creating new rules
- Deleting rules
- Viewing rules

**Missing Features:**
- No Edit button in `RulesList.tsx`
- No edit mode in `useAvailabilityRulesManager.ts`
- Users still must delete + recreate to modify rules

**Recommendation**: Track frontend enhancement in a separate TODO for UX improvements.

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2025-11-27 | Created | Found during API Contract review |
| 2025-12-02 | Resolved | Backend API fully implemented and verified |
