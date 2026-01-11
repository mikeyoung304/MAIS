# Impersonation Navigation - Code Patterns & Implementation Guide

## Overview

This document provides copy-paste ready code patterns for implementing impersonation in Next.js with proper hydration safety, session management, and navigation.

---

## Pattern 1: The isHydrated Hook

### Reusable Hook (Create Once, Use Everywhere)

**File:** `apps/web/src/hooks/useHydrated.ts`

````typescript
'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook to detect when component has hydrated on client.
 *
 * Used to prevent hydration mismatches when rendering session-dependent content.
 * During SSR and initial client render, returns false. After first useEffect,
 * returns true, indicating safe to render dynamic content.
 *
 * @returns {boolean} true if component has hydrated, false during SSR/hydration
 *
 * @example
 * ```tsx
 * export function UserBanner() {
 *   const isHydrated = useHydrated();
 *   const { user } = useAuth();
 *
 *   if (!isHydrated) return null;
 *   return <div>Welcome {user.email}</div>;
 * }
 * ```
 */
export function useHydrated(): boolean {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return isHydrated;
}
````

### Usage in Components

```typescript
'use client';

import { useHydrated } from '@/hooks/useHydrated';
import { useAuth } from '@/lib/auth-client';

export function ImpersonationBanner() {
  const isHydrated = useHydrated();
  const { impersonation, isLoading } = useAuth();

  // Safe: both server and client return null during hydration
  if (!isHydrated || isLoading) {
    return null;
  }

  // Safe: now we know session data is available
  if (!impersonation) {
    return null;
  }

  return (
    <div className="bg-amber-950 p-3 text-amber-400">
      Viewing as: <strong>{impersonation.tenantSlug}</strong>
    </div>
  );
}
```

---

## Pattern 2: Hydration-Safe Date Formatting

### Utility Function

**File:** `apps/web/src/lib/date-utils.ts`

````typescript
/**
 * Format a date string in a hydration-safe way.
 *
 * Uses ISO format (YYYY-MM-DD) which is consistent across server and client.
 * Avoids toLocaleDateString() which varies by server locale vs client locale.
 *
 * @param dateString - ISO date string from API
 * @returns - Formatted date string (YYYY-MM-DD)
 *
 * @example
 * ```tsx
 * formatDate('2026-01-06T12:34:56Z') // returns '2026-01-06'
 * ```
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

/**
 * Format a date string with time in hydration-safe way.
 *
 * @param dateString - ISO date string from API
 * @returns - Formatted datetime string (YYYY-MM-DD HH:mm)
 *
 * @example
 * ```tsx
 * formatDateTime('2026-01-06T12:34:56Z') // returns '2026-01-06 12:34'
 * ```
 */
export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const iso = date.toISOString();
  return iso.substring(0, 16).replace('T', ' ');
}

/**
 * Format a date string with relative time (e.g., "2 hours ago").
 *
 * Uses hydration-safe relative time formatting.
 * Returns null during SSR to prevent hydration mismatch.
 *
 * @param dateString - ISO date string from API
 * @param isHydrated - true if component has hydrated
 * @returns - Relative time string or null during SSR
 *
 * @example
 * ```tsx
 * const isHydrated = useHydrated();
 * formatRelativeTime('2026-01-06T11:34:56Z', isHydrated)
 * // returns '1 hour ago' (client only)
 * // returns null (server/hydration)
 * ```
 */
export function formatRelativeTime(dateString: string, isHydrated: boolean): string | null {
  if (!isHydrated) {
    return null; // Prevent mismatch during hydration
  }

  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return formatDate(dateString);
}
````

### Usage in Components

