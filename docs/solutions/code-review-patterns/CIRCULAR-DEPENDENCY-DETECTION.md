---
module: MAIS
date: 2025-12-28
problem_type: prevention_strategy
component: agent/customer
severity: P1
related_commit: e2d6545
tags: [circular-dependencies, architecture, module-design, registry-pattern]
---

# Quick Reference: Circular Dependency Detection & Prevention

## What It Looks Like

```typescript
// ❌ CIRCULAR: File A imports B, B imports A
// customer-booking-executor.ts
import { registerCustomerProposalExecutor } from '../../routes/public-customer-chat.routes';

// public-customer-chat.routes.ts
import { registerCustomerBookingExecutor } from '../agent/customer';
```

## Impact

- **Build Fails:** Cannot resolve module references
- **Runtime Error:** Undefined exports at startup
- **Hard to Debug:** Error messages are cryptic
- **Can't Tree-Shake:** Bundlers can't optimize

## Quick Fix (3 Steps)

### Step 1: Create Registry Module

```typescript
// server/src/agent/customer/executor-registry.ts
// ✅ ZERO imports from other agent modules

export type CustomerProposalExecutor = (
  tenantId: string,
  customerId: string,
  payload: Record<string, unknown>
) => Promise<Record<string, unknown>>;

const customerProposalExecutors = new Map<string, CustomerProposalExecutor>();

export function registerCustomerProposalExecutor(
  operation: string,
  executor: CustomerProposalExecutor
): void {
  customerProposalExecutors.set(operation, executor);
}

export function getCustomerProposalExecutor(
  operation: string
): CustomerProposalExecutor | undefined {
  return customerProposalExecutors.get(operation);
}
```

### Step 2: Update Executor

```typescript
// ✅ Import from registry, not routes
import { registerCustomerProposalExecutor } from './executor-registry';

export function registerCustomerBookingExecutor(prisma: PrismaClient): void {
  registerCustomerProposalExecutor('create_customer_booking', async (...) => {
    // implementation
  });
}
```

### Step 3: Update Routes

```typescript
// ✅ Import from registry, not executor
import { getCustomerProposalExecutor } from '../agent/customer/executor-registry';

const executor = getCustomerProposalExecutor(proposal.operation);
```

## Detection Commands

```bash
# Check for circular warnings
npm ls

# Visualize dependencies
npm install -D madge
npx madge --extensions ts --circular server/src

# Check specific file
npx madge --extensions ts server/src/agent/customer/executor-registry.ts
```

## Design Pattern: Registry

```
┌─────────────────────────────────────┐
│  Executor Registry Module           │
│  (No imports from other modules)    │
│  - Type definitions                 │
│  - Map<string, Executor>            │
│  - register()                       │
│  - get()                            │
└─────────────────────────────────────┘
        ▲                    ▲
        │ imports            │ imports
        │                    │
┌───────┴──────────┐  ┌──────┴────────────┐
│ Executor         │  │ Routes            │
│ (registers)      │  │ (looks up)        │
└──────────────────┘  └───────────────────┘
```

## Checklist for Review

- [ ] Registry module has NO imports from other agent modules?
- [ ] Executor imports registry (not routes)?
- [ ] Routes import registry (not executor)?
- [ ] `npm ls` runs without circular warnings?
- [ ] `npx madge --circular` shows no results?

## Pre-Commit Hook

```bash
#!/bin/sh
# .husky/pre-commit

echo "Checking for circular dependencies..."
npx madge --extensions ts --circular server/src || {
  echo "❌ Circular dependency detected!"
  exit 1
}

echo "✅ No circular dependencies"
```

## Common Mistakes

| Mistake                         | Problem                | Fix                     |
| ------------------------------- | ---------------------- | ----------------------- |
| Registry imports executor       | Still circular         | Only types in registry  |
| Routes directly import executor | Tight coupling         | Use registry            |
| Multiple registries             | Fragmented state       | One registry per domain |
| Registry in routes file         | Can't be imported back | Extract to own module   |

---

**Use This Document:** When adding a new executor or changing module structure
**Related:** PR-23-PREVENTION-STRATEGIES.md - Issue #1
