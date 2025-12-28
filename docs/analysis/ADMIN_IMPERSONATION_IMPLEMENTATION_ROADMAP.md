# Admin Impersonation Implementation Roadmap

**Overview:** Transform backend impersonation API (complete) into user-facing Next.js feature with HANDLED brand compliance

**Total Effort:** 8-12 days | **Priority:** P1 | **Dependencies:** None (backend ready)

---

## Quick Summary

| Component                     | Status   | Effort   | Impact           |
| ----------------------------- | -------- | -------- | ---------------- |
| Backend API                   | Complete | 0 days   | Blocking nothing |
| NextAuth Config               | Complete | 0 days   | Ready to use     |
| Routes/Layouts                | Missing  | 1 day    | High             |
| Tenant List UI                | Missing  | 2 days   | High             |
| Impersonation API Integration | Missing  | 1.5 days | High             |
| Impersonation Banner          | Missing  | 1 day    | Medium           |
| Edge Case Handling            | Partial  | 2-3 days | Medium           |
| Testing + Polish              | Missing  | 1-2 days | Medium           |

---

## Critical Path

```
Day 1: Routes & Layouts
  ├─ Create /admin directory structure
  ├─ Admin layout + dashboard stub
  └─ Update sidebar navigation

Day 2: Tenant List Page
  ├─ Verify /v1/admin/tenants endpoint
  ├─ Create TenantCard component
  └─ Implement tenant grid with Suspense

Day 3: Impersonation Integration
  ├─ Create Server Action wrappers
  ├─ Add impersonate button logic
  └─ Session update handling

Day 4: Impersonation Banner + Polish
  ├─ Create ImpersonationBanner component
  ├─ Brand compliance audit
  └─ Empty states + error handling

Day 5-6: Edge Cases
  ├─ Nested impersonation validation
  ├─ Timeout handling
  └─ Audit logging

Day 7: Testing
  ├─ Unit tests for components
  ├─ E2E test flow
  └─ Security review
```

---

## 1. Routes & Navigation Setup (1 Day)

### 1.1 Create Admin Directory Structure

```bash
mkdir -p apps/web/src/app/\(protected\)/admin/{dashboard,tenants,segments}
touch apps/web/src/app/\(protected\)/admin/{layout,error}.tsx
touch apps/web/src/app/\(protected\)/admin/dashboard/{page,error}.tsx
touch apps/web/src/app/\(protected\)/admin/tenants/{page,error}.tsx
touch apps/web/src/app/\(protected\)/admin/segments/{page,error}.tsx
```

### 1.2 Admin Layout

**File:** `apps/web/src/app/(protected)/admin/layout.tsx`

Pattern: Copy from tenant layout, but:

- Guard with `allowedRoles={['PLATFORM_ADMIN']}`
- Prevent impersonating users from accessing
- Show appropriate sidebar state

```typescript
'use client';

import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminSidebar } from '@/components/layouts/AdminSidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute allowedRoles={['PLATFORM_ADMIN']}>
      <div className="min-h-screen bg-surface">
        <AdminSidebar />
        <main className="lg:pl-72 transition-all duration-300">
          <div className="p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
```

### 1.3 Admin Dashboard Page

**File:** `apps/web/src/app/(protected)/admin/dashboard/page.tsx`

Simple welcome page with quick actions:

```typescript
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AdminDashboard() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-text-primary">
          Platform Dashboard
        </h1>
        <p className="text-lg text-text-muted mt-2">
          Manage HANDLED members and platform operations.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl border border-neutral-100 p-8 hover:shadow-lg transition-all">
          <h2 className="text-xl font-semibold text-text-primary mb-2">Members</h2>
          <p className="text-text-muted mb-4">View and manage all members on the platform.</p>
          <Link href="/admin/tenants">
            <Button className="bg-sage hover:bg-sage-hover">
              View Members
            </Button>
          </Link>
        </div>

        <div className="rounded-3xl border border-neutral-100 p-8 hover:shadow-lg transition-all">
          <h2 className="text-xl font-semibold text-text-primary mb-2">Segments</h2>
          <p className="text-text-muted mb-4">Organize members by customer segments.</p>
          <Link href="/admin/segments">
            <Button variant="outline">
              View Segments
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### 1.4 Update AdminSidebar Navigation

**File:** `apps/web/src/components/layouts/AdminSidebar.tsx`

Update lines 110-111:

```typescript
// Current (broken):
// const navItems = isImpersonating() || role === 'TENANT_ADMIN' ? tenantNavItems : adminNavItems;

