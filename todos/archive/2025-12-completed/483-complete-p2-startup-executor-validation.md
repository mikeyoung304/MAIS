# P2: Add Startup Executor Validation

## Status

**READY** - Re-added 2025-12-29 after plan review

## Priority

**P2 - Important Reliability Issue**

## Description

When a tool is added but its executor isn't registered in `registerAllExecutors()`, the system silently fails. In the T3 confirmation path, proposals mark as CONFIRMED but never actually execute - the user sees "booking confirmed" but no booking is created.

## Location

- `server/src/agent/executors/index.ts` - `registerAllExecutors()` function
- `server/src/routes/agent.routes.ts` (lines 332-355) - T3 confirmation path

## Current Behavior

```typescript
// agent.routes.ts T3 path - Silent failure
const executor = getProposalExecutor(proposal.toolName);
if (!executor) {
  // Logs warning but user thinks proposal succeeded
  return { status: 200, body: { message: 'Executor not yet registered' } };
}
```

## Expected Behavior

```typescript
// At app bootstrap - fail fast at deploy time
export function validateExecutorRegistry(): void {
  const registeredTools = [
    'upsert_package',
    'delete_package',
    'upsert_addon',
    'delete_addon',
    'create_booking',
    'cancel_booking',
    'update_booking',
    'add_blackout_date',
    'remove_blackout_date',
    'upsert_segment',
    'delete_segment',
    'update_branding',
    'update_customer',
  ];

  const missing = registeredTools.filter((t) => !getProposalExecutor(t));
  if (missing.length) {
    throw new Error(`FATAL: Missing executors for tools: ${missing.join(', ')}`);
  }
  logger.info('All tool executors registered successfully');
}
```

## Impact

- **Reliability**: Silent production failures when new tools added without executor
- **UX**: Users see "booking confirmed" but nothing happens
- **Development**: Easy to forget executor registration when adding tools

## Fix Steps

1. Add `validateExecutorRegistry()` function to executor-registry.ts
2. Call during server initialization (in di.ts or server.ts)
3. Fail fast at startup if any tool missing its executor
4. Log success message when all executors validated

## Related Files

- `server/src/agent/proposals/executor-registry.ts` - Registry module
- `server/src/di.ts` - Dependency injection / initialization
- `server/src/server.ts` - Server bootstrap

## Testing

- Remove one executor registration, verify startup fails
- Add new tool without executor, verify startup fails
- All executors registered, verify startup succeeds

## Why This Was Re-Added

Originally skipped as "dev convenience, not a bug". Three independent reviewers (DHH, Kieran, Code Simplicity) all flagged this as the highest-risk skipped item because silent failures in production are unacceptable.

## Tags

reliability, agent, proposal, startup-validation, code-review
