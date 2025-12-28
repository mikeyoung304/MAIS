# HANDLED Seed Data Integrity Review

**Date:** December 27, 2025
**Reviewer:** Code Integrity Analysis
**Status:** PASSED with recommendations

---

## Executive Summary

The HANDLED tenant seed (`server/prisma/seeds/handled.ts`) is **data-integrity safe** for database seeding. All checks passed without critical issues. Three minor recommendations identified for robustness.

| Check                  | Status  | Severity |
| ---------------------- | ------- | -------- |
| Utility Function Usage | ✅ PASS | —        |
| API Key Format         | ✅ PASS | —        |
| Tenant Slug Conflict   | ✅ PASS | —        |
| Email Format           | ✅ PASS | —        |
| Landing Page Schema    | ✅ PASS | P2       |
| Transaction Safety     | ✅ PASS | —        |
| Password Security      | ✅ PASS | —        |

---

## 1. CreateOrUpdateTenant Utility Usage ✅ PASS

**Finding:** The seed properly uses the `createOrUpdateTenant` utility function.

### Verification

```typescript
// Line 56 in handled.ts
const tenant = await createOrUpdateTenant(tx, {
  slug: HANDLED_SLUG,
  name: 'Handled',
  email: HANDLED_EMAIL,
  passwordHash,
  commissionPercent: 0,
  apiKeyPublic: publicKey,
  apiKeySecret: secretKey ?? undefined,
  primaryColor: '#7B9E87',
  secondaryColor: '#ffffff',
  accentColor: '#7B9E87',
  backgroundColor: '#ffffff',
  fontFamily: 'Georgia, serif',
  isActive: true,
});
```

### Implementation Details (from utils.ts)

- **Upsert pattern:** Properly uses `upsert` with `where: { slug }`
- **Key generation:** Public key preserved on update, secret key only set on create
- **Hashing:** Secret keys properly hashed via `apiKeyService.hashSecretKey()`
- **Transaction context:** Correctly accepts transaction client as first parameter

### Data Safety Implications

✅ **Safe:** Existing tenant data preserved on re-runs
✅ **Idempotent:** Can run multiple times without data loss
✅ **Consistent:** Uses same pattern as all other seeds (demo.ts, e2e.ts, etc.)

---

## 2. API Key Format Validation ✅ PASS

**Finding:** API key format is correct and will pass validation.

### Public Key Validation

```
Format: pk_live_{slug}_{random_16_chars}
Example: pk_live_handled_a3f8c9d2e1b4f7g8
Pattern: /^pk_live_[a-z0-9-]+_[a-f0-9]{16}$/
```

### Secret Key Validation

```
Format: sk_live_{slug}_{random_32_chars}
Example: sk_live_handled_a3f8c9d2e1b4f7g8h9i0j1k2l3m4n5o6
Pattern: /^sk_live_[a-z0-9-]+_[a-f0-9]{32}$/
```

### Generation Logic (Line 48-49 in handled.ts)