```typescript
'use client';

import { formatDate, formatDateTime, formatRelativeTime } from '@/lib/date-utils';
import { useHydrated } from '@/hooks/useHydrated';

interface TenantCardProps {
  tenant: {
    id: string;
    name: string;
    createdAt: string;
  };
}

export function TenantCard({ tenant }: TenantCardProps) {
  const isHydrated = useHydrated();

  return (
    <div className="p-4 border rounded">
      <h3>{tenant.name}</h3>

      {/* ✅ Safe: always same format */}
      <p className="text-sm text-gray-600">
        Created: {formatDate(tenant.createdAt)}
      </p>

      {/* ✅ Safe: with time component */}
      <p className="text-sm text-gray-600">
        Joined: {formatDateTime(tenant.createdAt)}
      </p>

      {/* ⚠️ Safe ONLY because guarded by isHydrated */}
      <p className="text-sm text-gray-600">
        {formatRelativeTime(tenant.createdAt, isHydrated) || 'Loading...'}
      </p>
    </div>
  );
}
```

---

## Pattern 3: Server Action - Impersonate Tenant

### Complete Server Action Implementation

**File:** `apps/web/src/app/(protected)/admin/tenants/actions.ts`

```typescript
'use server';

import { auth, unstable_update, getBackendToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { logger } from '@/lib/logger';
import { API_URL } from '@/lib/config';

/**
 * API response from impersonation endpoint
 */
interface ImpersonateResponse {
  token: string;
  email: string;
  role: 'PLATFORM_ADMIN' | 'TENANT_ADMIN';
  tenantId: string;
  slug: string;
  impersonation: {
    tenantId: string;
    tenantSlug: string;
    tenantEmail: string;
    startedAt: string;
  };
}

/**
 * Result type for impersonation action.
 * Returns success status instead of redirecting directly.
 * This allows client to handle navigation with proper session refresh.
 */
export type ImpersonationResult =
  | {
      success: true;
      redirectTo: string;
    }
  | {
      success: false;
      error: string;
    };

/**
 * Safely parse JSON response, handling non-JSON error responses
 */
async function safeParseJSON<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text || `Request failed with status ${response.status}`);
  }
}

/**
 * Impersonate a tenant
 *
 * Allows PLATFORM_ADMIN to view the platform as a specific tenant.
 *
 * Key Steps:
 * 1. Validate user is PLATFORM_ADMIN
 * 2. Fetch new impersonation token from backend API
 * 3. Update backend token cookie (httpOnly)
 * 4. Use unstable_update() to sync JWT session (NOT signIn())
 * 5. Invalidate RSC cache with revalidatePath()
 * 6. Return redirect URL to client
 * 7. Client does window.location.href for full page reload
 *
 * ERROR HANDLING:
 * - Catch unstable_update() failures
 * - Rollback backend token cookie
 * - Log detailed error
 * - Return error to client
 *
 * WHY NOT signIn()?
 * - signIn() uses cookies() internally, conflicts with Server Action
 * - signIn() requires password, we don't have it
 * - unstable_update() directly calls jwt callback, more reliable
 *
 * WHY window.location.href?
 * - Forces full page reload
 * - RSC cache invalidated
 * - Service worker cache bypassed
 * - SessionProvider refreshed
 * - All session-dependent components re-render with new data
 *
 * @param tenantId - ID of tenant to impersonate
 * @returns - Result with success status and redirect URL or error
 */
export async function impersonateTenant(tenantId: string): Promise<ImpersonationResult> {
  // Step 1: Validate authentication
  const session = await auth();

  if (!session?.user?.role || session.user.role !== 'PLATFORM_ADMIN') {
    logger.warn('Unauthorized impersonation attempt', {
      userId: session?.user?.id,
      role: session?.user?.role,
    });
    return { success: false, error: 'Unauthorized' };
  }

  // Step 2: Prevent nested impersonation
  if (session?.user?.impersonation) {
    logger.info('Attempted nested impersonation', {
      adminId: session.user.id,
      currentImpersonation: session.user.impersonation.tenantId,
    });
    return { success: false, error: 'Cannot impersonate while already impersonating' };
  }

  // Step 3: Get backend token
  const backendToken = await getBackendToken();
  if (!backendToken) {
    logger.error('No backend token available for impersonation');
    return { success: false, error: 'Not authenticated' };
  }

  // Step 4: Call backend API
  try {
    const response = await fetch(`${API_URL}/v1/auth/impersonate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${backendToken}`,
      },
      body: JSON.stringify({ tenantId }),
    });

    if (!response.ok) {
      const error = await safeParseJSON<{ message?: string }>(response);
      logger.error('Impersonation API failed', {
        status: response.status,
        error: error.message,
      });
      return { success: false, error: error.message || 'Impersonation failed' };
    }

    const data = await safeParseJSON<ImpersonateResponse>(response);

    // Step 5: Store original token for rollback if session update fails
    const cookieStore = await cookies();
    const originalToken = cookieStore.get('mais_backend_token')?.value;

    // Step 6: Update backend token cookie
    cookieStore.set('mais_backend_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 4 * 60 * 60, // 4 hours for impersonation sessions
      path: '/',
    });

    // Step 7: Update JWT session using unstable_update
    // Note: We cast to 'unknown' first because:
    // 1. MAISSession.user excludes backendToken (security - not sent to client)
    // 2. But JWT callback needs backendToken to sign the new JWT
    // 3. unstable_update passes this entire object to jwt callback with trigger='update'
    // 4. JWT callback in auth.ts extracts backendToken and includes impersonation data
    try {
      await unstable_update({
        user: {
          id: data.tenantId,
          email: data.email,
          role: data.role,
          tenantId: data.tenantId,
          slug: data.slug,
          impersonation: data.impersonation,
          backendToken: data.token, // Passed to JWT callback, not exposed to client
        } as unknown as { id: string; email: string },
      });
    } catch (error) {
      // Rollback backend token if session update fails
      logger.error('Failed to sync session after impersonation', { error });
      if (originalToken) {
        cookieStore.set('mais_backend_token', originalToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 24 * 60 * 60,
          path: '/',
        });
      } else {
        cookieStore.delete('mais_backend_token');
      }
      return { success: false, error: 'Failed to start impersonation session' };
    }

    // Step 8: Invalidate all RSC caches
    revalidatePath('/', 'layout');

    // Step 9: Log successful impersonation
    logger.info('Impersonation session started', {
      adminEmail: session.user.email,
      targetTenantId: data.tenantId,
      targetSlug: data.slug,
    });

    // Step 10: Return redirect URL to client
    // Client will do: window.location.href = result.redirectTo
    return { success: true, redirectTo: '/tenant/dashboard' };
  } catch (error) {
    logger.error('Impersonation request failed', { error });
    return { success: false, error: 'Impersonation request failed' };
  }
}
```

