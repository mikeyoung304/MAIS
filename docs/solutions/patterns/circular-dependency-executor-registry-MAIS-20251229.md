---
title: Circular Import Between Route Handler and Orchestrator
category: patterns
severity: high
component: server/src/agent/orchestrator/orchestrator.ts
date: 2025-12-29
symptoms:
  - TypeScript compilation fails with circular dependency error
  - "Cannot access 'X' before initialization" runtime error
  - Module imports resolve to undefined
root_cause: Orchestrator needed executor lookup function defined in routes, while routes imported orchestrator class
solution_pattern: Extract shared dependency into separate registry module
tags: [circular-dependency, module-architecture, typescript, dependency-injection, executor-pattern]
---

# Circular Dependency Resolution: Executor Registry Pattern

## Problem

When building the customer chatbot feature, we encountered a circular dependency:

```
orchestrator.ts
    ↓ imports
agent.routes.ts (for getProposalExecutor)
    ↓ imports
orchestrator.ts (for AgentOrchestrator class)
    ↓ CYCLE!
```

**Symptoms:**

- TypeScript compilation succeeds but runtime fails
- `Cannot access 'AgentOrchestrator' before initialization`
- Imported functions resolve to `undefined`

## Root Cause

The orchestrator needed to call `getProposalExecutor()` to execute T2 proposals after soft-confirmation. This function was defined in `agent.routes.ts` alongside the executor registrations. But `agent.routes.ts` imports `AgentOrchestrator` to instantiate it for route handlers.

## Solution: Extract Shared State to Registry Module

Create a third module that both can import without creating a cycle:

**File:** `server/src/agent/proposals/executor-registry.ts`

```typescript
/**
 * Proposal Executor Registry
 *
 * Centralized registry for proposal executors.
 * Extracted to its own module to avoid circular dependencies between:
 * - agent.routes.ts (needs AgentOrchestrator)
 * - orchestrator.ts (needs getProposalExecutor)
 * - executors/index.ts (registers executors)
 */

export type ProposalExecutor = (
  tenantId: string,
  payload: Record<string, unknown>
) => Promise<Record<string, unknown>>;

const proposalExecutors = new Map<string, ProposalExecutor>();

export function registerProposalExecutor(toolName: string, executor: ProposalExecutor): void {
  proposalExecutors.set(toolName, executor);
}

export function getProposalExecutor(toolName: string): ProposalExecutor | undefined {
  return proposalExecutors.get(toolName);
}

export function hasProposalExecutor(toolName: string): boolean {
  return proposalExecutors.has(toolName);
}

export function getRegisteredExecutors(): string[] {
  return Array.from(proposalExecutors.keys());
}
```

**Updated import structure:**

```
executor-registry.ts (no imports from agent modules)
    ↑ imports           ↑ imports
orchestrator.ts      agent.routes.ts
                          ↑ imports
                     orchestrator.ts (no cycle!)
```

## When to Apply This Pattern

Use the registry module pattern when:

1. **Two modules need shared state** - A Map, Set, or configuration object
2. **They also have a parent-child import relationship** - One instantiates the other
3. **The shared state has no dependencies** - Can be extracted cleanly

## Detection

Run circular dependency detection before it causes runtime issues:

```bash
npx madge --circular server/src/
```

Add to CI pipeline:

```yaml
- name: Check circular dependencies
  run: npx madge --circular --extensions ts server/src/ && echo "No cycles found"
```

## Prevention

1. **Registry modules should have zero internal imports** - Only external dependencies
2. **Keep registries focused** - One registry per concern (executors, handlers, etc.)
3. **Document the pattern** - Comment why the registry exists

```typescript
/**
 * Why this file exists:
 * Breaks circular dependency between orchestrator.ts ↔ agent.routes.ts
 * Both need access to executor registry without importing each other.
 */
```

## Related Documentation

- [ADR-006: Modular Monolith Architecture](../../adrs/ADR-006-modular-monolith-architecture.md)
- [CIRCULAR-DEPENDENCY-DETECTION.md](../code-review-patterns/CIRCULAR-DEPENDENCY-DETECTION.md)
- [PR-23 Prevention Strategies](../code-review-patterns/PR-23-PREVENTION-STRATEGIES.md)

## Key Insight

The registry pattern is essentially dependency injection for shared state. Instead of modules directly depending on each other, they both depend on a shared abstraction (the registry). This follows the Dependency Inversion Principle at the module level.
