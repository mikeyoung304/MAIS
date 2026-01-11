---
module: MAIS
date: 2026-01-09
problem_type: code_review_prevention
component: agent-ui-store, hooks, capabilities, dialog-timing
severity: P1-P2
tags:
  [
    code-review,
    agent-first-architecture,
    memory-leak,
    race-condition,
    capability-mismatch,
    async-timing,
    singletons,
  ]
---

# Phase 5 Code Review Prevention Strategies

**Based on fixes from Phase 5 Agent-First Architecture Code Review (8 reviewers)**

This document provides prevention strategies for the 5 critical findings from the Phase 5 code review. Use these checklists during development and code review to catch similar issues early.

---

## 1. Unbounded Array Growth (Memory Leak)

### Problem Statement

The `actionLog` array in `agent-ui-store.ts` grows indefinitely with every agent action. There is no cap, rotation, or cleanup mechanism. In long-running sessions with frequent agent interactions, this causes memory accumulation.

**Files affected:**

- `apps/web/src/stores/agent-ui-store.ts` (lines 252, 273, 291, 341, 367)

---

### Prevention Checklist: Array Size Limits

#### When to Add Size Limits (Decision Tree)

```
Does the array grow based on user actions/events?
├─ YES: Need size limit
│   ├─ If history/audit: Use FIFO buffer (max 100-500 items)
│   ├─ If cache: Use time-based TTL (5-30 min)
│   ├─ If queue: Use backpressure (size + rate limits)
│   └─ Document MAX_SIZE with reasoning
└─ NO: Can skip if bounded by schema
    └─ E.g., array of 3 tiers is bounded by design
```

#### Array Growth Patterns to Watch For

```typescript
// ❌ PATTERN 1: Unbounded push to array
const addAction = (action: AgentAction) => {
  state.actionLog.push(action); // Grows indefinitely
};

// ✅ FIX: Add FIFO buffer with max size
const MAX_ACTION_LOG_SIZE = 100; // Document why 100

const addAction = (action: AgentAction) => {
  state.actionLog.push(action);
  if (state.actionLog.length > MAX_ACTION_LOG_SIZE) {
    state.actionLog.shift(); // Remove oldest
  }
};
```

```typescript
// ❌ PATTERN 2: Unbounded accumulation in useEffect
useEffect(() => {
  const timer = setInterval(() => {
    metrics.push({ timestamp, value }); // Grows every second
  }, 1000);

  return () => clearInterval(timer);
}, []);

// ✅ FIX: Time-based cleanup or rotation
const MAX_METRICS_TIME = 5 * 60 * 1000; // 5 minutes

useEffect(() => {
  const timer = setInterval(() => {
    metrics.push({ timestamp, value });

    // Remove metrics older than 5 minutes
    const cutoff = Date.now() - MAX_METRICS_TIME;
    metrics = metrics.filter((m) => m.timestamp > cutoff);
  }, 1000);

  return () => clearInterval(timer);
}, []);
```

```typescript
// ❌ PATTERN 3: Document intent but don't implement
// Lazy load PreviewPanel to reduce initial bundle size
import { PreviewPanel } from '@/components/preview/PreviewPanel'; // Still synchronous!

// ✅ FIX: Implement what comment promises
import { lazy } from 'react';

// Lazy load PreviewPanel to reduce initial bundle size
const PreviewPanel = lazy(() => import('@/components/preview/PreviewPanel'));
```

#### Code Review Questions

**Ask during review:**

1. Does this array have a defined maximum size?
2. If not, what's the expected growth in a 1-hour session?
3. Is memory accumulation acceptable or problematic?
4. If size grows unbounded, add `MAX_*_SIZE` constant with comment
5. Test with 1000+ items: Does browser still respond?

#### Implementation Checklist

- [ ] Identify all arrays that grow based on actions/events
- [ ] Add `MAX_*_SIZE` constant with reasoning comment
- [ ] Implement FIFO cleanup (shift/pop) when limit exceeded
- [ ] Test with extreme values (max size + 10% overflow)
- [ ] Document cleanup strategy in JSDoc
- [ ] Verify memory usage stays bounded in long sessions