---

## Pattern 4: Client Component - Impersonate Button

### TenantsList with Impersonation Handling

**File:** `apps/web/src/app/(protected)/admin/tenants/TenantsList.tsx`

```typescript
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useHydrated } from '@/hooks/useHydrated';
import { formatDate } from '@/lib/date-utils';
import { impersonateTenant } from './actions';
import type { Tenant } from './types';

interface TenantsListProps {
  tenants: Tenant[];
}

export function TenantsList({ tenants }: TenantsListProps) {
  // Track which tenant is currently being impersonated for loading state
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);

  /**
   * Handle impersonation with proper session refresh
   *
   * Key points:
   * 1. Call server action directly (not in startTransition)
   * 2. Await the result
   * 3. Check result.success before navigating
   * 4. Use window.location.href for full page reload
   * 5. Reset loading state on error
   *
   * WHY NOT startTransition?
   * - Impersonation is async side effect (session update)
   * - React concurrent features can interfere
   * - Full page reload doesn't need optimistic UI
   *
   * WHY window.location.href?
   * - Forces complete page reload
   * - RSC cache invalidated
   * - Service worker cache bypassed
   * - SessionProvider refreshed with new session
   */
  const handleImpersonate = async (tenantId: string) => {
    setImpersonatingId(tenantId);

    try {
      const result = await impersonateTenant(tenantId);

      if (result.success) {
        // Full page reload to ensure fresh session state
        window.location.href = result.redirectTo;
      } else {
        // Reset state on error
        setImpersonatingId(null);
        console.error('Impersonation failed:', result.error);
        // TODO: Show toast error to user
      }
    } catch (error) {
      setImpersonatingId(null);
      console.error('Impersonation error:', error);
      // TODO: Show toast error to user
    }
  };

  // Filter and search implementation
  const filteredTenants = useMemo(() => {
    return tenants; // Add filtering logic as needed
  }, [tenants]);

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {filteredTenants.map((tenant) => (
        <div
          key={tenant.id}
          className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">{tenant.name}</h3>
            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
              {tenant.stripeConnected ? 'Stripe' : 'No Payments'}
            </span>
          </div>

          <p className="text-sm text-gray-600 mb-2">{tenant.email}</p>
          <p className="text-sm text-gray-600 mb-4">{tenant.slug}</p>

          {/* Hydration-safe date formatting */}
          <p className="text-xs text-gray-500 mb-4">
            Created: {formatDate(tenant.createdAt)}
          </p>

          <div className="flex gap-2">
            {/* Impersonate button with loading state */}
            <Button
              onClick={() => handleImpersonate(tenant.id)}
              disabled={impersonatingId === tenant.id}
              className="flex-1"
            >
              {impersonatingId === tenant.id ? 'Impersonating...' : 'Impersonate'}
            </Button>

            {/* View tenant site */}
            <Button variant="outline" asChild>
              <a href={`/t/${tenant.slug}`} target="_blank" rel="noopener noreferrer">
                View Site
              </a>
            </Button>

            {/* Edit tenant */}
            <Button variant="outline" asChild>
              <Link href={`/admin/tenants/${tenant.id}`}>Edit</Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Pattern 5: Hydration-Safe Impersonation Banner

### Complete ImpersonationBanner Component

**File:** `apps/web/src/components/layouts/ImpersonationBanner.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-client';
import { useHydrated } from '@/hooks/useHydrated';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut } from 'lucide-react';
import { stopImpersonation } from '@/app/(protected)/admin/tenants/actions';

