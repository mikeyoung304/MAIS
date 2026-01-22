---
status: pending
priority: p2
issue_id: '5254'
tags: [code-review, typescript, pitfall-62]
dependencies: []
---

# P2: Type Assertions on Unknown API Responses

## Problem Statement

External API responses from the ADK agent are cast without runtime validation. Per Pitfall #62: "Type assertion without validation - Never use `params as { foo: string }` on runtime data."

**Why it matters:** If the ADK API changes format, the code will silently break or produce undefined behavior.

## Findings

**File:** `server/src/services/vertex-agent.service.ts`

**Multiple unsafe casts:**

```typescript
// Line 382 - Unsafe cast of JSON response
const data = (await response.json()) as unknown;

// Lines 734-737 - Multiple unsafe casts without validation
const dataObj = data as Record<string, unknown>;
const messages = dataObj.messages as Array<{
  role: string;
  parts: Array<{ text?: string; functionCall?: unknown }>;
}>;
```

The `extractAgentResponse` and `extractToolCalls` methods cast unknown data without runtime validation.

## Proposed Solutions

### Option A: Add Zod schema for ADK responses (Recommended)

**Pros:** Type-safe, catches API changes early
**Cons:** More code
**Effort:** Medium
**Risk:** Low

```typescript
const ADKResponseSchema = z.array(
  z.object({
    content: z
      .object({
        role: z.string(),
        parts: z.array(
          z.object({
            text: z.string().optional(),
            functionCall: z.unknown().optional(),
          })
        ),
      })
      .optional(),
  })
);

const parseResult = ADKResponseSchema.safeParse(data);
if (!parseResult.success) {
  logger.error({ error: parseResult.error }, 'ADK response validation failed');
  return 'Invalid response from agent.';
}
```

### Option B: Add defensive checks

**Pros:** Less code than full schema
**Cons:** Less rigorous
**Effort:** Small
**Risk:** Low

## Recommended Action

Option A - Add Zod schema for ADK response validation.

## Technical Details

**Affected files:**

- `server/src/services/vertex-agent.service.ts`
- New: `server/src/services/session/adk-response.schemas.ts`

## Acceptance Criteria

- [ ] ADK responses validated with Zod before processing
- [ ] Invalid responses return user-friendly error
- [ ] Validation errors logged with details
- [ ] Existing tests pass

## Work Log

| Date       | Action                   | Result  |
| ---------- | ------------------------ | ------- |
| 2026-01-22 | Created from code review | Pending |

## Resources

- [CLAUDE.md Pitfall #62](CLAUDE.md)
