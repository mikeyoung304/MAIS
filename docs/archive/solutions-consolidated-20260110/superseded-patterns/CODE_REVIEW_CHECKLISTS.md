# Code Review Checklists (Print and Pin)

Three P0 vulnerability patterns with quick visual checklists. Use these during code review.

---

## Checklist 1: Express Route Ordering (Static First)

**When reviewing:** Routes, API endpoints, REST handlers

```
┌─────────────────────────────────────────────────┐
│ ROUTE REGISTRATION ORDER CHECKLIST              │
├─────────────────────────────────────────────────┤
│                                                 │
│ WRONG (routes executed in order, :id shadows)  │
│                                                 │
│  router.get('/:id', handler)           ❌      │
│  router.get('/me', handler)             ❌      │
│                                                 │
│ WHY BROKEN:                                     │
│  GET /users/me → matches /:id first             │
│  req.params.id = 'me'                          │
│  /me handler never executes                    │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ CORRECT (static routes registered first)       │
│                                                 │
│  router.get('/me', handler)             ✅      │
│  router.get('/:id', handler)            ✅      │
│                                                 │
│ WHY WORKS:                                      │
│  GET /users/me → matches /me first              │
│  GET /users/123 → matches /:id second           │
│  Both endpoints work correctly                 │
│                                                 │
├─────────────────────────────────────────────────┤
│ VISUAL: Always put static ABOVE parameterized  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ CODE PATTERNS TO FLAG                           │
├─────────────────────────────────────────────────┤
│                                                 │
│ Static routes COMMONLY shadowed by /:id:       │
│  • /me           (get current user)             │
│  • /current      (get current resource)         │
│  • /status       (get status)                   │
│  • /health       (health check)                 │
│  • /export       (export data)                  │
│  • /import       (import data)                  │
│  • /duplicate    (duplicate resource)           │
│  • /archive      (archive resource)             │
│  • /unarchive    (unarchive resource)           │
│                                                 │
│ If you see these AFTER /:id → FLAG IT           │
│                                                 │
└─────────────────────────────────────────────────┘

QUICK TEST:
  curl http://localhost/api/users/me

  ❌ BUG: Returns { id: "me" } (wrong handler)
  ✅ FIX: Returns { userId, email, ... } (current user)
```

**Questions to Ask:**

- Are all static routes (like `/me`) registered BEFORE `/:id` routes?
- Does the test for `/me` endpoint exist and pass?
- Do git diffs show route additions in correct order?
- When someone requests `/users/me`, does it return current user or user with id='me'?

**Reference File:** `server/src/routes/tenant-admin-segments.routes.ts`

- Lines 38-54: `GET /` (static)
- Lines 79-117: `POST /` (static)
- Lines 131-146: `GET /:id` (parameterized)

---

## Checklist 2: Auth Fallback Guards (No Default 'system')

**When reviewing:** Auth middleware, user context, audit logging

```
┌─────────────────────────────────────────────────┐
│ AUTHENTICATION FALLBACK VULNERABILITY           │
├─────────────────────────────────────────────────┤
│                                                 │
│ WRONG (uses fallback when auth fails)           │
│                                                 │
│  const userId = res.locals.user?.id || 'system' │
│                                        ❌        │
│  recordAudit({ actor: userId, action })         │
│                                                 │
│ DANGER: Auth bug becomes silent success        │
│  • Missing auth → returns 200 (not 401)         │
│  • Action attributed to 'system' (not attacker) │
│  • Audit trail useless (all actions "system")   │
│  • Enable privilege escalation                  │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ CORRECT (reject if auth missing)                │
│                                                 │
│  const userId = res.locals.user?.id;            │
│                                                 │
│  if (!userId) {                                 │
│    res.status(401).json({ error: '...' });     │
│    return;                                      │
│  }                                              │
│                                      ✅         │
│  recordAudit({ actor: userId, action })         │
│                                                 │
│ SECURE: Auth enforced, audit trail clear       │
│  • Missing auth → returns 401                   │
│  • Action never recorded if no auth             │
│  • Attacker traceable (not 'system')            │
│  • Middleware validates BEFORE handler          │
│                                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ FALLBACK PATTERNS TO BLOCK                      │
├─────────────────────────────────────────────────┤
│                                                 │
│ NEVER USE WITH AUTH VALUES:                     │
│  • userId || 'system'          ❌               │
│  • tenantId || 'default'       ❌               │
│  • admin ?? 'system'           ❌               │
│  • userId ?? 'unknown'         ❌               │
│  • auth?.id || 'anonymous'     ❌               │
│  • principal?.name || 'guest'  ❌               │
│                                                 │
│ OK TO USE WITH OTHER VALUES:                    │
│  • theme || 'light'            ✅ (not auth)    │
│  • limit || 10                 ✅ (not auth)    │
│  • sortBy || 'date'            ✅ (not auth)    │
│                                                 │
└─────────────────────────────────────────────────┘

AUDIT LOG VISIBILITY:

  ❌ BUG: All actions show actor='system' → can't trace who did it
  ✅ FIX: All actions show actor=actual_user_id → full traceability
```

