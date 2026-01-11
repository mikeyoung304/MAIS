---
title: Next.js Server/Client Boundary Import Tainting Best Practices
category: patterns
tags: [next.js, server-components, client-components, import-boundary, architecture]
severity: high
date_created: 2026-01-08
---

# Next.js Server/Client Boundary - Import Tainting Best Practices

**Problem:** Files importing server-only modules "taint" entire files, preventing any client imports—even from pure utilities.

**Solution:** Separate server-only code from shareable utilities.

---

## The Tainting Mechanism

### How Files Become "Tainted"

When you import a server-only module in a file, Next.js marks that **entire file** as a Server Component file:

```typescript
// apps/web/src/lib/auth.ts
import { cookies } from 'next/headers'; // ← Server-only import
import { getToken } from 'next-auth/jwt';

// ✅ This function works fine in server context
export async function getBackendToken(): Promise<string | null> {
  const cookie = await cookies();
  const token = await getToken({ cookies: cookie });
  return token?.backendToken || null;
}

// ❌ BUT this pure function CANNOT be imported by Client Components
// ...even though it doesn't use server APIs!
export function isAdmin(role?: string): boolean {
  return role === 'ADMIN';
}
```

### The Error

When a Client Component tries to import from a tainted file:

```typescript
// apps/web/src/components/AdminButton.tsx
'use client';

// ❌ ERROR: Client Components cannot import from this file!
// The entire file is marked as server-only because of the cookies() import
import { isAdmin } from '@/lib/auth';

export function AdminButton({ role }: { role?: string }) {
  if (!isAdmin(role)) return null;
  return <button>Admin</button>;
}
```

**Error message:**

```
Error: "isAdmin" is marked with 'server-only' but imported in a Client Component.
```

### Why This Happens

Next.js includes server-only modules at build time. When the client tries to execute the code, server APIs like `cookies()` don't exist in the browser, causing the entire module graph to be marked as server-only.

---

## Solution: File Organization Pattern

### 1. Separate Utilities File (.utils.ts)

Create a **pure utilities file with NO server imports**:

```typescript
// ✅ GOOD: Pure utilities, client-safe
// apps/web/src/lib/auth.utils.ts

/**
 * Pure role-checking utilities - safe for both server and client
 * No server imports allowed in this file
 */

export function isAdmin(role?: string): boolean {
  return role === 'ADMIN';
}

export function isTenantOwner(role?: string, tenantId?: string): boolean {
  return role === 'OWNER' && Boolean(tenantId);
}

export function isCustomer(role?: string): boolean {
  return role === 'CUSTOMER' || !role; // Default role
}

export function hasPermission(role: string, action: string): boolean {
  const roleHierarchy: Record<string, string[]> = {
    ADMIN: ['read', 'write', 'delete', 'manage'],
    OWNER: ['read', 'write', 'delete'],
    CUSTOMER: ['read'],
  };

  return (roleHierarchy[role] || []).includes(action);
}
```

### 2. Separate Server File (.server.ts)

Create a **server-only file with server imports**:

```typescript
// ✅ GOOD: Server-only, uses next/headers
// apps/web/src/lib/auth.server.ts

import 'server-only'; // Prevents accidental client imports

import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';
import type { JWT } from 'next-auth/jwt';

export async function getBackendToken(): Promise<string | null> {
  const cookie = await cookies();
  const token = (await getToken({ cookies: cookie })) as JWT | null;

  if (!token) return null;
  return (token as any).backendToken || null; // Server-side only
}

export async function getSessionUser() {
  const token = await getBackendToken();
  if (!token) return null;

  // Decode token, return user object
  // This stays server-side only
  return {
    /* user data */
  };
}

export async function validateRequest(requiredRole?: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;

  if (requiredRole) {
    // Import from .utils since it's pure
    const { hasPermission } = await import('./auth.utils');
    return hasPermission(user.role, requiredRole);
  }

  return true;
}
```

### 3. Use Both in Client Components

```typescript
// ✅ GOOD: Client component imports from .utils
// apps/web/src/components/AdminButton.tsx

'use client';

import { isAdmin } from '@/lib/auth.utils'; // ✓ Safe - pure utilities

interface AdminButtonProps {
  userRole?: string;
  onClick: () => void;
}

export function AdminButton({ userRole, onClick }: AdminButtonProps) {
  if (!isAdmin(userRole)) return null;

  return (
    <button onClick={onClick} className="btn-admin">
      Admin Panel
    </button>
  );
}
```

### 4. Use Both in Server Components