#### Example: Comment Template

```typescript
// Limit action log to prevent memory accumulation
// Reasoning: Each action is ~200 bytes (timestamp, payload, IDs)
// At 100 actions, ~20KB. 1000 actions = 200KB (acceptable)
// Unbounded = memory leak risk in 8+ hour sessions
const MAX_ACTION_LOG_SIZE = 100;
```

---

## 2. Debounce Race Conditions

### Problem Statement

When `publishDraft()` or `discardDraft()` is called, there may be a pending debounced save in `useDraftAutosave` that could fire AFTER the publish/discard completes, overwriting just-published config with stale draft.

**Files affected:**

- `apps/web/src/hooks/useDraftAutosave.ts` (lines 199-214)
- `apps/web/src/hooks/useDraftConfig.ts` (lines 134-183)

---

### Prevention Checklist: Debounce/Async Coordination

#### When to Cancel Pending Operations (Decision Tree)

```
Does hook A have debounced/delayed operations?
├─ YES: Check if hook B can call destructive operations
│   ├─ Hook B calls destructive op (publish/delete)?
│   │   ├─ YES: Must cancel A's pending ops before B runs
│   │   └─ Call cancelPendingOps() at start of B's operation
│   └─ No interaction: Can skip coordination
└─ NO: Can use standard async/await
```

#### Debounce/Async Patterns to Watch For

```typescript
// ❌ PATTERN 1: Two hooks, no coordination on destructive ops
// In useDraftAutosave.ts
const queueSave = useCallback(async (draft: Draft) => {
  clearTimeout(debounceRef.current);
  debounceRef.current = setTimeout(async () => {
    await api.updateDraft(draft); // Pending save
  }, 2000); // 2 second delay
}, []);

// In useDraftConfig.ts (no knowledge of pending save)
const publishDraft = async () => {
  await api.publishDraft(draft); // User action
  // But autosave might fire in ~500ms and overwrite!
};

// ✅ FIX: Expose cancel method and call before destructive ops
export const useDraftAutosave = () => {
  const debounceRef = useRef<NodeJS.Timeout>();

  const cancelPendingSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
  }, []);

  return { queueSave, cancelPendingSave };
};

// In component or useDraftConfig
const { cancelPendingSave } = useDraftAutosave();
const publishDraft = async () => {
  cancelPendingSave(); // Clear pending autosave
  await api.publishDraft(draft);
};
```

```typescript
// ❌ PATTERN 2: Dialog closes before async completes
const handleConfirm = () => {
  onConfirm(); // May be async
  onOpenChange(false); // Closes immediately
  // If onConfirm fails, user sees error but dialog is gone
};

// ✅ FIX: Only close on success, show loading during operation
const handleConfirm = async () => {
  setIsLoading(true);
  try {
    await onConfirm(); // Wait for completion
    onOpenChange(false); // Close AFTER success
  } catch (error) {
    // Dialog stays open, error visible in context
    throw error;
  } finally {
    setIsLoading(false);
  }
};
```

```typescript
// ❌ PATTERN 3: Multiple state updates, no coordination
useState(draft);
const [draftCopy, setDraftCopy] = useState(draft);
const [isDirty, setIsDirty] = useState(false);

// EditForm updates draftCopy
const handleChange = (field, value) => {
  setDraftCopy({ ...draftCopy, [field]: value });
  // Pending debounce to save draftCopy
};

// User clicks publish
const handlePublish = () => {
  // But which draft version? draft or draftCopy?
  api.publish(draft); // WRONG - ignores pending changes!
};

// ✅ FIX: Single source of truth + coordinate all operations
const [draft, setDraft] = useState(initialDraft);
const pendingOp = useRef<Promise<void>>();

const queueSave = useCallback(async (updates: Partial<Draft>) => {
  setDraft(d => ({ ...d, ...updates }));

  // Cancel previous pending save
  if (pendingOp.current) {
    await Promise.race([pendingOp.current, timeout(100)]); // Quick abort
  }

  // Queue new save
  pendingOp.current = api.saveDraft({ ...draft, ...updates });
  await pendingOp.current;
};

const publish = async () => {
  // Wait for pending save to complete
  if (pendingOp.current) await pendingOp.current;

  // Now publish current state
  await api.publishDraft(draft);
};
```

