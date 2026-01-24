---
status: complete
priority: p2
issue_id: '670'
tags:
  - code-review
  - testing
  - onboarding
dependencies: []
---

# Test Expects "Marketing" But Prompt Now Says "Website Setup"

## Problem Statement

The onboarding system prompt test at line 96 expects the prompt to contain "Marketing" but the phase was renamed to "Website Setup" in the prompt. This causes test failure and blocks pre-commit hooks.

**Why it matters:** Test failures prevent clean commits and may mask other issues. The test expectation needs to match the actual prompt content.

## Findings

**Location:** `server/test/agent/onboarding/onboarding-system-prompt.test.ts` line 96

**Failing Assertion:**

```typescript
expect(prompt).toContain('Marketing'); // ❌ Fails
```

**Actual Prompt Content (from onboarding-system-prompt.ts):**
The MARKETING phase guidance now says "Website Setup" instead of "Marketing":

```typescript
[OnboardingPhase.MARKETING]: `
## Current Phase: Website Setup
...
`
```

## Proposed Solutions

### Option A: Update Test to Match New Wording (Recommended)

**Pros:** Aligns test with current behavior
**Cons:** None
**Effort:** Trivial (5 min)
**Risk:** None

```typescript
expect(prompt).toContain('Website Setup');
```

### Option B: Revert Prompt to "Marketing"

**Pros:** No test change needed
**Cons:** "Website Setup" may be better UX
**Effort:** Trivial (5 min)
**Risk:** Low

## Recommended Action

**Option A** - Update the test. The rename to "Website Setup" appears intentional for better UX clarity.

## Technical Details

**Affected Files:**

- `server/test/agent/onboarding/onboarding-system-prompt.test.ts` line 96

## Acceptance Criteria

- [ ] Test passes with updated expectation
- [ ] Pre-commit hook runs cleanly
- [ ] All other onboarding tests pass

## Work Log

| Date       | Action                   | Learnings                             |
| ---------- | ------------------------ | ------------------------------------- |
| 2026-01-08 | Created from code review | Found during pre-commit hook test run |

## Resources

- Prompt source: `server/src/agent/prompts/onboarding-system-prompt.ts`
