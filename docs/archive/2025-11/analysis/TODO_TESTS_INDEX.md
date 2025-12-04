# Todo Tests Documentation Index

## Overview

This directory contains comprehensive documentation for the **12 todo tests** in the MAIS codebase, all focused on Stripe webhook integration testing.

**Location:** `/Users/mikeyoung/CODING/MAIS/server/test/http/webhooks.http.spec.ts`

**Status:** 0/12 tests implemented (all marked as `.todo()`)

---

## Documentation Files

### 1. **TODO_TESTS_CATALOG.md** (18 KB)

**Purpose:** Comprehensive technical reference  
**Contains:**

- Complete inventory of all 12 tests with line numbers
- Detailed test descriptions and expected behaviors
- Implementation hints with code references
- Complexity assessment and dependencies
- Related test patterns
- Integration with source code

**Use this when:** You need detailed implementation guidance for a specific test

**Key Sections:**

- Category 1-5: Complete test breakdown with line-by-line hints
- Implementation Priority & Complexity chart
- Test File Structure overview
- Key Dependencies & Helpers
- Related Source Code References

---

### 2. **QUICK_REFERENCE_TODOS.md** (4.7 KB)

**Purpose:** Quick lookup and implementation checklist  
**Contains:**

- Summary table of all 12 tests
- Implementation roadmap (Phase 1-3)
- Common test patterns with code examples
- Test data templates
- Coverage goals

**Use this when:** You're ready to start implementing and need quick patterns

**Key Sections:**

- All tests at a glance table
- 3-phase implementation roadmap
- Common test patterns (4 standard patterns)
- Valid/invalid payload templates
- Coverage targets

---

### 3. **TODO_TESTS_SUMMARY.txt** (This file)

**Purpose:** High-level overview and project context  
**Contains:**

- Category breakdown of all 12 tests
- Complexity classification
- Recommended implementation order
- Key implementation requirements
- Source code references
- Next steps and estimated impact

**Use this when:** You're onboarding or need a high-level overview

**Key Sections:**

- Tests by category
- Complexity breakdown
- Recommended implementation order
- Critical helper function details
- Estimated project impact

---

## Quick Navigation

### By Test Number

- **Test 1** (Line 36-44): Missing signature header → See CATALOG, Line "#### 1."
- **Test 2** (Line 46-55): Invalid signature → See CATALOG, Line "#### 2."
- **Test 3** (Line 57-72): Valid signature → See CATALOG, Line "#### 3."
- **Test 4** (Line 76-100): Duplicate returns 200 → See CATALOG, Line "#### 4."
- **Test 5** (Line 102-129): Duplicate not processed → See CATALOG, Line "#### 5."
- **Test 6** (Line 133-141): Invalid JSON → See CATALOG, Line "#### 6."
- **Test 7** (Line 143-156): Missing fields → See CATALOG, Line "#### 7."
- **Test 8** (Line 158-178): Server errors → See CATALOG, Line "#### 8."
- **Test 9** (Line 182-216): Checkout completion → See CATALOG, Line "#### 9."
- **Test 10** (Line 218-234): Unsupported types → See CATALOG, Line "#### 10."
- **Test 11** (Line 238-260): Record events → See CATALOG, Line "#### 11."
- **Test 12** (Line 262-290): Mark failed → See CATALOG, Line "#### 12."

### By Category

- **Signature Verification (3 tests)** → Tests 1-3
  - See QUICK_REFERENCE: "Signature Verification"
  - See CATALOG: "Category 1"
- **Idempotency (2 tests)** → Tests 4-5
  - See QUICK_REFERENCE: "Idempotency"
  - See CATALOG: "Category 2"
- **Error Handling (3 tests)** → Tests 6-8
  - See QUICK_REFERENCE: "Error Handling"
  - See CATALOG: "Category 3"
- **Event Processing (2 tests)** → Tests 9-10
  - See QUICK_REFERENCE: "Event Processing"
  - See CATALOG: "Category 4"
- **Webhook Recording (2 tests)** → Tests 11-12
  - See QUICK_REFERENCE: "Webhook Recording"
  - See CATALOG: "Category 5"

### By Complexity

- **Simple (2 tests)**: Tests 1, 6
  - Quick wins, minimal dependencies
  - Start with these
- **Medium (6 tests)**: Tests 2, 3, 4, 5, 7, 10
  - Core functionality
  - Need helper function and basic DB setup
- **Complex (4 tests)**: Tests 8, 9, 11, 12
  - Advanced scenarios, full integration
  - Requires comprehensive test infrastructure

### By Implementation Phase

- **Phase 1** (Quick Wins, 2-3 hours): Tests 1, 6, 2
- **Phase 2** (Core, 4-5 hours): Tests 3, 4, 5, 7, 10
- **Phase 3** (Advanced, 5-6 hours): Tests 11, 8, 9, 12

---

## Getting Started

### For Quick Overview

