---
title: HANDLED Rebrand - Complete Brand Migration from MAIS to gethandled.ai
problem_type: refactoring
component: multi-component
severity: medium
symptoms:
  - Brand identity mismatch between product vision and codebase naming
  - E2E tests failing due to hardcoded MAIS tenant slugs and API keys
  - Seed files referencing old MAIS brand voice and content
  - Domain verification using _mais-verify prefix
  - Health/metrics routes reporting mais-api service name
  - Documentation referencing outdated MAIS terminology
  - Footer and metadata pointing to old brand
root_cause: Brand identity migration from MAIS to HANDLED
solution_summary: |
  Systematic 3-phase rebrand across 24 files:
  Phase 1 - Core seed files (handled.ts, e2e.ts, seed.ts)
  Phase 2 - App pages and components (redirect, ScrollingIdentity)
  Phase 3 - Documentation (BRAND_VOICE_GUIDE.md, CLAUDE.md)
  Plus P1 test fixes and P2 production polish
files_affected:
  - server/prisma/seeds/handled.ts (new)
  - server/prisma/seeds/e2e.ts
  - server/prisma/seed.ts
  - apps/web/src/app/page.tsx
  - apps/web/src/components/home/ScrollingIdentity.tsx
  - apps/web/src/app/layout.tsx
  - apps/web/src/middleware.ts
  - apps/web/src/components/tenant/TenantFooter.tsx
  - docs/design/BRAND_VOICE_GUIDE.md
  - docs/design/HANDLED_BRAND_POSITIONING.md (new)
  - e2e/tests/*.spec.ts (4 files)
  - server/src/routes/health.routes.ts
  - server/src/routes/metrics.routes.ts
  - server/src/services/domain-verification.service.ts
verified: true
date_solved: 2025-12-27
related_commits:
  - e4882fe feat: complete HANDLED rebrand from MAIS
tags:
  - rebrand
  - handled
  - mais
  - multi-file
  - migration
  - brand-voice
  - seed-data
  - e2e-tests
  - documentation
---

# HANDLED Rebrand - Complete Brand Migration Pattern

This document captures the complete procedure for migrating a platform brand, using the MAIS to HANDLED rebrand as the reference implementation.

## Overview

A complete platform rebrand involves changes across 6 categories:

1. **Core Seed Files** - Database tenant definitions
2. **App Updates** - Root redirects and identity components
3. **Documentation** - Brand voice and positioning guides
4. **Test Updates (P1)** - E2E tests and unit tests that reference the brand
5. **Production Updates (P2)** - Metadata, footers, middleware, API routes
6. **Configuration Files** - Environment examples and configs

**Scope:** 24 files modified, 779 insertions, 440 deletions

---

## Solution

### Phase 1: Core Seed Files

#### 1.1 Create new brand tenant seed file

Create `server/prisma/seeds/{brand}.ts`:

```typescript
/**
 * {BRAND} Tenant Seed - "Tenant Zero" dogfooding
 *
 * Use: SEED_MODE={brand} npm exec prisma db seed
 */

import type { PrismaClient } from '../../src/generated/prisma';
import { logger } from '../../src/lib/core/logger';
import { createOrUpdateTenant } from './utils';

const BRAND_SLUG = '{brand}';
const BRAND_EMAIL = 'hello@{brand}.{tld}';

export async function seed{Brand}(prisma: PrismaClient): Promise<void> {
  // Tenant creation with:
  // - Brand colors (e.g., #7B9E87 for sage green)
  // - Font family (e.g., 'Georgia, serif')
  // - Complete landingPageConfig with all pages
}
```

#### 1.2 Update E2E test tenant

Edit `server/prisma/seeds/e2e.ts`:

```typescript
const E2E_TENANT_SLUG = '{brand}-e2e';
const E2E_PUBLIC_KEY = 'pk_live_{brand}-e2e_0000000000000000';
const E2E_SECRET_KEY = 'sk_live_{brand}-e2e_00000000000000000000000000000000';

export const E2E_KEYS = {
  tenantSlug: E2E_TENANT_SLUG,
  publicKey: E2E_PUBLIC_KEY,
  secretKey: E2E_SECRET_KEY,
} as const;
```

#### 1.3 Update seed.ts orchestrator

```typescript
import { seed{Brand} } from './seeds/{brand}';