/**
 * Impersonation Banner Component
 *
 * Fixed banner shown at top of page when PLATFORM_ADMIN is impersonating a tenant.
 * Provides context about who is being impersonated and exit button.
 *
 * HYDRATION SAFETY:
 * - Uses useHydrated() to prevent rendering session-dependent content during SSR
 * - Server render: null
 * - Initial client render (before useEffect): null
 * - After hydration (useEffect): checks session and renders if impersonating
 * - Result: Server HTML === Client HTML ✅ No mismatch
 *
 * IMPERSONATION DATA:
 * - tenantSlug: Name of tenant being impersonated (e.g., "bella-weddings")
 * - tenantEmail: Email of tenant being impersonated
 * - startedAt: ISO timestamp when impersonation started
 *
 * EXIT BEHAVIOR:
 * - Calls stopImpersonation() server action
 * - Server updates JWT session and backend token
 * - Returns redirect URL to admin page
 * - Client navigates with window.location.href for full page reload
 */
export function ImpersonationBanner() {
  const isHydrated = useHydrated();
  const { impersonation, isImpersonating, isLoading } = useAuth();
  const [isExiting, setIsExiting] = useState(false);

  /**
   * Handle exiting impersonation with proper session refresh
   *
   * Key points:
   * 1. Call server action directly
   * 2. Await the result
   * 3. Check result.success
   * 4. Use window.location.href for full page reload
   * 5. Reset loading state on error
   *
   * WHY full page reload?
   * - Session changed (impersonation cleared)
   * - RSC cache contains tenant-specific data
   * - Service worker may have cached tenant resources
   * - Need to ensure complete refresh
   */
  const handleExitImpersonation = async () => {
    setIsExiting(true);

    try {
      const result = await stopImpersonation();

      if (result.success) {
        // Full page reload to ensure fresh session and cleared caches
        window.location.href = result.redirectTo;
      } else {
        setIsExiting(false);
        console.error('Failed to exit impersonation:', result.error);
        // TODO: Show toast error
      }
    } catch (error) {
      setIsExiting(false);
      console.error('Error exiting impersonation:', error);
      // TODO: Show toast error
    }
  };

  /**
   * Hydration guard: Both server and client return null until after hydration
   * This prevents React hydration mismatch errors
   */
  if (!isHydrated || isLoading) {
    return null;
  }

  /**
   * Only show banner if actually impersonating
   */
  if (!isImpersonating() || !impersonation) {
    return null;
  }

  const { tenantSlug, tenantEmail } = impersonation;

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label="Impersonation status"
      className="fixed top-0 left-0 right-0 z-50 bg-amber-950/50 border-b border-amber-800 backdrop-blur-sm"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        {/* Left: Warning icon + impersonation info */}
        <div className="flex items-center gap-2 text-amber-400">
          <AlertTriangle
            className="h-4 w-4 flex-shrink-0"
            aria-hidden="true"
          />
          <span className="text-sm font-medium">
            Viewing as:{' '}
            <strong className="text-amber-300">{tenantSlug}</strong>
            {' '}({tenantEmail})
          </span>
        </div>

        {/* Right: Exit button */}
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-amber-700 text-amber-400 hover:bg-amber-900/50 flex-shrink-0"
          onClick={handleExitImpersonation}
          disabled={isExiting}
          aria-label="Exit impersonation and return to admin view"
        >
          <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
          {isExiting ? 'Exiting...' : 'Exit Impersonation'}
        </Button>
      </div>
    </div>
  );
}
```

---

## Pattern 6: Stop Impersonation Server Action

### Complete stopImpersonation Implementation

**File:** `apps/web/src/app/(protected)/admin/tenants/actions.ts` (continue from impersonateTenant)

```typescript
/**
 * API response from stop-impersonation endpoint
 */
