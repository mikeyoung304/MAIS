# PR #23 P1 Fixes - ALL RESOLVED

**Status:** All items resolved as of 2026-01-20

## Security Issues

### SEC-1: Missing Customer Ownership on Proposal Confirmation [RESOLVED]

- **File:** `server/src/routes/public-customer-chat.routes.ts:296-316`
- **Status:** Already implemented. Code requires sessionId and includes it in the proposal query alongside tenantId.

### SEC-2: Session ID Not Validated at Route Level [RESOLVED]

- **File:** `server/src/routes/public-customer-chat.routes.ts:238-250`
- **Status:** Already implemented. Session validation occurs before orchestrator call with proper 400 error on invalid/expired sessions.

## Dead Code

### SIMP-1: Unused addDays() Function [RESOLVED]

- **File:** `server/src/agent/customer/customer-tools.ts`
- **Status:** Function not present in codebase (already removed or never existed).

### SIMP-2: Unused tenantSlug Prop [RESOLVED]

- **Files:** `apps/web/src/components/chat/CustomerChatWidget.tsx`, `TenantChatWidget.tsx`
- **Status:** Props already cleaned up. Neither file contains tenantSlug.

## Type Safety

### TS-1: Missing Stable Key Prop [RESOLVED]

- **File:** `apps/web/src/components/chat/CustomerChatWidget.tsx`
- **Status:** ChatMessage interface already has `id: string` and all message creations use `crypto.randomUUID()`.

### TS-2: as any for tenantId [RESOLVED]

- **File:** `server/src/types/express.d.ts`
- **Status:** Express Request type already extended with `tenantId?: string`.