// Fixed:
const navItems = role === 'PLATFORM_ADMIN' && !isImpersonating() ? adminNavItems : tenantNavItems;
```

Also update `isActive()` check to handle admin routes:

```typescript
const isActive = (href: string) => {
  // Handle dashboard routes
  if (
    (href === '/tenant/dashboard' || href === '/admin/dashboard') &&
    pathname.endsWith('/dashboard')
  ) {
    return true;
  }
  return pathname.startsWith(href.split('/').slice(0, 3).join('/'));
};
```

---

## 2. Tenant Listing (2 Days)

### 2.1 Verify Backend Endpoint

**Action:** Check if `/v1/admin/tenants` exists

```bash
grep -r "GET.*tenants\|router.get.*tenants" server/src/routes/admin*.ts
```

**If Missing:** Create endpoint in `server/src/routes/admin.routes.ts`

```typescript
/**
 * GET /admin/tenants
 * List all tenants (platform admin only)
 */
router.get(
  '/tenants',
  authenticateAdmin,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenants = await tenantService.getAllTenants();
      res.status(200).json({
        status: 'success',
        tenants,
        count: tenants.length,
      });
    } catch (error) {
      next(error);
    }
  }
);
```

### 2.2 TenantCard Component

**File:** `apps/web/src/components/admin/TenantCard.tsx`

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, LogIn } from 'lucide-react';

interface TenantCardProps {
  tenant: {
    id: string;
    name: string;
    slug: string;
    email: string;
    apiKeyPublic: string;
    commissionPercent: number;
    isActive: boolean;
    stripeOnboarded: boolean;
    stats?: {
      bookings: number;
      packages: number;
      addOns: number;
    };
  };
  onImpersonate: (tenantId: string) => Promise<void>;
  isLoading: boolean;
}

export function TenantCard({ tenant, onImpersonate, isLoading }: TenantCardProps) {
  const [isImpersonating, setIsImpersonating] = useState(false);

  const handleClick = async () => {
    setIsImpersonating(true);
    try {
      await onImpersonate(tenant.id);
    } catch (error) {
      console.error('Impersonation failed:', error);
      setIsImpersonating(false);
    }
  };

  return (
    <div
      className="rounded-3xl border border-neutral-100 p-6 bg-white
                   hover:shadow-lg transition-all duration-300"
    >
      {/* Header with status badges */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">{tenant.name}</h3>
          <p className="text-sm text-text-muted">{tenant.slug}</p>
        </div>
        <div className="flex gap-2">
          {!tenant.isActive && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Inactive
            </Badge>
          )}
          {tenant.stripeOnboarded && (
            <Badge variant="success" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Stripe
            </Badge>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4 text-sm text-text-muted">
        <p>
          <span className="font-medium text-text-primary">Email:</span> {tenant.email}
        </p>
        <p>
          <span className="font-medium text-text-primary">Commission:</span>{' '}
          {tenant.commissionPercent}%
        </p>
        <p>
          <span className="font-medium text-text-primary">API Key:</span>{' '}
          <code className="bg-surface px-2 py-1 rounded text-xs font-mono">
            {tenant.apiKeyPublic.slice(0, 20)}...
          </code>
        </p>
      </div>

      {/* Stats */}
      {tenant.stats && (
        <div className="flex gap-4 mb-4 text-xs text-text-muted border-t border-neutral-100 pt-4">
          <span>{tenant.stats.bookings} bookings</span>
          <span>{tenant.stats.packages} packages</span>
          <span>{tenant.stats.addOns} add-ons</span>
        </div>
      )}

      {/* Action */}
      <Button
        onClick={handleClick}
        disabled={!tenant.isActive || isLoading || isImpersonating}
        className="w-full bg-sage hover:bg-sage-hover text-white"
      >
        {isImpersonating ? (
          'Signing in...'
        ) : (
          <>
            <LogIn className="h-4 w-4 mr-2" />
            Sign In As
          </>
        )}
      </Button>
    </div>
  );
}
```

### 2.3 Tenants List Page

