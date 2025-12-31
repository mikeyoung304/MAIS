---
module: MAIS
date: 2025-12-31
problem_type: prevention_strategy
component: apps/web/src/hooks, apps/web/src/app/api
phase: Frontend & API Development
symptoms:
  - 401 responses handled without explicit state tracking
  - Auth failures silently reset state without user feedback
  - No distinction between network errors and auth failures
  - Auth state UI falls out of sync with actual auth status
severity: P1
related_files:
  - apps/web/src/hooks/useOnboardingState.ts
  - apps/web/src/lib/auth-client.ts
  - apps/web/src/app/(protected)/layout.tsx
tags: [authentication, error-handling, state-management, ux-patterns, security]
---

# Silent Auth Failures Prevention Strategies

This document captures the root causes of unhandled 401 errors and provides patterns to ensure explicit state tracking for all authentication failures.

## Executive Summary

Silent auth failures occur when 401 responses are caught but dismissed without:

1. **Explicit state tracking** - No indication that auth failed
2. **User feedback** - Silent redirects without explanation
3. **Error recovery** - No path back to login
4. **Monitoring** - No way to track how often this happens

**P1 Problems:**

- User loses work without knowing why (silent logout)
- Page appears broken (data doesn't load) instead of "please login"
- Can't debug auth issues in production
- Creates security confusion (user thinks they're logged in but aren't)

**P2 Problems:**

- Code is hard to test (where does 401 go?)
- Error handling scattered across components
- Inconsistent UX (some pages redirect, others show nothing)

---

## Issue 1: 401 Handled Without State Tracking

### The Problem

When `fetch()` returns 401, the current pattern dismisses it without explicit state:

```typescript
// PROBLEMATIC: 401 silently resets state
if (response.status === 401) {
  setState(null); // Clears data but what about showing error?
  return; // Silent exit - no indication to user
}
```

**What users see:** Page becomes empty, they don't know why

**What developers see:** No error logs, hard to debug

### Code Review Finding

**File:** `apps/web/src/hooks/useOnboardingState.ts` (lines 59-65)

```typescript
if (response.status === 401) {
  // User is not authenticated - track this explicitly
  setIsAuthenticated(false);
  setState(null);
  return;
}
```

**Issues:**

1. No distinction between "first login check" vs "session expired during use"
2. `setIsAuthenticated(false)` is set but component doesn't necessarily use it
3. Silent return means error state isn't set (UI has no error to show)
4. No recovery path (component doesn't offer "login again" option)

### The Fix

**Step 1: Create explicit auth error type**

```typescript
// apps/web/src/lib/auth-errors.ts
export type AuthErrorType =
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED'
  | 'INVALID_TOKEN'
  | 'SESSION_REVOKED'
  | 'NETWORK_ERROR';

export interface AuthError {
  type: AuthErrorType;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

export class AuthFailureError extends Error {
  constructor(
    public readonly errorType: AuthErrorType,
    message: string,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = 'AuthFailureError';
  }
}
```

**Step 2: Explicit state tracking in hook**

```typescript
// apps/web/src/hooks/useOnboardingState.ts (improved)
interface AuthState {
  isAuthenticated: boolean | null; // null = unknown, true = yes, false = no
  authError: AuthError | null;
  lastAuthCheck: Date | null;
}

export function useOnboardingState() {
  const [state, setState] = useState<OnboardingStateResponse | null>(null);
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: null,
    authError: null,
    lastAuthCheck: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_PROXY}/onboarding-state`);

      // Explicit 401 handling with error tracking
      if (response.status === 401) {
        const authError: AuthError = {
          type: 'SESSION_EXPIRED',
          message: 'Your session has expired. Please log in again.',
          timestamp: new Date(),
          recoverable: true,
        };

        setAuthState({
          isAuthenticated: false,
          authError,
          lastAuthCheck: new Date(),
        });

        // IMPORTANT: Set error so UI can show recovery option
        setError('Session expired. Please log in again.');
        setState(null);

        // IMPORTANT: Log for monitoring
        logger.warn('Auth session expired during onboarding fetch', {
          endpoint: '/onboarding-state',
          previousAuthState: authState,
        });

        return;
      }

      // Other HTTP errors
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      // Success: Auth is valid
      setAuthState({
        isAuthenticated: true,
        authError: null,
        lastAuthCheck: new Date(),
      });

      const data = await response.json();
      setState(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setState(null);

      // Track non-auth errors separately
      if (!(err instanceof AuthFailureError)) {
        logger.error('Onboarding fetch failed', {
          error: message,
          authState: authState.isAuthenticated,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [authState]);

  return {
    // ... existing returns
    authState, // NEW: Explicit auth status
    isAuthenticated: authState.isAuthenticated,
    authError: authState.authError,
    lastAuthCheck: authState.lastAuthCheck,
  };
}
```

**Step 3: Component handles auth error explicitly**

```typescript
// apps/web/src/app/onboarding/page.tsx
export default function OnboardingPage() {
  const {
    state,
    isLoading,
    error,
    isAuthenticated,    // NEW
    authError,          // NEW
    lastAuthCheck,      // NEW
  } = useOnboardingState();

  // Explicit auth failure UI
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-400">Session Expired</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-text-muted">{authError?.message}</p>
            <p className="text-sm text-text-muted">
              Last checked: {lastAuthCheck?.toLocaleTimeString()}
            </p>
            <Button
              asChild
              className="w-full bg-sage hover:bg-sage-hover"
            >
              <Link href="/login">
                Log In Again
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rest of component...
  return (
    // ...
  );
}
```

### Prevention Checklist

**When handling API responses in hooks/actions:**

- [ ] 401 responses create explicit `AuthError` object
- [ ] `isAuthenticated` is set to `false` (not just `null`)
- [ ] `error` state is set with user-friendly message
- [ ] Logging includes context (endpoint, previous auth state)
- [ ] Component has recovery path (link to login page)
- [ ] No silent returns from error handlers

**When creating auth hooks:**

- [ ] Hook tracks `isAuthenticated: boolean | null`
- [ ] `authError: AuthError | null` object exists
- [ ] `lastAuthCheck: Date` timestamp available for debugging
- [ ] All 401s logged with context
- [ ] Hook returns enough info for UI to react

**When rendering components:**

- [ ] Check `isAuthenticated === false` before rendering data
- [ ] Show explicit "session expired" UI when auth fails
- [ ] Provide "log in again" button
- [ ] Never silently clear state without user feedback

### Code Pattern to Follow

**Generic API call pattern with explicit auth handling:**

```typescript
// apps/web/src/lib/api-client.ts
export interface ApiCallOptions {
  onAuthFailed?: (error: AuthError) => void;
  onError?: (error: Error) => void;
  silent?: boolean; // If true, don't show error to user
}

export async function apiFetch<T>(endpoint: string, options?: ApiCallOptions): Promise<T | null> {
  try {
    const response = await fetch(endpoint);

    // Explicit 401 handling
    if (response.status === 401) {
      const authError: AuthError = {
        type: 'SESSION_EXPIRED',
        message: 'Your session has expired.',
        timestamp: new Date(),
        recoverable: true,
      };

      logger.warn('API auth failed', { endpoint });

      // Call the callback if provided
      options?.onAuthFailed?.(authError);

      // Throw so component can catch if needed
      throw new AuthFailureError('SESSION_EXPIRED', authError.message, true);
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof AuthFailureError) {
      // Auth errors are handled above
      throw error;
    }

    // Other errors
    const message = error instanceof Error ? error.message : 'Unknown error';
    options?.onError?.(error instanceof Error ? error : new Error(message));

    return null;
  }
}

// Usage in component
export function useDashboardData() {
  const [data, setData] = useState(null);
  const [authError, setAuthError] = useState<AuthError | null>(null);
  const router = useRouter();

  useEffect(() => {
    apiFetch('/api/dashboard', {
      onAuthFailed: (error) => {
        setAuthError(error);
        // Optional: Auto-redirect after delay
        setTimeout(() => router.push('/login'), 2000);
      },
      onError: (error) => {
        logger.error('Dashboard fetch failed', error);
      },
    }).then(setData);
  }, [router]);

  return { data, authError };
}
```

### Testing Recommendation

**Test explicit auth error handling:**

```typescript
// apps/web/__tests__/auth-error-handling.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useOnboardingState } from '@/hooks/useOnboardingState';

describe('useOnboardingState auth error handling', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('should set explicit auth error on 401', async () => {
    (global.fetch as any).mockResolvedValue({
      status: 401,
      ok: false,
    });

    const { result } = renderHook(() => useOnboardingState());

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.authError?.type).toBe('SESSION_EXPIRED');
      expect(result.current.error).toBeDefined();
    });
  });

  it('should preserve auth error timestamp', async () => {
    (global.fetch as any).mockResolvedValue({
      status: 401,
      ok: false,
    });

    const { result } = renderHook(() => useOnboardingState());
    const beforeTime = new Date();

    await waitFor(() => {
      expect(result.current.lastAuthCheck).toBeDefined();
      expect(result.current.lastAuthCheck!.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    });
  });

  it('should set recoverable flag for temporary session expiry', async () => {
    (global.fetch as any).mockResolvedValue({
      status: 401,
      ok: false,
    });

    const { result } = renderHook(() => useOnboardingState());

    await waitFor(() => {
      expect(result.current.authError?.recoverable).toBe(true);
    });
  });
});
```

---

## Issue 2: Inconsistent Error Handling Between 401 and Other Errors

### The Problem

Different parts of the code handle auth errors differently:

```typescript
// Pattern 1: useOnboardingState
if (response.status === 401) {
  setIsAuthenticated(false);
  setState(null);
  return;
}