1. Start with **TODO_TESTS_SUMMARY.txt**
2. Review "Tests by Category" section
3. Check "Recommended Implementation Order"

### For Implementation

1. Read **QUICK_REFERENCE_TODOS.md**
2. Review "Implementation Roadmap" (Phase 1-3)
3. Start with Phase 1 tests (highest priority)

### For Detailed Guidance

1. Find your test in **TODO_TESTS_CATALOG.md**
2. Read the full test description
3. Follow "Implementation Hints" section
4. Reference "Key Code" pointers to source files

---

## Test Statistics

| Metric                        | Value                   |
| ----------------------------- | ----------------------- |
| Total Tests                   | 12                      |
| Current Pass Rate             | 0/12 (0%)               |
| Simple Tests                  | 2                       |
| Medium Tests                  | 6                       |
| Complex Tests                 | 4                       |
| Estimated Implementation Time | 11-14 hours             |
| Expected Coverage Increase    | 60% → 75%               |
| Test Framework                | Vitest + supertest      |
| Feature Area                  | Stripe webhook handling |

---

## Key Implementation Requirements

### Critical Helper Function (Line 298-308)

```typescript
function generateTestSignature(payload: string): string {
  // TODO: Implement HMAC-SHA256 signature generation
  // Required for all signature verification tests
  // Format: t={timestamp},v1={signature}
  return 'test_signature_placeholder'; // Currently returns placeholder
}
```

### Required Environment Variables

- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
- `DATABASE_URL` - Test database connection
- `DATABASE_URL_TEST` - Optional separate test database

### Test Infrastructure Needed

- Express app with raw body parsing middleware
- Prisma database connection
- Test tenant with API keys
- beforeEach/afterEach hooks for cleanup

---

## Source Code References

**Webhook Implementation:**

- Handler: `/Users/mikeyoung/CODING/MAIS/server/src/routes/webhooks.routes.ts` (274 lines)
- Repository: `/Users/mikeyoung/CODING/MAIS/server/src/adapters/prisma/webhook.repository.ts` (202 lines)
- Error Classes: `WebhookValidationError`, `WebhookProcessingError`
- Zod Schemas: `StripeSessionSchema`, `MetadataSchema`

**Key Methods:**

- `WebhooksController.handleStripeWebhook()` - Main handler (lines 113-273)
- `PrismaWebhookRepository.isDuplicate()` - Idempotency check (lines 36-68)
- `PrismaWebhookRepository.recordWebhook()` - Event recording (lines 92-129)
- `PrismaWebhookRepository.markProcessed()` - Success tracking (lines 147-162)
- `PrismaWebhookRepository.markFailed()` - Error tracking (lines 185-201)

---

## Common Issues & Solutions

### Issue: Signature verification fails

**Solution:** Implement `generateTestSignature()` helper function

- Import crypto module
- Use HMAC-SHA256 with STRIPE_WEBHOOK_SECRET
- Format: `t={timestamp},v1={signature}`

### Issue: Webhook not found in database

**Solution:** Ensure `recordWebhook()` is called before checking status

- Webhook is recorded with PENDING status
- Later marked as PROCESSED or FAILED
- Use composite key query: `tenantId_eventId`

### Issue: Duplicate detection not working

**Solution:** Verify idempotency check happens early

- Happens BEFORE event recording
- Idempotency uses composite key (tenantId, eventId)
- Returns early if duplicate found (line 142)

### Issue: Booking not created from webhook

**Solution:** Check metadata validation

- All required metadata fields must be present
- Use Zod schemas for validation
- Check `PackageNotFound` error handling

---

## Next Actions

### Immediate (Today)

1. Read TODO_TESTS_SUMMARY.txt (this file)
2. Review webhook implementation source code
3. Understand test infrastructure setup

### Short Term (Next 1-2 days)

1. Implement `generateTestSignature()` helper
2. Set up test infrastructure (app, Prisma, tenant)
3. Implement Phase 1 tests (simple tests first)

### Medium Term (Next 1 week)

1. Complete Phase 2 tests (core functionality)
2. Run full test suite regularly
3. Fix failing tests as they emerge

### Long Term (This sprint)

1. Complete Phase 3 tests (advanced features)
2. Achieve 100% pass rate (12/12)
3. Verify coverage increase to 75%+
4. Commit to main branch

---

## Contact & Questions

For implementation guidance:

1. Check CATALOG.md for specific test details
2. Review QUICK_REFERENCE_TODOS.md for common patterns
3. Reference source code with line numbers provided
4. Check webhook implementation for latest changes

---

## Version History

- **v1.0** (2025-11-23): Initial catalog creation
  - All 12 tests identified and documented
  - 3 comprehensive documentation files created
  - Implementation roadmap established
  - Estimated at 11-14 hours of work

---

**Last Updated:** 2025-11-23  
**Documentation Status:** Complete  
**Test Implementation Status:** 0% (Ready to begin)
