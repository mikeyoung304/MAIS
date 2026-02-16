---
status: pending
priority: p2
issue_id: 9022
tags: [code-review, plan-gap, provisioning]
dependencies: []
---

# tenant-provisioning.service.ts Creates Seed Packages — Not Listed for Update

## Problem Statement

`server/src/services/tenant-provisioning.service.ts` creates initial seed packages during tenant signup. After Phase 7 deletes the Package model, this service will crash at signup.

The plan mentions `build_first_draft` updating for "seed tier check" in Phase 4 but does NOT list `tenant-provisioning.service.ts` for modification.

## Findings

- Architecture Strategist P2-02: "tenant-provisioning.service.ts creates seed packages during tenant signup. After Phase 7 deletes the Package model, this will crash at signup."
- Agent-Native P2-8: "Are seed tiers created during tenant provisioning?"

## Proposed Solutions

### Option A: Update to create seed tiers instead of seed packages (Recommended)

- Modify `tenant-provisioning.service.ts` to create seed Tiers (matching new schema)
- Add to Phase 4 (when TierService is created)
- **Effort:** Small

### Option B: Remove seed creation entirely

- Don't create seed anything — let the agent build tiers via conversation
- **Effort:** Small but changes provisioning behavior

## Acceptance Criteria

- [ ] tenant-provisioning.service.ts listed in Phase 4 file list
- [ ] Creates seed Tiers (not Packages) after migration
- [ ] Signup doesn't crash after Package model deletion

## Work Log

| Date       | Action              | Learnings                                                    |
| ---------- | ------------------- | ------------------------------------------------------------ |
| 2026-02-12 | Provisioning review | Signup flow creates seed data that must match current schema |
