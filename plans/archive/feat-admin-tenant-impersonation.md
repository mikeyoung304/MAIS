# feat: Admin Tenant Impersonation UI

## Overview

Platform admins get locked into tenant dashboard after login. They need to:

1. View all tenants from an admin dashboard
2. Impersonate any tenant to see/manage their data
3. Exit impersonation and return to admin view

**Backend:** 100% complete. Frontend: Missing entirely.

---

## The Feature (6 Hours Total)

### Phase 1: Admin UI + Impersonation (4 hours)

**Files to create:**

```
apps/web/src/app/(protected)/admin/
├── layout.tsx              # Role check, redirect non-admins
├── page.tsx                # Redirect to /admin/tenants
└── tenants/
    ├── page.tsx            # Tenant grid with impersonate buttons
    ├── actions.ts          # Server actions (impersonate, stop)
    └── error.tsx           # Error boundary
```

**1. Admin Layout** (`layout.tsx`)

```tsx
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/components/layouts/AdminSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (session?.user?.role !== 'PLATFORM_ADMIN') {
    redirect('/tenant/dashboard');
  }

  // Cannot access admin routes while impersonating
  if (session?.impersonation) {
    redirect('/tenant/dashboard');
  }

  return (
    <div className="min-h-screen bg-surface">
      <AdminSidebar isAdmin />
      <main className="lg:pl-72 transition-all duration-300">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
```

**2. Tenants Page** (`tenants/page.tsx`)

```tsx
import { auth } from '@/lib/auth';
import { getBackendToken } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, CreditCard } from 'lucide-react';
import { impersonateTenant } from './actions';

async function getTenants() {
  const token = await getBackendToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/admin/tenants`, {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 60 },
  });
  const data = await res.json();
  return data.tenants; // Backend returns { tenants: [...] }
}

