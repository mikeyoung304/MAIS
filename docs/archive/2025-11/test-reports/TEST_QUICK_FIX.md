# Test Quick Fix Guide - Do This NOW

**⏱️ Time to fix: 15 minutes**
**🎯 Result: E2E tests will run**

---

## 🚨 Critical Fixes (Do These First)

### Fix 1: Playwright Config (2 minutes)

**File:** `e2e/playwright.config.ts`

**Line 72:**

```typescript
// CHANGE THIS:
cwd: './apps/web',

// TO THIS:
cwd: './client',
```

**Test it works:**

```bash
npm run test:e2e:headed
# Should see browser open to home page
```

---

### Fix 2: E2E GitHub Actions (3 minutes)

**File:** `.github/workflows/e2e.yml`

**Line 52:**

```yaml
# CHANGE THIS:
- name: Start API server in mock mode (background)
  run: |
    pnpm -C apps/api run dev &

# TO THIS:
- name: Start API server in mock mode (background)
  run: |
    pnpm -C server run dev &
```

---

### Fix 3: Unit Test GitHub Actions (2 minutes)

**File:** `.github/workflows/ci.yml`

**Line 47:**

```yaml
# CHANGE THIS:
- name: Run API unit tests
  run: pnpm -C apps/api run test

# TO THIS:
- name: Run API unit tests
  run: pnpm -C server run test
```

---

## ✅ Verify Fixes

```bash
# Test 1: E2E config works
npm run test:e2e:headed
# Should open browser without errors

# Test 2: Unit tests run
npm run --workspace=server test
# Should run tests (some will fail - that's OK for now)

# Test 3: Check CI workflows (commit and push)
git add .
git commit -m "fix: Update test configuration paths"
git push
# Check GitHub Actions - should run without path errors
```

---

## 📊 Expected Results

**Before:**

- ❌ E2E tests: Error "directory not found: apps/web"
- ❌ CI/CD: Fails with "apps/api: no such directory"
- ❌ Unit tests: Can't run in CI

**After:**

- ✅ E2E tests: Browser opens, tests run
- ✅ CI/CD: Workflows execute
- ✅ Unit tests: Run in CI (some still fail - that's next)

---

## 🔴 Known Issues After These Fixes

**Unit tests still fail (121 failures):**

- **Cause:** Multi-tenant refactoring added `tenantId` parameter
- **Fix:** See `TEST_RECOVERY_PLAN.md` Section "Fix 1.3"
- **Time:** 2-3 hours
- **Priority:** P0 (but not blocking E2E tests)

**Example:**

```typescript
// ❌ FAILS:
await service.getPackageBySlug('basic');

// ✅ NEEDS:
await service.getPackageBySlug('tenant_test', 'basic');
```

---

## 📋 Next Steps

After these quick fixes:

1. **Read full plan:** `TEST_RECOVERY_PLAN.md`
2. **Fix unit tests:** Update service call signatures (2-3 hours)
3. **Update docs:** `TESTING.md` (30 minutes)
4. **Add validation:** Pre-test checks (30 minutes)

---

## 🆘 If Something Goes Wrong

**Error: "Module not found"**

```bash
# Install dependencies
npm install
```

**Error: "Port 3001 already in use"**

```bash
# Kill existing process
lsof -ti:3001 | xargs kill -9
```

**Error: "Playwright browser not installed"**

```bash
npx playwright install chromium
```

---

## 📞 Questions?

See `TEST_RECOVERY_PLAN.md` for:

- Root cause analysis
- Detailed fix instructions
- Testing strategy
- Success metrics

**Bottom line:** We're at the edge of test hell, but these 3 fixes get us out.
