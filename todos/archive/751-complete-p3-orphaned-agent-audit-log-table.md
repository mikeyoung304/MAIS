# Orphaned AgentAuditLog Table - Schema Without Implementation

## Metadata

- **ID:** 751
- **Status:** deferred
- **Priority:** p3
- **Tags:** code-review, data-integrity, schema-drift
- **Created:** 2026-01-26
- **Source:** Legacy Agent Migration Review

## Problem Statement

The `AgentAuditLog` table exists in the Prisma schema (lines 836-856 in schema.prisma) but **nothing writes to it**. This is schema drift - the table was designed for agent action auditing but was never implemented, or the implementation was deleted during migration.

**Impact:**

- Schema bloat with unused table
- False expectation of audit capability
- Potential compliance gap if audit logging was a requirement

## Findings

**Data Integrity Guardian finding:**

The table schema includes fields for:

- `toolName` - Which tool was called
- `proposalId` - Reference to proposals
- `trustTier` - T1/T2/T3 action level
- `inputSummary` / `outputSummary` - Tool call details
- `executionDurationMs` - Performance tracking

Grep for `agentAuditLog.create` only found generated Prisma types, not actual usage.

**Current audit capabilities:**

- `ConfigChangeLog` - Active, tracks config changes
- `AgentSession` + `AgentSessionMessage` - Active, tracks conversations
- `AgentAuditLog` - **UNUSED**

## Proposed Solutions

### Option 1: Remove the unused table (Recommended)

Create migration to drop `AgentAuditLog` table.

```bash
npx prisma migrate dev --name remove_orphaned_agent_audit_log
```

**Pros:** Cleans up schema drift, removes confusion
**Cons:** If audit logging is needed later, table must be recreated
**Effort:** Small (30 min)
**Risk:** Low - table is unused

### Option 2: Implement audit logging in Cloud Run agents

Add audit log writes to agent tool executions.

**Pros:** Provides intended audit capability
**Cons:** Significant implementation work, may not be needed
**Effort:** Large
**Risk:** Medium

### Option 3: Document as intentional placeholder

Add comment to schema explaining table is reserved for future use.

**Pros:** No code changes
**Cons:** Doesn't resolve drift
**Effort:** Small
**Risk:** None

## Technical Details

**Affected files:**

- `prisma/schema.prisma` (lines 836-856)
- New migration file if removing

**Table definition:**

```prisma
model AgentAuditLog {
  id                   String    @id @default(cuid())
  tenantId             String
  userId               String?
  sessionId            String?
  toolName             String
  proposalId           String?
  trustTier            String?
  inputSummary         String?
  outputSummary        String?
  executionDurationMs  Int?
  success              Boolean   @default(true)
  errorMessage         String?
  createdAt            DateTime  @default(now())

  tenant               Tenant    @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([sessionId])
  @@index([createdAt])
}
```

## Acceptance Criteria

- [ ] Decision made: remove, implement, or document
- [ ] If removing: migration created and applied
- [ ] No orphaned foreign key references

## Work Log

| Date       | Action                   | Learnings                                                 |
| ---------- | ------------------------ | --------------------------------------------------------- |
| 2026-01-26 | Created from code review | Table was likely intended for local orchestrator auditing |

## Resources

- Schema: `prisma/schema.prisma`
