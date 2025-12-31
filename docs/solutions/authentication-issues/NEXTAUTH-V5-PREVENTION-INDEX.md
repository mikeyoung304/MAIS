# NextAuth v5 getBackendToken() - Prevention Strategy Index

**Complete prevention documentation for NextAuth v5 JWT token retrieval in HTTPS environments.**

---

## The Problem (TL;DR)

`getBackendToken()` fails in production because:

1. **Cookie names differ by protocol**:
   - HTTP: `authjs.session-token`
   - HTTPS: `__Secure-authjs.session-token` (the `__Secure-` prefix is critical!)

2. **Code only checked HTTP variant**:
   - Local development (HTTP) worked fine
   - Production (HTTPS) silently failed
   - Users locked out with 401 Unauthorized

3. **Mock request objects failed**:
   - Server Components constructed request objects manually
   - `getToken()` couldn't extract cookies from mock objects
   - Real Request objects work perfectly

---

## Documentation Suite

### 1. **Full Prevention Guide** (45 min read)

**File**: `nextauth-v5-getbackendtoken-cookie-prefix.md`

Comprehensive documentation covering:

- Root cause analysis (3 causes explained)
- Step-by-step implementation (4 steps)
- Security considerations
- Testing verification with examples
- Prevention strategies & checklist
- Code changes summary

**When to read**: You need to understand the full context or are implementing the fix

**Key sections**:

- Problem Statement
- Root Cause Analysis
- Solution Overview
- Step-by-Step Implementation
- Prevention Strategies

---

### 2. **Quick Reference** (5 min read)

**File**: `NEXTAUTH-V5-QUICK-REFERENCE.md`

Print-and-pin reference for developers:

- Core issue in 30 seconds
- One-liner reminders
- Copy-paste code patterns
- Debugging checklist
- Cookie name lookup table
- Common mistakes to avoid

**When to read**: You're debugging a token issue RIGHT NOW and need quick answers

**Best for**: Post it on your monitor, reference during debugging

---

### 3. **Code Review Checklist** (15 min read)

**File**: `NEXTAUTH-V5-CODE-REVIEW-CHECKLIST.md`

Checklist for reviewers of any NextAuth token code:

- Cookie name verification (7 checks)
- Request object handling (4 checks)
- Token usage patterns (3 checks)
- Testing & validation (4 checks)
- Security considerations (3 checks)
- Anti-patterns to reject (5 patterns)

**When to read**: You're reviewing a PR that touches authentication

**Use it for**:

- Approving code confidently
- Pointing out issues with specific links
- Educating reviewers about the problem

---

### 4. **Testing Strategy** (30 min read)

**File**: `NEXTAUTH-V5-TESTING-STRATEGY.md`

Complete testing guide covering:

- Unit tests (4 test suites with code)
- Integration tests (local HTTP)
- Staging tests (HTTPS)
- E2E tests with Playwright
- Manual testing checklist
- Debugging test failures
- CI/CD integration

**When to read**: You need to add tests or verify existing tests are sufficient

**Key sections**:

- Unit Tests (Mocked Environment)
- Integration Tests (Local HTTP)
- Staging Tests (HTTPS)
- E2E Tests (Playwright)
- Manual Testing Checklist
- Debugging Test Failures
- Pre-Deployment Verification

---

## Quick Navigation Map

### "I'm a developer who just..."

**...is debugging a token issue**
→ Read: `NEXTAUTH-V5-QUICK-REFERENCE.md`
→ Then: Check "Debugging Checklist" section
→ Takes: 5 minutes

**...implemented getBackendToken()**
→ Read: `nextauth-v5-getbackendtoken-cookie-prefix.md`
→ Key sections: "Step-by-Step Implementation" & "Prevention Strategies"
→ Takes: 30 minutes

**...need to test the fix**
→ Read: `NEXTAUTH-V5-TESTING-STRATEGY.md`
→ Key section: "Unit Tests" & "E2E Tests"
→ Takes: 20 minutes

**...wants to understand the architecture**
→ Read: `nextauth-v5-getbackendtoken-cookie-prefix.md`
→ Start with: "Root Cause Analysis"
→ Takes: 45 minutes

