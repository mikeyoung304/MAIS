# Project Hub Token Validation - CustomerId Mismatch

---

title: Project Hub Token Validation - CustomerId Mismatch
category: authentication-issues
severity: P1-critical
component: public-project.routes.ts
symptom: 403 Forbidden on Project Hub redirect after Stripe payment
root_cause: Token generated with email, validated against CUID
resolution_time: 45 minutes
prevention_tags:

- token-auth
- identifier-consistency
- multi-field-validation
  related_files:
- server/src/routes/public-project.routes.ts
- server/src/services/booking.service.ts
- server/src/lib/project-tokens.ts
  commit: 9fa761d8
  date: 2025-01-25

---

## Problem Symptom

After completing Stripe checkout, customers were redirected to the Project Hub (`/t/{tenant}/project/{projectId}?token=...`) but received a **403 Forbidden** error. The page fell back to the success page with `?error=invalid_token`.

**User-visible behavior:**

- Complete payment successfully in Stripe
- Redirect to Project Hub fails with 403
- Customer sees generic success page instead of Project Hub
- No helpful error message explaining what went wrong

## Investigation Steps

### 1. Traced the redirect flow

```
Stripe checkout complete
  → Webhook processes payment
  → Project created in booking.service.ts
  → Customer redirected to /t/{tenant}/project/{projectId}?token=...
  → Token validation fails with 403
```

### 2. Examined token generation (booking.service.ts:534)

```typescript
// Project creation - customerId is set to EMAIL
const project = await this.prisma.project.create({
  data: {
    tenantId,
    bookingId: created.id,
    customerId: created.email, // <-- Email stored here
    status: 'ACTIVE',
  },
});
```

### 3. Examined token generation (project-tokens.ts)

```typescript
// Token generated with project.customerId (the email)
const accessToken = generateProjectAccessToken(
  project.id,
  tenantId,
  project.customerId, // <-- Email goes into token
  'view',
  30
);
```

### 4. Examined token validation (public-project.routes.ts - BEFORE fix)

```typescript
// Validation was comparing against booking.customer?.id (CUID!)
if (tokenResult.payload.customerId !== project.booking.customer?.id) {
  res.status(403).json({ error: 'Access denied' });
  return;
}
```

### 5. Identified the mismatch

| Component        | Field Used                     | Value Type | Example                |
| ---------------- | ------------------------------ | ---------- | ---------------------- |
| Token generation | `project.customerId`           | Email      | `customer@example.com` |
| Token validation | `project.booking.customer?.id` | CUID       | `clx123abc456def`      |

**Email !== CUID = Always fails**

## Root Cause

**Field type mismatch in token-based authentication.**

The `Project.customerId` field stores the customer's **email address** (a design decision made in `booking.service.ts` for simplicity). However, token validation was attempting to fetch the customer record via the `booking.customer` relation and compare against the customer record's **CUID** (`id` field).

This is a classic example of **inconsistent identifier usage** - a critical security pattern violation where generation and validation use different data sources.

## Working Solution

### Fix Applied (commit 9fa761d8)

Changed all 4 validation points in `public-project.routes.ts` to use `project.customerId` directly:

**Lines 305-311 (GET /:projectId)**

```typescript
// BEFORE (broken):
if (tokenResult.payload.customerId !== project.booking.customer?.id) {

// AFTER (fixed):
// Verify token's customer ID matches the project's customerId
// Note: project.customerId stores the email (set in booking.service.ts during project creation)
// Token is generated with project.customerId, so we must validate against the same field
if (tokenResult.payload.customerId !== project.customerId) {
```

**Lines 404-408 (GET /:projectId/timeline)**

```typescript
// BEFORE:
if (tokenResult.payload.customerId !== project.booking.customer?.id) {

// AFTER:
// Verify customer ID matches token (uses project.customerId which is the email)
if (tokenResult.payload.customerId !== project.customerId) {
```

**Lines 500-504 (POST /:projectId/chat/session)**

```typescript
// BEFORE:
if (tokenResult.payload.customerId !== project.booking.customer?.id) {

// AFTER:
// Verify customer ID matches token (uses project.customerId which is the email)
if (tokenResult.payload.customerId !== project.customerId) {
```

