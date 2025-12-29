# PR #23 P2 Fixes (Should Fix Soon)

## Performance (High Priority)

### PERF-1: Verify Rate Limiter Application

- **File:** `server/src/routes/index.ts`
- **Issue:** Confirm `customerChatLimiter` is applied to routes
- **Verify:** Check route mounting includes limiter middleware

### PERF-2: Cache buildBusinessContext()

- **File:** `server/src/agent/customer/customer-orchestrator.ts:246,559`
- **Issue:** Called multiple times per request (2-6 DB queries)
- **Fix:** Cache result at start of `chat()` and pass through

### PERF-3: Add Missing Session Lookup Index

- **File:** New migration needed
- **Issue:** Queries use `(tenantId, sessionType, updatedAt)` but index doesn't exist
- **Fix:**

```sql
CREATE INDEX IF NOT EXISTS "AgentSession_tenantId_sessionType_updatedAt_idx"
ON "AgentSession"("tenantId", "sessionType", "updatedAt" DESC);
```

## Data Integrity

### SEC-3: Add Tenant Filter to Customer Lookup

- **File:** `server/src/agent/customer/customer-booking-executor.ts:84-89`
- **Issue:** `findUnique` by id doesn't include tenantId
- **Fix:** Change to `findFirst` with tenantId:

```typescript
const customer = await tx.customer.findFirst({
  where: { id: customerId, tenantId },
});
```

### DATA-1: Two-Step Proposal Creation

- **File:** `server/src/agent/customer/customer-tools.ts:356-384`
- **Issue:** Proposal created, then updated with customerId (crash window)
- **Fix:** Wrap in transaction or pass customerId to createProposal

### DATA-2: Create Rollback Script

- **File:** `server/prisma/migrations/16_add_customer_chat_support_rollback.sql`
- **Content:**

```sql
ALTER TABLE "AgentSession" DROP COLUMN IF EXISTS "sessionType";
ALTER TABLE "AgentSession" DROP COLUMN IF EXISTS "customerId";
ALTER TABLE "AgentProposal" DROP COLUMN IF EXISTS "customerId";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "chatEnabled";
DROP INDEX IF EXISTS "AgentSession_customerId_updatedAt_idx";
DROP INDEX IF EXISTS "AgentProposal_customerId_idx";
```

## Architecture

### ARCH-1: Fix Circular Dependency

- **File:** `server/src/agent/customer/customer-booking-executor.ts:9`
- **Issue:** Imports from routes creates circular dependency
- **Fix:** Move executor registry to separate module

### ARCH-2: Session Isolation

- **File:** `server/src/agent/customer/customer-orchestrator.ts:133-167`
- **Issue:** Multiple customers could share sessions within TTL
- **Fix:** Add client-side session UUID or always create new sessions

## Code Quality

### SIMP-3: Extract chatEnabled Check

- **File:** `server/src/routes/public-customer-chat.routes.ts:172,227`
- **Issue:** Same check repeated 3 times
- **Fix:** Create `requireChatEnabled` middleware

### SIMP-4: Remove Unused businessSlug

- **File:** `server/src/agent/customer/customer-orchestrator.ts:58,83,163,186,223`
- **Fix:** Remove from interfaces and all assignments

### SIMP-5: Consider Shared Formatters

- **File:** `server/src/agent/customer/customer-tools.ts:27-42`
- **Issue:** formatMoney/formatDate duplicated
- **Options:** Extract to shared utils or accept for MVP

## Type Safety

### TS-3: Type JSON Responses

- **File:** `apps/web/src/components/chat/CustomerChatWidget.tsx`
- **Fix:** Define response schemas with Zod

### TS-4: Validate Request Body

- **File:** `server/src/routes/public-customer-chat.routes.ts:214`
- **Fix:** Add Zod validation for message endpoint

### TS-5: Type Tool Parameters

- **File:** `server/src/agent/customer/customer-tools.ts`
- **Fix:** Create typed parameter validators