---

### "I'm a code reviewer reviewing..."

**...a PR that touches NextAuth**
→ Use: `NEXTAUTH-V5-CODE-REVIEW-CHECKLIST.md`
→ Check: All boxes in "Reviewer Sign-Off" section
→ Takes: 10 minutes per PR

**...need to know what to look for**
→ Read: "Cookie Name Verification" section (3 min)
→ Read: "Request Object Handling" section (3 min)
→ Takes: 6 minutes

**...want to explain the issue to PR author**
→ Reference: The specific anti-pattern from "Anti-Patterns to Reject"
→ Provide link: `NEXTAUTH-V5-QUICK-REFERENCE.md` for quick fix
→ Takes: 5 minutes

---

### "I'm deploying to..."

**...staging (HTTPS)**
→ Use: "Staging Tests" from `NEXTAUTH-V5-TESTING-STRATEGY.md`
→ Follow: "Pre-Deployment Verification" checklist
→ Takes: 30 minutes

**...production**
→ Verify: Staging tests all passed
→ Check: "Post-Deployment" section in testing guide
→ Monitor: Error logs for 4 hours
→ Takes: Throughout day

---

### "I'm implementing..."

**...a new API route that needs token**
→ Reference: "Copy-Paste Patterns" in quick reference
→ Follow: "API Routes Pass Actual Request Parameter" from code review checklist
→ Takes: 3 minutes (copy-paste)

**...a Server Component that needs token**
→ Reference: "Copy-Paste Patterns" in quick reference
→ Remember: No parameters needed for getBackendToken()
→ Takes: 3 minutes

**...full authentication feature**
→ Start: Read full prevention guide
→ Implement: Step-by-step from implementation section
→ Test: Use entire test strategy
→ Takes: 4-6 hours

---

## Key Decision Points

### Decision 1: Cookie Names to Check

```
Q: Which cookie names should I check?
A: Use possibleCookieNames array in getBackendToken()

Order matters!
1. __Secure-authjs.session-token  (HTTPS/production - check FIRST)
2. authjs.session-token           (HTTP/development)
3. __Secure-next-auth.session-token (NextAuth v4, HTTPS)
4. next-auth.session-token         (NextAuth v4, HTTP)

Reference: Full guide section "Step 1: Update Cookie Name Lookup Order"
```

### Decision 2: How to Pass Request to getBackendToken()

```
Q: When calling getBackendToken(), should I pass the request?

A: Depends on context:

API Route (route.ts):
  → YES, always pass request
  → export async function GET(request: Request)
  → const token = await getBackendToken(request)

Server Component:
  → NO, don't pass request
  → const token = await getBackendToken()

Client Component:
  → DON'T USE getBackendToken()
  → Use useSession() instead

Reference: Code review checklist sections "API Routes" and "Server Components"
```

### Decision 3: How to Handle Null Tokens

```
Q: What should I do if getBackendToken() returns null?

A: Always check before using:

const token = await getBackendToken(request);
if (!token) {
  return new Response('Unauthorized', { status: 401 });
}
// Now safe to use token

Reference: Quick reference "Common Mistakes" section MISTAKE 3
```

### Decision 4: Testing on HTTP vs HTTPS

```
Q: Do I need to test both HTTP and HTTPS?

A: YES, absolutely required:

Local dev (HTTP):
  - Tests cookie name without __Secure- prefix
  - Catches if code assumes HTTPS-only

Staging (HTTPS):
  - Tests cookie name with __Secure- prefix
  - Catches the actual production scenario
  - Required before any production deployment

Reference: Testing strategy "Staging Tests (HTTPS)" section
```

---

## Common Mistakes Index