**Lines 597-601 (POST /:projectId/chat/message)**

```typescript
// BEFORE:
if (tokenResult.payload.customerId !== project.booking.customer?.id) {

// AFTER:
// Verify customer ID matches token (uses project.customerId which is the email)
if (tokenResult.payload.customerId !== project.customerId) {
```

### Key Insight

The fix is simple once you understand the data flow. The **critical insight** is that token generation and validation must use the **exact same identifier source**:

```
Token Generation:           project.customerId (email)
                                    ↓
Token Payload:              { customerId: "customer@example.com" }
                                    ↓
Token Validation:           project.customerId (email)  ← Must match!
```

## Prevention Strategies

### 1. Token Auth Consistency Checklist

When implementing token-based authentication, verify:

- [ ] **Same field** is used for both generation and validation
- [ ] **Document the field type** in code comments (email vs CUID vs UUID)
- [ ] **Add inline comments** at validation points explaining which field is being compared
- [ ] **Write integration tests** that exercise the full flow (generate → use → validate)

### 2. Code Pattern for Token Validation

```typescript
// PATTERN: Always document which field contains what
interface Project {
  id: string; // CUID - internal identifier
  customerId: string; // EMAIL - customer identifier for token auth
  // ... other fields
}

// At generation point:
const token = generateToken({
  customerId: project.customerId, // Email - used for token auth
});

// At validation point:
// IMPORTANT: project.customerId stores email, not CUID
// Token was generated with email, so validate against email
if (tokenPayload.customerId !== project.customerId) {
  return 403;
}
```

### 3. Future Refactoring Consideration

Long-term, consider renaming `Project.customerId` to `Project.customerEmail` to make the field type obvious:

```typescript
// Future migration (if prioritized):
// ALTER TABLE "Project" RENAME COLUMN "customerId" TO "customerEmail";
```

This would make the mismatch impossible to introduce accidentally.

### 4. Test Coverage

Add integration test that exercises full flow:

```typescript
describe('Project Hub access after payment', () => {
  it('should allow access with valid token after Stripe checkout', async () => {
    // 1. Create booking with payment
    const booking = await createBookingWithPayment(tenantId, customerEmail);

    // 2. Verify project was created
    const project = await prisma.project.findFirst({
      where: { bookingId: booking.id },
    });
    expect(project).toBeDefined();
    expect(project.customerId).toBe(customerEmail); // Verify it's email

    // 3. Generate token (simulates what success page does)
    const token = generateProjectAccessToken(project.id, tenantId, project.customerId);

    // 4. Access Project Hub with token
    const response = await request(app)
      .get(`/v1/public/projects/${project.id}?token=${token}`)
      .set('X-Tenant-Key', tenantApiKey);

    expect(response.status).toBe(200); // Should succeed, not 403
  });
});
```

## Related Issues

- **Pitfall #65**: Email-based auth on sensitive routes - similar pattern of identifier confusion
- **Pitfall #76**: Static config for tenant-specific URLs - related multi-tenant routing issue
- ADR-002: Webhook idempotency - related to payment flow reliability

## Cross-References

- `/docs/solutions/patterns/mais-critical-patterns.md` - Token validation patterns
- `/docs/solutions/security-issues/P1-SECURITY-PREVENTION-STRATEGIES.md` - Auth security patterns
- `/server/src/lib/booking-tokens.ts` - Similar token pattern for booking management

## Verification

After applying the fix:

1. Complete a Stripe checkout as a customer
2. Observe redirect to `/t/{tenant}/project/{projectId}?token=...`
3. Verify Project Hub loads successfully (no 403)
4. Verify customer can interact with Project Hub agent

## Lessons Learned

1. **Document identifier types** - When a field is named `customerId`, document whether it contains a CUID, UUID, email, or other identifier type
2. **Trace full data flow** - Before assuming validation is correct, trace the data from generation through storage to validation
3. **Add comments at validation points** - Future developers need to understand why a specific field is being compared
4. **Integration tests catch this** - Unit tests might miss this because they mock the wrong values; integration tests with real data would catch the mismatch
