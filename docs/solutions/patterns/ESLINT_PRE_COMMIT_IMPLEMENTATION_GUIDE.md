---
title: ESLint Pre-commit Implementation Guide
date: 2026-01-05
category: patterns
severity: P1
component: Development Workflow, Pre-commit Hooks
tags: [eslint, pre-commit, husky, git-hooks, implementation]
---

# ESLint Pre-commit Implementation Guide

This guide provides step-by-step instructions to add ESLint checking to your pre-commit hooks.

## Current Pre-commit Hook Status

**Location:** `.husky/pre-commit`

**Current checks:**

1. ✅ Prisma schema regeneration
2. ✅ Prettier formatting
3. ✅ Documentation validation
4. ✅ Unit tests
5. ✅ TypeScript type checking
6. ✅ Next.js unused variable strictness
7. ❌ **MISSING: ESLint check**

## Step 1: Understand What We're Adding

ESLint will check for:

```
Dead Code Patterns:
├─ Unused imports
├─ Type-only values imported as code
├─ Unused variables
├─ Unused function parameters (unless prefixed with _)
└─ Functions with no callers

Configuration:
├─ server/.eslintrc.json (has the rules configured)
├─ .eslintrc.cjs (root, excludes apps/web)
└─ Current: 25 recent errors fixed, 0 errors remaining
```

## Step 2: Implement the Enhanced Pre-commit Hook

**File to modify:** `/Users/mikeyoung/CODING/MAIS/.husky/pre-commit`

### Current Hook Content

```bash
#!/bin/sh
set -e  # Exit on first error

# Check if Prisma schema changed and regenerate client
if git diff --cached --name-only | grep -q "server/prisma/schema.prisma"; then
  echo "Prisma schema changed, regenerating client..."
  (cd server && npm exec prisma generate)
fi

# Run lint-staged (auto-format staged files with prettier)
echo "Formatting staged files..."
npx lint-staged

# Run documentation validation
echo "Validating documentation standards..."
./scripts/validate-docs.sh

# Run unit tests (fast tests only)
echo "Running unit tests..."
npm run test:unit

# Run TypeScript type checking
echo "Running TypeScript type check..."
npm run typecheck

# Check for unused variables in Next.js (matches production build strictness)
echo "Checking Next.js unused variable strictness..."
if git diff --cached --name-only | grep -q "apps/web/"; then
  (cd apps/web && npx tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1) || {
    echo ""
    echo "ERROR: Unused variables detected in apps/web/"
    echo "Production builds enforce noUnusedLocals and noUnusedParameters."
    echo ""
    echo "Fix options:"
    echo "  1. Remove truly unused variables"
    echo "  2. Use the variable (don't just prefix with _)"
    echo "  3. Only prefix with _ if variable is TRULY unused"
    echo ""
    echo "See: docs/solutions/build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md"
    exit 1
  }
fi

echo "Pre-commit checks passed!"
```

### Enhanced Hook with ESLint

**Add this section right after lint-staged and before documentation validation:**

```bash
#!/bin/sh
set -e  # Exit on first error

# Check if Prisma schema changed and regenerate client
if git diff --cached --name-only | grep -q "server/prisma/schema.prisma"; then
  echo "Prisma schema changed, regenerating client..."
  (cd server && npm exec prisma generate)
fi

# Run lint-staged (auto-format staged files with prettier)
echo "Formatting staged files..."
npx lint-staged

# NEW: Run ESLint on staged TypeScript files
echo "Running ESLint on staged files..."
STAGED_TS_FILES=$(git diff --cached --name-only | grep -E '\.(ts|tsx)$' | grep -v 'apps/web' || true)
if [ -n "$STAGED_TS_FILES" ]; then
  npx eslint $STAGED_TS_FILES --max-warnings 0 || {
    echo ""
    echo "ERROR: ESLint found issues in staged files"
    echo ""
    echo "Common fixes:"
    echo "  1. Remove unused imports"
    echo "  2. Convert type-only imports: import type { X } from './m'"
    echo "  3. Delete unused variables (don't declare if not using)"
    echo "  4. Delete dead code functions (git preserves history)"
    echo "  5. Prefix unused parameters with _ : (_param) => ..."
    echo ""
    echo "Auto-fix attempt:"
    echo "  npx eslint --fix $STAGED_TS_FILES"
    echo ""
    echo "See: docs/solutions/patterns/ESLINT_DEAD_CODE_PREVENTION_STRATEGY-MAIS-20260105.md"
    echo "Quick reference: docs/solutions/patterns/ESLINT_DEAD_CODE_QUICK_REFERENCE.md"
    exit 1
  }
fi

# Run documentation validation
echo "Validating documentation standards..."
./scripts/validate-docs.sh

# Run unit tests (fast tests only)
echo "Running unit tests..."
npm run test:unit

# Run TypeScript type checking
echo "Running TypeScript type check..."
npm run typecheck

# Check for unused variables in Next.js (matches production build strictness)
echo "Checking Next.js unused variable strictness..."
if git diff --cached --name-only | grep -q "apps/web/"; then
  (cd apps/web && npx tsc --noEmit --noUnusedLocals --noUnusedParameters 2>&1) || {
    echo ""
    echo "ERROR: Unused variables detected in apps/web/"
    echo "Production builds enforce noUnusedLocals and noUnusedParameters."
    echo ""
    echo "Fix options:"
    echo "  1. Remove truly unused variables"
    echo "  2. Use the variable (don't just prefix with _)"
    echo "  3. Only prefix with _ if variable is TRULY unused"
    echo ""
    echo "See: docs/solutions/build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md"
    exit 1
  }
fi

echo "Pre-commit checks passed!"
```