#### Code Review Questions

**Ask during review:**

1. Is the component using debounced saves?
2. Does it have destructive operations (publish, delete, discard)?
3. If yes to both, are pending saves cancelled before destructive ops?
4. Is the dialog/UI closed BEFORE or AFTER async completes?
5. Can user see error if async fails after dialog closes?
6. Test: Edit → rapidly click Publish twice → what happens?

#### Implementation Checklist

- [ ] Identify all debounced operations and destructive operations
- [ ] Add cancel method to debounce hooks
- [ ] Call cancel before each destructive operation
- [ ] Dialog/UI stays open until async succeeds
- [ ] Test rapid-fire operations (multiple clicks)
- [ ] Test failure scenarios (network error, server rejection)
- [ ] Verify no stale data overwrites after destructive ops

#### Example: Cancellation Pattern

```typescript
// Debounce hook exports cancel method
const useDraftAutosave = () => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const queueSave = useCallback((draft) => {
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      api.updateDraft(draft);
    }, 2000);
  }, []);

  const cancelPendingSave = useCallback(() => {
    clearTimeout(timeoutRef.current);
  }, []);

  return { queueSave, cancelPendingSave };
};

// Consumer cancels before publish
const MyComponent = () => {
  const { cancelPendingSave } = useDraftAutosave();

  const handlePublish = async () => {
    cancelPendingSave(); // ALWAYS first
    await api.publishDraft();
  };
};
```

---

## 3. Capability/Tool Mismatch

### Problem Statement

The capability registry lists `add_section` as a capability (user-discoverable feature), but no tool with this exact name exists. The actual tool is `update_page_section` which handles additions via special parameters. This breaks the principle: **"Capability ID must match actual backend tool name"**.

**Files affected:**

- `apps/web/src/lib/agent-capabilities.ts` (lines 181-188)
- `server/src/agent/tools/storefront-tools.ts` (tool definitions)

---

### Prevention Checklist: Capability Registry Audit

#### When to Audit Capabilities (Decision Tree)

```
Adding new capability or tool?
├─ YES: Do this FIRST, before implementation
│   ├─ Is tool already implemented? (grep server/src/agent/tools/)
│   ├─ Does capability ID exactly match tool name?
│   ├─ Is tool in REQUIRED_EXECUTOR_TOOLS? (if write operation)
│   └─ Can agent successfully execute the tool?
└─ NO: Still audit in code review
    └─ Every 2 weeks: scan for mismatches
```

#### Capability/Tool Patterns to Watch For

```typescript
// ❌ PATTERN 1: Capability exists but no tool
// In agent-capabilities.ts
export const AGENT_CAPABILITIES: Capability[] = [
  {
    id: 'add_section', // ← User can discover this
    name: 'Add Section',
    description: 'Add a new section',
    // ...
  },
];

// In storefront-tools.ts
export const tools: Tool[] = [
  {
    name: 'update_page_section', // ← But tool is named this
    // ...
  },
];

// Agent discovery: "I can add sections" ✓
// Agent execution: "add_section not found" ✗

// ✅ FIX: Rename capability to match tool
export const AGENT_CAPABILITIES: Capability[] = [
  {
    id: 'update_page_section', // Matches tool name
    name: 'Edit Section', // Still user-friendly
    description: 'Add or update a section on your storefront',
    // ...
  },
];
```