type SeedMode = 'production' | 'e2e' | '{brand}' | 'all';

// Add case in switch
case '{brand}':
  await seed{Brand}(prisma);
  break;
```

#### 1.4 Delete old brand seed file

```bash
rm server/prisma/seeds/{old-brand}.ts
```

---

### Phase 2: App Updates

#### 2.1 Update root page redirect

```typescript
// apps/web/src/app/page.tsx
import { permanentRedirect } from 'next/navigation';

export default function HomePage() {
  permanentRedirect('/t/{brand}');
}
```

#### 2.2 Update identity components

Update components like `ScrollingIdentity.tsx` with new brand voice and personality.

---

### Phase 3: Documentation

#### 3.1 Create brand positioning doc

Create `docs/design/{BRAND}_BRAND_POSITIONING.md` with:

- Brand identity (name, domain, tagline)
- Target audience
- Voice principles with examples
- Value proposition
- Messaging framework

#### 3.2 Rewrite brand voice guide

Update `docs/design/BRAND_VOICE_GUIDE.md` with:

- Voice principles with do/don't examples
- Copy patterns (headlines, subheadlines, CTAs)
- Word usage table
- Design system tokens
- Component patterns
- Review checklist

#### 3.3 Update CLAUDE.md

Update project overview with new brand name and description.

---

### Phase 4: P1 Fixes (Test Blocking)

These are blocking for CI/CD and must be done first.

#### 4.1 Update E2E seed unit tests

```typescript
// server/test/seeds/e2e-seed.test.ts
expect(E2E_KEYS.tenantSlug).toBe('{brand}-e2e');
expect(E2E_KEYS.publicKey).toBe('pk_live_{brand}-e2e_0000000000000000');
```

#### 4.2 Update E2E test files

```typescript
// e2e/tests/storefront.spec.ts
await page.goto('/t/{brand}-e2e');

// e2e/tests/nextjs-booking-flow.spec.ts
const TEST_TENANT_SLUG = '{brand}-e2e';

// e2e/tests/tenant-multi-page.spec.ts
const TENANT_SLUG = '{brand}-e2e';
{ path: '', titleContains: '{Brand} E2E Test Tenant' },
```

#### 4.3 Update config files

```typescript
// e2e/playwright.config.ts
VITE_TENANT_API_KEY=pk_live_{brand}-e2e_0000000000000000

// client/.env.example
VITE_TENANT_API_KEY=pk_live_{brand}-e2e_0000000000000000
```

---

### Phase 5: P2 Fixes (Production Ready)

#### 5.1 Update Next.js layout metadata

```typescript
// apps/web/src/app/layout.tsx
export const metadata: Metadata = {
  title: {
    default: '{BRAND} - {Tagline}',
    template: '%s | {BRAND}',
  },
  authors: [{ name: '{BRAND}' }],
  openGraph: { siteName: '{BRAND}' },
};
```

#### 5.2 Update footer attribution

```typescript
// apps/web/src/components/tenant/TenantFooter.tsx
<a href="https://{brand}.{tld}">
  {BRAND}
</a>
```

#### 5.3 Update middleware known domains

```typescript
// apps/web/src/middleware.ts
const KNOWN_DOMAINS = [
  '{brand}.{tld}',
  'www.{brand}.{tld}',
  'app.{brand}.{tld}',
  'vercel.app',
  'localhost',
];
```

#### 5.4 Update health/metrics routes

```typescript
// server/src/routes/health.routes.ts
// server/src/routes/metrics.routes.ts
service: '{brand}-api',
```

#### 5.5 Update domain verification

```typescript
// server/src/services/domain-verification.service.ts
private readonly txtPrefix: string = '_{brand}-verify';
private readonly tokenPrefix: string = '{brand}-verify=';
```

---

## Verification Checklist

After completing all phases:

- [ ] `npm run typecheck` - TypeScript passes
- [ ] `npm test` - All server tests pass
- [ ] `npm run test:e2e` - E2E tests pass
- [ ] `SEED_MODE={brand} npm exec prisma db seed` - Seed runs
- [ ] Visit `http://localhost:3000/t/{brand}` - Landing page loads
- [ ] Check footer shows correct brand link
- [ ] Check page title in browser tab
- [ ] Check health endpoint returns correct service name