## Step 3: Apply the Changes

Replace the entire `.husky/pre-commit` file:

```bash
# Open the file
nano /Users/mikeyoung/CODING/MAIS/.husky/pre-commit

# Or use your preferred editor - just replace the file content above
```

### Verify the changes:

```bash
# Check the file has the new ESLint section
grep -A 5 "Run ESLint" /Users/mikeyoung/CODING/MAIS/.husky/pre-commit

# Should output:
# echo "Running ESLint on staged files..."
# STAGED_TS_FILES=$(git diff --cached --name-only | grep -E '\.(ts|tsx)$' | grep -v 'apps/web' || true)
# if [ -n "$STAGED_TS_FILES" ]; then
```

## Step 4: Test the Hook

### Test 1: Make a valid change (should pass)

```bash
cd /Users/mikeyoung/CODING/MAIS

# Create a valid change
echo "export const newConstant = 42;" >> server/src/config/new.ts

# Try to commit
git add server/src/config/new.ts
git commit -m "test: valid change"

# Should succeed, hook runs without errors
```

### Test 2: Introduce an ESLint violation (should fail)

```bash
cd /Users/mikeyoung/CODING/MAIS

# Create a violation
cat > /tmp/bad-code.ts << 'EOF'
import { unusedImport } from './module';

const unusedVariable = calculateSomething();
EOF

cp /tmp/bad-code.ts server/src/config/test-bad.ts

# Try to commit
git add server/src/config/test-bad.ts
git commit -m "test: intentional violation"

# Should FAIL with error message:
# ERROR: ESLint found issues in staged files
# Common fixes:
#   1. Remove unused imports
#   2. Convert type-only imports...
```

### Test 3: Auto-fix and retry

```bash
# From the error message above, follow the auto-fix command
npx eslint server/src/config/test-bad.ts --fix

# Or manually remove the unused items
# Then try committing again
git add server/src/config/test-bad.ts
git commit -m "test: fixed violations"

# Should succeed now
```

## Step 5: Document the Change

### Update CLAUDE.md

Add to the **Development Workflow** section:

```markdown
### Pre-commit Hook Protection

The `.husky/pre-commit` hook runs these checks BEFORE any commit:

1. **ESLint validation** - Detects unused imports, dead variables, type-only imports
   - Runs only on staged `.ts` and `.tsx` files
   - Requires `--max-warnings 0` (zero tolerance)
   - Use `npx eslint --fix` to auto-correct common issues

2. **TypeScript type checking** - Catches import mismatches
   - Runs full typecheck
   - Must pass before commit

3. **Next.js strictness** - When modifying apps/web/
   - Runs with `noUnusedLocals` and `noUnusedParameters`
   - Matches production build strictness

If pre-commit fails:

- Read the error message for which check failed
- Run suggested fix command
- Stage changes: `git add .`
- Retry commit
```

### Add PR Template Requirement

