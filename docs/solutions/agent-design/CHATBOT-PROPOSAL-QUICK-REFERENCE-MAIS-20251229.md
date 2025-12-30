---
module: MAIS
date: 2025-12-29
problem_type: quick_reference
component: agent/proposals
root_cause: institutional_knowledge
resolution_type: checklist
severity: P1
tags: [quick-reference, checklist, proposal-execution, circular-dependencies]
---

# Chatbot Proposal Execution Quick Reference

**Print and pin this checklist!**

---

## Before Adding New Trust Tier or State Transition

```
[ ] State transition has side effect (executor call, notification, etc.)
[ ] Error case updates status with error message
[ ] Multi-tenant: tenantId passed to all operations
[ ] Integration test covers happy path AND error path
```

---

## Before Adding Import to Agent Module

```
[ ] Check for circular dependency: npx madge --circular server/src/
[ ] Routes import services (not reverse)
[ ] Shared state goes in dedicated registry (not routes)
```

---

## Circular Dependency Detection

```bash
# Quick check
npx madge --circular server/src/

# Visual graph
npx madge --image graph.png server/src/agent/
```

---

## Proposal Lifecycle Verification

```
1. Tool creates proposal (PENDING)
   [ ] proposalId returned in tool result
   [ ] requiresApproval flag set correctly

2. Proposal confirmed (T2: auto, T3: user click)
   [ ] Status updates to CONFIRMED

3. Executor called
   [ ] getProposalExecutor(toolName) returns function
   [ ] executor(tenantId, payload) called

4. Status finalized
   [ ] Success → EXECUTED with result
   [ ] Failure → FAILED with errorMessage
```

---

## Field Mapping Checklist

```
[ ] DTO defined in packages/contracts/src/dto.ts
[ ] Canonical names: name (not title), basePrice (not priceCents)
[ ] Backend mapper uses canonical names
[ ] Executor accepts both old and new names (backward compat)
```

---

## Executor Registration Validation

Add to `server/src/index.ts`:

```typescript
import { getRegisteredExecutors } from './agent/proposals/executor-registry';

const REQUIRED_EXECUTORS = [
  'upsert_package',
  'delete_package',
  'book_service',
  // Add new tools here
];

const registered = getRegisteredExecutors();
const missing = REQUIRED_EXECUTORS.filter((t) => !registered.includes(t));
if (missing.length > 0) {
  throw new Error(`Missing executors: ${missing.join(', ')}`);
}
```

---

## Common Mistakes

| Mistake                           | Symptom                           | Fix                                |
| --------------------------------- | --------------------------------- | ---------------------------------- |
| Executor not registered           | Proposal stays CONFIRMED          | Add to registerAllExecutors()      |
| Executor not called after confirm | Status CONFIRMED but no DB change | Add execution loop in orchestrator |
| Wrong field name in DTO           | $NaN, blank values                | Use canonical names from contracts |
| Circular import                   | Runtime errors, undefined         | Extract to dedicated registry      |
| Missing tenantId in executor      | Cross-tenant execution            | Add tenantId to WHERE clause       |

---

## Test Commands

```bash
# Run proposal tests
npm test -- --grep "proposal"

# Run integration tests
npm run test:integration -- --grep "chatbot"

# Check circular deps
npx madge --circular server/src/
```

---

## Debug Logging Points

Enable with `LOG_LEVEL=debug`:

```
DEBUG: Proposal captured from tool result
  → toolName, proposalId, requiresApproval

DEBUG: Customer chat processResponse result
  → hasProposal, proposalId, toolNames

DEBUG: T2 proposals soft-confirmed by user message
  → tenantId, sessionId, proposalIds

DEBUG: Executing T2 soft-confirmed proposal
  → proposalId, toolName, tenantId
```

---

## ESLint Rules to Add

```json
{
  "rules": {
    "import/no-cycle": ["error", { "maxDepth": 5 }]
  }
}
```

---

**Full Guide:** [CHATBOT-PROPOSAL-EXECUTION-PREVENTION-STRATEGIES-MAIS-20251229.md](./CHATBOT-PROPOSAL-EXECUTION-PREVENTION-STRATEGIES-MAIS-20251229.md)

**Last Updated:** 2025-12-29
