# Next.js Client API Proxy - Quick Reference

**Print this. Pin to your desk during frontend development.**

---

## The Rule

| Component Type            | How to Call API    | Code                                  |
| ------------------------- | ------------------ | ------------------------------------- |
| **Client** ('use client') | `/api/*` proxy     | `fetch('/api/tenant-admin/packages')` |
| **Server** (no directive) | Direct Express API | `await createServerApiClient()`       |

---

## Client Component Pattern (30 seconds)

```typescript
'use client';
import { useState } from 'react';

export function MyComponent() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const loadData = async () => {
    // 1. Call Next.js proxy (same origin)
    const response = await fetch('/api/tenant-admin/packages');

    // 2. Check if authenticated
    if (response.status === 401) {
      setError('Please sign in');
      return;
    }

    // 3. Check if successful
    if (!response.ok) {
      setError('Failed to load data');
      return;
    }

    // 4. Use data
    setData(await response.json());
  };

  // ... rest of component
}
```

---

## Decision Tree (Choose One)

```
Which route are you in?
│
├─ /app/xyz/page.tsx (or any route file without 'use client')
│  └─ SERVER COMPONENT
│     └─ Use: const api = await createServerApiClient();
│
└─ Component marked with 'use client'
   └─ CLIENT COMPONENT
      └─ Use: await fetch('/api/...');
```

---

## Proxy Routes (Client Components)

These are the only URLs you use in client code:

| Use This                     | Goes To Backend             | For                       |
| ---------------------------- | --------------------------- | ------------------------- |
| `/api/tenant-admin/packages` | `/v1/tenant-admin/packages` | Admin dashboard API calls |
| `/api/agent/health`          | `/v1/agent/health`          | AI assistant calls        |
| `/api/agent/message`         | `/v1/agent/message`         | Chat messages             |

---

## What NOT to Do

| Wrong                                                | Why                              | Right                            |
| ---------------------------------------------------- | -------------------------------- | -------------------------------- |
| `fetch('http://localhost:3001/...')`                 | Client can't add auth token      | `fetch('/api/tenant-admin/...')` |
| `const token = localStorage.getItem('backendToken')` | Token isn't in localStorage      | Use proxy (it has token)         |
| `credentials: 'include'`                             | CORS blocks cross-origin cookies | Use same-origin proxy            |
| No error handling                                    | 401 crashes the component        | Check `response.ok` first        |

---

## Error Handling (Copy This)

```typescript
const response = await fetch('/api/tenant-admin/packages');

// Pattern: Check status BEFORE parsing JSON
if (response.status === 401) {
  window.location.href = '/login'; // Or show login form
  return;
}

if (!response.ok) {
  const errorData = await response.json();
  throw new Error(errorData.error || 'API error');
}

const data = await response.json();
```

---

## React Query Boilerplate

```typescript
import { useQuery } from '@tanstack/react-query';

export function usePackages() {
  return useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const response = await fetch('/api/tenant-admin/packages');

      if (response.status === 401) throw new Error('Not authenticated');
      if (!response.ok) throw new Error('Failed to fetch');

      return response.json();
    },
  });
}

// In component:
const { data, error, isLoading } = usePackages();
```

---

## Checklist: Before You Commit

- [ ] Client components use `/api/*` URLs (not `NEXT_PUBLIC_API_URL`)
- [ ] Server components use `createServerApiClient()`
- [ ] No `localStorage.getItem('token')` anywhere
- [ ] No `Authorization` header in client fetch code
- [ ] 401 responses are handled
- [ ] response.ok is checked before parsing JSON
- [ ] No CORS errors in browser console

---

## Symptom → Solution

| Problem                            | Cause                                          | Fix                                                    |
| ---------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| "Unauthorized" error               | User not logged in                             | Check `response.status === 401` → redirect to `/login` |
| CORS error in console              | Calling `localhost:3001` from `localhost:3000` | Use `/api/*` proxy instead (same origin)               |
| Component crashes parsing response | Got 401/error response as JSON                 | Check `response.ok` before `response.json()`           |
| Blank/broken UI in sidebar         | API returned error silently                    | Add error state + error display                        |
| "unavailable": false message       | API says user not authenticated                | Same as #1: need login                                 |

---

## Why This Pattern Exists

**You asked:** "Why can't I just call the Express API directly?"

**Answer:** The backend token is in an **HTTP-only cookie** (for security). HTTP-only cookies are invisible to JavaScript.

- The browser can't read them
- Only the server can read them
- That's by design (protects against XSS attacks)

**The proxy bridges this gap:**

```
Client Component
    ↓ (no token)
Next.js Proxy Route (reads HTTP-only cookie)
    ↓ (has token, adds to request)
Express API
```

**Result:** Client code stays simple, authentication stays secure.

---

## Server Component (For Reference)

You probably won't write this often, but here's the pattern:

```typescript
// ⚠️ Server Component (no 'use client')
import { createServerApiClient } from '@/lib/api';

export async function PackageList() {
  try {
    const api = await createServerApiClient();
    const response = await api.getPackages();

    if (!response.ok) {
      return <div>Failed to load packages</div>;
    }

    return (
      <ul>
        {response.body?.map(p => <li key={p.id}>{p.name}</li>)}
      </ul>
    );
  } catch (error) {
    return <div>Error: {error.message}</div>;
  }
}
```

**Difference:**

- No `'use client'` = Server Component
- Can call Express directly (has token from session)
- Better performance (rendered on server)
- No CORS issues

---

## Real-World Examples

### Example 1: Loading Packages on Mount

```typescript
'use client';
import { useEffect, useState } from 'react';

export function PackageList() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/tenant-admin/packages');

        if (response.status === 401) {
          setError('Please sign in');
          return;
        }

        if (!response.ok) throw new Error('Failed to load');

        setPackages(await response.json());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <ul>
      {packages.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

### Example 2: Form Submission

```typescript
'use client';
import { useState } from 'react';

export function CreatePackageForm() {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/tenant-admin/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (response.status === 401) {
        setError('Session expired, please sign in again');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create package');
      }

      const newPackage = await response.json();
      setName('');
      // Refetch list or update state
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Package name"
      />
      <button type="submit" disabled={submitting}>
        {submitting ? 'Creating...' : 'Create'}
      </button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
```

---

## File Locations

| What               | Where                                                   |
| ------------------ | ------------------------------------------------------- |
| Tenant Admin Proxy | `/apps/web/src/app/api/tenant-admin/[...path]/route.ts` |
| Agent Proxy        | `/apps/web/src/app/api/agent/[...path]/route.ts`        |
| Server API Client  | `/apps/web/src/lib/api.ts` → `createServerApiClient()`  |
| NextAuth.js Config | `/apps/web/src/lib/auth.ts` → `getBackendToken()`       |

---

## TL;DR

**Client Component:**

```typescript
const response = await fetch('/api/tenant-admin/packages');
if (response.status === 401) redirect('/login');
if (!response.ok) throw error;
const data = await response.json();
```

**Server Component:**

```typescript
const api = await createServerApiClient();
const response = await api.getPackages();
if (!response.ok) return <Error />;
const data = response.body;
```

**That's it. That's the whole pattern.**