```typescript
// ❌ PATTERN 2: Tool supports feature but capability missing
// In storefront-tools.ts
const tools = [
  {
    name: 'publish_draft',
    // Can publish drafts
  },
];

// In agent-capabilities.ts
const capabilities = [
  // NO publish capability listed!
];

// Agent: "I don't have publish capability"
// But tool exists! ✗

// ✅ FIX: Capability registry must list every user-discoverable tool
export const AGENT_CAPABILITIES: Capability[] = [
  // ... other capabilities
  {
    id: 'publish_draft',
    name: 'Publish Changes',
    description: 'Publish your draft changes to the live storefront',
    // ...
  },
];
```

```typescript
// ❌ PATTERN 3: Orphaned capability functions
// In agent-capabilities.ts
export function searchCapabilities(query: string): Capability[] {
  // Returns matching capabilities
}

export function getCapabilitiesByCategory(category: string): Capability[] {
  // Groups by category
}

// But NEVER used in production code! Only in tests.

// ✅ FIX: Either use or document as scaffolding
// Option A: Use in command palette
import { searchCapabilities } from '@/lib/agent-capabilities';

export function CommandPalette() {
  const [results, setResults] = useState<Capability[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (query.length > 0) {
      setResults(searchCapabilities(query));
    }
  }, [query]);

  return (/* render results */);
}

// Option B: Mark as scaffolding with clear comment
/**
 * Search capabilities by keyword.
 *
 * SCAFFOLDING: This function is prepared for the command palette feature
 * (see architecture plan, phase 6). Currently unused.
 */
export function searchCapabilities(query: string): Capability[] {
```

#### Code Review Questions

**Ask during review:**

1. Is this a new capability or tool?
2. If capability: Does matching tool exist with same ID?
3. If tool: Does matching capability exist in registry?
4. Can you grep and verify? (`grep -r "tool_name" server/src/agent/tools/`)
5. Is write tool registered in REQUIRED_EXECUTOR_TOOLS?
6. Test: Can agent discover and execute the capability?

#### Audit Procedure (Every PR)

```bash
# 1. List all tools from backend
grep -r "name: '" server/src/agent/tools/ | cut -d"'" -f2 | sort

# 2. List all capabilities from frontend
grep -r "id: '" apps/web/src/lib/agent-capabilities.ts | cut -d"'" -f2 | sort

# 3. Find mismatches (in capability but not tool)
comm -23 <(grep id apps/web/src/lib/agent-capabilities.ts | cut -d"'" -f2 | sort) \
         <(grep "name: '" server/src/agent/tools/ | cut -d"'" -f2 | sort)

# 4. Find missing capabilities (tool but not capability)
comm -13 <(grep id apps/web/src/lib/agent-capabilities.ts | cut -d"'" -f2 | sort) \
         <(grep "name: '" server/src/agent/tools/ | cut -d"'" -f2 | sort)
```

#### Implementation Checklist

- [ ] Tool is implemented and tested
- [ ] Capability ID exactly matches tool name
- [ ] Capability is discoverable (not buried in comments)
- [ ] Write tools are in REQUIRED_EXECUTOR_TOOLS
- [ ] Unused capability functions are documented as scaffolding
- [ ] Audit script passes (no mismatches)
- [ ] Agent can discover and execute capability

#### Example: Capability Definition Pattern

```typescript
// In agent-capabilities.ts
{
  // ID MUST match backend tool name exactly
  id: 'update_page_section',

  // User-friendly name (can be different from ID)
  name: 'Edit Section',

  // Clear description of what it does
  description: 'Add, modify, or replace a section on your storefront (hero, testimonials, gallery, etc.)',

  // Category for discovery
  category: 'editing',

  // Keywords for search
  keywords: ['add', 'update', 'edit', 'section', 'hero', 'gallery', 'faq'],

  // Trust tier for safety
  trustTier: 'T2',

  // User example
  example: 'Add a testimonials section to my homepage',
}
```

---

## 4. Dialog Async Timing

### Problem Statement

The `ConfirmDialog` closes immediately after `onConfirm()` is called, but `onConfirm` is often async. If the async operation fails AFTER the dialog closes, the user has no context of what failed.

**Files affected:**

