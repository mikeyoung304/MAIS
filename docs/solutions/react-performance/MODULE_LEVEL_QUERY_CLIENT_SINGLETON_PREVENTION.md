---
module: MAIS
date: 2026-01-26
problem_type: react_antipattern
component: apps/web/src/hooks
symptoms:
  - Cache invalidation silently fails after HMR
  - UI shows stale data after agent tool executes
  - Second component mount overwrites first component's QueryClient
  - SSR hydration mismatch warnings
root_cause: Module-level mutable state for React Query client reference
resolution_type: prevention_strategy
severity: P2
tags: [react-query, tanstack-query, singleton, hmr, ssr, antipattern, prevention]
pitfall_number: 86
---

# Module-Level QueryClient Singleton Prevention

**Pitfall #86:** Using module-level mutable variables to store React Query's `QueryClient` reference, then calling cache methods from non-React code.

---

## Quick Reference Card

```typescript
// ANTI-PATTERN - Module-level singleton
let queryClientRef: QueryClient | null = null;

export const setQueryClientRef = (client: QueryClient): void => {
  queryClientRef = client; // Set via useEffect - FRAGILE!
};

export const invalidateCache = (): void => {
  queryClientRef?.invalidateQueries({ queryKey: ['data'] });
  // Silently fails if called before setQueryClientRef
  // Stale reference if HMR replaces QueryClient
};

// CORRECT - Use React's context system
const queryClient = useQueryClient(); // Always current
queryClient.invalidateQueries({ queryKey: ['data'] });
```

---

## Problem Statement

### The Bug

Using a module-level `queryClientRef` variable that gets set via `useEffect`, then calling it from other components or external code (like agent tool handlers).

### Why It Fails

1. **React effects run in unpredictable order** - Component A's effect may call `setQueryClientRef()` AFTER Component B tries to use `invalidateCache()`
2. **HMR can reset module state** - Development hot reload creates a new QueryClient, but the module-level ref still points to the old (disconnected) one
3. **SSR hydration can cause mismatches** - Server render has no QueryClient; client hydration creates one; timing varies
4. **Multiple providers** - If the app has multiple `QueryClientProvider` (rare but possible), the singleton only stores one

### Symptoms

- Cache invalidation works 90% of the time, fails mysteriously sometimes
- After HMR, UI shows stale data even after mutations
- Console shows: `[useDraftConfig] Cannot invalidate - query client not set`
- Only first user action after page load fails; subsequent actions work
- Hard to reproduce in production; common in development

---

## Root Cause Analysis

```typescript
// apps/web/src/hooks/useDraftConfig.ts (lines 270-300)

// Module-level singleton - this is the problem
let queryClientRef: QueryClient | null = null;

// Called from a useEffect - ORDER NOT GUARANTEED
export const setQueryClientRef = (client: QueryClient): void => {
  queryClientRef = client;
};

// Called from agent tool handlers - OUTSIDE React
export const invalidateDraftConfig = (): void => {
  if (queryClientRef) {
    queryClientRef.invalidateQueries({
      queryKey: DRAFT_CONFIG_QUERY_KEY,
      refetchType: 'active',
    });
  } else {
    // Silent failure! Caller has no idea this didn't work
    logger.warn('[useDraftConfig] Cannot invalidate - query client not set');
  }
};
```

**Why the timing is fragile:**

```
Timeline 1 (Works):
  Layout mounts → setQueryClientRef(client) → Tool executes → invalidateDraftConfig() ✓

Timeline 2 (Fails - effect order):
  Layout mounts → Tool executes → invalidateDraftConfig() → setQueryClientRef(client)
                                  ^ null! Silent failure

Timeline 3 (Fails - HMR):
  setQueryClientRef(oldClient) → HMR creates newClient → invalidateDraftConfig()
                                                         ^ oldClient is disconnected!
```

---

## Solution Patterns

### Pattern 1: Pass invalidation as callback (Recommended for component-to-component)

```typescript
// AgentPanel.tsx - The component handling agent tool responses
export function AgentPanel({ onInvalidate }: { onInvalidate: () => void }) {
  const handleToolComplete = useCallback((result: ToolResult) => {
    if (result.toolName.includes('update_section')) {
      onInvalidate();  // Parent controls invalidation
    }
  }, [onInvalidate]);

  return <AgentChat onToolComplete={handleToolComplete} />;
}

// Parent component - has access to QueryClient via context
function Dashboard() {
  const queryClient = useQueryClient();

  const invalidateDraft = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['draft-config'] });
  }, [queryClient]);

  return <AgentPanel onInvalidate={invalidateDraft} />;
}
```

