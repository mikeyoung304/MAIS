---
status: pending
priority: p3
issue_id: '459'
tags: [code-review, security, agent, multi-tenant]
dependencies: []
---

# Agent Proposal updateMany Could Include Explicit tenantId

## Problem Statement

The `updateMany` call in `softConfirmPendingT2` uses proposal IDs that were already filtered by tenantId, but doesn't include tenantId in the where clause. While safe (IDs came from tenant-filtered query), adding tenantId is defense-in-depth.

## Severity: P3 - NICE-TO-HAVE

LOW risk finding. This is a belt-and-suspenders improvement, not a security vulnerability.

## Findings

- **Source**: Security Sentinel
- **Location**: `server/src/agent/proposals/proposal.service.ts:268-276`

```typescript
// Line 250-258: findMany properly filters by tenantId - GOOD
const proposals = await this.prisma.agentProposal.findMany({
  where: {
    tenantId,  // <-- Tenant isolation
    sessionId,
    status: 'PENDING',
    trustTier: 'T2',
    ...
  },
});

// Line 268-276: updateMany uses IDs from above - OK but could be explicit
await this.prisma.agentProposal.updateMany({
  where: {
    id: { in: proposalIds },  // No explicit tenantId
  },
  data: { ... },
});
```

## Proposed Solutions

### Option 1: Add Explicit tenantId (Recommended)

- **Pros**: Defense-in-depth, documents intent
- **Cons**: Slightly more verbose
- **Effort**: Trivial (5 minutes)
- **Risk**: None

```typescript
await this.prisma.agentProposal.updateMany({
  where: {
    id: { in: proposalIds },
    tenantId,  // Belt-and-suspenders
  },
  data: { ... },
});
```

## Technical Details

- **Affected Files**: `server/src/agent/proposals/proposal.service.ts`
- **Database Changes**: No

## Acceptance Criteria

- [ ] `updateMany` includes tenantId in where clause
- [ ] Same pattern applied to any other updateMany/deleteMany in the file

## Resources

- Source: Security Sentinel Code Review (2025-12-28)
