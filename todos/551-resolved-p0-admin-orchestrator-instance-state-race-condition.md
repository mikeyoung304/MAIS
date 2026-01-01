---
status: resolved
priority: p0
issue_id: '551'
tags: [code-review, architecture, agent-ecosystem, race-condition, quality-first-triage]
dependencies: []
resolved_at: 2026-01-01
resolution: 'Used AsyncLocalStorage for request-scoped state (request-context.ts). Removed instance variable from AdminOrchestrator.'
---

# P0: AdminOrchestrator Instance State Causes Race Conditions

> **Quality-First Triage Upgrade:** P1 → P0. "Violates Stateless Service principle. Concurrent requests can receive wrong tools. Non-deterministic behavior."

## Problem Statement

The `AdminOrchestrator` stores `isOnboardingMode` as **instance state** (line 150):

```typescript
export class AdminOrchestrator extends BaseOrchestrator {
  private isOnboardingMode: boolean = false;
```

This flag is modified in `chat()` before calling `super.chat()`. If the same `AdminOrchestrator` instance handles concurrent requests from different tenants (one in onboarding, one not), the flag gets overwritten, causing **wrong tools to be returned** in `getTools()`.

**Why it matters:** A non-onboarding tenant could receive onboarding tools (security risk), or an onboarding tenant could lose onboarding tools (broken experience).

## Findings

| Reviewer              | Finding                                                              |
| --------------------- | -------------------------------------------------------------------- |
| Architecture Reviewer | P1: Instance-level state in AdminOrchestrator causes race conditions |
| Security Reviewer     | Related: Rate limiter not scoped per-session                         |

## Proposed Solutions

### Option 1: Pass Mode Through Request Context (Recommended)

**Effort:** Small (1-2 hours)

Store mode in session or pass as parameter rather than instance state:

```typescript
// In chat() method, pass through request context
const sessionState = await this.getSession(tenantId, sessionId);
const tools = this.getToolsForMode(sessionState.isOnboardingMode);
```

Or extend `SessionState`:

```typescript
interface AdminSessionState extends SessionState {
  isOnboardingMode: boolean;
}
```

**Pros:**

- Eliminates race condition completely
- Uses existing session infrastructure

**Cons:**

- Slightly more complex session management

### Option 2: Create Orchestrator Per Request

**Effort:** Medium (3-4 hours)

Instantiate new orchestrator for each request.

**Pros:**

- Complete isolation
- Simple mental model

**Cons:**

- Memory overhead
- Loses instance-level caching benefits

### Option 3: Use AsyncLocalStorage for Request Context

**Effort:** Medium (2-3 hours)

Use Node.js AsyncLocalStorage to track per-request state.

**Pros:**

- No signature changes
- Works across async boundaries

**Cons:**

- More complex debugging
- Requires setup in middleware

## Recommended Action

Implement **Option 1** - use `AdminSessionState` to track mode per-session.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/admin-orchestrator.ts`

**Current Flow:**

1. `chat()` called with tenantId
2. Fetches tenant, checks onboarding phase
3. Sets `this.isOnboardingMode` (race window)
4. Calls `super.chat()` which calls `getTools()`
5. `getTools()` reads stale `this.isOnboardingMode`

**Fixed Flow:**

1. `chat()` called with tenantId
2. Fetches tenant, checks onboarding phase
3. Stores mode in session state
4. `getTools()` receives session context with correct mode

## Acceptance Criteria

- [ ] Remove `private isOnboardingMode` from AdminOrchestrator
- [ ] Store mode in AdminSessionState or pass as context
- [ ] Add test for concurrent requests with different modes
- [ ] Verify correct tools returned under concurrent load

## Work Log

| Date       | Action                   | Learnings                                         |
| ---------- | ------------------------ | ------------------------------------------------- |
| 2026-01-01 | Created from code review | Architecture Strategist identified race condition |

## Resources

- Current implementation: admin-orchestrator.ts:150
- Session state pattern: onboarding-orchestrator.ts:71-76