```typescript
// ✅ GOOD: Server component imports from both
// apps/web/src/app/(protected)/admin/page.tsx

import { getSessionUser } from '@/lib/auth.server';
import { isAdmin, hasPermission } from '@/lib/auth.utils';

export default async function AdminPage() {
  const user = await getSessionUser();

  if (!user || !isAdmin(user.role)) {
    return <div>Unauthorized</div>;
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>
      {hasPermission(user.role, 'delete') && (
        <button>Delete Users</button>
      )}
    </div>
  );
}
```

---

## File Organization Structure

```
apps/web/src/lib/
├── auth.utils.ts          ← Pure utilities, NO server imports
│   ├── isAdmin()
│   ├── isTenantOwner()
│   ├── hasPermission()
│   └── ... (all pure functions)
│
├── auth.server.ts         ← Server-only, imports next/headers
│   ├── getBackendToken()
│   ├── getSessionUser()
│   └── validateRequest()
│
├── api.ts                 ← Client ts-rest client (client-safe)
├── logger.ts              ← Pure logging (client-safe)
└── tenant.ts              ← Data fetching (check what it imports!)
```

**Rule:** If a file has `server-only` imports, create a `.server.ts` sibling and move pure logic to a `.utils.ts` file.

---

## Common Tainted Files and How to Fix Them

### Example 1: Auth Context

**Before (Tainted):**

```typescript
// apps/web/src/lib/auth.ts
import { cookies } from 'next/headers';

export const isAdmin = (role?: string) => role === 'ADMIN';
export const isTenantOwner = (role?: string) => role === 'OWNER';
export async function getBackendToken() {
  const c = await cookies();
  // ...
}
```

**After (Fixed):**

```typescript
// apps/web/src/lib/auth.utils.ts (pure utilities)
export const isAdmin = (role?: string) => role === 'ADMIN';
export const isTenantOwner = (role?: string) => role === 'OWNER';

// apps/web/src/lib/auth.server.ts (server-only)
import 'server-only';
import { cookies } from 'next/headers';

export async function getBackendToken() {
  const c = await cookies();
  // ...
}
```

### Example 2: Tenant Data Access

**Before (Tainted):**

```typescript
// apps/web/src/lib/tenant.ts
import { cookies } from 'next/headers';
import { headers } from 'next/headers';

export function getTenantSlug(slug: string): string {
  return slug.toLowerCase(); // Pure!
}

export async function getTenantBySlug(slug: string) {
  const h = await headers();
  // Server-only lookup
}
```

**After (Fixed):**

```typescript
// apps/web/src/lib/tenant.utils.ts (pure utilities)
export function getTenantSlug(slug: string): string {
  return slug.toLowerCase();
}

export function validateTenantSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug);
}

// apps/web/src/lib/tenant.server.ts (server-only)
import 'server-only';
import { headers } from 'next/headers';
import { getTenantSlug, validateTenantSlug } from './tenant.utils';

export async function getTenantBySlug(slug: string) {
  if (!validateTenantSlug(slug)) return null;
  const h = await headers();
  // ...
}
```

### Example 3: Metadata Generation

**Before (Tainted):**

```typescript
// apps/web/src/lib/metadata.ts
import { headers } from 'next/headers';

export function formatTitle(title: string): string {
  return `${title} | MAIS`;
}

export async function generateMetadata(slug: string) {
  const h = await headers();
  // Server-only metadata generation
}
```

**After (Fixed):**

```typescript
// apps/web/src/lib/metadata.utils.ts (pure utilities)
export function formatTitle(title: string): string {
  return `${title} | MAIS`;
}

export function formatDescription(desc: string): string {
  return desc.slice(0, 160);
}

// apps/web/src/lib/metadata.server.ts (server-only)
import 'server-only';
import { headers } from 'next/headers';
import { formatTitle, formatDescription } from './metadata.utils';

export async function generateMetadata(slug: string) {
  const h = await headers();
  // Server-only metadata generation using utils
}
```

---

## Detecting Tainted Files

### Manual Audit

Search for all server imports in lib:

```bash
# Find files importing server-only modules
grep -r "from 'next/headers'" apps/web/src/lib/
grep -r "from 'next/navigation'" apps/web/src/lib/ | grep -E "redirect|notFound"
grep -r "server-only" apps/web/src/lib/
grep -r "import.*getToken" apps/web/src/lib/
```

For each tainted file:

1. Identify pure functions
2. Create `.utils.ts` file
3. Move pure functions there
4. Keep server-only code in `.server.ts`

### Build Verification

```bash
npm run build

# If you see:
# Error: "X" is marked with 'server-only' but imported in a Client Component
# → Fix by creating .utils.ts file and removing import from .server.ts
```

---

## ESLint Prevention