// Pattern 2: useAuth hook
if (response.status === 401) {
  throw new Error('Unauthorized');
}

// Pattern 3: Server action
return { success: false, error: 'Unauthorized' };
```

**Result:** No consistent way to handle auth failures across the app

### The Fix

**Create unified auth error handler:**

```typescript
// apps/web/src/lib/auth-error-handler.ts
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

export interface AuthErrorHandlerOptions {
  autoRedirect?: boolean;
  redirectDelay?: number;
  onAuthFailed?: (error: AuthError) => void;
  silent?: boolean;
}

export function useAuthErrorHandler(options: AuthErrorHandlerOptions = {}) {
  const router = useRouter();
  const { autoRedirect = true, redirectDelay = 2000, onAuthFailed, silent = false } = options;

  const handleAuthError = useCallback(
    (error: AuthError | Response) => {
      const authError: AuthError =
        error instanceof Response
          ? {
              type: 'SESSION_EXPIRED',
              message: 'Your session has expired. Please log in again.',
              timestamp: new Date(),
              recoverable: true,
            }
          : error;

      if (!silent) {
        logger.warn('Auth error handled', authError);
      }

      onAuthFailed?.(authError);

      if (autoRedirect) {
        setTimeout(() => router.push('/login'), redirectDelay);
      }

      return authError;
    },
    [autoRedirect, redirectDelay, onAuthFailed, silent, router]
  );

  const handleResponse = useCallback(
    async (response: Response) => {
      if (response.status === 401) {
        const authError = handleAuthError(response);
        throw new AuthFailureError('SESSION_EXPIRED', authError.message, true);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    },
    [handleAuthError]
  );

  return { handleAuthError, handleResponse };
}
```

### Prevention Checklist

- [ ] All 401s go through unified error handler
- [ ] Error handler logs consistently
- [ ] Error handler calls `onAuthFailed` callback
- [ ] No silent 401 dismissals
- [ ] Auth errors tested with specific error types

---

## Issue 3: No Monitoring/Debugging Info for Auth Failures

### The Problem

When 401 happens, there's no way to know:

- When it happened
- Which endpoint triggered it
- Was the user in the middle of something?
- Did they refresh the page or did token expire naturally?

### The Fix

**Add auth event tracking:**

```typescript
// apps/web/src/lib/auth-event-logger.ts
export type AuthEventType =
  | 'SESSION_START'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'TOKEN_REFRESH'
  | 'TOKEN_INVALID'
  | 'LOGIN_SUCCESS'
  | 'LOGOUT';

export interface AuthEvent {
  type: AuthEventType;
  timestamp: Date;
  endpoint?: string;
  previousState?: boolean; // Previous isAuthenticated value
  nextState?: boolean; // New isAuthenticated value
  context?: Record<string, unknown>;
}

export class AuthEventLogger {
  private events: AuthEvent[] = [];

  logEvent(event: Omit<AuthEvent, 'timestamp'>) {
    const authEvent: AuthEvent = {
      ...event,
      timestamp: new Date(),
    };

    this.events.push(authEvent);

    // Keep only last 50 events
    if (this.events.length > 50) {
      this.events.shift();
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`Auth Event: ${event.type}`);
      console.log('Event:', authEvent);
      console.log('Event history:', this.getRecentEvents(5));
      console.groupEnd();
    }

    // Send to monitoring in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(authEvent);
    }
  }

  getRecentEvents(count: number = 10): AuthEvent[] {
    return this.events.slice(-count);
  }

  private sendToMonitoring(event: AuthEvent) {
    // Send to your monitoring service (Sentry, LogRocket, etc.)
    navigator.sendBeacon('/api/auth-events', JSON.stringify(event));
  }
}