### Pattern 2: Global QueryClient instance (Recommended for external code)

Create the QueryClient OUTSIDE React, making it truly global:

```typescript
// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

// Created at module load time - always available
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 5 * 60_000,
    },
  },
});

// Safe to call from anywhere - this IS the canonical client
export function invalidateDraftConfig(): void {
  queryClient.invalidateQueries({ queryKey: ['draft-config'] });
}
```

```typescript
// app/providers.tsx
import { queryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  // Use the same instance - no ref dance needed
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Pattern 3: Event-based communication (Recommended for decoupled systems)

```typescript
// lib/events.ts
type CacheInvalidationEvent = { queryKey: readonly string[] };
const eventTarget = new EventTarget();

export function emitCacheInvalidation(queryKey: readonly string[]): void {
  eventTarget.dispatchEvent(new CustomEvent('cache-invalidate', { detail: { queryKey } }));
}

export function onCacheInvalidation(handler: (event: CacheInvalidationEvent) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent).detail);
  eventTarget.addEventListener('cache-invalidate', listener);
  return () => eventTarget.removeEventListener('cache-invalidate', listener);
}
```

```typescript
// In a React component - listens for events
function CacheInvalidationListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    return onCacheInvalidation(({ queryKey }) => {
      queryClient.invalidateQueries({ queryKey });
    });
  }, [queryClient]);

  return null;
}

// In agent tool handler - emits events
async function handleToolResult(result: ToolResult) {
  if (result.toolName.includes('update_section')) {
    emitCacheInvalidation(['draft-config']);
  }
}
```

---

## When Module-Level State IS Acceptable

Module-level singletons are acceptable when:

| Scenario                       | Why It's OK               | Example                               |
| ------------------------------ | ------------------------- | ------------------------------------- |
| **Read-only configuration**    | Never changes             | `const API_URL = process.env.API_URL` |
| **Pure utilities**             | No state                  | `export function formatDate(d: Date)` |
| **Idempotent initialization**  | Multiple calls are safe   | Prisma client singleton               |
| **Explicit lifecycle control** | You control when it's set | SDK clients initialized at app start  |

Module-level singletons are **NOT** acceptable when:

| Scenario                    | Why It's Risky             | Example              |
| --------------------------- | -------------------------- | -------------------- |
| **Set from React effects**  | Effect order unpredictable | `let queryClientRef` |
| **Needs React context**     | Context can change         | `let routerRef`      |
| **HMR-sensitive**           | Module reloads lose state  | Mutable caches       |
| **Server/client different** | SSR has no client state    | `let windowRef`      |

### Decision Tree

```
Is it set from a React effect or callback?
├── YES → DO NOT use module-level singleton
│         Use: useQueryClient(), props, or events
│
└── NO → Is it set once at app initialization?
    ├── YES → Is it read-only after init?
    │   ├── YES → OK to use module-level
    │   └── NO → Risky - consider alternatives
    │
    └── NO → DO NOT use module-level singleton
```

---

## Code Review Checklist Item

Add to PR review checklist:

```markdown
## React State Patterns

- [ ] **No module-level React refs** - Check for `let someRef: SomeReactType | null = null` patterns
  - QueryClient refs → Use `useQueryClient()` or global instance in `lib/query-client.ts`
  - Router refs → Use `useRouter()` hook
  - Any ref set via useEffect → Refactor to callback/props pattern