Add to `.eslintrc.json`:

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "next/headers",
            "importNames": ["cookies", "headers", "draftMode"],
            "message": "Taints entire file for client use. Extract pure functions to .utils.ts, keep this import in .server.ts only"
          },
          {
            "name": "next/navigation",
            "importNames": ["redirect", "notFound"],
            "message": "Server-only. Move to .server.ts, extract shared logic to .utils.ts"
          },
          {
            "name": "next-auth/jwt",
            "message": "Server-only. Use in .server.ts, share pure logic via .utils.ts"
          }
        ],
        "patterns": [
          {
            "group": ["**/lib/**"],
            "importNames": ["cookies", "headers"],
            "message": "Server imports in lib/ taint entire module. Use .server.ts pattern"
          }
        ]
      }
    ]
  }
}
```

---

## Testing the Pattern

```typescript
// ✅ Test that .utils can be imported by client code
import { isAdmin } from '@/lib/auth.utils';

// ✅ Test that .server imports fail in client
// @ts-expect-error - Server-only import should fail
import { getBackendToken } from '@/lib/auth.server';

describe('Auth utilities', () => {
  it('should correctly identify admin role', () => {
    expect(isAdmin('ADMIN')).toBe(true);
    expect(isAdmin('CUSTOMER')).toBe(false);
  });

  it('should be importable in client components', () => {
    // This file compiles as a client component
    // If auth.utils was tainted, build would fail
  });
});
```

---

## Common Mistakes

### ❌ Mistake 1: Putting Everything in One File

```typescript
// ❌ WRONG: Pure and server-only in same file
import { cookies } from 'next/headers';

export function isAdmin(role?: string) {
  return role === 'ADMIN';
}
export async function getBackendToken() {
  /* ... */
}
```

**Fix:** Separate into `.utils.ts` and `.server.ts`

### ❌ Mistake 2: No Marker on Server File

```typescript
// ❌ WRONG: No 'server-only' marker, unclear intent
import { cookies } from 'next/headers';

export async function getBackendToken() {
  /* ... */
}
```

**Fix:** Add `import 'server-only'` at top of `.server.ts`

### ❌ Mistake 3: Importing .server in Client

```typescript
// ❌ WRONG: Client imports server-only
'use client';
import { getBackendToken } from '@/lib/auth.server'; // Runtime error!
```

**Fix:** Only import from `.utils.ts` in client components

### ❌ Mistake 4: Re-exporting Server Code

```typescript
// ❌ WRONG: Re-exporting server code
// apps/web/src/lib/index.ts
export * from './auth.server'; // Taints the barrel export!
export * from './auth.utils';
```

**Fix:** Only export from `.utils.ts`, or use explicit imports

---

## Migration Guide

### Step 1: Identify Tainted Files

```bash
grep -r "from 'next/" apps/web/src/lib/ | grep -v "next-auth"
```

### Step 2: Create .utils Files

For each tainted file, extract pure functions:

```typescript
// Original file identifies which functions are pure
// Move to new file

// apps/web/src/lib/original.ts
import { cookies } from 'next/headers';

export function pureFunction() {
  /* no side effects */
}
export async function serverFunction() {
  /* uses cookies */
}

// Becomes:

// apps/web/src/lib/original.utils.ts
export function pureFunction() {
  /* no side effects */
}

// apps/web/src/lib/original.server.ts
import 'server-only';
import { cookies } from 'next/headers';
export async function serverFunction() {
  /* uses cookies */
}
```

### Step 3: Update All Imports

```bash
# Find all imports of tainted file
grep -r "from '@/lib/original'" apps/web/src/

# Update to:
# Client components: import from './original.utils'
# Server components: import from './original.server'
```

### Step 4: Verify Build

```bash
npm run build

# Should succeed with no import errors
```

---

## Checklist

- [ ] Identified all files with server-only imports in lib/
- [ ] Created `.utils.ts` files for pure functions
- [ ] Created `.server.ts` files for server-only functions
- [ ] Added `server-only` marker to `.server.ts` files
- [ ] Updated all client imports to use `.utils.ts`
- [ ] Updated all server imports to use `.server.ts`
- [ ] `npm run build` passes with no errors
- [ ] ESLint rules configured to catch violations
- [ ] Documented file structure in project README

---

## Related Files

- **[NEXTJS_AUDIT_PREVENTION_STRATEGIES.md](NEXTJS_AUDIT_PREVENTION_STRATEGIES.md)** - Full prevention guide
- **[NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md)** - Quick checklist
- **[ADR-014: Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)** - Architecture decision
- **[Next.js Documentation: Server Components](https://nextjs.org/docs/app/building-your-application/rendering/server-components)**

---

**Key Takeaway:** Separate pure utilities (`.utils.ts`) from server-only code (`.server.ts`) to avoid import tainting issues.
