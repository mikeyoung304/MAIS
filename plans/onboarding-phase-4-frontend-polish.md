# Onboarding Phase 4: Frontend + Polish (Revised MVP)

> Complete the agent-powered tenant onboarding with welcome experience and E2E tests

**Created**: 2025-12-31
**Revised**: 2025-12-31 (Post-Review: Simplified MVP)
**Status**: Ready for Implementation
**Complexity**: MEDIUM (Focused MVP - Quality-First)
**Estimated Effort**: 6-8 hours

---

## Post-Review Revision Summary

After parallel review by DHH, Kieran, and Simplicity reviewers, the plan was revised:

| Original                   | Revised                      | Rationale                                                          |
| -------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| LivePreviewPanel (polling) | **Cut** → Link to storefront | Polling adds complexity, race conditions; link provides same value |
| Two-panel layout           | **Cut** → Single-panel       | Layout complexity not worth it for MVP                             |
| 8 E2E scenarios            | **4 core scenarios**         | Cover critical paths, add more when needed                         |
| Preview endpoint           | **Cut**                      | Storefront page already renders this data                          |
| OnboardingProgress         | **Keep**                     | Clean, focused component                                           |
| Integration tests first    | **Keep**                     | Right approach for stability                                       |

**Quality preserved:**

- Proper TypeScript interfaces
- Zod validation for JSON fields
- Comprehensive error handling
- Clean component patterns
- Focused but thorough testing

---

## Executive Summary

### The Decision: Phase 4 First, P2 Refactoring Later

After analyzing the current state, **proceeding to Phase 4 is the optimal path** because:

1. **All P2 security issues are already fixed** - Prompt injection, session verification, cleanup scheduler all merged
2. **Backend is 100% complete** - Phases 1-3 implemented with tests passing
3. **Only 1 P2 issue affects Phase 4** - Integration tests, which we need to write anyway for Phase 4
4. **Deferred P2s don't block functionality** - Orchestrator refactoring and tool DRY can wait
5. **User value is in Phase 4** - The live preview and welcome UX is what tenants actually see

### P2 Status Summary

| P2 Issue                       | Status                 | Blocks Phase 4?     |
| ------------------------------ | ---------------------- | ------------------- |
| Prompt Injection Detection     | ✅ FIXED               | No                  |
| Session Ownership Verification | ✅ FIXED               | No                  |
| Cleanup Scheduler              | ✅ FIXED               | No                  |
| Type Safety (JSON fields)      | ✅ FIXED               | No                  |
| Component Memoization          | ✅ FIXED               | No                  |
| Orchestrator Refactoring       | DEFERRED               | No                  |
| Integration Tests              | **INCLUDE IN PHASE 4** | Yes (needed anyway) |
| Duplicate Tool Logic           | DEFERRED               | No                  |

---

## What We're Building

### User Experience Flow

```
Tenant Signs Up → Dashboard → Growth Assistant Welcome
                                      ↓
                    ┌─────────────────┴─────────────────┐
                    │         TWO-PANEL LAYOUT          │
                    │                                   │
                    │  ┌──────────┐  ┌──────────────┐  │
                    │  │  Chat    │  │   Preview    │  │
                    │  │  Panel   │  │   Panel      │  │
                    │  │          │  │              │  │
                    │  │ Progress │  │ [Storefront] │  │
                    │  │ ▓▓▓▓░░░░ │  │              │  │
                    │  └──────────┘  └──────────────┘  │
                    └───────────────────────────────────┘
                                      ↓
                    Discovery → Market Research → Services → Done!
```

### Components to Build

```
apps/web/src/components/
├── onboarding/                    # NEW DIRECTORY
│   ├── LivePreviewPanel.tsx      # Real-time storefront preview
│   └── OnboardingProgress.tsx    # Phase completion indicator
└── agent/
    └── GrowthAssistantPanel.tsx  # MODIFY: Add onboarding mode
```

---

## Implementation Plan (Revised MVP)