export const authEventLogger = new AuthEventLogger();
```

**Use in auth hook:**

```typescript
// apps/web/src/hooks/useAuth.ts
export function useAuth() {
  const [authState, setAuthState] = useState(/* ... */);

  const handleAuthStateChange = useCallback((previousState: boolean | null, newState: boolean) => {
    authEventLogger.logEvent({
      type: newState ? 'LOGIN_SUCCESS' : 'SESSION_EXPIRED',
      previousState,
      nextState: newState,
    });

    setAuthState(newState);
  }, []);

  return {
    /* ... */
  };
}
```

### Prevention Checklist

- [ ] Auth events logged with timestamp
- [ ] Event history preserved for debugging
- [ ] Events sent to monitoring service
- [ ] Development logging includes full event context
- [ ] Production logging excludes sensitive data

---

## Code Review Checklist: Auth Error Handling

### For All Hooks/Actions that Call APIs

**401 Response Handling:**

- [ ] 401 check is explicit (not wrapped in generic error)
- [ ] `isAuthenticated` state is set to `false` (never just cleared)
- [ ] `error` state is set with user-readable message
- [ ] Auth error object created with type, message, timestamp
- [ ] Event logged with context (endpoint, previous state)

**Recovery Options:**

- [ ] UI shows explicit auth failure message
- [ ] User can click "log in again" button
- [ ] Redirect to login page (auto or manual)
- [ ] No infinite loops (check redirect logic)

**Testing:**

- [ ] 401 handling tested specifically (not just in error test)
- [ ] Auth state changes verified
- [ ] Logging called with correct parameters
- [ ] Recovery UI renders correctly

### Review Questions to Ask

1. **"What happens when this API returns 401?"**
   - Should be: "Auth error is logged, UI shows auth expired message"
   - Not: "State is cleared silently"

2. **"Could a user end up seeing an empty page without knowing why?"**
   - If yes: Need explicit auth failure UI

3. **"How would we debug this if a user reported 'it stopped working'?"**
   - Should have: Timestamps, endpoints, state changes in logs

---

## Quick Reference: Auth Error Handling Pattern

```typescript
// ✅ DO: Explicit auth error handling
if (response.status === 401) {
  const authError: AuthError = {
    type: 'SESSION_EXPIRED',
    message: 'Your session expired. Please log in again.',
    timestamp: new Date(),
    recoverable: true,
  };

  setIsAuthenticated(false);
  setAuthError(authError);
  setError(authError.message);

  logger.warn('Auth session expired', {
    endpoint,
    previousState: isAuthenticated,
  });

  return;
}

// ❌ DON'T: Silent dismissal
if (response.status === 401) {
  setState(null);
  return;
}
```

---

## Summary

| Aspect             | Pattern                                                            |
| ------------------ | ------------------------------------------------------------------ |
| **State Tracking** | `isAuthenticated: boolean \| null`, `authError: AuthError \| null` |
| **Error Type**     | `AuthError` with type, message, timestamp, recoverable flag        |
| **Logging**        | Every 401 logged with endpoint, state change, context              |
| **User Feedback**  | Explicit UI showing auth expired, login button                     |
| **Recovery**       | Link to `/login` or auto-redirect with delay                       |
| **Testing**        | 401 handling tested separately from other errors                   |

**Golden Rule:** Every 401 response should result in:

1. Explicit state change (isAuthenticated = false)
2. User-visible feedback (error message)
3. Recovery option (link to login)
4. Monitoring log (for debugging)
