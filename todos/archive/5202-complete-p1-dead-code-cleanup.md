# P1: Dead Code & YAGNI Cleanup

**Source:** Dashboard Rebuild Review (PR #39, 2026-02-07)

## Findings

1. **Dead `NAVIGATE`/`CLEAR_HIGHLIGHT` action types** — handler exists in AgentPanel but nothing sends these types (Pitfall #88). `AgentPanel.tsx`

2. **Deprecated multi-page model** still active in types — `PAGE_NAMES`, `currentPage`, `setCurrentPage` unused but still exported. `agent-ui-store.ts`

3. **Unused `completedSections` param** in `hydrate()` — accepted but never used. `refinement-store.ts`

4. **`Array.shift()` O(n)** in FIFO action log — called on every dispatch; use ring buffer or deque for O(1). `agent-ui-store.ts`

5. **FIFO pattern duplicated 7x** across stores — extract to shared utility.

## Fix

- Remove dead NAVIGATE/CLEAR_HIGHLIGHT cases and PageName model
- Remove unused `completedSections` from hydrate signature
- Replace `Array.shift()` with ring buffer (or just `slice(-100)` on read)
- Extract `createFIFOLog(maxSize)` utility