---

## Files Modified Summary

| Category   | Files                                                               |
| ---------- | ------------------------------------------------------------------- |
| Seed Files | `seeds/{brand}.ts` (new), `e2e.ts`, `seed.ts`                       |
| App Pages  | `apps/web/src/app/page.tsx`, `layout.tsx`                           |
| Components | `TenantFooter.tsx`, `ScrollingIdentity.tsx`                         |
| Middleware | `apps/web/src/middleware.ts`                                        |
| API Routes | `health.routes.ts`, `metrics.routes.ts`                             |
| Services   | `domain-verification.service.ts`                                    |
| Tests      | `e2e-seed.test.ts`, `*.spec.ts` (4 files)                           |
| Config     | `playwright.config.ts`, `client/.env.example`                       |
| Docs       | `BRAND_VOICE_GUIDE.md`, `{BRAND}_BRAND_POSITIONING.md`, `CLAUDE.md` |

---

## Prevention Strategies

### 1. Brand Reference Inventory Before Migration

```bash
# Generate exhaustive brand reference report
grep -rn "OldBrandName\|old-brand\|oldbrand" \
  --include="*.ts" --include="*.tsx" --include="*.json" \
  --include="*.md" --include="*.env*" --include="*.yml" \
  . > brand-inventory.txt

# Categorize by priority
grep -c "\.test\.\|\.spec\." brand-inventory.txt  # P1: Test files
grep -c "\.env\|config" brand-inventory.txt       # P1: Config files
grep -c "\.md" brand-inventory.txt                # P2: Docs
```

### 2. Automated Detection

Add to `package.json`:

```json
{
  "scripts": {
    "brand:check": "bash scripts/check-brand-references.sh"
  }
}
```

```bash
#!/bin/bash
# scripts/check-brand-references.sh

OLD_PATTERNS=(
  "mais"
  "pk_live_mais"
  "maconaisolutions"
)

for pattern in "${OLD_PATTERNS[@]}"; do
  results=$(grep -rn "$pattern" \
    --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules .)

  if [ -n "$results" ]; then
    echo "Found orphaned brand reference: $pattern"
    echo "$results"
    exit 1
  fi
done
```

### 3. Pre-commit Hook

```bash
# .husky/pre-commit
npm run brand:check || {
  echo "Brand check failed. Please update old brand references."
  exit 1
}
```

### 4. Centralized Brand Configuration

```typescript
// packages/shared/src/brand.ts
export const BRAND = {
  name: 'HANDLED',
  slug: 'handled',
  domain: 'gethandled.ai',
  testApiKeyPrefix: 'pk_live_handled',
  testSecretKeyPrefix: 'sk_live_handled',
  legacyPatterns: ['mais', 'pk_live_mais'],
} as const;
```

---

## Related Documentation

| Document                      | Location           | Relevance                        |
| ----------------------------- | ------------------ | -------------------------------- |
| REBRAND-SUMMARY.md            | `/docs/`           | Strategic decision and checklist |
| HANDLED_BRAND_POSITIONING.md  | `/docs/design/`    | Brand identity guide             |
| BRAND_VOICE_GUIDE.md          | `/docs/design/`    | Copy and design patterns         |
| TYPESCRIPT-SEED-PREVENTION-\* | `/docs/solutions/` | Seed update patterns             |

---

## Key Lessons

| Issue                        | Impact              | Prevention                   |
| ---------------------------- | ------------------- | ---------------------------- |
| Test fixtures with old slugs | E2E tests blocked   | Centralize test constants    |
| Hardcoded API key patterns   | Auth failures       | Use `BRAND.testApiKeyPrefix` |
| Old brand in error messages  | User confusion      | Search all string literals   |
| Documentation drift          | Developer confusion | Include docs in inventory    |

**The 80/20 rule:** 80% of rebrand issues come from test fixtures and configuration files. Prioritize these first (P1) before documentation (P2).