export default async function TenantsPage() {
  const tenants = await getTenants();

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-text-primary mb-2">Tenants</h1>
        <p className="text-text-muted">Manage and impersonate tenant accounts</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tenants.map((tenant: any) => (
          <Card
            key={tenant.id}
            className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-serif text-xl">{tenant.name}</CardTitle>
                {tenant.stripeConnected ? (
                  <Badge variant="success">
                    <CreditCard className="h-3 w-3 mr-1" />
                    Stripe
                  </Badge>
                ) : (
                  <Badge variant="secondary">No Payments</Badge>
                )}
              </div>
              <p className="text-text-muted text-sm">{tenant.email}</p>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-text-muted mb-4">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {tenant.slug}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(tenant.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex gap-2">
                <form action={impersonateTenant.bind(null, tenant.id)} className="flex-1">
                  <Button type="submit" variant="sage" size="sm" className="w-full">
                    Impersonate
                  </Button>
                </form>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/t/${tenant.slug}`} target="_blank">
                    View Site
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

**3. Server Actions** (`tenants/actions.ts`)

```typescript
'use server';

import { auth, getBackendToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { signIn } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function impersonateTenant(tenantId: string) {
  const session = await auth();

  if (session?.user?.role !== 'PLATFORM_ADMIN') {
    throw new Error('Unauthorized');
  }

  if (session?.impersonation) {
    throw new Error('Cannot impersonate while already impersonating');
  }

  const backendToken = await getBackendToken();
  const response = await fetch(`${API_URL}/v1/auth/impersonate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${backendToken}`,
    },
    body: JSON.stringify({ tenantId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Impersonation failed');
  }

  const data = await response.json();

  // Update backend token cookie
  const cookieStore = await cookies();
  cookieStore.set('mais_backend_token', data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 4 * 60 * 60, // 4 hours for impersonation
    path: '/',
  });

  // Re-authenticate to update NextAuth session with impersonation data
  await signIn('credentials', {
    token: data.token,
    email: data.email,
    role: data.role,
    tenantId: data.tenantId,
    slug: data.slug,
    impersonation: JSON.stringify(data.impersonation),
    redirect: false,
  });

  revalidatePath('/');
  redirect('/tenant/dashboard');
}

export async function stopImpersonation() {
  const session = await auth();

  if (!session?.impersonation) {
    redirect('/admin/tenants');
  }

  const backendToken = await getBackendToken();
  const response = await fetch(`${API_URL}/v1/auth/stop-impersonation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${backendToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to stop impersonation');
  }

  const data = await response.json();

  // Restore admin token
  const cookieStore = await cookies();
  cookieStore.set('mais_backend_token', data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
    path: '/',
  });

  // Re-authenticate as admin (no impersonation)
  await signIn('credentials', {
    token: data.token,
    email: data.email,
    role: data.role,
    redirect: false,
  });

  revalidatePath('/');
  redirect('/admin/tenants');
}
```

**4. Fix NextAuth Credentials Provider** (update `auth.ts`)

Add `impersonation` to credentials and authorize callback:

```typescript
// In credentials object
impersonation: { label: 'Impersonation', type: 'text' },

// In authorize callback, when credentials?.token exists
return {
  id: (credentials.tenantId as string) || 'user',
  email: credentials.email as string,
  role: (credentials.role as 'PLATFORM_ADMIN' | 'TENANT_ADMIN') || 'TENANT_ADMIN',
  tenantId: credentials.tenantId as string | undefined,
  slug: credentials.slug as string | undefined,
  backendToken: credentials.token as string,
  impersonation: credentials.impersonation
    ? JSON.parse(credentials.impersonation as string)
    : undefined,
};
```

---

### Phase 2: Banner + Test (2 hours)

**1. Impersonation Banner** (`components/layouts/ImpersonationBanner.tsx`)

```tsx
'use client';

import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogOut } from 'lucide-react';
import { stopImpersonation } from '@/app/(protected)/admin/tenants/actions';
import { useTransition } from 'react';

export function ImpersonationBanner() {
  const { data: session } = useSession();
  const [isPending, startTransition] = useTransition();

  if (!session?.impersonation) return null;

  const { tenantSlug, tenantEmail } = session.impersonation;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500/10 border-b border-orange-500/20">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-orange-700">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">
            Viewing as: <strong>{tenantSlug}</strong> ({tenantEmail})
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full border-orange-500 text-orange-700 hover:bg-orange-500/10"
          onClick={() => startTransition(() => stopImpersonation())}
          disabled={isPending}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {isPending ? 'Exiting...' : 'Exit Impersonation'}
        </Button>
      </div>
    </div>
  );
}
```

**2. Add to Tenant Layout**

Update `apps/web/src/app/(protected)/tenant/layout.tsx`:

```tsx
import { ImpersonationBanner } from '@/components/layouts/ImpersonationBanner';

export default async function TenantLayout({ children }) {
  return (
    <>
      <ImpersonationBanner />
      {/* Add pt-10 when impersonating to account for banner */}
      <div className="min-h-screen bg-surface">{/* existing layout */}</div>
    </>
  );
}
```

**3. One E2E Test** (`e2e/tests/admin-impersonation.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';

test('admin can impersonate tenant and exit', async ({ page }) => {
  // Login as platform admin
  await page.goto('/login');
  await page.fill('[name="email"]', 'admin@gethandled.ai');
  await page.fill('[name="password"]', 'admin-password');
  await page.click('button[type="submit"]');

  // Should land on admin tenants page
  await expect(page).toHaveURL('/admin/tenants');
  await expect(page.locator('h1')).toHaveText('Tenants');

  // Impersonate first tenant
  await page.click('button:has-text("Impersonate"):first-child');

  // Should redirect to tenant dashboard with banner
  await expect(page).toHaveURL('/tenant/dashboard');
  await expect(page.locator('text=Viewing as:')).toBeVisible();

  // Exit impersonation
  await page.click('button:has-text("Exit Impersonation")');

  // Should return to admin
  await expect(page).toHaveURL('/admin/tenants');
  await expect(page.locator('text=Viewing as:')).not.toBeVisible();
});
```

---

## Checklist

### Phase 1 (4 hours)

- [ ] Create `/admin/layout.tsx` with role check
- [ ] Create `/admin/page.tsx` redirect
- [ ] Create `/admin/tenants/page.tsx` with tenant grid
- [ ] Create `/admin/tenants/actions.ts` with impersonate/stop
- [ ] Create `/admin/tenants/error.tsx` boundary
- [ ] Update `auth.ts` to accept `impersonation` credential
- [ ] Update `AdminSidebar` to show admin nav when `isAdmin` prop
- [ ] Test impersonation flow manually

### Phase 2 (2 hours)

- [ ] Create `ImpersonationBanner.tsx`
- [ ] Add banner to tenant layout
- [ ] Write E2E test
- [ ] Manual QA pass

---

## Key Implementation Notes

1. **Session Sync:** Must call `signIn()` after getting impersonation token to update NextAuth session
2. **Backend Response:** `/v1/admin/tenants` returns `{ tenants: [...] }` not array directly
3. **Field Names:** Backend uses `name` not `businessName` for tenant
4. **Timeout:** Impersonation sessions = 4 hours, regular = 24 hours
5. **No Search:** Defer search to later - you have <50 tenants

---

## References

- `server/src/routes/auth.routes.ts:702-784` - Impersonation endpoints
- `apps/web/src/lib/auth.ts` - NextAuth config
- `apps/web/src/middleware.ts:66-76` - Route protection
- `docs/design/BRAND_VOICE_GUIDE.md` - UI standards