- `apps/web/src/components/build-mode/ConfirmDialog.tsx` (lines 53-55)
- `apps/web/src/components/preview/PreviewPanel.tsx` (pass async callbacks)

---

### Prevention Checklist: Async Dialog Handling

#### When to Await Before Closing (Decision Tree)

```
Does dialog pass callback to onConfirm()?
├─ YES: Is onConfirm async?
│   ├─ YES: Dialog must wait for completion
│   │   ├─ Show loading state during operation
│   │   ├─ Only close on success
│   │   └─ Keep dialog open if error occurs
│   └─ NO: Can close immediately
└─ NO: Can close immediately
```

#### Dialog/Async Patterns to Watch For

```typescript
// ❌ PATTERN 1: Dialog closes before async completes
const handleConfirm = () => {
  onConfirm(); // May be async, but not awaited
  onOpenChange(false); // Closes immediately
};

// Result: Dialog closes, then operation might fail → user confused

// ✅ FIX: Wait for async, show loading, close on success only
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleConfirm = async () => {
  setIsLoading(true);
  setError(null);

  try {
    await onConfirm(); // Wait for completion
    onOpenChange(false); // Close AFTER success
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Operation failed');
    // Dialog stays open, user sees error
  } finally {
    setIsLoading(false);
  }
};

return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogTitle>{title}</DialogTitle>
      {error && <div className="text-red-600">{error}</div>}
      <DialogFooter>
        <Button
          onClick={handleConfirm}
          disabled={isLoading}
        >
          {isLoading ? 'Loading...' : 'Confirm'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
```

```typescript
// ❌ PATTERN 2: Fire-and-forget async
const handlePublish = () => {
  publishDraft(); // Not awaited
  setPublished(true); // Assumes success
  // If publishDraft fails, state is wrong
};

// ✅ FIX: Await before updating state
const handlePublish = async () => {
  try {
    await publishDraft(); // Wait for result
    setPublished(true); // Update AFTER success
  } catch (error) {
    setError(error);
    setPublished(false);
  }
};
```

```typescript
// ❌ PATTERN 3: No feedback during operation
const handleDelete = async () => {
  setDeleting(true);
  try {
    await api.deleteItem(id);
    // User stares at button for 2 seconds, no feedback
    close();
  } finally {
    setDeleting(false);
  }
};

// ✅ FIX: Show loading/progress feedback
const handleDelete = async () => {
  setDeleting(true);
  setProgress(0);

  try {
    const task = api.deleteItem(id);

    // Show progress if available
    task.on('progress', (pct) => setProgress(pct));

    await task;
    close();
  } finally {
    setDeleting(false);
  }
};

// In UI
<Button disabled={isDeleting}>
  {isDeleting ? `Deleting... ${progress}%` : 'Delete'}
</Button>
```

#### Code Review Questions

**Ask during review:**

1. Is `onConfirm` async? (check type or JSDoc)
2. If yes, does dialog wait for completion?
3. Can dialog close BEFORE async completes? (race condition)
4. Is there loading state during operation?
5. Can user see errors if operation fails?
6. Test: Slow network (DevTools > Throttle) → confirm → does dialog close or stay open?

#### Implementation Checklist

- [ ] Identify async callbacks in dialog/button handlers
- [ ] Await completion before state updates
- [ ] Show loading state during operation
- [ ] Dialog/UI stays open until success
- [ ] Errors display in context (in dialog, not toast)
- [ ] Test with network throttling (DevTools)
- [ ] Test error scenarios (server rejection, timeout)

#### Example: Robust Confirm Dialog

