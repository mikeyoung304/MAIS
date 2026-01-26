---
status: complete
priority: p3
issue_id: '549'
tags: [code-review, typescript, type-safety]
dependencies: []
completed_at: '2026-01-26'
resolution: 'N/A - CustomerToolContext and all legacy agent customer tools deleted in migration to Vertex AI Cloud Run architecture. Customer chatbot now uses Booking Agent on Cloud Run.'
---

# Extended Context Type Gap (CustomerToolContext)

## Problem Statement

`CustomerToolContext` extends `ToolContext` with `proposalService`, but the `AgentTool.execute()` signature expects base `ToolContext`. The `book_service` tool casts to `CustomerToolContext` without type safety.

## Findings

**Pattern Recognition Specialist:**

> "`CustomerToolContext` is not part of `AgentTool` interface. `execute()` signature expects `ToolContext` but booking tool needs `proposalService`."

**Evidence:**

```typescript
// customer-tools.ts:20-23
interface CustomerToolContext extends ToolContext {
  proposalService: ProposalService;
}

// customer-tools.ts:273 - Unsafe cast
const customerContext = context as CustomerToolContext;
```

**Impact:**

- Type safety gap
- Runtime could fail if proposalService missing
- Inconsistent with other customer tools (they don't cast)

## Proposed Solutions

### Option A: Add proposalService to base ToolContext

All orchestrators provide proposalService in context.

**Pros:** No casting needed, type-safe
**Cons:** All tools receive proposalService (even if unused)
**Effort:** Medium (20 min)
**Risk:** Low

### Option B: Pass proposalService as dependency injection

Tools that need proposalService receive it at registration, not via context.

**Pros:** Cleaner separation
**Cons:** Changes tool registration pattern
**Effort:** Medium (30 min)
**Risk:** Medium

### Option C: Document as acceptable

Casting is safe because CustomerChatOrchestrator always provides proposalService.

**Pros:** No code change
**Cons:** Remains type-unsafe
**Effort:** Small (5 min)
**Risk:** Low

## Recommended Action

Option C for now (document), Option A for future cleanup

## Technical Details

**Affected Files:**

- `server/src/agent/customer/customer-tools.ts:20-23, 273`
- `server/src/agent/tools/types.ts` - ToolContext definition

## Acceptance Criteria

- [ ] Decision documented
- [ ] OR proposalService added to base ToolContext

## Work Log

| Date       | Action                   | Learnings                                     |
| ---------- | ------------------------ | --------------------------------------------- |
| 2026-01-01 | Created from code review | Context extension pattern needs documentation |