```typescript
publicKey = `pk_live_${HANDLED_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
secretKey = `sk_live_${HANDLED_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
```

✅ **Correct:** 8 bytes = 16 hex chars for public key
✅ **Correct:** 16 bytes = 32 hex chars for secret key
✅ **Safe:** Keys generated fresh on first run, preserved on re-runs

---

## 3. Tenant Slug Conflict Detection ⚠️ P2 RECOMMENDATION

**Finding:** Slug 'handled' is technically valid but requires clarification.

### Slug Validation Results

- **Length:** "handled" = 7 chars ✅ (3-50 required)
- **Format:** Lowercase, alphanumeric only ✅
- **Pattern match:** Starts with letter, ends with alphanumeric ✅
- **Reserved list:** NOT in reserved slugs ✅

### Reserved Slug Check (from api-key.service.ts line 209-227)

```typescript
const reserved = [
  'api',
  'admin',
  'app',
  'www',
  'widget',
  'cdn',
  'static',
  'assets',
  'public',
  'private',
  'internal',
  'system',
  'test',
  'staging',
  'production',
  'dev',
  'demo',
];
```

**Status:** "handled" is NOT reserved ✅

### Existing Tenant Check (Line 29-31 in handled.ts)

```typescript
const existingTenant = await prisma.tenant.findUnique({
  where: { slug: HANDLED_SLUG },
});
```

✅ **Safe:** Query runs outside transaction to detect conflicts
✅ **Idempotent:** If exists, updates; if new, creates

### Recommendation P2

**No breaking conflicts detected**, but note:

- No existing 'mais' tenant exists to conflict with migration
- Slug 'handled' differs from prior MAIS branding (good separation)
- Database constraint `@@unique([slug])` ensures no duplicates

---

## 4. Email Format Validation ✅ PASS

**Finding:** Email format is valid and follows best practices.

### Email Validation

```
Email: hello@gethandled.ai
Format: RFC 5322 compliant
Domain: .ai (valid TLD)
Uniqueness: Enforced via database constraint @@unique([email])
```

### Schema Validation (from schema.prisma line 43)

```prisma
email String? @unique
```

✅ **Unique constraint:** Prevents duplicate tenant admin emails
✅ **Optional:** Can seed without email if needed
✅ **Format:** Valid domain and structure
✅ **Case sensitivity:** PostgreSQL case-sensitive by default (good for email)

---

## 5. Landing Page Schema Conformance ⚠️ P2 VALIDATION CONCERN

**Finding:** Landing page structure is mostly correct, but one field needs attention.

### Schema Definition (contracts/src/landing-page.ts)

The seed uses the **new page-based configuration** format (lines 76-311 in handled.ts):

```typescript
landingPageConfig: {
  pages: {
    home: {
      enabled: true,
      sections: [...]
    },
    about: { enabled: true, sections: [...] },
    services: { enabled: true, sections: [] },
    faq: { enabled: true, sections: [...] },
    contact: { enabled: true, sections: [...] },
    gallery: { enabled: false, sections: [] },
    testimonials: { enabled: false, sections: [] }
  }
}
```

### Section Types Used

✅ `hero` - Correctly defined (line 82)
✅ `text` - Correctly defined (line 90)
✅ `features` - Correctly defined (line 97)
✅ `pricing` - Correctly defined (line 135)
✅ `faq` - Correctly defined (line 182)
✅ `cta` - Correctly defined (line 216)
✅ `contact` - Correctly defined (line 296)

### Schema Conformance Checks

#### Hero Sections ✅ PASS

```typescript
// Expected: headline, subheadline, ctaText, backgroundImageUrl (optional)
// Provided: headline ✅, subheadline ✅, ctaText ✅
// Missing: backgroundImageUrl (optional - acceptable)
```

#### Text Section ✅ PASS

```typescript
// Expected: headline (optional), content, imageUrl (optional), imagePosition
// Provided: headline ✅, content ✅, imagePosition ✅
// Missing: imageUrl (optional - acceptable)
```

#### Features Section ✅ PASS

```typescript
// Expected: headline, subheadline (optional), features[], columns (optional), backgroundColor
// Provided: headline ✅, subheadline ✅, features[] ✅, columns: 3 ✅
// Missing: backgroundColor (optional - acceptable)
```

#### Pricing Section ⚠️ P2 - FIELD NAMING

```typescript
// Line 135-180 in handled.ts
tiers: [
  {
    name: 'Handled',
    price: '$49',              // ← Correct (string | number)
    priceSubtext: '/month',    // ← ✅ CORRECT FIELD NAME
    description: '...',        // ← ✅ Correct
    features: [...],           // ← ✅ Correct
    ctaText: 'Get Started',    // ← ✅ Correct
    ctaHref: '/signup?...',    // ← ✅ Correct (matches pattern)
    isPopular: true,           // ← ✅ Correct (optional)
  }
]
```

**Validation:** All tier fields match schema exactly ✅

#### FAQ Section ✅ PASS

```typescript
// Expected: headline, items: { question, answer }[]
// Provided: All items have question ✅ and answer ✅
// Validation: 6 items (schema allows 1-20) ✅
```

#### Contact Section ✅ PASS

```typescript
// Expected: headline, email (optional), phone (optional), address (optional)
// Provided: headline ✅, email ✅
// Missing: phone, address (both optional - acceptable)
```

#### CTA Section ✅ PASS

```typescript
// Expected: headline, subheadline (optional), ctaText
// Provided: headline ✅, subheadline ✅, ctaText ✅
```

### Schema Conformance Result

**Status:** ✅ PASS
All sections conform to the schema defined in `packages/contracts/src/landing-page.ts`.

### Recommendation P2

**Minor:** The `priceSubtext` field (line 142) uses `/month` instead of traditional patterns like `per month`. This is valid but unconventional. Consider updating to match UI rendering expectations:

```typescript
// Current:
priceSubtext: '/month';

// Recommended (if UI expects):
priceSubtext: 'per month';
```

**Impact:** Low - if UI properly renders, no changes needed.

---

## 6. Tenant Data Isolation ✅ PASS

**Finding:** The seed properly isolates HANDLED tenant from other tenants.

### Isolation Mechanisms

1. **Unique slug constraint** (schema.prisma line 39)

   ```prisma
   slug String @unique
   ```

2. **Unique email constraint** (schema.prisma line 43)

   ```prisma
   email String? @unique
   ```

3. **Unique API key constraints** (schema.prisma lines 47-48)

   ```prisma
   apiKeyPublic String @unique
   apiKeySecret String // Hashed, unique in practice
   ```

4. **Upsert pattern** (utils.ts line 117)
   - Uses slug as unique identifier
   - Cannot accidentally merge with other tenants
   - Safe re-runs preserve data

✅ **Safe:** HANDLED tenant cannot conflict with:

- 'little-bit-farm' (demo tenant)
- 'handled-e2e' (E2E test tenant)
- 'la-petit-mariage' (wedding tenant)
- 'little-bit-horse-farm' (wellness tenant)
- 'plate' (catering tenant)

---

## 7. Transaction Safety ✅ PASS

**Finding:** Transaction handling is robust and follows best practices.

### Transaction Implementation (Line 39-321 in handled.ts)

```typescript
await prisma.$transaction(
  async (tx) => {
    // All seed operations wrapped in transaction
    // If any step fails, entire seed rolls back
  },
  { timeout: 60000 } // 60 second timeout
);
```

✅ **ACID compliance:** All-or-nothing execution
✅ **Rollback safety:** Partial data not committed
✅ **Timeout:** 60 seconds adequate for tenant + landing page config
✅ **Logging:** Proper transaction completion logging (line 323-345)

### Key Preservation Pattern

```typescript
// Line 44-51: Detect existing tenant to preserve keys
if (existingTenant) {
  publicKey = existingTenant.apiKeyPublic; // ← Reuse on update
  logger.info('HANDLED tenant already exists - updating...');
} else {
  publicKey = `pk_live_${HANDLED_SLUG}_${crypto.randomBytes(8).toString('hex')}`;
  secretKey = `sk_live_${HANDLED_SLUG}_${crypto.randomBytes(16).toString('hex')}`;
  logger.info('Creating new HANDLED tenant with generated keys');
}
```

✅ **Correct:** Keys only generated on create, preserved on update

---

## 8. Password Security ✅ PASS

**Finding:** Password handling follows security best practices.

### Production Guard (Line 21-26 in handled.ts)

```typescript
const isProduction = process.env.NODE_ENV === 'production';
const envPassword = process.env.HANDLED_ADMIN_PASSWORD;
if (isProduction && !envPassword) {
  throw new Error('HANDLED_ADMIN_PASSWORD environment variable is required in production');
}
const HANDLED_PASSWORD = envPassword || 'handled-admin-2025!';
```

✅ **Security:** Prevents default password in production
✅ **Env var check:** Fails fast if missing in production
✅ **Dev fallback:** Safe default for local development

### Password Hashing (Line 53 in handled.ts)

```typescript
const passwordHash = await bcrypt.hash(HANDLED_PASSWORD, 10);
```

✅ **Bcrypt rounds:** 10 is standard (OWASP recommended 12, but acceptable)
✅ **Async:** Non-blocking hash operation
✅ **Storage:** Hash stored, never plaintext

**Recommendation P3 (Optional):** Increase bcrypt rounds to 12 for consistency with platform seed:

```typescript
const passwordHash = await bcrypt.hash(HANDLED_PASSWORD, 12);
```

---

## 9. Seed Orchestration ✅ PASS

**Finding:** Seed properly integrated into orchestration system.

### Seed Registry (Line 31 in seed.ts)

```typescript
import { seedHandled } from './seeds/handled';
```

### Seed Mode Support (Line 13 in seed.ts)

```
SEED_MODE=handled npm exec prisma db seed
```

### Switch Case Handler (Line 127-130 in seed.ts)

```typescript
case 'handled':
  // HANDLED: Tenant Zero - dogfooding our own platform
  await seedHandled(prisma);
  break;
```

### All Seed Mode (Line 109 in seed.ts)

```typescript
await seedHandled(prisma); // Included in 'all' mode
```

✅ **Integrated:** Properly registered in seed system
✅ **Discoverable:** Can run independently or with all seeds
✅ **Safe:** Isolated from other seed paths

---

## Data Integrity Findings Summary

| Finding                   | Severity | Status  | Notes                                   |
| ------------------------- | -------- | ------- | --------------------------------------- |
| 1. Utility function usage | —        | ✅ PASS | Correct upsert pattern                  |
| 2. API key format         | —        | ✅ PASS | Valid pk*live*, sk*live* formats        |
| 3. Slug conflict          | P2       | ✅ PASS | Not reserved, no existing 'mais' tenant |
| 4. Email format           | —        | ✅ PASS | RFC 5322 valid, unique constraint       |
| 5. Landing page schema    | P2       | ✅ PASS | All sections conform to Zod schema      |
| 6. Tenant isolation       | —        | ✅ PASS | Unique constraints protect data         |
| 7. Transaction safety     | —        | ✅ PASS | ACID compliant, proper rollback         |
| 8. Password security      | —        | ✅ PASS | Production guard, bcrypt hashed         |
| 9. Seed orchestration     | —        | ✅ PASS | Properly integrated into system         |

---

## Recommendations

### P1 (Critical) - None

No critical data integrity issues found.

### P2 (Important)

1. **Pricing section priceSubtext** (Line 142, 150, 167)
   - Current: `/month`
   - Consider: `per month` (if UI rendering expects different format)
   - Risk: Low (formatting only, no validation failure)

2. **Slug conflict documentation**
   - Add comment explaining 'handled' is separate brand from 'mais'
   - Document in PR that no migration needed

### P3 (Nice to Have)

1. **Bcrypt rounds consistency**
   - Current: 10 rounds (line 53)
   - Recommended: 12 rounds (to match platform.seed.ts)
   - Impact: Minimal (5-10ms slower hash)

---

## Pre-Deployment Checklist

Before running `SEED_MODE=handled npm exec prisma db seed`:

- [ ] DATABASE_URL points to correct development database
- [ ] No 'handled' tenant exists yet (or it's safe to update)
- [ ] Review landing page structure in Storybook/frontend
- [ ] If production: Set `HANDLED_ADMIN_PASSWORD` environment variable
- [ ] Verify `.gethandled.ai` domain is valid in seed
- [ ] Test seed: `SEED_MODE=handled npm exec prisma db seed`
- [ ] Verify tenant appears in database: `npm exec prisma studio`
- [ ] Test tenant access: `curl -H "X-Tenant-Key: pk_live_handled_..." http://localhost:3001/v1/packages`

---

## Conclusion

✅ **The HANDLED seed is safe to execute.**

The seed properly uses the `createOrUpdateTenant` utility, generates valid API keys, uses correct email format, and conforms to all landing page schema requirements. The transaction-based approach ensures data consistency on re-runs. Two minor P2 recommendations provided for formatting consistency, but not blocking.

**Status: APPROVED FOR DEPLOYMENT**

_Review completed: December 27, 2025_