**Questions to Ask:**

- Are there any `|| 'system'`, `|| 'unknown'`, or `|| 'default'` fallbacks for auth values?
- Does missing auth return 401, or 200 with fallback?
- Is auth checked in middleware (before handler) or in handler (too late)?
- Do audit logs show actual user IDs or fallback values?
- Can request without auth token succeed?

**Search Command:**

```bash
grep -rn "userId.*||.*'" server/src --include="*.ts" | grep -E "system|unknown|default"
```

**Reference File:** `server/src/routes/platform-admin-traces.routes.ts`

- Line 238: `const userId = res.locals.user?.id || 'system';` ← VULNERABLE
- Line 287: `const userId = res.locals.user?.id || 'system';` ← VULNERABLE

---

## Checklist 3: Multi-Tenant Isolation (Always Include tenantId)

**When reviewing:** Database queries, Prisma operations, data fetching

```
┌─────────────────────────────────────────────────┐
│ MULTI-TENANT DATA ISOLATION                     │
├─────────────────────────────────────────────────┤
│                                                 │
│ WRONG (trusts pre-scoped ID, no tenantId check) │
│                                                 │
│  const segment = await prisma.segment           │
│    .findUnique({                                │
│      where: { id: segmentId }      ❌          │
│    });                                          │
│                                                 │
│ DANGER:                                         │
│  • No verification: does this segment belong to │
│    the requesting tenant?                       │
│  • Attacker can guess segment IDs               │
│  • Returns segments from OTHER tenants          │
│  • Multi-tenant security completely broken      │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ CORRECT (includes tenantId in query)            │
│                                                 │
│  const segment = await prisma.segment           │
│    .findUnique({                                │
│      where: {                                   │
│        id_tenantId: {              ✅           │
│          id: segmentId,                         │
│          tenantId: auth.tenantId                │
│        }                                        │
│      }                                          │
│    });                                          │
│                                                 │
│ SECURE:                                         │
│  • Only tenant owner can access their segments  │
│  • ID + tenantId = unique (prevents collisions) │
│  • Attacker cannot access other tenant data     │
│  • Defense-in-depth: query layer verifies       │
│                                                 │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ PRISMA OPERATIONS CHECKLIST                     │
├─────────────────────────────────────────────────┤
│                                                 │
│ findUnique:                                     │
│   ❌ where: { id }                              │
│   ✅ where: { id_tenantId: { id, tenantId } }  │
│                                                 │
│ findFirst:                                      │
│   ❌ where: { slug }                            │
│   ✅ where: { slug, tenantId }                  │
│                                                 │
│ findMany:                                       │
│   ❌ where: {}                     (all tenants)│
│   ✅ where: { tenantId }                        │
│                                                 │
│ update:                                         │
│   ❌ where: { id }                              │
│   ✅ where: { id_tenantId: { id, tenantId } }  │
│                                                 │
│ delete:                                         │
│   ❌ where: { id }                              │
│   ✅ where: { id_tenantId: { id, tenantId } }  │
│                                                 │
│ RULE: If you query by ID, also include tenantId│
│                                                 │
└─────────────────────────────────────────────────┘

SCHEMA REQUIREMENT:

  ✅ CORRECT schema with composite key:

  model Segment {
    id       String @id
    tenantId String
    name     String

    tenant   Tenant @relation(fields: [tenantId], references: [id])

    @@unique([tenantId, id])      // Composite key enforces isolation
    @@index([tenantId])           // Fast tenant-scoped queries
  }
```