### Phase 4.1: Integration Tests Foundation (3-4 hours)

**Goal**: Ensure Phase 1-3 backend works end-to-end before building UI

**Tasks**:

- [ ] Create `server/test/integration/onboarding-flow.test.ts`
- [ ] Test complete discovery → market research → services flow
- [ ] Test advisor memory persistence across sessions
- [ ] Test session resumption with context injection
- [ ] Verify tenant isolation in all operations

**Files**:

```
server/test/integration/
└── onboarding-flow.test.ts       # 4-5 focused integration tests
```

**Quality Requirements** (from Kieran review):

- [ ] Use mock adapters for speed, real DB for 1-2 critical paths only
- [ ] Add explicit test for mid-onboarding refresh (race condition scenario)
- [ ] Test unknown phase handling (graceful fallback)

**Success Criteria**:

- [ ] All phase transitions tested
- [ ] Resume scenario verified (user returns, sees context)
- [ ] No cross-tenant data leakage
- [ ] Tests run in < 30 seconds

---

### Phase 4.2: OnboardingProgress Component (1 hour)

**Goal**: Show users where they are in onboarding

**Design**:

```tsx
// OnboardingProgress.tsx
<div className="flex items-center gap-2 p-3 bg-sage/10 rounded-lg">
  <div className="flex gap-1">
    {phases.map((phase, i) => (
      <div
        key={phase}
        className={cn(
          'w-2 h-2 rounded-full transition-colors',
          i < currentPhaseIndex ? 'bg-sage' : 'bg-neutral-300'
        )}
        aria-hidden="true"
      />
    ))}
  </div>
  <span className="text-sm text-neutral-600" aria-live="polite">
    {phaseName} ({currentPhaseIndex + 1}/4)
  </span>
  <button
    onClick={onSkip}
    className="text-xs text-neutral-500 hover:underline ml-auto"
    aria-label="Skip onboarding setup"
  >
    Skip setup
  </button>
</div>
```

**Tasks**:

- [ ] Create `apps/web/src/components/onboarding/OnboardingProgress.tsx`
- [ ] Display 4 phases: Discovery, Market Research, Services, Marketing
- [ ] Show current phase with visual indicator
- [ ] Add "Skip setup" action (calls `/v1/agent/skip-onboarding`)
- [ ] Style with HANDLED design system (sage accents, subtle)
- [ ] Handle unknown phases gracefully (fallback to first phase)

**Props Interface**:

```typescript
interface OnboardingProgressProps {
  currentPhase: OnboardingPhase;
  onSkip: () => Promise<void>;
  isSkipping?: boolean; // Loading state for skip action
  className?: string;
}
```

**Quality Requirements**:

- [ ] ARIA labels for accessibility (screen reader support)
- [ ] Loading state when skip is in progress
- [ ] Error handling if skip fails (show error, allow retry)
- [ ] Keyboard accessible (skip button focusable)

**Success Criteria**:

- [ ] Phase indicator shows correct current phase
- [ ] Skip action transitions to SKIPPED state
- [ ] Styling matches HANDLED brand
- [ ] Accessible via keyboard and screen reader

---

### Phase 4.3: GrowthAssistantPanel Updates (1-2 hours)

**Goal**: Detect onboarding mode and show appropriate UI with storefront link

**Tasks**:

- [ ] Modify `GrowthAssistantPanel.tsx` to detect `tenant.onboardingPhase`
- [ ] Show `OnboardingProgress` when in onboarding mode
- [ ] Adjust welcome message for new vs returning users
- [ ] Add prominent "View your storefront" link (replaces complex preview panel)
- [ ] Handle skip action with proper error handling

**Onboarding Mode Detection**:

```typescript
const isOnboarding = tenant.onboardingPhase !== 'COMPLETED' && tenant.onboardingPhase !== 'SKIPPED';
```

**Storefront Link (instead of live preview)**:

