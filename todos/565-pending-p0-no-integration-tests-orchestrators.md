---
status: deferred
priority: p2
issue_id: '565'
tags: [code-review, testing, agent-ecosystem, quality-first-triage]
dependencies: ['548']
deferred_at: 2026-01-01
reason: 'BaseOrchestrator constructor creates Anthropic client directly (tight coupling). Integration tests require DI refactor. 38 unit tests added in todo-548 provide substantial coverage. Recommend: add Anthropic client factory to enable mocking in future sprint.'
---

# P0: No Integration Tests for Orchestrator End-to-End Flows

> **Quality-First Triage:** New finding. "Primary user journeys have zero executable specification. Every deployment is a gamble."

## Problem Statement

There are **zero integration tests** for the actual orchestrator chat flows:

- No tests for full chat flow with tool calls returning results
- No tests for session resumption across multiple turns
- No tests for T2 soft-confirm proposal execution
- No tests for guardrails (rate limiter + circuit breaker + budget) working together

The existing `onboarding-flow.spec.ts` tests event sourcing and advisor memory - **not the actual orchestrator chat flow**.

**Why it matters:** These are the PRIMARY user journeys. Every deployment is an implicit integration test. Failures are discovered in production, not in CI.

## Findings

| Reviewer             | Finding                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| Test Coverage Triage | P0: Primary user journeys undocumented. Zero executable specification. |

## Proposed Solutions

### Option 1: Mock Anthropic API Integration Tests (Recommended)

**Effort:** Large (6-8 hours)

Create integration tests with mocked Claude API responses:

1. Customer booking flow: Message → tool call → proposal → confirm → execute
2. Onboarding flow: Discovery → market research → service creation with T2 soft-confirm
3. Session resumption: Create session, close, resume with context
4. Guardrail integration: All guardrails working together

## Technical Details

**New Test Files:**

- `server/test/integration/customer-chat-flow.spec.ts`
- `server/test/integration/admin-chat-flow.spec.ts`
- `server/test/integration/orchestrator-guardrails.spec.ts`

**Key Flows to Test:**

1. `CustomerChatOrchestrator.chat()` with booking flow
2. `OnboardingOrchestrator.chat()` with T2 soft-confirm
3. `AdminOrchestrator.chat()` with mode switching

## Acceptance Criteria

- [ ] Integration test for customer booking flow (message → tool → proposal → execute)
- [ ] Integration test for session resumption
- [ ] Integration test for T2 soft-confirm lifecycle
- [ ] Integration test for guardrail interaction

## Work Log

| Date       | Action                            | Learnings                            |
| ---------- | --------------------------------- | ------------------------------------ |
| 2026-01-01 | Created from quality-first triage | Test Coverage agent identified as P0 |