```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** Should return void or Promise<void> */
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = onConfirm();

      // Handle both sync and async
      if (result instanceof Promise) {
        await result;
      }

      // Close only on success
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Operation failed'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {error && (
          <div className="text-sm text-red-600 p-2 bg-red-50 rounded">
            {error}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 5. Undocumented Singletons

### Problem Statement

The capability registry and similar utility modules export functions that appear to be singletons/utilities but their state management and lifecycle are unclear. Functions like `searchCapabilities()`, `getCapabilitiesByCategory()` are built but never used in production, creating confusion about module-level state and usage expectations.

**Files affected:**

- `apps/web/src/lib/agent-capabilities.ts` (425 lines of mostly scaffolding)

---

### Prevention Checklist: Singleton/Utility Documentation

#### When to Document Intent (Decision Tree)

```
Is this a utility module?
├─ YES: Is it actually used in production code?
│   ├─ YES: Document usage in module JSDoc
│   │   ├─ Add @example with common patterns
│   │   ├─ List files that import it
│   │   └─ Note any state/side effects
│   ├─ NO (scaffolding): Add clear marker
│   │   ├─ /** SCAFFOLDING: Phase X feature ... */
│   │   ├─ Link to implementation plan
│   │   └─ Mark functions with @internal or @deprecated
│   └─ PARTIAL (half used): Split file
└─ NO: Document as what it is (constants, etc.)
```

#### Singleton/Utility Patterns to Watch For

```typescript
// ❌ PATTERN 1: Large module, mostly unused functions
// apps/web/src/lib/agent-capabilities.ts
export const AGENT_CAPABILITIES: Capability[] = [
  /* 200 items */
];

export function searchCapabilities(query: string): Capability[] {
  /* ... */
}
export function getCapabilitiesByCategory(cat: string): Capability[] {
  /* ... */
}
export function getCapabilitiesByTier(tier: string): Capability[] {
  /* ... */
}
export function getCapability(id: string): Capability | undefined {
  /* ... */
}
export function getCategories(): string[] {
  /* ... */
}
export function getCapabilitiesGrouped(): Record<string, Capability[]> {
  /* ... */
}

// In production code:
import { AGENT_CAPABILITIES } from '@/lib/agent-capabilities';
// Uses only AGENT_CAPABILITIES array, never calls the functions!

// Result: 425 lines of utility functions, none used → confusing

// ✅ FIX: Document as scaffolding with clear intent
/**
 * Agent capability registry and utilities.
 *
 * SCAFFOLDING: Functions like searchCapabilities, getCapabilitiesByCategory,
 * etc. are prepared for the command palette feature (Phase 6, see architecture plan).
 * Currently, only AGENT_CAPABILITIES array is used in production.
 *
 * Production usage: Import AGENT_CAPABILITIES to display/list capabilities
 * Planned usage: searchCapabilities for Cmd+K command palette (not yet implemented)
 *
 * @see docs/architecture/agent-first-phases.md#phase-6-command-palette
 */

// Only export what's used
export const AGENT_CAPABILITIES: Capability[] = [
  /* ... */
];

/**
 * Search capabilities by keyword.
 * @internal - Only used in tests until command palette is implemented
 * @deprecated - This function is not yet used in production
 */
export function searchCapabilities(query: string): Capability[] {
  /* ... */
}
```

```typescript
// ❌ PATTERN 2: No documentation of module state/behavior
export const cache = new Map<string, CachedData>();

export async function getCached(key: string) {
  if (cache.has(key)) {
    return cache.get(key);
  }
  // ... fetch and populate cache
}

// Questions left unanswered:
// - Is cache shared across all users?
// - Does it persist across page reloads?
// - When does it get cleared?
// - Is it safe to use in SSR contexts?

// ✅ FIX: Document module behavior with JSDoc
/**
 * In-memory cache for capability metadata.
 *
 * Behavior:
 * - Cache is shared across entire app instance (not per-user)
 * - Persists across page navigations (cleared only on full reload)
 * - Cleared automatically after 5 minutes (TTL)
 * - NOT suitable for user-specific data
 *
 * Thread-safety: Single-threaded (browser JS) so safe without locks
 *
 * SSR: Only works in client components; server-side calls get empty cache
 *
 * @example
 * // Safe: Capability list is same for all users
 * const caps = await getCached('capabilities');
 *
 * @example
 * // WRONG: User-specific data
 * cache.set('user:123:drafts', drafts); // Don't do this!
 */