- [ ] **Cache invalidation from external code** - If calling `queryClient.invalidateQueries()` from non-React code (agent handlers, event listeners), verify the queryClient is the global instance, not a ref captured from a hook
```

---

## ESLint Rule Suggestion

Create a custom ESLint rule to detect this pattern:

```javascript
// eslint-rules/no-module-level-react-refs.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow module-level variables for React Query/Router refs',
      category: 'Possible Errors',
    },
    messages: {
      noModuleLevelRef: 'Module-level {{ type }} ref is fragile. Use {{ alternative }} instead.',
    },
    schema: [],
  },
  create(context) {
    return {
      VariableDeclaration(node) {
        // Only check module-level declarations
        if (node.parent.type !== 'Program') return;

        for (const decl of node.declarations) {
          if (!decl.id.typeAnnotation) continue;

          const typeText = context.getSourceCode().getText(decl.id.typeAnnotation);

          // Detect QueryClient refs
          if (typeText.includes('QueryClient')) {
            context.report({
              node: decl,
              messageId: 'noModuleLevelRef',
              data: {
                type: 'QueryClient',
                alternative: 'useQueryClient() hook or global instance in lib/query-client.ts',
              },
            });
          }

          // Detect Router refs
          if (typeText.includes('NextRouter') || typeText.includes('AppRouterInstance')) {
            context.report({
              node: decl,
              messageId: 'noModuleLevelRef',
              data: {
                type: 'Router',
                alternative: 'useRouter() hook',
              },
            });
          }
        }
      },
    };
  },
};
```

**Add to `.eslintrc.js`:**

```javascript
module.exports = {
  rules: {
    'local/no-module-level-react-refs': 'error',
  },
};
```

---

## Testing for This Pattern

### Unit Test: Verify invalidation works after simulated HMR

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';

describe('QueryClient singleton pattern', () => {
  it('should handle QueryClient replacement (simulates HMR)', async () => {
    // Create first client (pre-HMR)
    const oldClient = new QueryClient();

    // Set up some cached data
    oldClient.setQueryData(['draft-config'], { pages: { home: true } });

    // Create second client (post-HMR)
    const newClient = new QueryClient();

    // WRONG: Module-level ref still points to oldClient
    // invalidateDraftConfig() would try to invalidate oldClient
    // but newClient is what's actually being used

    // CORRECT: Using useQueryClient() always gets the current provider's client
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={newClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useQueryClient(), { wrapper });

    expect(result.current).toBe(newClient);
    expect(result.current).not.toBe(oldClient);
  });
});
```

### E2E Test: Verify cache invalidation after tool execution

```typescript
test('agent tool should invalidate draft config cache', async ({ page }) => {
  // Navigate to dashboard
  await page.goto('/tenant/dashboard');

  // Capture initial draft state
  const initialPreview = await page.locator('[data-testid="preview-panel"]').textContent();

  // Trigger agent tool that modifies draft
  await page.fill('[data-testid="agent-input"]', 'Change the headline to "New Title"');
  await page.click('[data-testid="agent-send"]');

  // Wait for tool execution
  await page.waitForSelector('[data-testid="tool-complete"]');

  // Verify preview updated (cache was invalidated)
  await expect(page.locator('[data-testid="preview-panel"]')).toContainText('New Title');

  // Verify NO stale data warning in console
  const consoleLogs = await page.evaluate(() => (window as any).__consoleLogs || []);
  expect(consoleLogs).not.toContain(
    expect.stringMatching(/Cannot invalidate.*query client not set/)
  );
});
```

---

## Migration Path

If you have existing code using the singleton pattern:

### Step 1: Create global QueryClient

```typescript
// lib/query-client.ts (NEW FILE)
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, gcTime: 5 * 60_000, refetchOnWindowFocus: false },
  },
});
```

### Step 2: Update providers

```diff
// app/providers.tsx
+ import { queryClient } from '@/lib/query-client';

export function Providers({ children }) {
- const [queryClient] = useState(() => new QueryClient({...}));
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Step 3: Update external invalidation calls

```diff
// hooks/useDraftConfig.ts

- let queryClientRef: QueryClient | null = null;
-
- export const setQueryClientRef = (client: QueryClient): void => {
-   queryClientRef = client;
- };
-
- export const invalidateDraftConfig = (): void => {
-   if (queryClientRef) {
-     queryClientRef.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
-   }
- };

+ import { queryClient } from '@/lib/query-client';
+
+ export const invalidateDraftConfig = (): void => {
+   queryClient.invalidateQueries({ queryKey: DRAFT_CONFIG_QUERY_KEY });
+ };
```

### Step 4: Remove setQueryClientRef calls

```diff
// app/(protected)/tenant/layout.tsx

- import { setQueryClientRef } from '@/hooks/useDraftConfig';
-
- useEffect(() => {
-   const queryClient = useQueryClient();
-   setQueryClientRef(queryClient);
- }, []);
```

---

## Related Patterns

- **Pitfall #29:** TanStack Query staleTime blocking real-time (use `staleTime: 0`)
- **Pitfall #30:** Race condition on cache invalidation (add 100ms delay)
- **Pitfall #50:** Module-level cache unbounded (add TTL and max size)
- **Pattern:** Per-session isolation for mutable state in agents

---

## References

- [TanStack Query: QueryClient](https://tanstack.com/query/latest/docs/reference/QueryClient)
- [React Context vs Module State](https://kentcdodds.com/blog/application-state-management-with-react)
- Related TODO: `todos/paintbrush-review-p3-query-client-singleton-hmr.md`
- Related TODO: `todos/archive/2026-01-completed/684-complete-p2-queryclientref-stale-reference.md`

---

**Last Updated:** 2026-01-26
**Status:** Active Prevention Strategy
