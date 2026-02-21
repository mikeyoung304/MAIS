---
status: pending
priority: p2
issue_id: '11090'
tags: [code-review, typescript]
pr: 68
---

# F-026: Unsafe Null Cast in Provisioning Return Type

## Problem Statement

The tenant provisioning service uses `null as unknown as Segment` to satisfy a return type that expects a `Segment` object. This unsafe cast hides the fact that `segment` can be null, and any downstream code accessing properties on the returned segment will throw a runtime error.

## Findings

- **Agents:** 1 agent flagged
- **Location:** `server/src/services/tenant-provisioning.service.ts:294`
- **Impact:** Runtime `TypeError: Cannot read properties of null` when any code accesses the segment from the provisioning result. The `as unknown as` double-cast is a red flag that the type system is being deliberately circumvented.

## Proposed Solution

Make `segment` optional in the `ProvisionedTenantResult` type (i.e., `segment?: Segment` or `segment: Segment | null`). Update all consumers to handle the missing segment case explicitly instead of assuming it is always present.

## Effort

Small

## Acceptance Criteria

- [ ] `segment` field in `ProvisionedTenantResult` typed as `Segment | null` or optional
- [ ] The `null as unknown as Segment` cast is removed
- [ ] All consumers of `ProvisionedTenantResult.segment` handle the null case
- [ ] `npm run typecheck` passes for both workspaces
- [ ] No remaining `as unknown as` casts for this field
