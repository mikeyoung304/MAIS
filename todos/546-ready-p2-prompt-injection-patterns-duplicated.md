---
status: ready
priority: p2
issue_id: "546"
tags: [code-review, security, dry, prompt-injection]
dependencies: []
---

# Prompt Injection Patterns Duplicated

## Problem Statement

Prompt injection detection patterns are defined in TWO places with different coverage:
1. `tools/types.ts` - 21 comprehensive patterns
2. `customer-chat-orchestrator.ts` - 8 basic patterns

CustomerChatOrchestrator uses its local (incomplete) patterns, missing protections from the comprehensive set.

## Findings

**Pattern Recognition Specialist:**
> "PROMPT_INJECTION_PATTERNS defined in TWO places with different coverage. CustomerChatOrchestrator only uses local patterns, misses refined patterns from types.ts."

**Evidence:**
```typescript
// tools/types.ts - 21 patterns including:
/\bpretend\s+(?:to\s+be|you\s+are|that\s+you)\b/i,
/\byou\s+are\s+(?:now|no\s+longer|actually)\b/i,
/\b(?:new|different)\s+(?:persona|character|identity)\b/i,
// ... 18 more patterns

// customer-chat-orchestrator.ts - 8 patterns (subset):
/ignore\s+(?:previous|your|all)\s+instruction/i,
/disregard\s+(?:previous|your|all)\s+instruction/i,
// ... 6 more (missing many from types.ts)
```

**Impact:**
- Inconsistent protection between agents
- CustomerChatOrchestrator (public-facing) has weaker protection
- DRY violation makes updates error-prone

## Proposed Solutions

### Option A: Import from single source (Recommended)
CustomerChatOrchestrator imports patterns from types.ts.

```typescript
// customer-chat-orchestrator.ts
import { PROMPT_INJECTION_PATTERNS } from '../tools/types';

private detectPromptInjection(message: string): boolean {
  const normalized = message.normalize('NFKC');
  return PROMPT_INJECTION_PATTERNS.some(p => p.test(normalized));
}
```

**Pros:** Single source of truth, consistent protection
**Cons:** None
**Effort:** Small (10 min)
**Risk:** Low

### Option B: Extract to dedicated security module
Create `server/src/agent/security/prompt-injection.ts` with all detection logic.

**Pros:** Clean separation, reusable
**Cons:** Adds file, slightly more complex
**Effort:** Medium (20 min)
**Risk:** Low

## Recommended Action

Option A - Import from types.ts (quickest fix)

## Technical Details

**Affected Files:**
- `server/src/agent/orchestrator/customer-chat-orchestrator.ts:63-74` - Remove local patterns
- `server/src/agent/tools/types.ts:121-169` - Source patterns (keep)

## Acceptance Criteria

- [ ] CustomerChatOrchestrator imports patterns from types.ts
- [ ] Local pattern definition removed
- [ ] All 21 patterns applied to customer chat
- [ ] Tests verify protection consistency

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-01 | Created from code review | Public-facing agents need strongest protection |

## Resources

- [OWASP Prompt Injection](https://owasp.org/www-project-top-10-for-llm-applications/)
