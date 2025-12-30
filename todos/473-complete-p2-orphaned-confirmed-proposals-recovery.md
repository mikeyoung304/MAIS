# P2: Orphaned CONFIRMED State Proposals Recovery

## Status

**COMPLETE** - Implemented 2025-12-29

## Priority

**P2 - Important**

## Description

If the server crashes or restarts after a proposal is marked CONFIRMED but before execution completes, the proposal will be stuck in CONFIRMED status forever. There's no mechanism to recover or retry these orphaned proposals.

## Solution Implemented

### 1. Created `recoverOrphanedProposals()` function in `server/src/jobs/cleanup.ts`

The function:

- Finds CONFIRMED proposals older than 5 minutes (stuck proposals)
- For each orphaned proposal:
  - Gets the registered executor for the tool
  - If executor exists: attempts execution and marks as EXECUTED on success
  - If executor missing or execution fails: marks as FAILED with descriptive error
- Logs all recovery attempts for observability
- Returns counts of retried and failed proposals

### 2. Added `recoverOrphanedProposalsOnStartup()` wrapper function

A startup-safe wrapper that:

- Runs immediately on server startup
- Catches errors to prevent startup failures (non-fatal)
- Logs recovery results

### 3. Integrated into server startup in `server/src/index.ts`

- Runs AFTER executor registration (via `createApp`)
- Runs BEFORE accepting traffic
- Only runs in real mode (with database)

### 4. Added to scheduled cleanup in `runAllCleanupJobs()`

Orphan recovery now runs:

- On every server startup
- As part of the daily cleanup scheduler

## Files Modified

- `server/src/jobs/cleanup.ts` - Added `recoverOrphanedProposals()` and `recoverOrphanedProposalsOnStartup()` functions
- `server/src/index.ts` - Added startup call to `recoverOrphanedProposalsOnStartup()`

## Verification

- TypeScript: `npm run typecheck` passes

## Original Problem

- Proposal marked CONFIRMED -> Server crashes -> Proposal stays CONFIRMED forever
- Next chat message doesn't retry old CONFIRMED proposals
- No cron job or startup task to clean up

## Solution Behavior

1. On server startup, find CONFIRMED proposals older than 5 minutes
2. Attempt to execute each using the registered executor
3. Mark as EXECUTED on success, FAILED on error
4. Log all recovery attempts for monitoring/debugging
5. Continue running in scheduled cleanup job for proposals that become orphaned during runtime

## Tags

reliability, agent, proposal, recovery, startup, complete