**File:** `apps/web/src/app/(protected)/admin/tenants/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-client';
import { TenantCard } from '@/components/admin/TenantCard';
import { toast } from 'sonner';

export default function TenantsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tenants, setTenants] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/admin/tenants');
      if (!response.ok) throw new Error('Failed to fetch tenants');
      const data = await response.json();
      setTenants(data.tenants);
    } catch (error) {
      toast.error('Failed to load members');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImpersonate = async (tenantId: string) => {
    try {
      const response = await fetch('/api/auth/impersonate', {
        method: 'POST',
        body: JSON.stringify({ tenantId }),
      });

      if (!response.ok) throw new Error('Impersonation failed');

      // Redirect to tenant dashboard
      router.push('/tenant/dashboard');
    } catch (error) {
      toast.error('Failed to sign in as member');
      console.error(error);
      throw error;
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-serif font-bold text-text-primary">
          Members
        </h1>
        <p className="text-lg text-text-muted mt-2">
          Manage and support all HANDLED members.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-text-muted">Loading members...</p>
        </div>
      ) : tenants.length === 0 ? (
        <div className="text-center py-12 rounded-3xl border border-neutral-100 bg-neutral-50">
          <p className="text-text-muted">No members yet. Time to grow!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((tenant) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              onImpersonate={handleImpersonate}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 3. Impersonation Integration (1.5 Days)

### 3.1 Server Action for Impersonation

**File:** `apps/web/src/app/api/auth/impersonate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await request.json();

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Get backend token server-side
    const backendToken = await getBackendToken();
    if (!backendToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call backend impersonate endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/auth/impersonate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${backendToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenantId }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const result = await response.json();

    // Set authentication cookies (NextAuth will handle session update)
    const res = NextResponse.json(result);

    return res;
  } catch (error) {
    console.error('Impersonation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 3.2 Server Action for Stop Impersonation

**File:** `apps/web/src/app/api/auth/stop-impersonate/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getBackendToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Get backend token server-side
    const backendToken = await getBackendToken();
    if (!backendToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call backend stop-impersonation endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/auth/stop-impersonate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${backendToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Stop impersonation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 3.3 Add Helper to auth-client.ts

**File:** `apps/web/src/lib/auth-client.ts` (add to exports)

```typescript
/**
 * Stop impersonation and return to admin view
 */
export async function stopImpersonation() {
  try {
    const response = await fetch('/api/auth/stop-impersonate', {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to stop impersonation');
    }

    // Trigger NextAuth session update
    await update();

    return response.json();
  } catch (error) {
    console.error('Stop impersonation error:', error);
    throw error;
  }
}
```

---

## 4. Impersonation Banner (1 Day)

### 4.1 ImpersonationBanner Component

**File:** `apps/web/src/components/admin/ImpersonationBanner.tsx`

```typescript
'use client';

import { AlertCircle, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { stopImpersonation } from '@/lib/auth-client';
import { toast } from 'sonner';

interface ImpersonationBannerProps {
  tenantEmail: string;
  tenantName?: string;
}

export function ImpersonationBanner({
  tenantEmail,
  tenantName,
}: ImpersonationBannerProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleExit = async () => {
    setIsLoading(true);
    try {
      await stopImpersonation();
      toast.success('Exited impersonation');
      router.push('/admin/dashboard');
      router.refresh();
    } catch (error) {
      toast.error('Failed to exit impersonation');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="rounded-2xl bg-orange-50 border-l-4 border-orange-400 p-4 mb-6 flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0" />
        <div>
          <p className="font-semibold text-orange-900">
            Impersonating member
          </p>
          <p className="text-sm text-orange-800">
            {tenantName || tenantEmail}
          </p>
        </div>
      </div>

      <Button
        onClick={handleExit}
        disabled={isLoading}
        size="sm"
        className="bg-orange-600 hover:bg-orange-700 text-white"
      >
        <LogOut className="h-4 w-4 mr-2" />
        Exit
      </Button>
    </div>
  );
}
```

### 4.2 Integrate into Layouts

**File:** `apps/web/src/app/(protected)/tenant/layout.tsx`

Add at top of main content:

```typescript
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner';
import { auth } from '@/lib/auth';

export default async function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const isImpersonating = !!session?.user?.impersonation;

  return (
    <ProtectedRoute allowedRoles={['TENANT_ADMIN']}>
      <div className="min-h-screen bg-surface">
        <AdminSidebar />
        <main className="lg:pl-72 transition-all duration-300">
          <div className="p-6 lg:p-8">
            {isImpersonating && session?.user?.impersonation && (
              <ImpersonationBanner
                tenantEmail={session.user.impersonation.tenantEmail}
                tenantName={session.user.impersonation.tenantSlug}
              />
            )}
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
```

---

## 5. Edge Cases & Validation (2-3 Days)

### 5.1 Backend: Nested Impersonation Prevention

**File:** `server/src/routes/auth.routes.ts`

In `startImpersonation()` method:

```typescript
async startImpersonation(currentToken: string, tenantId: string): Promise<UnifiedLoginResponse> {
  const payload = this.identityService.verifyToken(currentToken);

  // NEW: Check if already impersonating
  if (payload.impersonating) {
    throw new UnauthorizedError(
      'Cannot impersonate while already impersonating. Stop impersonation first.'
    );
  }

  if (!payload.userId) {
    throw new UnauthorizedError('Only platform admins can impersonate tenants');
  }

  // ... rest of logic
}
```

### 5.2 Backend: Impersonation Timeout

**File:** `server/src/routes/auth.routes.ts`

Create separate token expiration for impersonation:

```typescript
private readonly impersonationTokenExpiry = '4h'; // Shorter than admin token (24h)

createImpersonationToken(payload: TokenPayload & { impersonating: any }) {
  return jwt.sign(payload, this.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: this.impersonationTokenExpiry, // Use shorter expiry
  });
}
```

### 5.3 Rate Limiting (Express)

**File:** `server/src/routes/auth.routes.ts` (at top)

```typescript
import rateLimit from 'express-rate-limit';

const impersonateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10,
  message: 'Too many impersonation attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Then in router:
router.post('/impersonate', impersonateLimiter, async (req, res, next) => {
  // ... handler
});
```

### 5.4 Audit Logging Schema

**File:** `server/prisma/schema.prisma` (add model)

```prisma
model AdminActivityLog {
  id                String    @id @default(cuid())
  adminId           String
  adminEmail        String
  action            String    // 'impersonate', 'stop_impersonate', etc.
  targetTenantId    String?
  targetTenantEmail String?
  ipAddress         String?
  userAgent         String?
  status            String    // 'success', 'failed'
  errorMessage      String?
  duration          Int?      // milliseconds
  createdAt         DateTime  @default(now())

  @@index([adminId])
  @@index([createdAt])
}
```

Create migration:

```bash
cd server && npm exec prisma migrate dev --name add_admin_activity_logs
```

---

## 6. Testing Strategy (1-2 Days)

### 6.1 E2E Test: Complete Flow

**File:** `apps/web/e2e/admin-impersonation.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin Impersonation Flow', () => {
  test('admin can impersonate tenant and return', async ({ page, context }) => {
    // 1. Login as admin
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@gethandled.ai');
    await page.fill('input[type="password"]', 'admin-password');
    await page.click('button[type="submit"]');

    // 2. Should land on admin dashboard
    await expect(page).toHaveURL('/admin/dashboard');

    // 3. Navigate to tenants
    await page.click('a[href="/admin/tenants"]');
    await expect(page).toHaveURL('/admin/tenants');

    // 4. Click "Sign In As" on first tenant
    const firstTenantButton = page.locator('button:has-text("Sign In As")').first();
    await firstTenantButton.click();

    // 5. Should redirect to tenant dashboard
    await expect(page).toHaveURL('/tenant/dashboard');

    // 6. Impersonation banner should appear
    await expect(page.locator('text=Impersonating member')).toBeVisible();

    // 7. Click Exit Impersonation
    await page.click('button:has-text("Exit")');

    // 8. Should return to admin dashboard
    await expect(page).toHaveURL('/admin/dashboard');

    // 9. Banner should be gone
    await expect(page.locator('text=Impersonating member')).not.toBeVisible();
  });

  test('cannot impersonate while already impersonating', async ({ page }) => {
    // ... login and impersonate tenant A
    // ... try to impersonate tenant B
    // ... should show error: "Cannot impersonate while impersonating"
  });
});
```

### 6.2 Component Tests

**File:** `apps/web/__tests__/components/TenantCard.test.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { TenantCard } from '@/components/admin/TenantCard';

describe('TenantCard', () => {
  it('calls onImpersonate when button clicked', async () => {
    const mockImpersonate = vitest.fn();
    const tenant = { id: 'tenant_1', name: 'Test', /* ... */ };

    render(
      <TenantCard
        tenant={tenant}
        onImpersonate={mockImpersonate}
        isLoading={false}
      />
    );

    const button = screen.getByRole('button', { name: /sign in as/i });
    fireEvent.click(button);

    expect(mockImpersonate).toHaveBeenCalledWith('tenant_1');
  });

  it('disables button when tenant is inactive', () => {
    const tenant = { id: 'tenant_1', isActive: false, /* ... */ };

    render(
      <TenantCard
        tenant={tenant}
        onImpersonate={vitest.fn()}
        isLoading={false}
      />
    );

    const button = screen.getByRole('button', { name: /sign in as/i });
    expect(button).toBeDisabled();
  });
});
```

---

## Checklist by Phase

### Phase 1: Routes (Day 1)

- [ ] Create `/admin` directory structure
- [ ] Create admin layout (copy + modify tenant layout)
- [ ] Create admin dashboard page
- [ ] Create tenants page (stub)
- [ ] Create segments page (stub)
- [ ] Update AdminSidebar to show admin routes
- [ ] Test navigation between admin pages

### Phase 2: Tenant List (Days 2)

- [ ] Verify/create `/v1/admin/tenants` backend endpoint
- [ ] Create TenantCard component
- [ ] Create /admin/tenants page with fetch + grid
- [ ] Add loading skeleton
- [ ] Add empty state
- [ ] Add error boundary
- [ ] Test tenant list rendering

### Phase 3: Impersonation (Day 3)

- [ ] Create `/api/auth/impersonate` route
- [ ] Create `/api/auth/stop-impersonate` route
- [ ] Add `stopImpersonation()` to auth-client
- [ ] Integrate impersonate button in TenantCard
- [ ] Test impersonation flow (start + stop)
- [ ] Verify session update after impersonation

### Phase 4: Banner & UX (Day 4)

- [ ] Create ImpersonationBanner component
- [ ] Integrate into tenant layout
- [ ] Test banner appearance/disappearance
- [ ] Brand compliance audit (colors, spacing, typography)
- [ ] Add error toast handling
- [ ] Add success notifications

### Phase 5: Edge Cases (Days 5-6)

- [ ] Add nested impersonation validation (backend)
- [ ] Add impersonation timeout (shorter than admin)
- [ ] Add rate limiting (backend)
- [ ] Create audit logging schema + migration
- [ ] Log impersonation start/stop to audit table
- [ ] Test timeout behavior
- [ ] Test rate limiting

### Phase 6: Testing & Review (Day 7)

- [ ] Write E2E test for complete flow
- [ ] Write unit tests for components
- [ ] Write integration tests for API routes
- [ ] Run code review (use `/workflows:review`)
- [ ] Security review (tokens, CSRF, session)
- [ ] Brand review (design, copy, UX)
- [ ] Merge and deploy

---

## Success Metrics

- Admin can log in and access `/admin/dashboard`
- Admin can navigate to `/admin/tenants` and see all tenants
- Admin can click "Sign In As" and be impersonating a tenant
- Impersonation banner appears (HANDLED-branded)
- Admin can click "Exit" and return to admin dashboard
- All impersonation flows are logged in audit table
- E2E tests pass (100% coverage of happy path)
- No TypeScript errors (`npm run typecheck`)
- All tests pass (`npm test`)

---

## Known Risks

| Risk                               | Likelihood | Impact   | Mitigation                                   |
| ---------------------------------- | ---------- | -------- | -------------------------------------------- |
| Backend endpoint missing           | Medium     | High     | Verify endpoint exists before implementation |
| NextAuth session update delay      | Low        | Low      | Add polling/refresh if needed                |
| CSRF on impersonate endpoint       | Low        | Critical | Verify backend validates origin/referer      |
| Impersonation timeout too long     | Low        | Medium   | Use shorter timeout (4h vs 24h)              |
| Concurrent impersonation confusion | Low        | Medium   | Test and document expected behavior          |

---

## Dependencies

- **Blocked by:** Nothing (backend ready, NextAuth ready)
- **Blocks:** Nothing
- **Related:** Password reset flow, tenant signup flow

---

## Resources

- **Backend Tests:** `server/test/routes/auth-impersonation.spec.ts`
- **Legacy Reference:** `client/src/features/admin/`
- **Brand Guide:** `docs/design/BRAND_VOICE_GUIDE.md`
- **Gap Analysis:** `docs/analysis/ADMIN_IMPERSONATION_GAP_ANALYSIS.md`

---

## Questions for Kickoff

1. Should `/v1/admin/tenants` include tenant stats? (bookings, packages, etc.)
2. What's the target impersonation timeout? (suggestion: 4 hours)
3. Do we need audit logging dashboard in Phase 1?
4. Should impersonation be tracked in email notifications to tenant?
5. Is admin->tenant impersonation the only use case, or admin->support->tenant later?
