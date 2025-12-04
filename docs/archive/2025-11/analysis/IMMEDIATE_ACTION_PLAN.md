# IMMEDIATE ACTION PLAN - Pre-Launch Checklist

**Timeline:** Must complete before general availability  
**Estimated Effort:** 20-25 hours  
**Risk Reduction:** CRITICAL → MEDIUM-LOW

---

## BLOCKING ISSUES (Do First)

### 1. Fix ESLint Configuration

**Severity:** CRITICAL (Prevents linting)  
**Time:** 1-2 hours  
**Why:** ESLint broken, no code quality checks running

**Steps:**

```bash
# 1. Update .eslintrc.cjs with parserOptions.project
# Add to module.exports:
parserOptions: {
  project: ['./tsconfig.json', './server/tsconfig.json', './client/tsconfig.json'],
  projectCacheLocation: './node_modules/.eslint-parser-cache',
}

# 2. Test linting
npm run lint

# 3. Fix violations (likely dozens)
# Use: eslint . --ext .ts,.tsx --fix
```

**Files to Modify:**

- `.eslintrc.cjs` - Add parserOptions.project

---

### 2. Fix Security Vulnerability

**Severity:** CRITICAL (Security)  
**Time:** 30 minutes  
**Why:** Prototype pollution in js-yaml

**Steps:**

```bash
# 1. Run audit fix
npm audit fix

# 2. Test Stripe integration
npm run test:integration -- stripe

# 3. Commit
git add package-lock.json
git commit -m "fix: resolve js-yaml prototype pollution vulnerability"
```

---

### 3. Update Payment-Critical Packages

**Severity:** HIGH (Stripe integration)  
**Time:** 1 hour  
**Why:** Stripe 19.1.0 → 19.3.1 has payment improvements

**Steps:**

```bash
# 1. Update packages
npm update stripe @prisma/client prisma

# 2. Run payment tests
npm run test:integration -- stripe

# 3. Test webhook processing
npm run test:integration -- webhook

# 4. Commit
git add package-lock.json
git commit -m "chore: update stripe and prisma to latest versions"
```

---

### 4. Fix Type Safety (116 'any' Casts)

**Severity:** HIGH (Type safety)  
**Time:** 4-6 hours  
**Why:** Runtime errors possible with JSON columns

**Steps:**

**4a. Create Type-Safe JSON Validators**

```typescript
// File: src/lib/json-schemas.ts (NEW)

import { z } from 'zod';

export const brandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9A-F]{6}$/i)
    .optional(),
  fontFamily: z.string().optional(),
  logo: z.string().url().optional(),
});

export type BrandingConfig = z.infer<typeof brandingSchema>;

export const secretsSchema = z.object({
  stripe: z
    .object({
      ciphertext: z.string(),
      iv: z.string(),
      authTag: z.string(),
    })
    .optional(),
});

export type SecretsConfig = z.infer<typeof secretsSchema>;

// Safe parsers
export function parseBranding(data: unknown): BrandingConfig {
  return brandingSchema.parse(data || {});
}

export function parseSecrets(data: unknown): SecretsConfig {
  return secretsSchema.parse(data || {});
}
```

**4b. Replace 'any' Casts**

```typescript
// BEFORE:
const currentBranding = (tenant.branding as any) || {};

// AFTER:
import { parseBranding } from '../lib/json-schemas';
const currentBranding = parseBranding(tenant.branding);
```

**4c. Enable TypeScript Strict Options**

```json
// server/tsconfig.json
{
  "compilerOptions": {
    "noUnusedLocals": true, // Add (currently false)
    "noUnusedParameters": true // Add (currently false)
    // ... rest stays same
  }
}
```

**4d. Fix Violations**

```bash
npm run typecheck
# Fix each error - most are unused variables
# Format: variable_name (parameter) is declared but never used
```

**Files to Modify:**

- `src/lib/json-schemas.ts` (NEW)
- All files with `as any` casts (~30 files)
- `server/tsconfig.json`

**Verification:**

```bash
npm run typecheck  # Should pass with no errors
npm run lint       # Once ESLint fixed
```

---

### 5. Increase Test Coverage to 70%

