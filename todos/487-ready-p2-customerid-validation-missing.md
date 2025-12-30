# P2: CustomerId Validation Missing in Customer Booking Executor

## Status

**READY** - Approved 2025-12-29 via auto-triage

## Priority

**P2 - Important Security Issue**

## Description

The customer booking executor trusts `proposal.customerId` from the database but doesn't verify that this customerId actually belongs to the tenant. If there's a race condition or database manipulation, a proposal could have a customerId from a different tenant.

## Location

- `server/src/routes/public-customer-chat.routes.ts` (lines 345-348)

## Current Code

```typescript
const customerId = proposal.customerId;
if (!customerId) {
  throw new Error('Customer ID not found on proposal');
}
// Uses customerId without verifying tenant ownership
```

## Expected Code

```typescript
const customerId = proposal.customerId;
if (!customerId) {
  throw new Error('Customer ID not found on proposal');
}

// Verify customer belongs to this tenant
const customer = await tx.customer.findFirst({
  where: { id: customerId, tenantId },
});
if (!customer) {
  throw new Error('Customer not found or access denied');
}
```

## Impact

- **Security**: Potential cross-tenant data access
- **Data Integrity**: Bookings could be created for wrong tenant's customer
- **Compliance**: Violates multi-tenant isolation

## Fix Steps

1. Add explicit tenant ownership verification for customerId
2. Verify customer exists and belongs to tenant before booking
3. Log any mismatches for security auditing

## Related Files

- `server/src/agent/customer/customer-booking-executor.ts` - Main executor
- `server/src/services/customer.service.ts` - Customer queries

## Testing

- Create proposal with customerId from different tenant
- Verify rejection with appropriate error
- Check audit logs

## Tags

security, multi-tenant, agent, customer, code-review
