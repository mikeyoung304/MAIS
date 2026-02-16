# P2: AgentPanel God Component Refactor

**Source:** Dashboard Rebuild Review (PR #39, 2026-02-07)
**File:** `apps/web/src/components/agent/AgentPanel.tsx` (746 lines)

## Findings

1. **God component**: AgentPanel handles chat rendering, tool dispatch, dashboard actions, slot metrics extraction, preview refresh, and scroll coordination — all in one file.

2. **queryClientRef singleton** (Pitfall #78): Module-level ref for QueryClient set via useEffect. Use `useQueryClient()` hook instead.

3. **Natural language dispatch fragility**: Some dashboard actions matched by string patterns in agent responses rather than structured tool results.

## Fix

- Extract: `useDashboardActionDispatch()` hook, `useSlotMetricsExtractor()` hook, `ChatMessageList` component
- Replace `queryClientRef` with `useQueryClient()`
- Ensure all dashboard actions come through `dashboardAction` field in tool results, not string matching