const cache = new Map<string, CachedData>();

export async function getCached(key: string) {
  // Implementation with above guarantees
}
```

```typescript
// ❌ PATTERN 3: Functions that look stateless but have hidden dependencies
export function formatCapability(cap: Capability): string {
  // Looks pure, but actually depends on...?
  return `${cap.name} - ${cap.description}`;
}

export function sortCapabilities(caps: Capability[]): Capability[] {
  // Uses implicit global state?
  return caps.sort((a, b) => {
    return a.trustTier.localeCompare(b.trustTier);
  });
}

// Without documentation, reader doesn't know:
// - Are these pure functions?
// - Do they have side effects?
// - Do they modify input?

// ✅ FIX: Document function behavior
/**
 * Format a capability for display.
 * Pure function - no side effects.
 *
 * @param cap - Capability to format
 * @returns Human-readable string
 *
 * @example
 * formatCapability({ id: 'x', name: 'Foo', description: 'Bar' })
 * // => "Foo - Bar"
 */
export function formatCapability(cap: Capability): string {
  return `${cap.name} - ${cap.description}`;
}

/**
 * Sort capabilities by trust tier (ascending: T1, T2, T3).
 * MUTATES input array - consider spreading if immutability needed.
 *
 * @param caps - Array to sort
 * @returns Same array, sorted in-place
 *
 * @example
 * const sorted = sortCapabilities([...caps]); // Spread to preserve original
 */
export function sortCapabilities(caps: Capability[]): Capability[] {
  return caps.sort((a, b) => {
    return a.trustTier.localeCompare(b.trustTier);
  });
}
```

#### Code Review Questions

**Ask during review:**

1. Is this utility module or scaffolding?
2. If scaffolding, is it marked clearly?
3. Does module-level JSDoc explain what's used vs. what's not?
4. For singleton/cache modules, is behavior documented?
   - Shared state or per-instance?
   - Persistence across navigations?
   - TTL/cleanup?
5. For exported functions, are they used?
   - Grep: `grep -r "function_name" apps/`
   - If zero matches, it's scaffolding or dead code
6. Are pure functions documented as such?

#### Documentation Checklist

- [ ] Module-level JSDoc explains purpose
- [ ] Scaffolding is marked clearly with `@internal`, `@deprecated`, or file comment
- [ ] Links to implementation plan (if scaffolding)
- [ ] Singleton/cache behavior documented (shared vs. per-instance, TTL, etc.)
- [ ] Each function has JSDoc with @example
- [ ] Pure functions documented as having no side effects
- [ ] Mutating functions clearly marked
- [ ] Audit: All exported functions are either used or marked as scaffolding

#### Example: Complete Module Documentation

```typescript
/**
 * Agent capability registry and utilities.
 *
 * This module provides the canonical list of capabilities (AI actions) that users
 * can discover. Capabilities are mapped to backend tools by exact name match.
 *
 * PRODUCTION: AGENT_CAPABILITIES array is used to display available capabilities.
 *
 * SCAFFOLDING: Utility functions (searchCapabilities, getCapabilitiesByCategory, etc.)
 * are prepared for the command palette feature (Phase 6). Currently unused.
 * See architecture plan and issue #742 for implementation timeline.
 *
 * @internal - Functions marked @internal are scaffolding and not yet used
 *
 * @example
 * // List all capabilities
 * import { AGENT_CAPABILITIES } from '@/lib/agent-capabilities';
 * AGENT_CAPABILITIES.forEach(cap => console.log(cap.name));
 *
 * @example
 * // (Future) Search capabilities in command palette
 * const results = searchCapabilities('add section');
 */

/**
 * All available agent capabilities.
 *
 * Capabilities are discovered by users and executed by the agent.
 * The `id` field MUST match a backend tool name exactly.
 *
 * Source of truth for agent discovery and execution parity.
 */
export const AGENT_CAPABILITIES: Capability[] = [
  // ...
];