**Severity:** CRITICAL (Pre-launch requirement)  
**Time:** 8-10 hours  
**Why:** Currently 51%, need 70% for launch

**Focus Areas (by priority):**

**5a. Fix Adapter Tests (Currently 7.83%)**

Target: 50% coverage

Files to test:

- `src/adapters/prisma/booking.repository.ts` (369 lines, 41.75% covered)
- `src/adapters/prisma/catalog.repository.ts` (305 lines, 41.75% covered)
- `src/adapters/prisma/tenant.repository.ts` (varies)

Create: `src/adapters/prisma/__tests__/booking.repository.spec.ts`

```typescript
describe('BookingRepository', () => {
  describe('createBooking', () => {
    it('should create booking with multi-tenant isolation');
    it('should calculate commission correctly');
    it('should reject booking on blackout date');
    it('should reject double-booking same date');
    it('should handle transaction rollback on validation error');
  });

  describe('findByTenant', () => {
    it("should only return tenant's own bookings");
    it('should return empty array for nonexistent tenant');
  });
});
```

**5b. Fix Controller Tests (Currently 2.99%)**

Target: 40% coverage

Focus on: `src/controllers/tenant-admin.controller.ts`

```typescript
describe('TenantAdminController', () => {
  describe('uploadLogo', () => {
    it('should upload logo and return URL');
    it('should reject missing file');
    it('should reject oversized file (>2MB)');
    it('should validate file type');
  });

  describe('updateBranding', () => {
    it('should update branding config');
    it('should validate color hex codes');
  });
});
```

**5c. Fix Route Tests (Currently 31.75%)**

Target: 60% coverage

Key routes to test:

- POST /v1/bookings - create booking
- GET /v1/bookings - list with filters
- POST /v1/packages - create package
- DELETE /v1/packages/:id - delete package

**5d. Unskip Integration Tests**

30+ tests marked `it.skip()` with TODO comments

```bash
# Find skipped tests
grep -r "it.skip" test/integration/

# For each: determine root cause and fix
# Common issues:
# - Data contamination (need better test isolation)
# - Race conditions (need transaction isolation)
# - Mock issues (need better test doubles)
```

**Actions:**

```bash
# 1. Create test files
touch src/adapters/prisma/__tests__/booking.repository.spec.ts
touch src/controllers/__tests__/tenant-admin.controller.spec.ts

# 2. Write tests (use existing tests as reference)
# See: src/services/audit.service.test.ts (100% coverage example)

# 3. Run coverage
npm run test:coverage

# 4. Commit
git add test/
git commit -m "test: increase coverage from 51% to 70% (target: 70%)"
```

**Coverage Target Matrix:**
| Module | Current | Target | Gap |
|--------|---------|--------|-----|
| adapters | 7.83% | 50% | +42% |
| controllers | 2.99% | 40% | +37% |
| routes | 31.75% | 60% | +28% |
| services | 50.82% | 70% | +19% |
| lib | 43.41% | 70% | +27% |
| **OVERALL** | **51.15%** | **70%** | **+19%** |

---

### 6. Remove Dead Code

**Severity:** MEDIUM (Code quality)  
**Time:** 2 hours  
**Why:** Reduces maintenance burden

**Dead Code to Remove/Archive:**

1. **Calendar Integration (11% coverage)**
   - Move to `_deprecated/` folder:
     - `src/adapters/gcal.adapter.ts`
     - `src/adapters/gcal.jwt.ts`
   - Remove from DI: `src/di.ts`

2. **Stripe Adapter (9% coverage)**
   - Verify `stripe-connect.service.ts` is the source of truth
   - If redundant, archive `src/adapters/stripe.adapter.ts`
   - If complementary, document usage

3. **Console.log Statements**
   - Replace with logger in:
     - `src/adapters/mock/index.ts` (8 instances)
     - `src/lib/core/config.ts` (2 instances)
     - `src/index.ts` (1 instance)

4. **Unused Imports**
   - Remove `import { ZodError }` from routes
   - Audit all imports with `eslint . --fix`

**Actions:**

