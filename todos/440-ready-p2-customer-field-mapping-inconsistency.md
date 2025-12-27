---
status: ready
priority: p2
issue_id: "440"
tags: [code-review, code-quality, agent-tools]
dependencies: []
---

# Field Mapping Inconsistency (Customer.notes vs description)

## Problem Statement

The `get_customers` tool maps the Customer model's `notes` field inconsistently with how other tools handle similar fields. This could confuse the AI agent.

**Why it matters:**
- Inconsistent field names reduce agent effectiveness
- May cause confusion when cross-referencing data
- API consistency matters for AI understanding

## Findings

- **Location:** `server/src/agent/tools/read-tools.ts` (formatCustomer helper)
- Customer has `notes` field in Prisma model
- Some formatting inconsistencies with similar entities
- Agent prompts may reference fields differently

## Proposed Solutions

### Option A: Standardize Field Names

**Approach:** Use consistent naming across all formatters.

**Pros:**
- Better agent comprehension
- Consistent API

**Cons:**
- Breaking change if already in use

**Effort:** Small (1 hour)

**Risk:** Low

---

### Option B: Document Field Mappings

**Approach:** Add comments explaining field name choices.

**Pros:**
- No code changes

**Cons:**
- Doesn't fix inconsistency

**Effort:** Small (30 minutes)

**Risk:** None

## Recommended Action

<!-- Filled during triage -->

## Technical Details

**Affected files:**
- `server/src/agent/tools/read-tools.ts`

**Database changes:** None

## Acceptance Criteria

- [ ] Field mappings consistent across tools
- [ ] Agent can reference fields predictably
- [ ] Tests pass

## Work Log

### 2025-12-26 - Initial Discovery

**By:** architecture-strategist agent

**Actions:**
- Reviewed field mapping patterns

**Learnings:**
- Consistency helps AI agent effectiveness
