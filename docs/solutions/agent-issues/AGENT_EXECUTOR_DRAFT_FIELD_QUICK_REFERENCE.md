# Agent Executor Draft Field + Context Loss - Quick Reference

**Print this. Pin it. 2 minutes.**

---

## The Two Bugs

| Bug              | File                      | Line     | Wrong                | Correct                           |
| ---------------- | ------------------------- | -------- | -------------------- | --------------------------------- |
| Backend field    | `onboarding-executors.ts` | 193, 228 | `landingPageConfig`  | `landingPageConfigDraft`          |
| Frontend history | `useAgentChat.ts`         | 224-231  | Always show greeting | Check for existing messages first |

---

## Symptom → Cause Decision Tree

```
Agent says "updated" but preview unchanged?
├── YES → Check executor writes to landingPageConfigDraft (not landingPageConfig)
│
Tab switch resets conversation?
├── YES → Check useAgentChat loads data.messages before setting greeting
│
Backend session empty?
├── NO → Frontend is discarding it (not backend issue)
```

---

## The Fix (Copy-Paste)

### Backend (onboarding-executors.ts)

```typescript
// Line 193: CHANGE THIS
select: { landingPageConfigDraft: true }  // was: landingPageConfig

// Line 228: CHANGE THIS
tenantUpdates.landingPageConfigDraft = { ... }  // was: landingPageConfig
```

### Frontend (useAgentChat.ts)

```typescript
// Replace lines 224-231 with:
if (data.messages && data.messages.length > 0) {
  setMessages(
    data.messages.map((m) => ({
      role: m.role,
      content: m.content,
      timestamp: new Date(m.timestamp || Date.now()),
    }))
  );
} else {
  setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
}
```

---

## Unit Test Must-Have

```typescript
it('writes to landingPageConfigDraft', async () => {
  await executeUpdateStorefront(mockPrisma, tenantId, payload);

  const call = mockPrisma.tenant.update.mock.calls[0][0];
  expect(call.data).toHaveProperty('landingPageConfigDraft'); // ✅
  expect(call.data).not.toHaveProperty('landingPageConfig'); // ✅
});
```

---

## Pre-Merge Checklist

- [ ] Executor reads from `landingPageConfigDraft`
- [ ] Executor writes to `landingPageConfigDraft`
- [ ] Unit test asserts correct field name
- [ ] Frontend checks `data.messages.length > 0` before greeting
- [ ] `hasDraft: true` returned after draft writes

---

## Golden Rules

1. **Draft fields for AI tools**: `landingPageConfigDraft`, not `landingPageConfig`
2. **Check history before greeting**: `if (data.messages?.length > 0)`
3. **Backend is unified**: One session per tenant - don't create separate sessions
4. **Test the field name**: Not just "it works" but "it writes to correct field"

---

**Full doc:** `docs/solutions/agent-issues/agent-executor-draft-field-context-loss-MAIS-20260110.md`
