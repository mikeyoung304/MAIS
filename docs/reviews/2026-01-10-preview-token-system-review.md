# Code Review: Preview Token System & DRY Segment Utilities

**Date:** 2026-01-10
**Commits Reviewed:** 75a91c26, 8b044392
**Reviewer:** Multi-agent parallel review (6 specialized agents)
**Status:** Complete - 9 findings documented

---

## Executive Summary

Reviewed the preview token system and DRY segment utilities extraction across 30 files (+2184/-222 lines). **No critical (P1) issues found.** The implementation demonstrates excellent security practices for JWT handling and tenant isolation. Six important (P2) improvements identified, primarily around code duplication and minor security hardening.

### Key Metrics

| Category        | Result       |
| --------------- | ------------ |
| P1 Critical     | 0            |
| P2 Important    | 6            |
| P3 Nice-to-have | 3            |
| Tests Passing   | 2405/2405 ✅ |

---

## Files Reviewed

### Core Preview Token System

- `server/src/lib/preview-tokens.ts` - JWT generation/validation (193 lines)
- `server/src/routes/public-tenant.routes.ts` - GET `/:slug/preview` endpoint
- `server/src/routes/tenant-admin.routes.ts` - POST `/preview-token` endpoint
- `apps/web/src/hooks/usePreviewToken.ts` - React Query hook (146 lines)

### DRY Segment Utilities

- `server/src/lib/segment-utils.ts` - Extracted utilities (139 lines)
- `server/src/services/catalog.service.ts` - Uses segment-utils
- `server/src/agent/executors/index.ts` - Uses segment-utils

### Landing Page Service

- `server/src/services/landing-page.service.ts` - Expanded (+414 lines)

---

## Findings

### P2 - Important (Should Fix)

#### #721: Missing Rate Limiting on Preview Token Endpoint

**File:** `server/src/routes/tenant-admin.routes.ts`
**Risk:** CPU exhaustion via repeated JWT signing
**Fix:** Add `draftAutosaveLimiter` or dedicated limiter (~15 min)

```typescript
// Current (no limiter)
router.post('/preview-token', async (_req, res, next) => {

// Fix
router.post('/preview-token', draftAutosaveLimiter, async (_req, res, next) => {
```

---

#### #722: Information Disclosure in Token Error Messages

**File:** `server/src/routes/public-tenant.routes.ts:160-166`
**Risk:** Attackers can distinguish failure modes (expired vs invalid vs tenant mismatch)
**Fix:** Return generic error message (~10 min)

```typescript
// Current (reveals failure reason)
return res.status(401).json({
  error: tokenResult.message,
  code: tokenResult.error, // 'expired', 'invalid', 'tenant_mismatch'
});

// Fix (generic message)
return res.status(401).json({
  error: 'Invalid or expired preview token',
});
```

---

#### #723: Preview Endpoint Makes 2 DB Queries

**File:** `server/src/routes/public-tenant.routes.ts:168-179`
**Impact:** ~15-30ms extra latency per request
**Fix:** Create `findBySlugForPreview()` repository method (~30 min)

```typescript
// Current (2 queries)
const tenant = await tenantRepository.findBySlugPublic(slug);
const draftWrapper = await tenantRepository.getLandingPageDraft(tenantId);

// Fix (1 query)
const tenant = await tenantRepository.findBySlugForPreview(slug);
```

---

#### #724: Duplicate getBuildModeDraft Implementations

**Files:**

- `server/src/services/landing-page.service.ts:299-426`
- `server/src/agent/tools/utils.ts:152-328`

**Impact:** ~95% identical code, maintenance burden
**Fix:** Delete unused service methods OR have them delegate to utils (~20 min)

---

#### #725: Duplicate Publish/Discard Logic

**Files:**

- `server/src/services/landing-page.service.ts:466-560`
- `server/src/agent/executors/storefront-executors.ts:566-688`

