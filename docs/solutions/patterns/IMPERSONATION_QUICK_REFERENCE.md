# Impersonation Navigation - Quick Reference (Print & Pin!)

## ONE-MINUTE DECISION TREE

```
Implementing impersonation or session changes?
│
├─ Need to render session-dependent UI?
│  └─ Always use isHydrated pattern → return null during SSR
│
├─ Need to navigate after session change?
│  └─ Always use window.location.href → full page reload
│
├─ Need to format a date for display?
│  └─ Always use ISO format → date.toISOString().split('T')[0]
│
├─ See "hydration mismatch" error?
│  └─ Add isHydrated check → wrap component return
│
├─ User sees stale data after impersonation?
│  └─ Clear service worker → DevTools → Application → Unregister
│
└─ Session desync (401 errors)?
   └─ Check unstable_update() succeeded → verify cookie rollback
```

---

## DO/DON'T PATTERNS

### Pattern 1: Rendering Session Data

```typescript
// ❌ DON'T - Causes hydration mismatch
export function UserBanner() {
  const { user } = useAuth();
  return <div>{user?.email}</div>; // Server renders null, client renders email
}

// ✅ DO - Hydration safe
export function UserBanner() {
  const { user } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated) return null;
  return <div>{user?.email}</div>;
}
```

### Pattern 2: Navigation After Impersonation

```typescript
// ❌ DON'T - Cache may be stale
const result = await impersonateTenant(tenantId);
router.push(result.redirectTo);

// ✅ DO - Full page reload, all caches cleared
const result = await impersonateTenant(tenantId);
window.location.href = result.redirectTo;
```

### Pattern 3: Server Action Pattern

```typescript
// ❌ DON'T - Use unstable_update, not signIn()
export async function impersonateTenant(tenantId: string) {
  await signIn('credentials', { email, password }); // Fails in Server Action
  redirect('/tenant/dashboard'); // Doesn't sync session
}

// ✅ DO - Update session, invalidate cache, return result
export async function impersonateTenant(tenantId: string) {
  const data = await fetch(`${API_URL}/v1/auth/impersonate`);

  const cookieStore = await cookies();
  cookieStore.set('mais_backend_token', data.token, { ... });

  await unstable_update({
    user: { ...data, backendToken: data.token }
  });

  revalidatePath('/', 'layout');
  return { success: true, redirectTo: '/tenant/dashboard' };
}
```

### Pattern 4: Date Formatting

```typescript
// ❌ DON'T - Locale-dependent, server ≠ client
<span>{new Date(createdAt).toLocaleDateString()}</span>

// ✅ DO - Hydration-safe ISO format
function formatDate(dateString: string): string {
  return new Date(dateString).toISOString().split('T')[0];
}
<span>{formatDate(createdAt)}</span>
```

---

## 5-POINT CHECKLIST

Before pushing impersonation code:

- [ ] **Hydration:** Session-dependent components use `isHydrated` pattern
- [ ] **Navigation:** Using `window.location.href` not `router.push()`
- [ ] **Server Action:** Using `unstable_update()` not `signIn()`
- [ ] **Cache:** Calling `revalidatePath('/', 'layout')`
- [ ] **Error Handling:** Catching errors, rolling back cookies on failure

---

## DEBUGGING: 3 COMMON ISSUES

| Issue                           | Fix                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------ |
| **"Hydration mismatch" error**  | Add `isHydrated` check, return null during SSR                                 |
| **User sees stale tenant data** | Unregister service workers (DevTools → Application), hard reload (Cmd+Shift+R) |
| **Session desync, 401 errors**  | Verify `unstable_update()` succeeded, check cookie rollback in error handler   |

---

## SERVICE WORKER NUCLEAR OPTION

If service worker cache is stuck:

```typescript
// 1. Open DevTools (F12)
// 2. Application tab → Service Workers
// 3. Click "Unregister" for each worker
// 4. Application tab → Cache Storage
// 5. Delete all cache entries
// 6. Hard reload: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
```

Or in code:

```typescript
async function clearAllCaches() {
  // Unregister service workers
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const reg of registrations) {
    await reg.unregister();
  }

  // Clear cache storage
  const cacheNames = await caches.keys();
  for (const name of cacheNames) {
    await caches.delete(name);
  }

  // Force reload
  window.location.href = '/';
}
```

