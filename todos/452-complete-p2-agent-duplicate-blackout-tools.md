---
status: complete
priority: p2
issue_id: '452'
tags: [agent, code-review, simplicity, dry]
dependencies: []
---

# Duplicate Blackout Tools Create LLM Confusion

## Problem Statement

There are 5 overlapping tools for blackout management:

- `get_blackouts` (read)
- `get_blackout_dates` (read, nearly identical)
- `manage_blackout` (write, combined create/delete)
- `add_blackout_date` (write, with range support)
- `remove_blackout_date` (write, by ID)

This creates LLM decision paralysis and maintenance burden.

## Severity: P2 - IMPORTANT

DRY violation and potential LLM confusion affecting agent reliability.

## Findings

- **Location**:
  - `server/src/agent/tools/read-tools.ts` lines 492-548 (`get_blackouts`)
  - `server/src/agent/tools/read-tools.ts` lines 1289-1352 (`get_blackout_dates`)
  - `server/src/agent/tools/write-tools.ts` lines 419-471 (`manage_blackout`)
  - `server/src/agent/tools/write-tools.ts` lines 479-544 (`add_blackout_date`)
  - `server/src/agent/tools/write-tools.ts` lines 549-606 (`remove_blackout_date`)

- `get_blackout_dates` was added as a "user-friendly alias" but creates confusion

## Problem Scenario

1. User: "Block next week for vacation"
2. LLM sees 5 related tools
3. LLM might call:
   - `manage_blackout` (missing range support)
   - `add_blackout_date` (correct but not obvious)
4. Extra round-trips or wrong tool selection

## Proposed Solutions

### Option 1: Consolidate to 2 Tools (Recommended)

- **Pros**: Clear purpose, no overlap
- **Cons**: Breaking change for any external integrations (unlikely)
- **Effort**: Medium (2-3 hours)
- **Risk**: Low

**Keep:**

- `get_blackout_dates` (read - better name)
- `add_blackout_date` (write - has range support)
- `remove_blackout_date` (write - by ID)

**Remove:**

- `get_blackouts` (duplicate)
- `manage_blackout` (superseded by add/remove)

### Option 2: Keep All, Improve Descriptions

- **Pros**: No breaking changes
- **Cons**: Doesn't solve root problem
- **Effort**: Small
- **Risk**: Medium (confusion persists)

## Recommended Action

[To be filled during triage]

## Technical Details

- **Affected Files**:
  - `server/src/agent/tools/read-tools.ts` - Remove `getBlackoutsTool`
  - `server/src/agent/tools/write-tools.ts` - Remove `manageBlackoutTool`
  - `server/src/agent/tools/all-tools.ts` - Update exports
- **Related Components**: Orchestrator system prompt (update capability hints)
- **Database Changes**: No

## Acceptance Criteria

- [ ] Only 3 blackout tools remain: `get_blackout_dates`, `add_blackout_date`, `remove_blackout_date`
- [ ] Removed tools cleaned from all-tools.ts exports
- [ ] System prompt capability hints updated
- [ ] Tests updated

## Resources

- Source: Code Review - Code Simplicity + Agent-Native Review Agents (2025-12-28)

## Notes

Source: Code Review on 2025-12-28
Estimated Effort: Medium (2-3 hours)
