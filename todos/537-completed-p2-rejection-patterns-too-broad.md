---
status: completed
priority: p2
issue_id: "537"
tags: [code-review, agent-ecosystem, agent-native]
dependencies: []
completed_at: 2026-01-01
---

# T2 Rejection Patterns Too Broad

## Problem Statement

Rejection patterns like "no", "wait", "actually" are too broad. A message like "No, I don't have any other questions" would incorrectly reject pending proposals.

## Findings

**Agent-Native Reviewer:**
> "A message like 'No, I don't have any other questions' or 'Actually, that looks great!' would incorrectly reject pending proposals."

**Location:** `proposal.service.ts` (lines 246-276)

## Solution Implemented

Made rejection patterns more contextual to require explicit rejection intent, not just keyword presence:

### Pattern Changes

**Before (overly broad):**
- `^wait|stop|hold|cancel` at start of message would reject
- "Wait, I have a question first" incorrectly rejected
- "Stop by anytime" incorrectly rejected
- "Hold that thought" incorrectly rejected

**After (contextual):**
- `^no,?\s*(don't|cancel|stop|wait)` - "No" only with explicit cancellation verb
- `^wait[,!]?\s*(don't|stop|cancel|no)` - "Wait" only with rejection context
- `^stop[,!]?\s*(that|this|it|the|don't|now|i\s+(changed|don't|want))` - "Stop" only with object or "changed mind"
- `^hold\s+on` - Only "hold on" pattern (not "hold that thought")
- `^cancel` - "Cancel" at start is always rejection intent
- `\bno\s+no\b` - Repeated "no" as emphatic rejection
- Additional phrases: "never mind", "scratch that", "on second thought"

### Test Results

- 54 tests pass (was 49, added 5 new edge case tests)
- False positive tests: "Stop by anytime", "Hold that thought", "Wait, I have a question" all correctly NOT rejected
- True positive tests: "No, cancel that", "Wait, don't do that", "Stop, I changed my mind" all correctly rejected

## Files Changed

1. `server/src/agent/proposals/proposal.service.ts` (lines 246-276)
   - Updated rejection pattern regex to be more contextual
   - Added comprehensive comments explaining each pattern

2. `server/test/agent/proposals/proposal.service.test.ts`
   - Updated "wait" test to use rejection context ("Wait, don't do that")
   - Added new test for "wait" without rejection context (should confirm)
   - Updated case-insensitive test to use proper rejection context
   - Added 4 new edge case tests:
     - "stop" in non-rejection context
     - "hold" in non-rejection context
     - Repeated "no" as emphatic rejection
     - Common rejection phrases (never mind, scratch that, etc.)

## Acceptance Criteria

- [x] Rejection patterns more contextual
- [x] False positive rate reduced
- [x] Tests pass (54/54)
