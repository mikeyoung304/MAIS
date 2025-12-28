# UNFINISHED_REGISTER.md

**Generated:** 2025-12-26
**Agent:** B2 - Unfinished Work / TODO Archaeology
**Codebase:** MAIS (Macon AI Solutions)

This document catalogs all incomplete work, TODO items, stub implementations, half-integrations, and technical debt discovered in the MAIS codebase.

---

## Table of Contents

1. [Priority Summary](#priority-summary)
2. [P0 - Blocking Issues / Security Concerns](#p0---blocking-issues--security-concerns)
3. [P1 - Should Fix Before Next Release](#p1---should-fix-before-next-release)
4. [P2 - Technical Debt to Address](#p2---technical-debt-to-address)
5. [P3 - Nice to Have Cleanup](#p3---nice-to-have-cleanup)
6. [Backup Files to Clean Up](#backup-files-to-clean-up)
7. [Deprecated Code Requiring Migration](#deprecated-code-requiring-migration)
8. [Legacy System Migrations](#legacy-system-migrations)

---

## Priority Summary

| Priority | Count | Description                                   |
| -------- | ----- | --------------------------------------------- |
| P0       | 0     | No blocking issues or security concerns found |
| P1       | 8     | Should fix before next release                |
| P2       | 35+   | Technical debt to address                     |
| P3       | 15+   | Nice to have cleanup                          |

---

## P0 - Blocking Issues / Security Concerns

**No P0 issues found.** The codebase appears to have addressed critical security and blocking concerns.

---

## P1 - Should Fix Before Next Release

### 1. Missing Domain Lookup Endpoint (TODO in tenant.ts)

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/tenant.ts:285`
**Comment:** `// TODO: Implement domain lookup endpoint in Express API`
**Context:** Custom domain resolution for tenant storefronts
**Age:** December 25, 2025 (recent)
**Impact:** Custom domain feature incomplete - tenants cannot use their own domains
**Recommended Action:** FINISH - Implement `GET /v1/public/tenants/by-domain/:domain` endpoint

### 2. Lead Magnet Email Integration Stub

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/pages/Home/LeadMagnetSection.tsx:19`
**Comment:** `// TODO: Integrate with email service (Postmark, ConvertKit, etc.)`
**Context:** Newsletter signup has fake delay instead of actual email service
**Age:** November 24, 2025 (over 1 month old)
**Impact:** Lead capture form is non-functional - lost leads
**Recommended Action:** FINISH - Integrate with Postmark (already used in codebase)

### 3. Tenant Admin Navigation Routes Commented Out

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/components/navigation/RoleBasedNav.tsx:49`
**Comment:** `// TODO: Uncomment routes as they are implemented`
**Context:** 5 navigation routes commented out (Packages, Bookings, Blackouts, Branding, Settings)
**Age:** November 28, 2025
**Impact:** Tenant admin dashboard has limited functionality
**Recommended Action:** FINISH - These features may already be implemented elsewhere

### 4. UploadService Singleton Breaking DI Pattern

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/upload.service.ts:4`
**Comment:** `TODO 065: This singleton pattern breaks the DI pattern.`
**Context:** Legacy singleton wrapper maintained for backward compatibility
**Age:** December 6, 2025
**Impact:** Architecture inconsistency, harder to test
**Recommended Action:** FINISH - Migrate all consumers to DI container, then REMOVE

### 5. Payment Failed Webhook Handler Tests

**File:** `/Users/mikeyoung/CODING/MAIS/server/test/services/booking-payment-failed.spec.ts:3`
**File:** `/Users/mikeyoung/CODING/MAIS/server/test/controllers/payment-failed-webhook.spec.ts:3`
**Comment:** `TODO-266: Missing webhook handler for payment_intent.failed`
**Context:** Tests exist but verify handler exists
**Age:** Unknown
**Impact:** Payment failure handling coverage
**Recommended Action:** DOCUMENT - Verify handler is properly tested

### 6. Catalog Service Auth Context

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/catalog.service.ts:32`
**Comment:** `TODO: Replace with proper auth context from middleware in Sprint 3`
**Context:** Authentication context handling
**Age:** Sprint 3 reference suggests this is outdated
**Impact:** Potential auth inconsistency
**Recommended Action:** FINISH - Implement proper auth context or DOCUMENT if resolved

### 7. Booking Service Input Type Rename

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/booking.service.ts:711`
**Comment:** `const packageSlug = input.packageId; // TODO: Rename in input type in future refactor`
**Context:** Misleading variable name - packageId actually contains slug
**Age:** Unknown
**Impact:** Code confusion, potential bugs
**Recommended Action:** FINISH - Rename in input type

### 8. Customer ID Generation Placeholder

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/booking.service.ts:968`
**Comment:** `customerId: \`customer\_${Date.now()}\`, // TODO: Integrate with Customer management`
**Context:** Using timestamp-based IDs instead of proper customer management
**Age:** Unknown
**Impact:** No customer deduplication, lost relationship data
**Recommended Action:** FINISH - Implement customer management

---

## P2 - Technical Debt to Address

### Rate Limiter TODOs (4 items)

| File                                   | Line | TODO ID  | Description                                  |
| -------------------------------------- | ---- | -------- | -------------------------------------------- |
| `server/src/middleware/rateLimiter.ts` | 201  | TODO-057 | Rate limiter for public scheduling endpoints |
| `server/src/middleware/rateLimiter.ts` | 225  | TODO-193 | Rate limiter for add-on read operations      |
| `server/src/middleware/rateLimiter.ts` | 245  | TODO-193 | Rate limiter for add-on write operations     |
| `server/src/middleware/rateLimiter.ts` | 265  | TODO-273 | Rate limiter for Stripe webhook endpoint     |

**Recommended Action:** FINISH - All rate limiters should be properly configured

### Idempotency Key Implementation (5 items)

| File                                              | Line | TODO ID  | Description                                     |
| ------------------------------------------------- | ---- | -------- | ----------------------------------------------- |
| `server/src/routes/public-date-booking.routes.ts` | 12   | TODO-329 | Request-level idempotency via X-Idempotency-Key |
| `server/src/routes/public-date-booking.routes.ts` | 50   | TODO-329 | CacheService for idempotency handling           |
| `server/src/routes/public-date-booking.routes.ts` | 91   | TODO-329 | Check for idempotency key header                |
| `server/src/routes/public-date-booking.routes.ts` | 140  | TODO-329 | Cache result if idempotency key provided        |
| `server/src/routes/index.ts`                      | 614  | TODO-329 | Pass cacheAdapter for idempotency               |

**Recommended Action:** FINISH - Idempotency is critical for booking reliability

### Webhook Delivery Service (3 items)

| File                         | Line | TODO ID  | Description                          |
| ---------------------------- | ---- | -------- | ------------------------------------ |
| `server/src/di.ts`           | 94   | TODO-278 | Outbound webhook delivery            |
| `server/src/di.ts`           | 101  | TODO-278 | Webhook subscription management      |
| `server/src/routes/index.ts` | 633  | TODO-278 | Register tenant admin webhook routes |

**Recommended Action:** FINISH - Customer webhook notifications

### Landing Page System TODOs (6 items)

| File                                                           | Line | TODO ID  | Description                    |
| -------------------------------------------------------------- | ---- | -------- | ------------------------------ |
| `server/src/services/landing-page.service.ts`                  | 12   | TODO-241 | Architecture note              |
| `server/src/services/landing-page.service.ts`                  | 33   | TODO-244 | API response design            |
| `server/src/routes/tenant-admin-landing-page.routes.ts`        | 232  | TODO-249 | Rate limiting for saves        |
| `server/src/routes/tenant-admin-landing-page.routes.ts`        | 284  | TODO-249 | Rate limiting for requests     |
| `server/src/routes/tenant-admin-landing-page.routes.ts`        | 359  | TODO-235 | Image upload endpoint          |
| `packages/contracts/src/tenant-admin/landing-page.contract.ts` | 230  | TODO-235 | Image upload endpoint contract |

**Recommended Action:** DOCUMENT or FINISH - Review if these are notes vs action items

### Reminder System TODOs (3 items)

| File                                               | Line    | TODO ID  | Description                          |
| -------------------------------------------------- | ------- | -------- | ------------------------------------ |
| `server/src/adapters/mock/index.ts`                | 623     | TODO-154 | Calculate new reminder due date      |
| `server/src/adapters/mock/index.ts`                | 635     | TODO-154 | Reset reminderSentAt                 |
| `server/src/adapters/prisma/booking.repository.ts` | 868-928 | TODO-154 | Reminder recalculation on reschedule |

**Recommended Action:** FINISH - Reminder dates should update on booking reschedule

### Tenant Admin Routes Helper Functions (3 items)

| File                                       | Line      | TODO ID  | Description                                  |
| ------------------------------------------ | --------- | -------- | -------------------------------------------- |
| `server/src/routes/tenant-admin.routes.ts` | 1060      | TODO-195 | DTO mapper function for code deduplication   |
| `server/src/routes/tenant-admin.routes.ts` | 1073      | TODO-194 | Helper to extract tenantId from auth request |
| `server/src/routes/tenant-admin.routes.ts` | 1206,1234 | TODO-196 | Explicit NotFoundError handling              |

**Recommended Action:** FINISH - Code quality improvements

### Landing Page Editor Hooks TODOs (10+ items)

| File                                     | Line    | TODO ID  | Description                 |
| ---------------------------------------- | ------- | -------- | --------------------------- |
| `client/src/.../useLandingPageEditor.ts` | 63-483  | TODO-253 | localStorage draft recovery |
| `client/src/.../useLandingPageEditor.ts` | 228-280 | TODO-250 | Performance monitoring      |
| `client/src/.../useLandingPageEditor.ts` | 516     | TODO-254 | Flush on tab blur/close     |

**Recommended Action:** DOCUMENT - These appear to be well-implemented features

### OG Image for Tenant Pages

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/app/t/[slug]/(site)/page.tsx:44`
**Comment:** `// TODO: Add og:image from tenant branding when available`
**Recommended Action:** FINISH - Social sharing preview images

### TenantLandingPage Refactor

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/TenantLandingPage.tsx:4-6`
**Comment:** `TODO: Refactor to use SectionRenderer for section display. See TODO #410`
**Recommended Action:** FINISH - Consolidate rendering logic

### Honeypot Bot Protection

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/routes/public-date-booking.routes.ts:112`
**Comment:** `// TODO-330: Honeypot bot protection`
**Recommended Action:** FINISH - Add spam protection

---

## P3 - Nice to Have Cleanup

### Test Template TODOs (20+ items)

Files in `/Users/mikeyoung/CODING/MAIS/server/test/templates/`:

- `service.test.template.ts` - 20+ TODO comments
- `controller.test.template.ts` - 15+ TODO comments
- `repository.test.template.ts` - 10+ TODO comments
- `webhook.test.template.ts` - 5+ TODO comments

**Recommended Action:** DOCUMENT - These are intentional placeholders in template files

### Section Component Layout Shift Prevention

| File                                       | TODO ID      | Description                  |
| ------------------------------------------ | ------------ | ---------------------------- |
| `client/src/.../EditableHeroSection.tsx:9` | TODO-255     | Layout shift prevention      |
| `client/src/.../HeroSection.tsx:31-34`     | TODO-255,256 | Layout shift & editable mode |

**Recommended Action:** DOCUMENT - Appears to be design decisions, not action items

### Accessibility Comments

| File                                     | Line   | TODO ID  | Description                    |
| ---------------------------------------- | ------ | -------- | ------------------------------ |
| `client/src/.../HeroSection.tsx`         | 69,109 | TODO-212 | Background image accessibility |
| `client/src/.../TestimonialsSection.tsx` | 128    | TODO-218 | Cite element accessibility     |

**Recommended Action:** DOCUMENT - Accessibility implementation notes

### BrandingForm Refactor Note

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/features/tenant-admin/branding/components/BrandingForm/index.tsx:7`
**Comment:** `Refactored to accept form object instead of 11 individual props (TODO 106)`
**Recommended Action:** REMOVE - This is completed work, remove TODO reference

---

## Backup Files to Clean Up

The following backup files should be reviewed and removed if no longer needed:

| File                                                                                                 | Type               |
| ---------------------------------------------------------------------------------------------------- | ------------------ |
| `/Users/mikeyoung/CODING/MAIS/server/.env.backup`                                                    | Environment backup |
| `/Users/mikeyoung/CODING/MAIS/client/src/pages/Home.tsx.backup`                                      | Component backup   |
| `/Users/mikeyoung/CODING/MAIS/client/src/pages/Home.tsx.bak`                                         | Component backup   |
| `/Users/mikeyoung/CODING/MAIS/client/src/pages/Success.tsx.old`                                      | Component backup   |
| `/Users/mikeyoung/CODING/MAIS/client/src/features/admin/tenants/TenantForm.tsx.backup`               | Component backup   |
| `/Users/mikeyoung/CODING/MAIS/server/test/integration/catalog.repository.integration.spec.ts.backup` | Test backup        |
| `/Users/mikeyoung/CODING/MAIS/server/scripts/test-api.sh.bak`                                        | Script backup      |
| `/Users/mikeyoung/CODING/MAIS/server/src/adapters/mock/index.ts.bak`                                 | Adapter backup     |

**Recommended Action:** REMOVE - Clean up backup files after verifying current versions work

---

## Deprecated Code Requiring Migration

### UploadService (Multiple Deprecations)

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/upload.service.ts`

| Line | Deprecated Item                             | Migration Target            |
| ---- | ------------------------------------------- | --------------------------- |
| 17   | `@deprecated Use container.storageProvider` | DI container                |
| 33   | `createUploadConfig()`                      | di.ts configuration         |
| 73   | `UploadService class`                       | `container.storageProvider` |
| 139  | `uploadService singleton`                   | DI import                   |

**Migration Status:** Partially complete - backward compatibility wrapper remains

### RateLimiter Deprecation

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/middleware/rateLimiter.ts:124`
**Deprecated:** Old upload limiter
**Migration:** Use `uploadLimiterIP` and `uploadLimiterTenant` instead

### Navigation Deprecation

**File:** `/Users/mikeyoung/CODING/MAIS/apps/web/src/components/tenant/navigation.ts:99`
**Deprecated:** Static navigation items
**Migration:** Use `getNavigationItems(config)` for dynamic navigation

### Landing Page Config Deprecation

**File:** `/Users/mikeyoung/CODING/MAIS/packages/contracts/src/landing-page.ts:465`
**Deprecated:** `DEFAULT_SECTION_VISIBILITY`
**Migration:** Use `DEFAULT_LANDING_PAGE_CONFIG.pages` instead

### Database Config Deprecation

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/config/database.ts:81`
**Deprecated:** Manual database verification
**Migration:** Use Prisma for database verification

### Base Error Deprecation

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/lib/errors/base.ts:41`
**Deprecated:** Old error class
**Migration:** Use `AppError` instead

---

## Legacy System Migrations

### Landing Page Configuration Migration

The codebase maintains backward compatibility between legacy section-based configuration and new page-based configuration.

**Files involved:**

- `/Users/mikeyoung/CODING/MAIS/packages/contracts/src/landing-page.ts`
- `/Users/mikeyoung/CODING/MAIS/apps/web/src/lib/tenant.ts`
- `/Users/mikeyoung/CODING/MAIS/server/scripts/migrate-to-page-config.ts`

**Status:** Migration script exists but legacy format still supported

**Recommended Action:**

1. Run migration script for existing tenants
2. Remove legacy support after migration verified
3. Clean up `normalizeToPages()` function

### Tier Aliases (Legacy URL Support)

**File:** `/Users/mikeyoung/CODING/MAIS/client/src/pages/TierDetailPage.tsx:20,41-44,98-101`

Legacy tier URLs (`budget`, `middle`, `luxury`) redirect to new format (`tier_1`, `tier_2`, `tier_3`).

**Recommended Action:** DOCUMENT - Keep for SEO/bookmark compatibility

### Audit Service Legacy Tracking

**File:** `/Users/mikeyoung/CODING/MAIS/server/src/services/audit.service.ts:9,44,154-186`

`trackLegacyChange()` method exists for CRUD operations during migration.

**Recommended Action:** DOCUMENT - Keep until migration complete, then evaluate removal

---

## Summary

The MAIS codebase has **0 P0 issues** and is in good health overall. The main areas requiring attention are:

1. **P1 Priority (8 items):** Focus on completing domain lookup, email integration, and navigation routes
2. **Rate Limiting & Idempotency:** Multiple TODOs suggest these need thorough review
3. **Deprecated Code:** Several modules have deprecated patterns that should be migrated to DI
4. **Backup Files:** 8 backup files should be cleaned up
5. **Legacy Migration:** Landing page config migration should be completed

Most TODOs are well-documented with TODO IDs (e.g., TODO-253, TODO-329) suggesting an organized approach to tracking technical debt.
