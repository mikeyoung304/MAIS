# useDraftConfig Silent Auth Failure

---

title: "useDraftConfig Silent Auth Failure - Preview Shows Default Config"
slug: usedraftconfig-silent-auth-failure
category: ui-bugs
severity: P1
component: apps/web/hooks/useDraftConfig.ts, apps/web/components/dashboard/ContentArea.tsx
symptoms:

- Preview iframe shows DEFAULT config `[Your Transformation Headline]` instead of actual draft
- Auth "Failed to fetch" error in console but no visible error to user
- AI agent updates work (data saved to DB) but preview doesn't reflect them
- Preview works after fresh login but breaks after session expires
  root_cause: useDraftConfig treated ALL non-200 responses as "use defaults" including 401 auth errors
  solution_verified: true
  created: 2026-01-22
  pitfall_id: 72
  related_issues:
- FLUID_CANVAS_PREVIEW_UPDATES.md
- PREVIEW_CONNECTION_FAILED_ROOT_CAUSE.md
  tags:
- preview
- authentication
- silent-failure
- TanStack-Query
- error-handling

---

## Problem Statement

When the user's auth session expired or an API error occurred:

1. Console showed "Failed to fetch" auth error
2. useDraftConfig API call returned 401
3. Hook silently returned `DEFAULT_PAGES_CONFIG` instead of throwing
4. Preview iframe rendered `[Your Transformation Headline]` placeholder text
5. User had no indication anything was wrong - data appeared to be missing

## Root Cause Analysis

### The Silent Failure Bug (useDraftConfig.ts:122-126)

```typescript
// BEFORE (broken) - lines 122-126:
// Other errors - fallback to defaults
logger.warn('[useDraftConfig] Unexpected response, using defaults', {
  status: response.status,
});
return { pages: DEFAULT_PAGES_CONFIG, hasDraft: false, version: 0 };
```

This code treated 401 (unauthorized), 403 (forbidden), and 500+ (server errors) the same as 404 (no config yet) - all became "use defaults".

### Why This Was Wrong

| Status | Meaning         | Correct Action                           |
| ------ | --------------- | ---------------------------------------- |
| 200    | Success         | Use returned data                        |
| 404    | No config yet   | Use defaults (recoverable)               |
| 401    | Session expired | **Throw error** - user needs to re-login |
| 403    | Not authorized  | **Throw error** - security issue         |
| 500+   | Server down     | **Throw error** - temporary failure      |

### The Missing Error Handler (ContentArea.tsx)

ContentArea called `useDraftConfig()` but only used `config`, `hasDraft`, `invalidate`, `isLoading` - ignoring the `error` field entirely.

## Solution

### 1. Proper Error Classification (useDraftConfig.ts)

```typescript
// 404 means tenant not found or no config - use defaults (recoverable)
if (response.status === 404) {
  logger.debug('[useDraftConfig] No config found, using defaults');
  return { pages: DEFAULT_PAGES_CONFIG, hasDraft: false, version: 0 };
}

// Auth errors - throw to show error state (user needs to re-login)
// CRITICAL: Don't silently use defaults - this causes the "DEFAULT config in preview" bug
if (response.status === 401 || response.status === 403) {
  logger.error('[useDraftConfig] Authentication error', { status: response.status });
  throw new Error('Session expired. Please refresh the page to log in again.');
}

// Server errors - throw to show error state
if (response.status >= 500) {
  logger.error('[useDraftConfig] Server error', { status: response.status });
  throw new Error(`Server error (${response.status}). Please try again later.`);
}

// Other unexpected errors - throw to surface the problem
logger.warn('[useDraftConfig] Unexpected response status', { status: response.status });
throw new Error(`Failed to load draft configuration (${response.status})`);
```

### 2. Error Display in ContentArea (ContentArea.tsx)

```typescript
const { config, hasDraft, invalidate, isLoading, error: draftError, refetch } = useDraftConfig();

// Check for draft config errors first (auth failures, server errors)
// This prevents the silent "DEFAULT config in preview" bug
if (draftError && view.status === 'preview') {
  return (
    <div className={cn('h-full', className)} data-testid="content-area-draft-error">
      <ErrorView error={draftError.message} onRetry={refetch} />
    </div>
  );
}
```

## Files Changed

| File                                                | Change                                                     |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `apps/web/src/hooks/useDraftConfig.ts`              | Throw errors for 401/403/500 instead of returning defaults |
| `apps/web/src/components/dashboard/ContentArea.tsx` | Check `draftError` and show ErrorView                      |

## Before/After

| Scenario               | Before                        | After                          |
| ---------------------- | ----------------------------- | ------------------------------ |
| Session expired        | Silent defaults, confusing UI | Clear error message with retry |
| Server error           | Silent defaults               | Error message with retry       |
| No config (new tenant) | Defaults (correct)            | Defaults (unchanged)           |
| Network failure        | Logged but silent defaults    | TanStack Query retry + error   |

## Prevention Strategies

### Pitfall #72: Silent error fallbacks in data fetching hooks

**Anti-pattern:**

```typescript
// BAD - masks auth/server failures as "no data"
if (response.status !== 200) {
  return { data: [], hasData: false };
}
```

**Correct pattern:**

```typescript
// GOOD - distinguish recoverable (404) from unrecoverable (401/500)
if (response.status === 404) {
  return { data: [], hasData: false };
}
if (response.status === 401 || response.status === 403) {
  throw new Error('Session expired');
}
if (response.status >= 500) {
  throw new Error('Server error');
}
throw new Error(`Unexpected error (${response.status})`);
```

### Checklist for Data Fetching Hooks

- [ ] 404 = legitimate "not found" → return empty state
- [ ] 401/403 = auth failure → throw error with user-facing message
- [ ] 500+ = server failure → throw error with retry suggestion
- [ ] Other codes → throw error (don't silently mask)
- [ ] Consumer component checks `error` field and shows error UI
- [ ] Error UI has retry action (refetch)

## Related Issues

- **FLUID_CANVAS_PREVIEW_UPDATES.md** - Related preview system fixes
- **PREVIEW_CONNECTION_FAILED_ROOT_CAUSE.md** - PostMessage handshake issues

## Keywords

useDraftConfig, silent failure, 401, authentication, preview defaults, TanStack Query, error handling, ContentArea
