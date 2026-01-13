---
status: resolved
priority: p1
issue_id: '5174'
tags: [code-review, security, agent-system, information-disclosure]
dependencies: []
resolved_date: '2026-01-12'
resolved_by: master-architect-triage
resolution: Code already fixed - uses 'unknown' instead of customerId at line 138
---

# Customer ID Enumeration via Error Messages

## Problem Statement

The customer booking executor reveals customer IDs in error messages when a customer doesn't belong to the requesting tenant, allowing attackers to enumerate valid customer IDs across all tenants.

**Why it matters:** Information disclosure vulnerability that enables cross-tenant customer ID enumeration, potentially allowing correlation with other data sources to identify customers.

## Findings

**Source:** Security Sentinel agent review (agent ID: a9f11fa)

**Location:** `/Users/mikeyoung/CODING/MAIS/server/src/agent/customer/customer-booking-executor.ts:131-138`

**Current Code:**

```typescript
// Verify customer still exists and belongs to this tenant
const customer = await tx.customer.findFirst({
  where: { id: customerId, tenantId },
});

if (!customer) {
  throw new ResourceNotFoundError('customer', customerId, 'Please try booking again.');
  // ⚠️ Leaks customerId in error message
}
```

**Vulnerability:** The error message includes the actual `customerId`, confirming the ID exists even if it belongs to another tenant.

**Exploit Scenario:**

1. Attacker (Tenant A) enumerates customer IDs: `cust_001`, `cust_002`, etc.
2. For each ID, attacker attempts booking via chatbot
3. Error message confirms whether ID exists (even if it belongs to Tenant B)
4. Attacker builds database of valid customer IDs across all tenants

## Proposed Solutions

### Solution 1: Generic Error Message (Recommended)

**Approach:** Don't reveal customer ID in error message

```typescript
if (!customer) {
  // Generic error - don't reveal if customer exists in another tenant
  throw new ResourceNotFoundError(
    'customer',
    'unknown',
    'Invalid booking details. Please try again.'
  );
}
```

**Pros:**

- Simple fix (1 line change)
- Prevents ID enumeration
- Consistent with security-as-obscurity best practices

**Cons:**

- Slightly less helpful for legitimate debugging

**Effort:** 5 minutes
**Risk:** LOW - No breaking changes

### Solution 2: Redact Customer ID in Production

**Approach:** Only show customer ID in development/test environments

```typescript
if (!customer) {
  const displayId = process.env.NODE_ENV === 'production' ? 'unknown' : customerId;
  throw new ResourceNotFoundError(
    'customer',
    displayId,
    'Invalid booking details. Please try again.'
  );
}
```

**Pros:**

- Debugging-friendly in dev
- Secure in production

**Cons:**

- More complex
- Environment-dependent behavior

**Effort:** 10 minutes
**Risk:** LOW

### Solution 3: Audit Logging for Suspicious Activity

**Approach:** Log repeated failed customer lookups for anomaly detection

**Pros:**

- Detects enumeration attempts
- Complements generic error message

**Cons:**

- Doesn't prevent initial enumeration
- Requires monitoring infrastructure

**Effort:** 1 hour
**Risk:** LOW

## Recommended Action

**Implement Solution 1** immediately, then add Solution 3 for monitoring.

## Technical Details

**Affected Files:**

- `/Users/mikeyoung/CODING/MAIS/server/src/agent/customer/customer-booking-executor.ts:137`

**Related Components:**

- `ResourceNotFoundError` error class
- Customer chatbot tool calls

**Database Schema:** No changes required

## Acceptance Criteria

- [ ] Error message does not reveal actual customer ID
- [ ] Test: Attempt booking with another tenant's customer ID → generic error
- [ ] Test: Attempt booking with non-existent customer ID → same generic error
- [ ] Verify no behavioral difference between "not found" and "wrong tenant"
- [ ] Update unit tests to verify redacted error messages

## Work Log

| Date       | Action                          | Learnings                              |
| ---------- | ------------------------------- | -------------------------------------- |
| 2026-01-11 | Issue identified in code review | Customer ID leakage via error messages |

## Resources

- **Code Review Report:** Security Sentinel agent (ID: a9f11fa)
- **Related Pattern:** Security-as-obscurity for resource enumeration
- **Similar Issue:** Photo upload returns 403 (correct) vs 404 (obscurity)
- **OWASP Reference:** [Information Exposure](https://owasp.org/www-community/vulnerabilities/Information_exposure_through_query_strings_in_url)