**Impact:** Wrapper format `{ draft, published }` defined in two places
**Fix:** Executor should call service method (~45 min)

---

#### #726: Missing Shared Contract for Preview Token Response

**Files:**

- `apps/web/src/hooks/usePreviewToken.ts:28-31` (frontend type)
- `server/src/routes/tenant-admin.routes.ts:1949-1952` (backend response)

**Impact:** No compile-time validation of API contract
**Fix:** Add `PreviewTokenResponseSchema` to `@macon/contracts` (~20 min)

---

### P3 - Nice-to-Have

#### #727: JWT Type Assertion Before Validation

Use Zod schema instead of `as PreviewTokenPayload` assertion.

#### #728: Repeated Validation/Fallback Pattern

Same Zod validation + fallback pattern repeated 6+ times. Extract helper.

#### #729: Dual Draft System Complexity

Documented tech debt - two draft systems (Build Mode vs Visual Editor). Acknowledged, no action needed now.

---

## Positive Findings (Commendations)

### Security Excellence ✅

- JWT algorithm pinning (`HS256` only) - prevents algorithm confusion attacks
- Token type validation (`type: 'preview'`) - prevents token confusion
- Cache-Control headers - prevents ISR cache poisoning
- Short 10-minute expiry - limits attack window
- Tenant slug validation in token - prevents cross-tenant preview

### Tenant Isolation Excellence ✅

- All queries include `tenantId` in WHERE clause
- `validateSegmentOwnership()` properly enforced
- Transactions used for read-modify-write patterns
- Error messages don't leak tenant information
- No TOCTOU vulnerabilities found

### DRY Extraction Done Correctly ✅

- `resolveOrCreateGeneralSegment()` used in both CatalogService and executors
- `validateSegmentOwnership()` used consistently
- No remaining inline segment resolution logic
- Route ordering correct (`/:slug/preview` before `/:slug`)

---

## Next Steps

### Quick Wins (Recommended First)

| Todo                 | Effort | Impact             |
| -------------------- | ------ | ------------------ |
| #721 Rate limiting   | 15 min | Security hardening |
| #722 Generic errors  | 10 min | Security hardening |
| #726 Shared contract | 20 min | Type safety        |

### Medium Effort

| Todo                       | Effort | Impact          |
| -------------------------- | ------ | --------------- |
| #723 Query optimization    | 30 min | Performance     |
| #724 DRY getBuildModeDraft | 20 min | Maintainability |
| #725 DRY publish/discard   | 45 min | Maintainability |

### Deferred

| Todo                   | Reason                                 |
| ---------------------- | -------------------------------------- |
| #727 JWT assertion     | Low risk, mitigated by runtime checks  |
| #728 Validation helper | Nice-to-have, not blocking             |
| #729 Dual draft system | Documented debt, needs design decision |

---

## Review Agents Used

| Agent                    | Focus Area        | Key Finding                      |
| ------------------------ | ----------------- | -------------------------------- |
| security-sentinel        | JWT, auth, tokens | Rate limiting + error disclosure |
| data-integrity-guardian  | Tenant isolation  | ✅ Excellent - no issues         |
| architecture-strategist  | DRY patterns      | ✅ Correct extraction            |
| typescript-reviewer      | API contracts     | Missing shared contract          |
| performance-oracle       | N+1, caching      | Extra DB query                   |
| code-simplicity-reviewer | DRY, complexity   | Duplicate implementations        |

---

## Commands Reference

```bash
# View all pending todos from this review
ls todos/72[1-9]-pending-*.md

# Triage findings
/triage

# Fix approved items
/resolve_todo_parallel

# Run tests after fixes
npm test
```

---

## Related Documentation

- Prevention strategies: `docs/solutions/patterns/DUAL_DRAFT_SYSTEM_PREVENTION_STRATEGIES.md`
- Preview token implementation: `server/src/lib/preview-tokens.ts`
- Segment utilities: `server/src/lib/segment-utils.ts`
