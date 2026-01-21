---
status: complete
priority: p2
issue_id: '5197'
tags: [code-review, agent-v2, security, deduplication]
dependencies: []
---

# Prompt Injection Patterns Duplicated Across Files

## Problem Statement

INJECTION_PATTERNS for prompt injection filtering are defined in two places with different coverage, creating inconsistency risk.

**Why it matters:** If patterns are updated in one place but not the other, prompt injection protection becomes inconsistent and potentially exploitable.

## Findings

**Location 1:** `server/src/agent-v2/deploy/research/src/agent.ts` (lines 45-90)

- 22+ regex patterns
- Comprehensive coverage

**Location 2:** `server/src/routes/internal-agent.routes.ts` (lines 1236-1248)

- ~11 patterns
- Subset of Research agent patterns

Example of divergence - Research has:

```typescript
/(?:you\s+(?:are|must|should|will)\s+(?:now\s+)?(?:a|an|my)\s+)/i,
```

But backend doesn't have this pattern.

## Proposed Solutions

### Option A: Extract to Shared Module (Recommended)

**Pros:** Single source of truth, consistent protection
**Cons:** Requires build pipeline change for agents
**Effort:** Medium (2 hours)

Create `packages/security/src/injection-patterns.ts`:

```typescript
export const INJECTION_PATTERNS: RegExp[] = [
  // All patterns here
];

export function filterPromptInjection(text: string): string {
  let result = text.normalize('NFKC');
  for (const pattern of INJECTION_PATTERNS) {
    result = result.replace(pattern, '[FILTERED]');
  }
  return result;
}
```

### Option B: Copy Full Patterns to Backend

**Pros:** Quick fix
**Cons:** Still duplicated, drift risk remains
**Effort:** Small (30 min)

## Technical Details

**Affected Files:**

- `server/src/agent-v2/deploy/research/src/agent.ts`
- `server/src/routes/internal-agent.routes.ts`
- Potentially new: `packages/security/src/injection-patterns.ts`

## Acceptance Criteria

- [ ] Single source of truth for injection patterns
- [ ] Both agent and backend use same patterns
- [ ] Tests verify pattern coverage

## Work Log

| Date       | Action  | Notes                |
| ---------- | ------- | -------------------- |
| 2026-01-19 | Created | From security review |
