# PR #23 P1 Fixes (Required Before Merge)

## Security Issues

### SEC-1: Missing Customer Ownership on Proposal Confirmation

- **File:** `server/src/routes/public-customer-chat.routes.ts:289-295`
- **Issue:** Proposal confirmation only validates tenantId, not customer ownership
- **Fix:** Add sessionId or customerId validation:

```typescript
const proposal = await prisma.agentProposal.findFirst({
  where: {
    id: proposalId,
    tenantId,
    sessionId: actualSessionId, // Add session isolation
  },
});
```

### SEC-2: Session ID Not Validated at Route Level

- **File:** `server/src/routes/public-customer-chat.routes.ts:237-245`
- **Issue:** sessionId from client not validated before passing to orchestrator
- **Fix:** Add explicit session validation:

```typescript
if (sessionId) {
  const session = await orchestrator.getSession(tenantId, sessionId);
  if (!session) {
    res.status(400).json({ error: 'Invalid or expired session' });
    return;
  }
}
```

## Dead Code

### SIMP-1: Unused addDays() Function

- **File:** `server/src/agent/customer/customer-tools.ts:47-51`
- **Fix:** Delete lines 47-51

### SIMP-2: Unused tenantSlug Prop

- **File:** `apps/web/src/components/chat/CustomerChatWidget.tsx:53,74`
- **Fix:** Remove from interface and function signature
- **Also update:** `apps/web/src/components/chat/TenantChatWidget.tsx`

## Type Safety

### TS-1: Missing Stable Key Prop

- **File:** `apps/web/src/components/chat/CustomerChatWidget.tsx:344`
- **Issue:** Using array index as React key
- **Fix:** Add UUID to ChatMessage interface:

```typescript
interface ChatMessage {
  id: string; // Add this
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Generate when creating message
const userMessage: ChatMessage = {
  id: crypto.randomUUID(),
  ...
};
```

### TS-2: as any for tenantId

- **File:** `server/src/routes/public-customer-chat.routes.ts:58`
- **Fix:** Extend Express Request type:

```typescript
// In types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      tenantId?: string;
    }
  }
}
```