interface StopImpersonationResponse {
  token: string;
  email: string;
  role: 'PLATFORM_ADMIN';
}

/**
 * Stop impersonating a tenant
 *
 * Returns PLATFORM_ADMIN to their normal admin view.
 * Restores original admin token and clears impersonation state.
 *
 * Key Steps:
 * 1. Validate user is impersonating
 * 2. Fetch stop-impersonation endpoint
 * 3. Update backend token cookie (restore admin token)
 * 4. Use unstable_update() to clear impersonation from JWT
 * 5. Invalidate RSC cache
 * 6. Return redirect URL to client
 * 7. Client does window.location.href for full page reload
 *
 * ERROR HANDLING:
 * - Rollback backend token if session update fails
 * - Log detailed error
 * - Return error to client
 *
 * @returns - Result with success status and redirect URL or error
 */
export async function stopImpersonation(): Promise<ImpersonationResult> {
  // Step 1: Validate authentication
  const session = await auth();

  // If not impersonating, just redirect to admin page
  if (!session?.user?.impersonation) {
    return { success: true, redirectTo: '/admin/tenants' };
  }

  // Step 2: Get backend token (still the impersonation token at this point)
  const backendToken = await getBackendToken();
  if (!backendToken) {
    logger.error('No backend token available for stop-impersonation');
    return { success: false, error: 'Not authenticated' };
  }

  // Step 3: Call backend API
  try {
    const response = await fetch(`${API_URL}/v1/auth/stop-impersonation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${backendToken}`,
      },
    });

    if (!response.ok) {
      const error = await safeParseJSON<{ message?: string }>(response);
      logger.error('Stop impersonation API failed', {
        status: response.status,
        error: error.message,
      });
      return { success: false, error: error.message || 'Failed to stop impersonation' };
    }

    const data = await safeParseJSON<StopImpersonationResponse>(response);

    // Step 4: Store impersonation token for rollback if session update fails
    const cookieStore = await cookies();
    const impersonationToken = cookieStore.get('mais_backend_token')?.value;

    // Step 5: Restore admin token
    cookieStore.set('mais_backend_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // Back to normal 24 hour session
      path: '/',
    });

    // Step 6: Update JWT session to clear impersonation using unstable_update
    try {
      await unstable_update({
        user: {
          id: session.user.id,
          email: data.email,
          role: data.role,
          tenantId: undefined, // Clear tenant context
          slug: undefined,
          backendToken: data.token, // Restore admin token to JWT
          impersonation: undefined, // Clear impersonation data
        } as unknown as { id: string; email: string },
      });
    } catch (error) {
      // Rollback backend token if session update fails
      logger.error('Failed to sync session after stopping impersonation', { error });
      if (impersonationToken) {
        cookieStore.set('mais_backend_token', impersonationToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 4 * 60 * 60,
          path: '/',
        });
      }
      return { success: false, error: 'Failed to restore admin session' };
    }

    // Step 7: Invalidate all RSC caches
    revalidatePath('/', 'layout');

    // Step 8: Log successful stop
    logger.info('Impersonation session ended', {
      adminEmail: data.email,
    });

    // Step 9: Return redirect URL to client
    return { success: true, redirectTo: '/admin/tenants' };
  } catch (error) {
    logger.error('Stop impersonation request failed', { error });
    return { success: false, error: 'Stop impersonation request failed' };
  }
}
```

---

## Pattern 7: Type Definitions

### Tenant Types

**File:** `apps/web/src/app/(protected)/admin/tenants/types.ts`

```typescript
/**
 * Tenant type for admin list view
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  stripeConnected: boolean;
  createdAt: string; // ISO date string from API
  updatedAt: string; // ISO date string from API
}

/**
 * Impersonation context in session
 */