---

## THE isHydrated PATTERN (Simplified)

This is the ONLY safe way to render session-dependent content:

```typescript
'use client';

export function Component() {
  const { user } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Both server and client return null → no mismatch
  if (!isHydrated) return null;

  // Safe to use session data now
  return <div>{user?.email}</div>;
}
```

Why it works:

1. Server doesn't have session → returns null
2. Client before useEffect → returns null
3. Server HTML == Client HTML ✅
4. After hydration → client loads session, renders

---

## FULL IMPERSONATION FLOW (Copy-Paste Template)

### Step 1: Server Action

```typescript
'use server';

import { auth, unstable_update, getBackendToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function impersonateTenant(tenantId: string) {
  const session = await auth();

  if (session?.user?.role !== 'PLATFORM_ADMIN') {
    return { success: false, error: 'Unauthorized' };
  }

  const backendToken = await getBackendToken();
  const response = await fetch(`${API_URL}/v1/auth/impersonate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${backendToken}` },
    body: JSON.stringify({ tenantId }),
  });

  if (!response.ok) {
    return { success: false, error: 'Impersonation failed' };
  }

  const data = await response.json();
  const cookieStore = await cookies();
  const originalToken = cookieStore.get('mais_backend_token')?.value;

  try {
    // Update backend token
    cookieStore.set('mais_backend_token', data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 4 * 60 * 60,
      path: '/',
    });

    // Update JWT session
    await unstable_update({
      user: {
        id: data.tenantId,
        email: data.email,
        role: data.role,
        tenantId: data.tenantId,
        slug: data.slug,
        impersonation: data.impersonation,
        backendToken: data.token,
      } as unknown as { id: string; email: string },
    });

    // Invalidate caches
    revalidatePath('/', 'layout');

    return { success: true, redirectTo: '/tenant/dashboard' };
  } catch (error) {
    // Rollback on error
    if (originalToken) {
      cookieStore.set('mais_backend_token', originalToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
        path: '/',
      });
    }
    return { success: false, error: 'Failed to impersonate' };
  }
}
```

### Step 2: Client Component

```typescript
'use client';

export function TenantsList({ tenants }) {
  const [impersonatingId, setImpersonatingId] = useState(null);

  const handleImpersonate = async (tenantId) => {
    setImpersonatingId(tenantId);
    try {
      const result = await impersonateTenant(tenantId);
      if (result.success) {
        window.location.href = result.redirectTo; // FULL PAGE RELOAD
      } else {
        setImpersonatingId(null);
      }
    } catch (error) {
      setImpersonatingId(null);
    }
  };

  return (
    <button onClick={() => handleImpersonate(tenant.id)}>
      {impersonatingId === tenant.id ? 'Impersonating...' : 'Impersonate'}
    </button>
  );
}
```

### Step 3: Hydration-Safe Banner

```typescript
'use client';

export function ImpersonationBanner() {
  const { impersonation, isLoading } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated || isLoading) return null;
  if (!impersonation) return null;

  return (
    <div className="bg-amber-950 p-2">
      Viewing as: <strong>{impersonation.tenantSlug}</strong>
      <button onClick={async () => {
        const result = await stopImpersonation();
        if (result.success) {
          window.location.href = result.redirectTo;
        }
      }}>
        Exit
      </button>
    </div>
  );
}
```

---

## RED FLAGS (Code Review Checklist)

- [ ] ❌ Using `router.push()` for impersonation navigation
- [ ] ❌ Using `startTransition()` wrapping impersonation
- [ ] ❌ Using `signIn()` in Server Actions
- [ ] ❌ Missing `unstable_update()` call
- [ ] ❌ Missing `revalidatePath()` call
- [ ] ❌ Not checking `isHydrated` before rendering session data
- [ ] ❌ Using `toLocaleDateString()` for display dates
- [ ] ❌ No error handling or cookie rollback
- [ ] ❌ Rendering impersonation data without loading check

---

## TLDR

1. **Session UI:** `isHydrated` pattern ✅
2. **Navigation:** `window.location.href` ✅
3. **Dates:** ISO format only ✅
4. **Server Action:** `unstable_update()` + `revalidatePath()` ✅
5. **Cache Stuck:** Hard reload + clear service workers ✅
