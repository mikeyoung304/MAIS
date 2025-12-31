# P1: Missing Tenant Validation in T2 Proposal Execution

## Status

**COMPLETE** - Fixed 2025-12-29

## Priority

**P1 - Critical Security Issue**

## Description

When executing T2 (soft-confirm) proposals, the orchestrator fetches the proposal by ID without validating that it belongs to the current tenant. An attacker could potentially execute proposals belonging to other tenants by manipulating the confirmation flow.

## Location

- `server/src/agent/orchestrator/orchestrator.ts` (line ~421)

## Current Code

```typescript
const proposal = await this.prisma.agentProposal.findUnique({
  where: { id: proposalId },
});
```

## Expected Code

```typescript
const proposal = await this.prisma.agentProposal.findFirst({
  where: {
    id: proposalId,
    tenantId, // CRITICAL: Filter by tenant
  },
});
```

## Impact

- **Security**: Cross-tenant data access vulnerability
- **Data Integrity**: Actions could be executed against wrong tenant
- **Compliance**: Violates multi-tenant isolation requirements

## Fix Steps

1. Change `findUnique` to `findFirst` with tenantId filter
2. Add explicit check: `if (!proposal || proposal.tenantId !== tenantId)`
3. Log any mismatch attempts for security auditing

## Related Files

- `server/src/agent/customer/customer-orchestrator.ts` - Check for same pattern
- `server/src/agent/proposals/proposal.service.ts` - Review all proposal queries

## Testing

- Add integration test: Create proposal for tenant A, attempt execution as tenant B
- Verify rejection with appropriate error message
- Check audit logs capture the attempt

## Tags

security, multi-tenant, agent, proposal, t2-confirmation
