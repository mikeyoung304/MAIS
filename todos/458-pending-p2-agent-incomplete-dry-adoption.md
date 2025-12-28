---
status: pending
priority: p2
issue_id: '458'
tags: [code-review, dry, agent, architecture]
dependencies: []
---

# Agent Tools: DRY Helpers Created But Not Fully Adopted

## Problem Statement

The `utils.ts` file with DRY helpers (`handleToolError`, `buildDateRangeFilter`, `formatPrice`, `formatDateISO`) was created, but adoption is incomplete. Only 2-3 tools use the helpers while 30+ tools still have inline patterns.

## Severity: P2 - IMPORTANT

Technical debt that will compound. Half-adoption creates cognitive overhead.

## Findings

- **Source**: Architecture Strategist + Code Simplicity Reviewer

| Helper Function        | Defined | Times Used | Times Inline Still         |
| ---------------------- | ------- | ---------- | -------------------------- |
| `handleToolError`      | Yes     | 2          | 32+                        |
| `buildDateRangeFilter` | Yes     | 2          | 0 (other tools don't need) |
| `formatPrice`          | Yes     | 2          | 14+ (write-tools.ts)       |
| `formatDateISO`        | Yes     | 2          | 12+ (write-tools.ts)       |

Key locations with inline patterns:

- `server/src/agent/tools/write-tools.ts` - Does NOT import utils.ts at all
- Most catch blocks still have inline error handling

## Proposed Solutions

### Option 1: Complete the Adoption (Recommended)

- **Pros**: Consistent codebase, realized DRY benefits
- **Cons**: Time investment
- **Effort**: Small (1-2 hours)
- **Risk**: Low

Steps:

1. Add utils imports to `write-tools.ts`
2. Replace all inline `$${(cents / 100).toFixed(2)}` with `formatPrice()`
3. Replace all inline `.toISOString().split('T')[0]` with `formatDateISO()`
4. Replace all inline error handling with `handleToolError()`

### Option 2: Leave As-Is

- **Pros**: No work required
- **Cons**: Technical debt, inconsistency
- **Risk**: High long-term maintenance burden

## Recommended Action

Complete the adoption in write-tools.ts to match read-tools.ts patterns.

## Technical Details

- **Affected Files**:
  - `server/src/agent/tools/write-tools.ts` - Add imports, refactor 19 tools
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria

- [ ] `write-tools.ts` imports from `utils.ts`
- [ ] All `$${(price / 100).toFixed(2)}` replaced with `formatPrice()`
- [ ] All `.toISOString().split('T')[0]` replaced with `formatDateISO()`
- [ ] All catch blocks use `handleToolError()`
- [ ] TypeScript compiles without errors

## Resources

- Source: Code Review on 2025-12-28 (Architecture + Simplicity Agents)
- Related: TODO-455 (original DRY helpers todo)

## Notes

Estimated Effort: Small (1-2 hours)
