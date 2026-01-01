---
status: resolved
priority: p0
issue_id: '548'
tags: [code-review, testing, agent-ecosystem, quality-first-triage]
dependencies: []
resolved_at: 2026-01-01
resolution: 'Added 30 tests for parseChatMessages(), withTimeout(), and DEFAULT_ORCHESTRATOR_CONFIG. Added 8 tests for request-context. Exported pure functions for testability.'
---

# P0: BaseOrchestrator (1100 lines) has 0% Test Coverage

> **Quality-First Triage Upgrade:** P1 → P0. "The codebase cannot be considered production-ready without tests for the core orchestrator."

## Problem Statement

The core `base-orchestrator.ts` file (1,111 lines) has **zero test coverage**. This is the most critical component in the agent ecosystem containing:

- Session management (`getOrCreateSession`, `getSession`)
- Chat processing logic (`chat` method)
- Tool execution with recursion limits (`processResponse`)
- Circuit breaker cleanup (`cleanupOldCircuitBreakers`)
- Proposal execution (`executeConfirmedProposals`)
- History message building (`buildHistoryMessages`)
- Context cache invalidation

**Why it matters:** Any regression in this core orchestration logic would break all agent functionality - onboarding, customer chat, and admin assistants.

## Findings

| Reviewer               | Finding                                                      |
| ---------------------- | ------------------------------------------------------------ |
| Test Coverage Reviewer | BaseOrchestrator.ts has 0 unit tests and 0 integration tests |
| Architecture Reviewer  | Template Method pattern is well-designed but untested        |
| Performance Reviewer   | Cleanup logic in `cleanupOldCircuitBreakers` untested        |

## Proposed Solutions

### Option 1: Unit Tests for Pure Functions (Recommended)

**Effort:** Medium (3-4 hours)

Extract and test pure functions:

- `parseChatMessages()` - JSON parsing with type guards
- `buildHistoryMessages()` - Message truncation logic
- `cleanupOldCircuitBreakers()` - Cleanup heuristics

**Pros:**

- Quick wins, high value
- Easy to mock dependencies

**Cons:**

- Doesn't test integration between components

### Option 2: Integration Tests with Mocked Anthropic

**Effort:** Large (6-8 hours)

Full chat flow tests with mocked Claude API.

**Pros:**

- Tests real orchestration flow
- Catches integration bugs

**Cons:**

- Complex setup
- Slower test execution

### Option 3: Create TestableOrchestrator Subclass

**Effort:** Medium (4-5 hours)

Create a concrete test implementation that exposes protected methods for testing.

**Pros:**

- Tests via public interface
- No production code changes

**Cons:**

- Extra test code to maintain

## Recommended Action

Start with **Option 1** for immediate coverage, then add **Option 2** for integration testing.

## Technical Details

**Affected Files:**

- `server/src/agent/orchestrator/base-orchestrator.ts`
- `server/test/agent/orchestrator/` (new test files)

**Key Methods to Test First:**

1. `parseChatMessages()` - Line 156-169
2. `buildHistoryMessages()` - Line 709-728
3. `cleanupOldCircuitBreakers()` - Line 1072-1110
4. `withTimeout()` - Line 758-777

## Acceptance Criteria

- [ ] Unit tests for `parseChatMessages()` covering valid, empty, and malformed input
- [ ] Unit tests for `buildHistoryMessages()` covering truncation
- [ ] Unit tests for `cleanupOldCircuitBreakers()` covering TTL and hard cap
- [ ] Integration test for basic chat flow with mocked Claude API
- [ ] Coverage report shows >50% for base-orchestrator.ts

## Work Log

| Date       | Action                   | Learnings                                     |
| ---------- | ------------------------ | --------------------------------------------- |
| 2026-01-01 | Created from code review | Test Coverage Reviewer identified 0% coverage |

## Resources

- Related: `server/test/agent/orchestrator/rate-limiter.test.ts` (pattern to follow)
- Related: `server/test/agent/orchestrator/circuit-breaker.test.ts`