export interface ImpersonationContext {
  tenantId: string;
  tenantSlug: string;
  tenantEmail: string;
  startedAt: string; // ISO timestamp
}
```

---

## Pattern 8: Testing Template

### Test Suite for Impersonation

**File:** `apps/web/src/__tests__/impersonation.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImpersonationBanner } from '@/components/layouts/ImpersonationBanner';
import { useAuth } from '@/lib/auth-client';
import { stopImpersonation } from '@/app/(protected)/admin/tenants/actions';

// Mock dependencies
vi.mock('@/lib/auth-client');
vi.mock('@/app/(protected)/admin/tenants/actions');

describe('ImpersonationBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render during hydration', () => {
    const { container } = render(<ImpersonationBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('should not render when not impersonating', async () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonation: undefined,
      isImpersonating: () => false,
      isLoading: false,
    } as any);

    const { container } = render(<ImpersonationBanner />);

    // Wait for hydration
    await waitFor(() => {
      expect(vi.mocked(useAuth)).toHaveBeenCalled();
    });

    expect(container.firstChild).toBeNull();
  });

  it('should render banner when impersonating', async () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonation: {
        tenantSlug: 'bella-weddings',
        tenantEmail: 'bella@example.com',
        tenantId: '123',
        startedAt: '2026-01-06T12:00:00Z',
      },
      isImpersonating: () => true,
      isLoading: false,
    } as any);

    render(<ImpersonationBanner />);

    await waitFor(() => {
      expect(screen.getByText(/bella-weddings/)).toBeInTheDocument();
      expect(screen.getByText(/bella@example.com/)).toBeInTheDocument();
    });
  });

  it('should exit impersonation on button click', async () => {
    vi.mocked(useAuth).mockReturnValue({
      impersonation: {
        tenantSlug: 'bella-weddings',
        tenantEmail: 'bella@example.com',
        tenantId: '123',
        startedAt: '2026-01-06T12:00:00Z',
      },
      isImpersonating: () => true,
      isLoading: false,
    } as any);

    vi.mocked(stopImpersonation).mockResolvedValue({
      success: true,
      redirectTo: '/admin/tenants',
    });

    const windowLocationHrefSpy = vi.spyOn(window, 'location', 'get');

    render(<ImpersonationBanner />);

    const exitButton = await screen.findByText('Exit Impersonation');
    await userEvent.click(exitButton);

    await waitFor(() => {
      expect(stopImpersonation).toHaveBeenCalled();
    });
  });
});
```

---

## Summary

These patterns provide:

1. **useHydrated hook** - Reusable hydration safety
2. **Date formatting utilities** - Hydration-safe date formatting
3. **impersonateTenant action** - Complete server action with error handling
4. **TenantsList component** - Client component with impersonation handling
5. **ImpersonationBanner component** - Hydration-safe banner with exit button
6. **stopImpersonation action** - Server action to exit impersonation
7. **Type definitions** - TypeScript interfaces for tenant and impersonation data
8. **Test template** - Unit tests for impersonation flows

All patterns follow best practices for:

- Hydration safety
- Session management
- Error handling
- Type safety
- Testing
