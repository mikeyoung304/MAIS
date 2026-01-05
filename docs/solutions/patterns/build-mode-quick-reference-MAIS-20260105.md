---
slug: build-mode-quick-reference
date_discovered: 2026-01-05
severity: low
component: build-mode
tags: [quick-reference, agent-native, postmessage, draft-system]
---

# Build Mode Quick Reference

## 30-Second Decision Tree

```
Building an AI-assisted editor?
│
├─ Creating agent tools?
│  ├─ List ALL UI actions first
│  ├─ Create tool for EACH action
│  ├─ Extract schemas to shared module
│  └─ Assign trust tiers (T1=auto, T2=confirm, T3=user-confirm)
│
├─ Using PostMessage?
│  ├─ Define Zod schemas for ALL message types
│  ├─ Use parseMessage() - never type cast
│  ├─ Validate origin on EVERY handler
│  └─ Use discriminated unions
│
├─ Building draft system?
│  ├─ Define what goes to draft vs live
│  ├─ Document exceptions clearly
│  ├─ Add optimistic locking
│  └─ Authenticate preview URLs
│
└─ Ready for review?
   ├─ Run multi-agent review (5 parallel agents)
   ├─ Check agent parity (can agent do what user can?)
   └─ Verify DRY (no duplicate schemas)
```

## Trust Tier Assignments

| Risk Level | Trust Tier | Auto-Confirm?          | Examples                         |
| ---------- | ---------- | ---------------------- | -------------------------------- |
| Low        | T1         | Yes                    | Reorder, toggle visibility       |
| Medium     | T2         | Soft (show briefly)    | Update content, change branding  |
| High       | T3         | No (user must confirm) | Publish, delete, billing changes |

## PostMessage Pattern

```typescript
// ALWAYS validate before using
const message = parseChildMessage(event.data);
if (!message) return;

// Now safe to switch on type
switch (message.type) {
  case 'BUILD_MODE_READY': // ...
}
```

## Draft System Pattern

```typescript
// Read: Check draft first, fall back to live
const config = draft ?? live ?? DEFAULT_CONFIG;

// Write: Always to draft
await updateDraft(tenantId, newConfig);

// Publish: Copy draft to live, clear draft
await publish(tenantId); // draft → live, draft = null

// Discard: Clear draft
await discard(tenantId); // draft = null
```

## Agent Parity Checklist

Before shipping:

- [ ] User can publish via UI → Agent has `publish_draft` tool
- [ ] User can discard via UI → Agent has `discard_draft` tool
- [ ] User can see draft → Agent has `get_landing_page_draft` tool
- [ ] Every button has corresponding tool

## DRY Checklist

Before shipping:

- [ ] Zod schemas in ONE place (not tools AND executors)
- [ ] Helper functions in shared module
- [ ] Error formatting uses shared function

## File Locations

| Purpose        | Location                                             |
| -------------- | ---------------------------------------------------- |
| Shared schemas | `server/src/agent/schemas/storefront-schemas.ts`     |
| Tools          | `server/src/agent/tools/storefront-tools.ts`         |
| Executors      | `server/src/agent/executors/storefront-executors.ts` |
| Protocol       | `apps/web/src/lib/build-mode/protocol.ts`            |
| Components     | `apps/web/src/components/build-mode/`                |
| Hooks          | `apps/web/src/hooks/useBuildModeSync.ts`             |

## Common Mistakes

| Mistake                  | Fix                                             |
| ------------------------ | ----------------------------------------------- |
| Type casting PostMessage | Use `parseMessage()` with Zod                   |
| Duplicating schemas      | Extract to shared module                        |
| Missing agent tools      | Audit UI → create matching tools                |
| Branding bypasses draft  | Decide: add to draft OR document as intentional |
| No origin validation     | Add `if (!isSameOrigin(event.origin)) return;`  |

## See Also

- [Full patterns doc](./build-mode-storefront-editor-patterns-MAIS-20260105.md)
- [Agent-native design patterns](../agent-design/AGENT-NATIVE-DESIGN-PATTERNS.md)
- [Proposal execution flow](../logic-errors/chatbot-proposal-execution-flow-MAIS-20251229.md)
