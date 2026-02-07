# P1: ViewState Guards & Transition Validation

**Source:** Dashboard Rebuild Review (PR #39, 2026-02-07)
**Files:** `apps/web/src/stores/agent-ui-store.ts`

## Findings

1. **Missing `coming_soon` guards** (Pitfall #92): `showPreview()`, `showDashboard()`, `highlightSection()` can override `coming_soon` view state during onboarding. Only `revealSite()` should transition from `coming_soon`.

2. **No ViewState transition validation**: Any state can jump to any other state. Should have a transition map (e.g., `coming_soon` can only go to `revealing`, `revealing` can only go to `preview`).

3. **Two unsynchronized state machines**: ViewState in `agent-ui-store` and mode in `refinement-store` can conflict (e.g., ViewState = `preview` but mode = `publish_ready`). Need a single source of truth or bidirectional sync.

## Fix

- Add `if (state.view.status === 'coming_soon') return;` guard to `showPreview`, `showDashboard`, `highlightSection`
- Add `VALID_TRANSITIONS` map and validate transitions before applying
- Consider merging refinement mode into ViewState or adding sync middleware