/**
 * Search capabilities by keyword.
 *
 * @internal - Not yet used; prepared for Cmd+K command palette (Phase 6)
 * @param query - Search text (e.g., "add section", "publish")
 * @returns Matching capabilities, sorted by relevance
 */
export function searchCapabilities(query: string): Capability[] {
  // ...
}

// ... other functions similarly documented
```

---

## Quick Reference Checklist

Use this when reviewing code or starting a feature:

### Before Writing Code

- [ ] Check if array grows unbounded
  - If yes: Add MAX\_\*\_SIZE constant
- [ ] Check if hooks interact (debounce + destructive ops)
  - If yes: Add cancel methods
- [ ] Check if new capability → Does tool exist?
  - If no: Either create tool or fix capability ID
- [ ] Check if dialog closes too early
  - If async callback: Await before closing
- [ ] Check if module is scaffolding
  - If yes: Document clearly

### During Code Review

- [ ] Array growth: Does it have size limits?
- [ ] Debounce races: Are pending ops cancelled before publish/delete?
- [ ] Dialog timing: Does it wait for async to complete?
- [ ] Capabilities: Do IDs match actual backend tool names?
- [ ] Singletons: Is purpose documented?

### When Committing

```bash
# Validate no unbounded arrays
grep -r "\.push(" apps/web/src --include="*.ts" --include="*.tsx" | grep -v MAX_ | head -10

# Check for capability/tool mismatches
grep "id: '" apps/web/src/lib/agent-capabilities.ts | cut -d"'" -f2 > /tmp/cap_ids
grep "name: '" server/src/agent/tools/ -r | cut -d"'" -f2 > /tmp/tool_names
comm -23 /tmp/cap_ids /tmp/tool_names | head -5

# Verify async handling in dialogs
grep -A 5 "onOpenChange(false)" apps/web/src/components --include="*.tsx" -r
```

---

## Prevention Strategy by Role

### For Developers

**Before implementing:**

1. Check SIZE_LIMIT decision tree (unbounded arrays)
2. Check ASYNC_COORDINATION decision tree (debounce races)
3. Check CAPABILITY_AUDIT (tool matching)
4. Check ASYNC_DIALOG (timing)

**Before committing:**

1. Run bash audit scripts above
2. Test with extreme values (100+ items, slow network)
3. Document any scaffolding clearly

### For Code Reviewers

**Priority order:**

1. Unbounded growth (memory leak potential) - P1
2. Capability mismatch (breaks agent execution) - P1
3. Race conditions (data corruption) - P1
4. Dialog timing (UX issue) - P2
5. Undocumented scaffolding (confusion) - P3

**Ask the decision tree questions** from each section above.

### For Tech Leads

**Integrate into process:**

- Add SIZE_LIMIT check to pre-commit hooks
- Add CAPABILITY_AUDIT to CI/CD (run bash scripts)
- Add JSDoc template to new file scaffold
- Document in CLAUDE.md under "Prevention Strategies"

---

## Resources

- **PR:** Agent-First Dashboard Architecture (Phases 1-5)
- **Reviewers:** 8 specialized agents (Performance Oracle, Data Integrity Guardian, Agent-Native Architect, etc.)
- **Related:** `/docs/solutions/patterns/ATOMIC_TENANT_PROVISIONING_DEFENSE_IN_DEPTH.md` (transaction coordination patterns)
- **Related:** `/docs/solutions/patterns/BUILD_MODE_STOREFRONT_EDITOR_PATTERNS.md` (editor state management)

---

## Summary

These 5 prevention strategies address root causes found in Phase 5 code review:

1. **Unbounded Array Growth** → Add MAX\_\*\_SIZE constant + FIFO cleanup
2. **Debounce Race Conditions** → Expose cancel methods + call before destructive ops
3. **Capability/Tool Mismatch** → Audit every PR with bash script
4. **Dialog Async Timing** → Await completion, show loading, only close on success
5. **Undocumented Singletons** → Module-level JSDoc + mark scaffolding clearly

Apply these patterns to eliminate similar issues in future phases.
