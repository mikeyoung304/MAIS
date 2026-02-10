---
status: pending
priority: p3
issue_id: '5262'
tags: [code-review, architecture, pr-44]
dependencies: ['5243']
---

# Make required services non-optional for fail-fast DI

## Problem Statement

Per-domain deps interfaces allow optional services (internal-agent-shared.ts:122-161). Forces every route to check `if (!service)` and return 503. Pushes errors to runtime instead of catching at startup.

## Findings

- Optional service types in `server/src/routes/internal-agent/internal-agent-shared.ts:122-161`
- Every route has defensive null checks: `if (!service) return res.status(503).json(...)`
- Errors caught at request time, not startup time
- Requires ~30+ null checks across all domain routes
- Missing service is a configuration error, should fail-fast at startup

## Proposed Solutions

### Option 1: Required services with fail-fast DI

**Approach:**

1. Make required services non-optional in deps interfaces
2. DI container validates required services at startup
3. Throws error if required service missing
4. Remove defensive null checks from routes

**Pros:**

- Fail-fast at startup, not request time
- Reduces ~30+ null checks
- Clearer error messages
- Configuration errors caught early

**Cons:**

- Requires DI container refactor
- Startup validation logic needed

**Effort:** 2-3 hours

**Risk:** Medium

### Option 2: Keep current pattern

**Approach:** Leave optional services and defensive checks

**Pros:**

- Works currently
- No refactor needed

**Cons:**

- Errors at runtime, not startup
- Requires many null checks

**Effort:** 0 minutes

**Risk:** None

## Recommended Action

**To be filled during triage.** Wait for #5243 (DI container improvement) to complete, then evaluate Option 1.

## Technical Details

**Affected files:**

- `server/src/routes/internal-agent/internal-agent-shared.ts:122-161` - deps interfaces
- All 6 domain route files - defensive null checks
- `server/src/di.ts` - DI container startup validation

**Dependencies:**

- DEPENDS ON #5243 (DI container improvement)

**Related components:**

- All agent route handlers
- DI container initialization
- Error handling utilities

## Resources

- **PR:** #44
- **Related:** #5243 (DI container improvement)

## Acceptance Criteria

- [ ] #5243 complete
- [ ] Required services made non-optional
- [ ] DI container validates at startup
- [ ] Defensive null checks removed
- [ ] Clear error messages if services missing
- [ ] All tests pass

## Work Log

### 2026-02-09 - Initial Discovery

**By:** Claude Code

**Actions:**

- Identified during PR #44 code review
- Counted ~30+ defensive null checks
- Documented fail-fast pattern benefit
- Flagged dependency on #5243

## Notes

- Low priority: current pattern works functionally
- Fail-fast is better pattern for required dependencies
- DEPENDS ON #5243 - wait for DI container refactor
- Reduces defensive code and improves error clarity