| Mistake                                | Reference                                 | Fix                            |
| :------------------------------------- | :---------------------------------------- | :----------------------------- |
| Only checking `authjs.session-token`   | Quick reference MISTAKE 1                 | Add `__Secure-` variant first  |
| Constructing mock request in API route | Quick reference MISTAKE 2                 | Pass actual request parameter  |
| Not handling null token                | Quick reference MISTAKE 3                 | Check for null before use      |
| Using getBackendToken() on client      | Quick reference MISTAKE 4                 | Use useSession() instead       |
| Only testing HTTP, not HTTPS           | Code review checklist                     | Test both protocols            |
| Assuming consistent cookie name        | Testing strategy "Decision: Cookie Names" | Check all variants             |
| Using converted object for getToken()  | Full prevention guide "Root Cause 2"      | Pass actual CookieStore object |
| Throwing error for missing token       | Full prevention guide "Test Suite 2"      | Return null gracefully         |

---

## Prevention Checklists

### Before Writing Code

```
☐ Do I need getBackendToken() or can useSession() work?
☐ Am I in an API route (route.ts) or Server Component?
☐ Will I need to test on both HTTP and HTTPS?
☐ Do I understand cookie name prefixing?
☐ Have I checked the copy-paste patterns?
```

### Before Code Review

```
☐ Did the author check for __Secure- variant?
☐ Does request parameter pass in API routes?
☐ Are null tokens handled gracefully?
☐ Is there a test plan for HTTPS?
☐ Any hardcoded cookie names?
```

### Before Staging Deployment

```
☐ All tests passing (unit, integration, E2E)?
☐ Cookie name lookup handles both HTTPS and HTTP?
☐ Any "No session cookie found" in staging logs?
☐ Can I manually login and access protected routes?
☐ Do cookies show __Secure- prefix in DevTools?
```

### Before Production Deployment

```
☐ Staging tests all passed?
☐ Verified __Secure- cookie on HTTPS?
☐ API routes successfully retrieve tokens?
☐ Protected pages load without 401 errors?
☐ Team notified of token lookup changes?
```

---

## Prevention Principles (Remember These!)

### Principle 1: Protocol Matters

```
HTTP  → Cookie without __Secure- prefix
HTTPS → Cookie WITH __Secure- prefix

This is security-by-design, not a bug.
Always test both.
```

### Principle 2: Order First

```
Check HTTPS variant FIRST (most common after deployment).
Fall back to HTTP variant SECOND.
Check legacy variants THIRD.

Order: __Secure-authjs → authjs → __Secure-next-auth → next-auth
```

### Principle 3: Real Over Mock

```
API routes: Use real Request object (parameter provided)
Server Components: Use real CookieStore from next/headers

Mock objects fail silently. Real objects work reliably.
```

### Principle 4: Null Is Normal

```
Missing token = user not authenticated (normal)
Missing token ≠ error (don't throw)

Return null gracefully.
Let caller decide what to do.
```

### Principle 5: Test Both Worlds

```
HTTP tests: Verify unprefixed cookie works
HTTPS tests: Verify prefixed cookie works

Local dev works ≠ production works
Test production environment explicitly.
```

---

## Files Changed by This Prevention

The bug fix requires changes to:

| File                       | Change                                                | Impact                                   |
| :------------------------- | :---------------------------------------------------- | :--------------------------------------- |
| `apps/web/src/lib/auth.ts` | Add `__Secure-` variant to cookie name list           | Fixes token lookup on HTTPS              |
| `apps/web/src/lib/auth.ts` | Fix request object construction for Server Components | Fixes Server Component token retrieval   |
| All API routes             | Ensure request parameter is passed                    | Ensures real Request object is available |
| Test files                 | Add HTTPS test cases                                  | Prevents regression                      |

---

## How to Apply This Across Your Codebase

### Step 1: Fix Core getBackendToken() (5 min)

Edit `apps/web/src/lib/auth.ts`:

- Add `__Secure-authjs.session-token` first
- Fix Server Component request object construction
- Verify error handling

Reference: Full prevention guide "Step 1" and "Step 3"

### Step 2: Review All API Routes (15 min)

Search for all API routes using `getBackendToken()`:

```bash
grep -r "getBackendToken" apps/web/src/app/api/ --include="*.ts"
```

For each route:

- Verify `request` parameter is passed
- Add null check before using token
- Test the route on HTTPS

Reference: Code review checklist "API Routes Pass Actual Request Parameter"

### Step 3: Add Tests (30 min)

Add tests from the test strategy:

