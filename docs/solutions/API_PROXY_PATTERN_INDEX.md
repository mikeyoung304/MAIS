# API Proxy Pattern Documentation Index

**Problem:** Client components calling backend API directly without proper authentication

**Solution:** API proxy pattern - server-side routes that bridge NextAuth sessions with Express backend authentication

---

## Documents (Read in Order)

### 1. Quick Reference (START HERE)

**File:** `docs/solutions/API_PROXY_QUICK_REFERENCE.md`

- 30-second proxy creation
- Common errors and fixes
- Anti-patterns to avoid
- When to use proxies

**Best for:** Daily reference, quick lookup

---

### 2. Comprehensive Guide

**File:** `docs/solutions/API_PROXY_PATTERN_PREVENTION.md`

- Problem statement and architecture
- Step-by-step implementation guide
- Architecture patterns (Query, Mutate, Delete)
- Prevention strategies
- Common errors with solutions
- Testing patterns

**Best for:** Understanding the full pattern, implementing new proxies

---

### 3. Code Review Checklist

**File:** `docs/solutions/API_PROXY_CODE_REVIEW_CHECKLIST.md`

- 6-tier review checklist
- Security (token exposure)
- Correctness (body/headers)
- Next.js patterns
- Error handling
- Code quality
- Testing requirements

**Best for:** Reviewing PRs with auth changes, catching issues

---

### 4. Architectural Decision Record

**File:** `docs/adrs/ADR-015-api-proxy-pattern.md`

- Problem statement
- Design rationale
- Alternative approaches considered
- Implementation checklist
- Security model
- Migration path
- Future enhancements

**Best for:** Understanding "why" this pattern exists, architectural context

---

## Quick Answer Guide

### "When should I use an API proxy?"

```
Is this a client component ('use client')?
├─ YES → Continue
└─ NO → You don't need a proxy

Does the endpoint require authentication?
├─ YES → Continue
└─ NO → Call directly, no proxy needed

Can you use a Server Component instead?
├─ YES → Use Server Component (no proxy)
└─ NO → Create/use proxy route

Does a proxy route already exist?
├─ YES → Use it
└─ NO → Create new proxy route
```

→ See `API_PROXY_QUICK_REFERENCE.md` for decision tree

---

### "How do I create a proxy route?"

1. Create: `apps/web/src/app/api/{feature}/[...path]/route.ts`
2. Copy template from `API_PROXY_QUICK_REFERENCE.md`
3. Replace `{feature}` with feature name
4. Test: Verify `getBackendToken()` returns token
5. Test: Verify backend receives Authorization header

→ See `API_PROXY_QUICK_REFERENCE.md` for template

---

### "What am I doing wrong?"

| Error                 | Cause                 | Fix                                                            |
| --------------------- | --------------------- | -------------------------------------------------------------- |
| 401 Unauthorized      | Token missing/invalid | Check session active; verify `getBackendToken()` returns value |
| CORS error            | Direct backend call   | Use proxy route `/api/{feature}/path` not backend URL          |
| Empty body in backend | Body not forwarded    | Use `body = await request.text()` for POST/PUT                 |
| Missing HTTP methods  | Only exports GET      | Export GET, POST, PUT, PATCH, DELETE                           |
| Token in logs         | Logging issue         | Remove token from logged data                                  |

→ See `API_PROXY_PATTERN_PREVENTION.md` for detailed solutions

---

## Files to Review

### Production Proxy Routes (Reference)

These are production-ready examples you can copy:

1. **Tenant Admin Proxy**
   - File: `apps/web/src/app/api/tenant-admin/[...path]/route.ts`
   - Purpose: Package/booking admin CRUD
   - Backend: `/v1/tenant-admin/*`

2. **Agent Proxy**
   - File: `apps/web/src/app/api/agent/[...path]/route.ts`
   - Purpose: AI assistant integration
   - Backend: `/v1/agent/*`

Both follow the same pattern - use these as templates.

### Supporting Code

- **Auth Helper:** `apps/web/src/lib/auth.ts`
  - `getBackendToken()` - Server-side token retrieval
  - Used by proxy routes to access session token

- **Logger:** `apps/web/src/lib/logger.ts`
  - Used for error logging in proxies
  - Never logs token or sensitive data

---

## Prevention Checklist

Before committing code with API proxy changes:

**Security:**

- [ ] Proxy calls `getBackendToken()` before backend request
- [ ] Authorization header uses `Bearer ${token}` format
- [ ] Token not exposed in client code
- [ ] No hardcoded tokens
- [ ] Error messages don't reveal token

**Correctness:**