**File:** `.github/pull_request_template.md` (or create if doesn't exist)

```markdown
## Code Quality Checklist

- [ ] ESLint passes locally: `npm run lint`
- [ ] TypeScript passes: `npm run typecheck`
- [ ] No new dead code (unused imports, variables, functions)
- [ ] Type-only imports use `import type` syntax
- [ ] Pre-commit hook passed before pushing

See: docs/solutions/patterns/ESLINT_DEAD_CODE_PREVENTION_STRATEGY-MAIS-20260105.md
```

## Step 6: Team Communication

Share with your team:

### Slack/Discord Message

```
🚨 ESLint Pre-commit Hook Activated

New pre-commit check is now live:

✅ What's new:
- ESLint validation on staged .ts/.tsx files
- Catches unused imports, dead code, type-only imports
- Zero tolerance for violations

📋 What to expect:
- Commit will fail if ESLint finds issues
- Read the error message for specific problems
- Run: npx eslint --fix <file> to auto-correct

📚 Documentation:
- Quick reference: docs/solutions/patterns/ESLINT_DEAD_CODE_QUICK_REFERENCE.md
- Full guide: docs/solutions/patterns/ESLINT_DEAD_CODE_PREVENTION_STRATEGY-MAIS-20260105.md

⚡ Common fixes (30 seconds each):
1. Remove unused imports
2. Delete unused variables
3. Change to import type { X } for types only
4. Delete dead functions (git has history)

If stuck, see the quick reference or ask in #dev-help
```

## Troubleshooting

### Issue: Hook runs but ESLint times out

**Symptom:** `ESLint found issues` but no file-specific errors shown

**Solution:**

```bash
# Run ESLint directly to see actual errors
npx eslint server/src --max-warnings 0

# Check one file at a time if many errors
npx eslint server/src/agent/orchestrator/base-orchestrator.ts
```

### Issue: Hook runs on files you don't want

**Symptom:** ESLint checks `apps/web/` when it should only check `server/`

**Solution:**
The hook explicitly excludes `apps/web` (has separate TypeScript check):

```bash
# This line in hook prevents apps/web from being linted:
STAGED_TS_FILES=$(git diff --cached --name-only | grep -E '\.(ts|tsx)$' | grep -v 'apps/web' || true)
```

### Issue: Auto-fix doesn't work as expected

**Symptom:** `npx eslint --fix` runs but errors remain

**Solution:**

```bash
# Try with verbose output
npx eslint --fix --debug server/src/agent/tools/onboarding-tools.ts

# Some errors require manual fixes (cannot auto-fix):
# - Dead functions (must delete manually)
# - Import name mismatches (must verify correct names)
# - Architecture issues (require design review)
```

## Performance Impact

**Estimated time overhead per commit:**

```
ESLint scanning:     ~1-3 seconds (only staged files)
ESLint checking:     ~2-5 seconds (actually running checks)
Total added:         ~3-8 seconds per commit

Benefit:             Catches 90% of linting issues locally
                     Prevents CI failures
                     Saves ~15+ minutes of debugging per week
```

If this is too slow, you can optimize:

```bash
# Option 1: Cache ESLint results
npx eslint --cache server/src

# Option 2: Run only on changed files (already done in hook)
# Option 3: Skip non-TypeScript files (already done in hook)
```

## Verification Checklist

After implementing, verify:

- [ ] `.husky/pre-commit` file is updated
- [ ] File is executable: `chmod +x .husky/pre-commit`
- [ ] Test case 1 passes (valid change commits)
- [ ] Test case 2 fails (violation blocks commit)
- [ ] Test case 3 passes (fixed violation commits)
- [ ] CLAUDE.md is updated
- [ ] Team is notified
- [ ] Documentation is linked in PR template

## Rollback (If Needed)

If you need to disable the check temporarily:

```bash
# Comment out the ESLint section
nano .husky/pre-commit

# Change this:
# echo "Running ESLint on staged files..."

# To this:
# # echo "Running ESLint on staged files..."  # DISABLED: reason here
```

But before doing this, investigate why it's failing and fix the root cause.

## Related Documents

- **Quick Reference:** `docs/solutions/patterns/ESLINT_DEAD_CODE_QUICK_REFERENCE.md`
- **Prevention Strategy:** `docs/solutions/patterns/ESLINT_DEAD_CODE_PREVENTION_STRATEGY-MAIS-20260105.md`
- **TypeScript Config:** `docs/solutions/build-errors/typescript-unused-variables-build-failure-MAIS-20251227.md`
- **Import Issues:** `docs/solutions/build-errors/import-name-mismatch-onboarding-tools-MAIS-20251231.md`

## Success Indicators

After implementation, monitor:

1. **CI Build Success Rate** - Should increase (fewer lint failures)
2. **Pre-commit Hook Usage** - All developers hitting it (means it's active)
3. **Code Review Comments** - Fewer "remove unused import" comments
4. **Technical Debt** - Dead code doesn't accumulate
5. **Developer Workflow** - Shift left: fix issues locally, not in CI