**Questions to Ask:**

- Does every `findUnique`, `findFirst`, `update`, `delete` include `tenantId` in where clause?
- Are composite keys (like `@@unique([tenantId, id])`) used in schema?
- Can a user from tenant A access resources from tenant B by guessing IDs?
- Do tests verify cross-tenant access returns null/404?
- Does the schema have `@@index([tenantId])` for performance?

**Search Commands:**

```bash
# Find queries missing tenantId
grep -rn "findUnique.*where:" server/src --include="*.ts" -A 3 | \
  grep -B 1 "id:" | grep -v "tenantId"

# Find missing composite keys in schema
grep -n "@@unique" server/prisma/schema.prisma | \
  grep -v "tenantId"
```

**Reference File:** `server/src/adapters/prisma/catalog.repository.ts`

- Line 61: `where: { tenantId_slug: { tenantId, slug } }` ✅ Correct composite
- Line 112: `where: { tenantId, id }` ✅ Correct (both required)
- Line 229: `where: { tenantId, id }` ✅ Correct (both required)

---

## Combined Quick Reference (1-Minute Review)

Use this for fast PRs:

```
┌──────────────────────────────────────────────────┐
│ 3 CHECKS FOR ALL CODE REVIEWS (P0 SECURITY)     │
├──────────────────────────────────────────────────┤
│                                                  │
│ 1. ROUTE ORDER                                   │
│    □ No static routes AFTER /:id routes?        │
│    □ /me, /current, /status appear first?       │
│    □ git diff shows static routes on top?       │
│                                                  │
│ 2. AUTH FALLBACK                                 │
│    □ No || 'system' fallbacks?                   │
│    □ No ?? 'unknown' fallbacks?                  │
│    □ Missing auth returns 401 (not 200)?        │
│    □ Audit logs show real userIds (not system)? │
│                                                  │
│ 3. TENANT ISOLATION                              │
│    □ All queries include tenantId?               │
│    □ Composite keys in schema? @@unique([...])  │
│    □ Cross-tenant access returns null?          │
│    □ Tests verify isolation?                     │
│                                                  │
│ APPROVED IF ALL 3 PASS                           │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## Git Diff Scanning

When reviewing PRs, scan diffs for these patterns:

```bash
# Route ordering issue
git diff HEAD~1 HEAD -- 'server/src/routes/*.ts' | \
  grep -E '^\+.*router\.(get|post)\('

# Auth fallback vulnerability
git diff HEAD~1 HEAD | grep -E "^[\+].*\|\|.*['\"]system|unknown|default" | \
  grep -E "user|auth|principal|admin"

# Missing tenantId in queries
git diff HEAD~1 HEAD -- 'server/src' | \
  grep -E '^\+.*where:' | \
  grep -v 'tenantId'
```

---

## Test Verification Checklist

Before approving, run these tests:

```bash
# 1. Route ordering - verify /me endpoint works
curl http://localhost:3001/api/users/me
# Should return current user, NOT { id: 'me' }

# 2. Auth rejection - verify missing auth is rejected
curl http://localhost:3001/api/protected
# Should return 401, NOT 200 with fallback user

# 3. Cross-tenant isolation - verify data isolation
# Request segment from tenant A as tenant B
# Should return 404 or null, NOT the segment
```

---

## When to Flag for Security Review

Escalate to security team if you see:

1. **Any `|| 'system'` fallback for auth** (vulnerability)
2. **Queries without tenantId in where clause** (data leak)
3. **Static routes after parameterized routes** (feature break)
4. **Composite keys removed from schema** (isolation broken)
5. **Auth checks in handler instead of middleware** (bypasses on error)

---

## Print & Pin Instructions

1. Print this page (one-sided for desk size)
2. Laminate for durability
3. Pin to desk or monitor bezel
4. Reference during every code review
5. Use checklists as conversation starters in PR comments

**Severity:** P0 (Production blocker)
**Update Frequency:** Only if new patterns discovered
**Last Updated:** 2026-01-02