```tsx
// Simple, stable, no polling needed
{
  isOnboarding && (
    <a
      href={`/t/${tenant.slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-4 py-2 bg-sage/10 hover:bg-sage/20
               rounded-lg text-sage-dark transition-colors"
    >
      <ExternalLinkIcon className="w-4 h-4" />
      <span>View your storefront</span>
    </a>
  );
}
```

**Welcome Messages**:

```typescript
// New user
"Hey! I'm here to help you set up {businessName}. Instead of filling out forms,
we'll just have a conversation and I'll handle the setup for you.

So — what kind of services do you offer?"

// Returning user (from advisor memory)
"Welcome back! I remember you're a {businessType} in {city}.
We've created {packageCount} packages so far. Ready to continue?"
```

**Quality Requirements**:

- [ ] Feature-flaggable (can disable onboarding mode if issues arise)
- [ ] Graceful fallback if tenant.onboardingPhase is undefined
- [ ] Link opens in new tab with proper security attributes
- [ ] Welcome message uses safe string interpolation (no XSS)

**Success Criteria**:

- [ ] Onboarding mode detected correctly
- [ ] Progress indicator visible during onboarding
- [ ] Different welcome for new vs returning users
- [ ] Storefront link works and opens in new tab
- [ ] Existing chat functionality unchanged for non-onboarding users

---

### Phase 4.4: E2E Tests (2 hours)

**Goal**: Focused coverage of critical paths with Playwright

**Test Scenarios** (4 core scenarios, per review feedback):

1. **Happy Path**: Discovery → Market Research → Services → Marketing → Done
2. **Skip Scenario**: User skips onboarding, state is SKIPPED
3. **Resume Scenario**: User leaves and returns, sees context summary
4. **Tenant Isolation**: User only sees their own packages

**Tasks**:

- [ ] Create `e2e/tests/onboarding-flow.spec.ts`
- [ ] Write test for complete happy path (most critical)
- [ ] Write test for skip scenario
- [ ] Write test for resume with context
- [ ] Write test for tenant isolation (security)

**Quality Requirements**:

- [ ] Use stable selectors (data-testid, not CSS classes)
- [ ] Add retry logic for async operations (agent responses)
- [ ] Clean up test data after each test
- [ ] Test both success and failure paths for skip action

**Test Structure**:

```typescript
// e2e/tests/onboarding-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as test tenant, reset onboarding state
  });

  test('completes full onboarding happy path', async ({ page }) => {
    // Discovery phase
    await expect(page.getByText('what kind of services')).toBeVisible();
    await page.getByRole('textbox').fill('I am a wedding photographer');
    // ... continue through phases
    await expect(page.getByText('Onboarding Complete')).toBeVisible();
  });

  test('skips onboarding when user requests', async ({ page }) => {
    await page.getByRole('button', { name: 'Skip setup' }).click();
    await expect(page.locator('[data-testid="onboarding-progress"]')).not.toBeVisible();
  });

  test('resumes with context when user returns', async ({ page }) => {
    // Complete discovery, leave, return
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('photographer')).toBeVisible();
  });

  test('isolates data between tenants', async ({ page, context }) => {
    // Login as tenant A, create packages
    // Login as tenant B, verify no packages visible
  });
});
```

**Success Criteria**:

- [ ] All 4 scenarios pass consistently
- [ ] Tests run in < 2 minutes
- [ ] No flaky tests (stable selectors, proper waits)
- [ ] Clean test isolation (no cross-test pollution)

---

## Technical Specifications

### API Endpoints (Backend)

All required endpoints already exist:

| Endpoint                     | Method | Purpose               | Status    |
| ---------------------------- | ------ | --------------------- | --------- |
| `/v1/agent/chat`             | POST   | Send message to agent | ✅ EXISTS |
| `/v1/agent/onboarding-state` | GET    | Get current phase     | ✅ EXISTS |
| `/v1/agent/skip-onboarding`  | POST   | Skip onboarding       | ✅ EXISTS |

**Note**: No new preview endpoint needed - storefront page (`/t/[slug]`) already renders this data.

### State Management (Simplified)

Use existing tenant data instead of new context:

```typescript
// In GrowthAssistantPanel.tsx - no new context needed
const isOnboarding = tenant.onboardingPhase !== 'COMPLETED' && tenant.onboardingPhase !== 'SKIPPED';