- [ ] Request body forwarded for POST/PUT (`await request.text()`)
- [ ] Content-Type header preserved
- [ ] Query strings forwarded (`?sort=name`)
- [ ] All HTTP methods exported (GET, POST, PUT, PATCH, DELETE)
- [ ] 401 returned if token missing

**Next.js Patterns:**

- [ ] Uses `NextRequest` and `NextResponse`
- [ ] `params` awaited before use
- [ ] Single `handleRequest()` function
- [ ] No duplicate routes
- [ ] Uses `process.env.NEXT_PUBLIC_API_URL`

**Error Handling:**

- [ ] 401 for auth failures (not 500)
- [ ] Backend errors forwarded as-is
- [ ] Error logging includes context (method, URL)
- [ ] Error logging excludes token
- [ ] Try/catch wraps entire handler

**Testing:**

- [ ] Tested after login (token available)
- [ ] Tested without login (401 response)
- [ ] Tested with mutations (POST/PUT)
- [ ] Tested with delete (DELETE)

---

## Common Patterns

### Pattern 1: Query Data from Client Component

```typescript
'use client';

export function PackageList() {
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    fetch('/api/tenant-admin/packages')
      .then(r => r.json())
      .then(setPackages);
  }, []);

  return <div>{packages.length}</div>;
}
```

**Flow:** Client → Proxy `/api/tenant-admin/packages` → Backend `/v1/tenant-admin/packages`

### Pattern 2: Use Server Component Instead (Preferred)

```typescript
// No 'use client' - Server Component
export async function PackageList() {
  const token = await getBackendToken();
  const response = await fetch(`${API_URL}/v1/tenant-admin/packages`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const packages = await response.json();
  return <div>{packages.length}</div>;
}
```

**Flow:** Direct to backend (no proxy, simpler)

### Pattern 3: Mutate Data via Proxy

```typescript
'use client';

async function createPackage(name: string) {
  const response = await fetch('/api/tenant-admin/packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return response.json();
}
```

**Flow:** Client → Proxy (POST body) → Backend → Returns created resource

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│ Next.js App (Browser)                                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Client Component ('use client')                          │
│       ↓                                                    │
│  fetch('/api/tenant-admin/packages')                      │
│       ↓                                                    │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ Next.js API Route (Server)                                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  /api/tenant-admin/[...path]/route.ts                     │
│       ├─ getBackendToken() → Gets JWT from session       │
│       ├─ Builds Authorization: Bearer {token}             │
│       └─ fetch(Backend API + token)                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────┐
│ Express Backend (Port 3001)                                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  /v1/tenant-admin/packages                                │
│       ├─ Validates: Authorization header present          │
│       ├─ Validates: JWT signature valid                   │
│       ├─ Processes: CRUD operations                       │
│       └─ Returns: JSON response                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## Key Insight

**The proxy route is the bridge between client-side code and server-side authentication.**

- **Client:** Gets token-free access (proxy handles auth)
- **Proxy:** Retrieves token, forwards request (middleware)
- **Backend:** Validates token, processes request (API)

This keeps the token secure while allowing interactive UX.

---

## Next Steps

1. **First time?** Read `API_PROXY_QUICK_REFERENCE.md` (5 min)
2. **Need to create proxy?** Follow template in Quick Reference (10 min)
3. **Reviewing code?** Use `API_PROXY_CODE_REVIEW_CHECKLIST.md`
4. **Deep understanding?** Read `API_PROXY_PATTERN_PREVENTION.md`
5. **Architectural context?** Read `docs/adrs/ADR-015-api-proxy-pattern.md`

---

## Getting Help

**Question:** How do I...?

- Create a proxy route → See Quick Reference, Pattern Creation section
- Debug 401 errors → See Comprehensive Guide, Common Errors section
- Review a PR → See Code Review Checklist
- Understand why this pattern → See ADR-015

**Issue:** I'm getting...?

- 401 Unauthorized → See Error Handling section
- CORS error → You're calling backend directly, use proxy
- Empty body → Not forwarding request text, use `await request.text()`
- Token in logs → Remove token from logged data

---

## Related Documentation

- **NextAuth Setup:** `apps/web/src/lib/auth.ts`
- **Backend Contracts:** `packages/contracts/`
- **Multi-tenant Guide:** `docs/multi-tenant/`
- **Security Guide:** `docs/security/`
- **Architecture Guide:** `docs/ARCHITECTURE.md`

---

## Document Maintenance

This index is maintained by the Architecture team.

**Last Updated:** 2025-12-28
**Review Schedule:** Every 6 months or after major changes
**Owner:** @architecture-team