- Unit tests for cookie name variants
- Integration tests for HTTP
- E2E tests for both HTTP and HTTPS

Reference: Testing strategy "Unit Tests" and "E2E Tests"

### Step 4: Deploy to Staging (variable)

Follow staging tests:

- Verify `__Secure-` prefix in DevTools
- Test all protected API routes
- Monitor logs for token errors

Reference: Testing strategy "Staging Tests (HTTPS)"

### Step 5: Document (5 min)

Update your team:

- Link to this index in Slack
- Mention the one-liner reminder: "\_\_Secure- prefix on HTTPS"
- Reference code review checklist in PR template

---

## Related Documentation

- **MAIS Authentication Architecture**: `/CLAUDE.md` (MAIS-specific patterns)
- **NextAuth.js v5 Official Docs**: https://authjs.dev/
- **MDN Set-Cookie Header**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie
- **RFC 6265 (Cookies)**: https://tools.ietf.org/html/rfc6265

---

## Glossary

| Term                    | Definition                                                                          | Example                                            |
| :---------------------- | :---------------------------------------------------------------------------------- | :------------------------------------------------- |
| **\_\_Secure- prefix**  | Cookie name prefix that indicates Secure flag. Browsers add automatically.          | `__Secure-authjs.session-token`                    |
| **Secure flag**         | Cookie attribute that restricts transmission to HTTPS only.                         | `Secure; HttpOnly; SameSite=Lax`                   |
| **Session cookie**      | HTTP-only cookie containing encrypted JWT for NextAuth sessions                     | `authjs.session-token`                             |
| **Backend token**       | JWT extracted from session cookie, used for API calls. Not exposed to client.       | Stored in `MAISJWT.backendToken`                   |
| **Mock request object** | Manually constructed object that looks like Request but lacks proper cookie parsing | Used when actual Request unavailable               |
| **Real Request object** | Actual NextRequest from API route handler with built-in cookie parsing              | From `export async function GET(request: Request)` |

---

## Support & Questions

### "Where do I find...?"

| Question          | Answer                                                   |
| :---------------- | :------------------------------------------------------- |
| The quick fix     | `NEXTAUTH-V5-QUICK-REFERENCE.md`                         |
| Code patterns     | `NEXTAUTH-V5-QUICK-REFERENCE.md` → "Copy-Paste Patterns" |
| Review guidance   | `NEXTAUTH-V5-CODE-REVIEW-CHECKLIST.md`                   |
| Test examples     | `NEXTAUTH-V5-TESTING-STRATEGY.md`                        |
| Full explanation  | `nextauth-v5-getbackendtoken-cookie-prefix.md`           |
| Decision tree     | `NEXTAUTH-V5-QUICK-REFERENCE.md` → "Decision Tree"       |
| Common mistakes   | `NEXTAUTH-V5-QUICK-REFERENCE.md` → "Common Mistakes"     |
| Testing checklist | `NEXTAUTH-V5-TESTING-STRATEGY.md` → "Manual Testing"     |

### "How long will this take?"

| Task                      |  Time   | Documents             |
| :------------------------ | :-----: | :-------------------- |
| Understanding the problem |  5 min  | Quick reference       |
| Implementing the fix      | 30 min  | Full prevention guide |
| Code review               | 10 min  | Code review checklist |
| Testing                   | 45 min  | Testing strategy      |
| Total                     | ~90 min | All documents         |

---

## Success Criteria

You've successfully applied this prevention strategy when:

```
☐ All getBackendToken() calls check __Secure- variant first
☐ All API routes pass request parameter
☐ All null tokens are handled with if (!token) check
☐ Tests include both HTTP and HTTPS
☐ Staging tests pass on HTTPS with __Secure- cookies
☐ No "No session cookie found" errors in production logs
☐ Protected routes work on production (https://)
☐ Users can login and access authenticated features
☐ Team aware of cookie prefixing behavior
```

---

**Document Created**: 2025-12-31
**Purpose**: Prevention strategy index for NextAuth v5 production failures
**Severity**: CRITICAL
**Audience**: MAIS development team, code reviewers, QA
**Maintenance**: Update when NextAuth v5 changes cookie behavior or new edge cases discovered
