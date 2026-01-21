# PR #23 P2 Fixes - MOSTLY RESOLVED

**Status:** 12/14 items resolved as of 2026-01-21

## Performance (High Priority)

### PERF-1: Verify Rate Limiter Application [RESOLVED]

- **File:** `server/src/routes/index.ts:728-736`
- **Status:** Verified. `customerChatLimiter` is properly imported and applied to `/v1/public/chat` routes.

### PERF-2: Cache buildBusinessContext() [RESOLVED]

- **File:** `server/src/agent/orchestrator/base-orchestrator.ts`
- **Status:** Implemented. Added 60-second TTL cache to `loadTenantData()` with periodic cleanup.

### PERF-3: Add Missing Session Lookup Index [RESOLVED]

- **File:** `server/prisma/schema.prisma:885`
- **Status:** Index already exists: `@@index([tenantId, sessionType, updatedAt])` with comment `#530: getOrCreateSession queries all 3 fields`

## Data Integrity

### SEC-3: Add Tenant Filter to Customer Lookup [RESOLVED]

- **File:** `server/src/agent/customer/customer-booking-executor.ts:132-134`
- **Status:** Already uses `findFirst` with `{ id: customerId, tenantId }`.

### DATA-1: Two-Step Proposal Creation [RESOLVED]

- **File:** `server/src/agent/customer/customer-tools.ts`, `server/src/agent/proposals/proposal.service.ts`
- **Status:** Fixed. `createProposal` now accepts `customerId` directly, eliminating the separate update step.

### DATA-2: Create Rollback Script [SKIPPED - ANTI-PATTERN]

- **Status:** SKIPPED per CLAUDE.md pitfall #59
- **Reason:** Migration rollback files run AFTER the original alphabetically, undoing changes and causing schema drift. Use forward-only migrations instead.

## Architecture

### ARCH-1: Fix Circular Dependency [RESOLVED]

- **File:** `server/src/agent/customer/executor-registry.ts`
- **Status:** Already fixed. Imports from `./executor-registry` not routes. See `docs/solutions/patterns/circular-dependency-executor-registry-MAIS-20251229.md`.

### ARCH-2: Session Isolation [PENDING]

- **File:** `server/src/agent/customer/customer-orchestrator.ts:133-167`
- **Issue:** Multiple customers could share sessions within TTL
- **Fix:** Add client-side session UUID or always create new sessions

## Code Quality

### SIMP-3: Extract chatEnabled Check [RESOLVED]

- **File:** `server/src/routes/public-customer-chat.routes.ts:46-71`
- **Status:** Created `createRequireChatEnabled` middleware factory and applied to `/session` and `/message` routes.

### SIMP-4: Remove Unused businessSlug [RESOLVED]

- **Files:** `apps/web/src/hooks/useAgentChat.ts`, `server/src/routes/agent.routes.ts`
- **Status:** Removed from external API contract (SessionContext interface and session response). Internal LLM context still uses it intentionally.

### SIMP-5: Consider Shared Formatters [PENDING - LOW PRIORITY]

- **File:** `server/src/agent/customer/customer-tools.ts:27-42`
- **Issue:** formatMoney/formatDate duplicated
- **Options:** Extract to shared utils or accept for MVP

## Type Safety

### TS-3: Type JSON Responses [PENDING]

- **File:** `apps/web/src/components/chat/CustomerChatWidget.tsx`
- **Fix:** Define response schemas with Zod

### TS-4: Validate Request Body [PENDING]

- **File:** `server/src/routes/public-customer-chat.routes.ts:214`
- **Fix:** Add Zod validation for message endpoint

### TS-5: Type Tool Parameters [PENDING]

- **File:** `server/src/agent/customer/customer-tools.ts`
- **Fix:** Create typed parameter validators
