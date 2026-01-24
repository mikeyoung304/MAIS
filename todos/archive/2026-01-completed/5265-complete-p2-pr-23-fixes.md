# PR #23 P2 Fixes - COMPLETE

**Status:** 14/14 items resolved ✅ as of 2026-01-21

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

### ARCH-2: Session Isolation [RESOLVED]

- **File:** `server/src/agent/orchestrator/customer-chat-orchestrator.ts`
- **Issue:** Multiple customers could share sessions within TTL
- **Fix:** Overrode `getOrCreateSession()` in CustomerChatOrchestrator to always create new isolated sessions instead of reusing existing ones

## Code Quality

### SIMP-3: Extract chatEnabled Check [RESOLVED]

- **File:** `server/src/routes/public-customer-chat.routes.ts:46-71`
- **Status:** Created `createRequireChatEnabled` middleware factory and applied to `/session` and `/message` routes.

### SIMP-4: Remove Unused businessSlug [RESOLVED]

- **Files:** `apps/web/src/hooks/useAgentChat.ts`, `server/src/routes/agent.routes.ts`
- **Status:** Removed from external API contract (SessionContext interface and session response). Internal LLM context still uses it intentionally.

### SIMP-5: Shared Formatters [RESOLVED]

- **Files:** `server/src/agent/tools/utils.ts`, `server/src/agent/customer/customer-tools.ts`
- **Issue:** formatMoney/formatDate duplicated across files
- **Fix:** Added `formatDateDisplay()` to utils.ts; updated customer-tools.ts to import `formatPrice` and `formatDateDisplay` from shared utils instead of local duplicates

## Type Safety

### TS-3: Type JSON Responses [RESOLVED]

- **File:** `apps/web/src/components/chat/CustomerChatWidget.tsx`
- **Status:** Added Zod schemas for health, session, message, and confirm endpoint responses

### TS-4: Validate Request Body [RESOLVED]

- **File:** `server/src/routes/public-customer-chat.routes.ts`
- **Status:** Added `MessageRequestSchema` and `ConfirmRequestSchema` with Zod validation

### TS-5: Type Tool Parameters [RESOLVED]

- **File:** `server/src/agent/customer/customer-tools.ts`
- **Status:** Added typed parameter validators for all customer tools (get_services, check_availability, book_service, confirm_proposal, get_business_info)
