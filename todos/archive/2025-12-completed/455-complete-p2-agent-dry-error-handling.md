---
status: complete
priority: p2
issue_id: '455'
tags: [code-review, dry, simplicity, agent]
dependencies: []
---

# Agent Tools Have Duplicated Error Handling Pattern

## Problem Statement

Every agent tool has identical error handling boilerplate, repeated ~36 times across read-tools.ts and write-tools.ts. This violates DRY principles and makes maintenance harder.

## Severity: P2 - IMPORTANT

DRY violation creating maintenance burden and inconsistency risk.

## Findings

- **Location**: `server/src/agent/tools/read-tools.ts` (~17 tools), `server/src/agent/tools/write-tools.ts` (~19 tools)

Repeated pattern:

```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error({ error, tenantId }, 'Error in [tool_name] tool');
  return {
    success: false,
    error: `Failed to [action]: ${errorMessage}. [Help text]`,
    code: '[TOOL_NAME]_ERROR',
  };
}
```

Also duplicated:

1. Date range filter pattern (4+ times)
2. Price formatting `$${(priceCents / 100).toFixed(2)}` (10+ times)
3. Date formatting `date.toISOString().split('T')[0]` (many times)

## Proposed Solutions

### Option 1: Extract Helper Functions (Recommended)

- **Pros**: Single source of truth, consistent errors
- **Cons**: Minor refactor
- **Effort**: Small (2-3 hours)
- **Risk**: Low

```typescript
// Helper in types.ts or a new utils.ts
function handleToolError(
  error: unknown,
  toolName: string,
  tenantId: string,
  helpText: string
): ToolError {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  logger.error({ error, tenantId }, `Error in ${toolName} tool`);
  return {
    success: false,
    error: `${helpText}: ${errorMessage}`,
    code: `${toolName.toUpperCase()}_ERROR`,
  };
}

function buildDateRangeFilter(fromDate?: string, toDate?: string) {
  if (!fromDate && !toDate) return {};
  return {
    date: {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(toDate) } : {}),
    },
  };
}

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const formatDateISO = (date: Date) => date.toISOString().split('T')[0];
```

### Option 2: Higher-Order Function Wrapper

- **Pros**: Less boilerplate per tool
- **Cons**: More complex, harder to debug
- **Effort**: Medium
- **Risk**: Medium

## Recommended Action

[To be filled during triage]

## Technical Details

- **Affected Files**:
  - `server/src/agent/tools/read-tools.ts` - Refactor 17 tools
  - `server/src/agent/tools/write-tools.ts` - Refactor 19 tools
  - New: `server/src/agent/tools/utils.ts` - Add helper functions
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria

- [ ] `handleToolError` helper created and used by all tools
- [ ] `buildDateRangeFilter` helper created and used by applicable tools
- [ ] `formatPrice` helper created and used throughout
- [ ] `formatDateISO` helper created and used throughout
- [ ] All tests pass after refactor

## Resources

- Source: Code Review - Code Simplicity Review Agent (2025-12-28)

## Notes

Source: Code Review on 2025-12-28
Estimated Effort: Small (2-3 hours)