```bash
# 1. Create deprecated folder
mkdir -p _deprecated

# 2. Move incomplete features
mv src/adapters/gcal.adapter.ts _deprecated/
mv src/adapters/gcal.jwt.ts _deprecated/

# 3. Update DI to remove references
# Edit src/di.ts - remove gcal instances

# 4. Replace console.log
grep -r "console\." src/ --include="*.ts"
# Replace each with: logger.info(), logger.warn(), logger.error()

# 5. Commit
git add .
git commit -m "refactor: archive incomplete features and remove dead code"
```

---

### 7. Break Down Large Files

**Severity:** MEDIUM (Maintainability)  
**Time:** 4 hours  
**Why:** 704-line file hard to maintain

**File: src/routes/tenant-admin.routes.ts (704 lines)**

Split into:

- `src/routes/tenant-admin/branding.ts` (100 lines)
- `src/routes/tenant-admin/packages.ts` (200 lines)
- `src/routes/tenant-admin/bookings.ts` (150 lines)
- `src/routes/tenant-admin/blackouts.ts` (100 lines)
- `src/routes/tenant-admin/index.ts` (50 lines - main router)

**Extract Middleware:**

- `src/middleware/multer-error-handler.ts` (20 lines)
- `src/middleware/validation.ts` (30 lines)

**Actions:**

```bash
# 1. Create directory structure
mkdir -p src/routes/tenant-admin

# 2. Extract each route group (use IDE refactor tools)
# Vscode: right-click → Extract to file

# 3. Update main router to import sub-routes
# src/routes/tenant-admin/index.ts
import { router as brandingRouter } from './branding';
import { router as packagesRouter } from './packages';
// etc.

router.use('/branding', brandingRouter);
router.use('/packages', packagesRouter);

# 4. Test
npm run test
npm run typecheck

# 5. Commit
git add src/routes/tenant-admin/
git commit -m "refactor: split tenant-admin routes into focused modules"
```

---

## VERIFICATION CHECKLIST

Before marking as "launch-ready", verify:

```bash
# 1. Type safety
npm run typecheck              # ✓ No errors
eslint . --ext .ts,.tsx        # ✓ No errors

# 2. Tests passing
npm run test                   # ✓ All pass
npm run test:coverage          # ✓ 70%+ coverage

# 3. Security
npm audit                      # ✓ 0 vulnerabilities

# 4. Formatting
npm run format:check           # ✓ All formatted

# 5. Build
npm run build                  # ✓ Builds successfully

# 6. E2E Tests
npm run test:e2e               # ✓ Key flows pass
```

---

## GIT WORKFLOW

For each fix:

```bash
# 1. Create feature branch
git checkout -b fix/pre-launch-critical

# 2. Make changes
# ... (follow steps above)

# 3. Test thoroughly
npm run test
npm run typecheck
npm run lint

# 4. Commit with clear message
git add .
git commit -m "fix: <category> - <description>"
# Examples:
# fix: eslint - add parserOptions.project to monorepo setup
# fix: security - resolve js-yaml prototype pollution
# fix: types - remove 116 'any' casts via JSON validators

# 5. Push
git push origin fix/pre-launch-critical

# 6. Create PR (when ready)
gh pr create --title "Pre-launch fixes" --body "Addresses critical issues before GA"
```

---

## TRACKING PROGRESS

After each fix, mark complete:

- [ ] 1. Fix ESLint Configuration
- [ ] 2. Fix Security Vulnerability
- [ ] 3. Update Critical Packages
- [ ] 4. Fix Type Safety
- [ ] 5. Increase Test Coverage
- [ ] 6. Remove Dead Code
- [ ] 7. Break Down Large Files

**Estimated Completion:** This week  
**Estimated Time Remaining:** 20-25 hours  
**Hours Per Day:** 4-5 hours (assuming split across 4-5 days)

---

## NEXT STEPS AFTER LAUNCH

Once these fixes complete, move to:

1. **Logging Standardization** (4-6 hours)
2. **Performance Monitoring** (6-8 hours)
3. **Database Query Optimization** (6-8 hours)
4. **Error Code System** (2-4 hours)
5. **Deployment Documentation** (4-6 hours)

See `CODE_HEALTH_ASSESSMENT.md` for full details.
