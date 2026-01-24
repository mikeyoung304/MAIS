# Continuation Prompt for Phases 4 & 5

Copy everything below this line to a fresh Claude Code session:

---

/workflows:work plans/agent-first-dashboard-architecture.md

Context for the new session:

I'm implementing the Agent-First Dashboard Architecture. Phases 1-3 are COMPLETE (commits f643121f, 8cb23bf3). Continue with Phase 4 (Layout Refactoring) and Phase 5 (Cleanup & Testing).

## Completed Files (Phases 1-3)

| File                                                     | Purpose                                                                    |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `apps/web/src/stores/agent-ui-store.ts`                  | Zustand store with discriminated unions, event sourcing, tenant isolation  |
| `apps/web/src/stores/index.ts`                           | Clean store exports                                                        |
| `apps/web/src/hooks/useDraftConfig.ts`                   | TanStack Query hook with `invalidateDraftConfig()` for agent tools         |
| `apps/web/src/lib/agent-capabilities.ts`                 | Capability registry (18 capabilities, T1/T2/T3 trust tiers)                |
| `apps/web/src/components/dashboard/ContentArea.tsx`      | Dynamic view router based on store ViewState                               |
| `apps/web/src/components/dashboard/DashboardView.tsx`    | Extracted dashboard content                                                |
| `apps/web/src/components/preview/PreviewPanel.tsx`       | Preview with page tabs, viewport toggle, publish/discard T3 dialogs        |
| `apps/web/src/app/(protected)/tenant/layout.tsx`         | Updated with ContentArea, store init, QueryClientProvider                  |
| `server/src/agent/tools/ui-tools.ts`                     | **NEW** 5 UI control tools (show_preview, hide_preview, navigate_to, etc.) |
| `server/src/agent/tools/all-tools.ts`                    | Updated to include uiTools                                                 |
| `apps/web/src/components/agent/PanelAgentChat.tsx`       | Added AgentUIAction type and onUIAction callback                           |
| `apps/web/src/components/agent/GrowthAssistantPanel.tsx` | Added handleUIAction with router integration                               |

## Phase 4 Tasks (Layout Refactoring)

From the plan, Phase 4 involves:

1. **Rename GrowthAssistantPanel → AgentPanel:** Update component name and all imports
2. **Remove GrowthAssistantContext:** Replaced by Zustand store
3. **Redirect /tenant/build → /tenant/dashboard?showPreview=true:** Backwards compatibility
4. **Handle showPreview query param in dashboard page:** Auto-show preview when redirected
5. **Update navigation links throughout app:** Point to new unified dashboard
6. **Remove /tenant/build/layout.tsx:** No longer needed (if separate layout exists)

## Phase 5 Tasks (Cleanup & Testing)

1. **Remove deprecated BuildModeChat component** (or mark deprecated)
2. **Clean up unused imports and dead code**
3. **Write E2E tests for agent UI control:**
   - Agent shows preview after editing section
   - Preview updates after agent tool execution
   - Publish requires T3 confirmation dialog
   - Discard requires T3 confirmation dialog
   - /tenant/build redirects correctly
4. **Update acceptance criteria in plan**
5. **Final verification:** All tests pass, build succeeds

## Critical Files to Read First

- `apps/web/src/contexts/GrowthAssistantContext.tsx` - Context to remove
- `apps/web/src/app/(protected)/tenant/build/page.tsx` - Page to update with redirect
- `apps/web/src/app/(protected)/tenant/dashboard/page.tsx` - Handle showPreview param
- `apps/web/src/components/build-mode/BuildModeChat.tsx` - Component to deprecate
- `apps/web/src/components/layouts/AdminSidebar.tsx` - May have Build Mode nav link

## Key Patterns

```typescript
// Redirect pattern for /tenant/build/page.tsx
import { redirect } from 'next/navigation';

export default function BuildModeRedirect() {
  redirect('/tenant/dashboard?showPreview=true');
}

// Handle query param in dashboard page
'use client';
import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { agentUIActions } from '@/stores/agent-ui-store';

export default function DashboardPage() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('showPreview') === 'true') {
      agentUIActions.showPreview('home');
      window.history.replaceState({}, '', '/tenant/dashboard');
    }
  }, [searchParams]);

  return <DashboardView />;
}
```

## Quality Expectations

- TypeScript strict mode
- No console errors or warnings
- All existing tests pass
- E2E tests for critical flows
- No breaking changes to existing functionality
- Clean git history with descriptive commits

## Commit Strategy

- Phase 4: `refactor(dashboard): redirect /tenant/build, remove GrowthAssistantContext`
- Phase 5: `test(agent): add E2E tests for agent-first architecture`

Start by reading GrowthAssistantContext.tsx to understand what state needs migrating, then work through the Phase 4 tasks systematically.