// Skip action
const handleSkip = async () => {
  try {
    setIsSkipping(true);
    await fetch('/api/agent/skip-onboarding', { method: 'POST' });
    router.refresh(); // Refresh tenant data
  } catch (error) {
    setSkipError('Failed to skip. Please try again.');
  } finally {
    setIsSkipping(false);
  }
};
```

---

## Success Metrics

| Metric                     | Target           | Measurement              |
| -------------------------- | ---------------- | ------------------------ |
| Onboarding completion rate | 80%              | Completed / Started      |
| Time to first package      | < 10 min         | Event timestamps         |
| E2E test coverage          | 4 core scenarios | Test pass rate           |
| Skip success rate          | 100%             | No errors on skip action |

---

## Risk Mitigation

| Risk                       | Mitigation                                      |
| -------------------------- | ----------------------------------------------- |
| Unknown phase from backend | Graceful fallback to NOT_STARTED                |
| Skip action fails          | Show error message, allow retry                 |
| E2E test flakiness         | Use stable selectors, add retries, proper waits |
| Existing chat broken       | Feature-flag onboarding mode for quick rollback |

---

## Deferred Items (Post-Phase 4)

These can be addressed in a cleanup sprint after Phase 4:

1. **Orchestrator Refactoring** (3-4h) - Extract SessionManager, ToolDispatcher
2. **Duplicate Tool Logic** (2-3h) - DRY validation helpers
3. **Live Preview Panel** - If user feedback requests real-time preview
4. **Two-Panel Layout** - If user feedback requests side-by-side view

---

## File Summary

### New Files

```
apps/web/src/components/onboarding/
└── OnboardingProgress.tsx        # Phase completion indicator

server/test/integration/
└── onboarding-flow.test.ts       # Integration tests

e2e/tests/
└── onboarding-flow.spec.ts       # E2E tests
```

### Modified Files

```
apps/web/src/components/agent/GrowthAssistantPanel.tsx    # Onboarding mode + storefront link
```

---

## Execution Order (Recommended)

```
Session 1 (3-4h):
└── Phase 4.1: Integration Tests      [3-4h]
    ├── 4-5 focused tests
    ├── Mock adapters for speed
    └── Real DB for 1-2 critical paths

Session 2 (2-3h):
├── Phase 4.2: OnboardingProgress     [1h]
│   ├── Progress dots component
│   ├── Skip button with loading state
│   └── Accessibility (ARIA labels)
│
└── Phase 4.3: GrowthAssistant mods   [1-2h]
    ├── Onboarding mode detection
    ├── Welcome messages
    └── Storefront link

Session 3 (2h):
└── Phase 4.4: E2E Tests              [2h]
    ├── Happy path
    ├── Skip scenario
    ├── Resume with context
    └── Tenant isolation
```

**Total: 6-8 hours** for quality implementation

---

## References

### Internal

- `plans/agent-powered-tenant-onboarding.md` - Master plan
- `server/src/agent/prompts/onboarding-system-prompt.ts:225` - Phase guidance
- `server/src/agent/onboarding/advisor-memory.service.ts` - Memory service
- `apps/web/src/components/agent/GrowthAssistantPanel.tsx` - Existing panel

### Commits

- `c712580` feat(onboarding): implement Phase 3 session resumption
- `c11cda2` feat(onboarding): implement Phase 2 tools and market research
- `903da20` feat(onboarding): implement Phase 1 agent-powered tenant onboarding

### Documentation

- `docs/solutions/patterns/agent-phase-3-onboarding-system-prompt-injection-MAIS-20251231.md`
- `docs/design/BRAND_VOICE_GUIDE.md` - HANDLED brand styling
