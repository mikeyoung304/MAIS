---
title: Next.js Audit Prevention - Implementation Guide
category: patterns
type: implementation-guide
tags: [next.js, migration, implementation, step-by-step, guide]
date_created: 2026-01-08
---

# Next.js Audit Prevention - Implementation Guide

**For:** Teams implementing Next.js migrations or large refactoring
**Time:** 2-3 weeks typical
**Complexity:** High (requires architectural changes)

---

## Phase 1: Pre-Migration Setup (2-3 days)

### Day 1: Establish File Structure Guidelines

**1. Create `.utils.ts` template**

```typescript
// apps/web/src/lib/example.utils.ts
/**
 * PURE UTILITIES
 * No server imports allowed in this file
 * Safe for both Client and Server Components
 */

export function exampleUtility(input: string): string {
  // Pure logic only
  return input.toLowerCase();
}
```

**2. Create `.server.ts` template**

```typescript
// apps/web/src/lib/example.server.ts
import 'server-only'; // Prevents accidental client imports

import { someServerAPI } from 'next/headers'; // ← OK here

export async function exampleServerFunction(): Promise<void> {
  // Server-only logic
}
```

**3. Document in README**

Add to `apps/web/README.md`:

```markdown
## File Organization

### Pure Utilities (.utils.ts)

- No server imports (next/headers, cookies, etc.)
- Safe for Client and Server Components
- Example: `src/lib/auth.utils.ts`

### Server-Only (.server.ts)

- Can import next/headers, next/navigation, server-only APIs
- Only importable by Server Components
- MUST have 'server-only' marker at top
- Example: `src/lib/auth.server.ts`

### Import Rules

- Client Components: `import { X } from '@/lib/name.utils'`
- Server Components: Can import from both
- Never: Client importing from `.server.ts`
```

### Day 2: Configure ESLint Rules

**1. Add to `.eslintrc.json`:**

```json
{
  "rules": {
    "no-restricted-imports": [
      "error",
      {
        "paths": [
          {
            "name": "next/headers",
            "importNames": ["cookies", "headers", "draftMode"],
            "message": "Found in lib/ - this file is TAINTED. Move to .server.ts and extract pure logic to .utils.ts"
          },
          {
            "name": "next/navigation",
            "importNames": ["redirect", "notFound", "useRouter"],
            "message": "Server-only in .server.ts. Use in Server Components or Route Handlers only"
          },
          {
            "name": "next-auth/jwt",
            "message": "Token handling is server-only. Keep in .server.ts"
          }
        ]
      }
    ]
  }
}
```

**2. Test ESLint config:**

```bash
npm run lint -- apps/web/src/lib/

# Should report any server imports found
```

### Day 3: Schedule Code Review Process

**1. Create review checklist:**

```markdown
## Pre-Merge Review Checklist

### Server/Client Boundary

- [ ] No .server files imported by Client Components
- [ ] All pure utilities in .utils files
- [ ] ESLint rules pass (no server imports in lib)
- [ ] npm run build succeeds

### Build Verification

- [ ] npm run typecheck passes
- [ ] npm run build succeeds
- [ ] No "imported in a Client Component" errors

### Code Quality

- [ ] No duplication across .utils and .server files
- [ ] Pure functions can't be moved to .server (shared usage)
- [ ] Clear separation of concerns

### Documentation

- [ ] File structure documented in README
- [ ] New .utils/.server files explained in PR
- [ ] Examples provided for developers
```

**2. Set up reviewer assignments:**

```bash
# Create .github/CODEOWNERS
apps/web/src/lib/     @reviewer1 @reviewer2  # Type Safety
apps/web/src/app/     @reviewer1             # Type Safety
apps/web/             @reviewer3             # Architecture
```

---

## Phase 2: First Migration (1 week)

### Week 1: Refactor One Module

**Select:** Most used module (e.g., `auth`)

**Step 1: Create utilities file**

```bash
# Identify pure functions
grep -A 5 "export function" apps/web/src/lib/auth.ts

# Create new utilities file
cat > apps/web/src/lib/auth.utils.ts << 'EOF'
// Pure utilities
export function isAdmin(role?: string): boolean {
  return role === 'ADMIN';
}
EOF
```

**Step 2: Create server file**

```bash
# Create server-only file
cat > apps/web/src/lib/auth.server.ts << 'EOF'
import 'server-only';
import { cookies } from 'next/headers';

export async function getBackendToken(): Promise<string | null> {
  // Server-only code
}
EOF
```

**Step 3: Move original to legacy**

```bash
mv apps/web/src/lib/auth.ts apps/web/src/lib/auth.legacy.ts
```

**Step 4: Update imports**

```bash
# Find all imports
grep -r "from '@/lib/auth'" apps/web/src/

# For each file:
# - Client Component: change to '@/lib/auth.utils'
# - Server Component: change to '@/lib/auth.server'
```

**Step 5: Verify build**

```bash
npm run build

# Should pass with no errors
```

**Step 6: Delete legacy file**

```bash
rm apps/web/src/lib/auth.legacy.ts
```

### Week 1 Deliverable

- ✅ One module refactored (auth.utils.ts + auth.server.ts)
- ✅ All imports updated
- ✅ Build passes
- ✅ No ESLint errors
- ✅ PR merged with review checklist completed

---

## Phase 3: Full Migration (2 weeks)

### Week 2: Apply Pattern to Remaining Modules

**Repeat Week 1 process for each lib module:**

1. `auth.ts` → `auth.utils.ts` + `auth.server.ts` ✓ (done in Week 1)
2. `tenant.ts` → `tenant.utils.ts` + `tenant.server.ts`
3. `api.ts` → `api.ts` (usually client-safe, no changes)
4. `logger.ts` → `logger.ts` (pure utilities, no changes)
5. `metadata.ts` → `metadata.utils.ts` + `metadata.server.ts`
6. `cache.ts` → `cache.ts` (client-safe, no changes)

**For each:**

```bash
# 1. Identify pure functions
grep -E "^export (async )?function" apps/web/src/lib/$MODULE.ts

# 2. Determine if server-only needed
grep -E "next/headers|next/navigation|cookies|headers" apps/web/src/lib/$MODULE.ts

# 3. If no server imports:
# - No changes needed, keep as-is
# - Rename to .utils.ts if clarity needed
# 4. If has server imports:
# - Create .utils.ts with pure functions
# - Create .server.ts with server functions
# - Update imports in all files
# - Delete original
```

### Week 3: Code Review & Validation

**Full codebase review:**

```bash
# Run all checks
npm run typecheck
npm run lint
npm run build
npm test

# Audit for remaining issues
grep -r "from '@/lib/.*\.server'" apps/web/src/components/  # Should be empty
grep -r "from '@/lib/.*\.server'" apps/web/src/app/         # Only Server Components

# Verify file structure
ls -la apps/web/src/lib/ | grep -E "\.(utils|server)\.ts$"
```

**Run parallel review agents:**

```bash
/workflows:review  # 8-agent comprehensive review

# Expected findings:
# - Any remaining import violations
# - Duplicated logic across .utils/.server
# - Missed pure functions in .server files
# - Documentation gaps
```

**Address findings:**

```markdown
## P1 (24 hours)

- [ ] Import violations fixed
- [ ] Build passes
- [ ] No ESLint errors

## P2 (1 week)

- [ ] Duplicated logic extracted
- [ ] Pure functions moved to .utils
- [ ] Documentation updated

## P3 (backlog)

- [ ] Performance optimizations
- [ ] Additional test coverage
- [ ] Code cleanup
```

---

## Phase 4: Prevention System (ongoing)

### Ongoing: Maintain Standards

**1. Pre-commit Hook**

```bash
#!/bin/bash
# .husky/pre-commit

npm run lint -- apps/web/src/lib/
if [ $? -ne 0 ]; then
  echo "ESLint failed in lib/ - server imports found"
  exit 1
fi

npm run build
if [ $? -ne 0 ]; then
  echo "Build failed - import tainting likely"
  exit 1
fi
```

**2. CI/CD Pipeline**

```yaml
# .github/workflows/build.yml
- name: Check ESLint
  run: npm run lint -- apps/web/src/lib/

- name: Build
  run: npm run build

- name: Type Check
  run: npm run typecheck
```

**3. Code Review Template**

Add to PR template:

```markdown
## Next.js File Organization

- [ ] No `next/headers` imports in components/
- [ ] All server imports in `.server.ts` files
- [ ] ESLint passes on lib/
- [ ] Build succeeds with no import errors
- [ ] README updated if new patterns introduced
```

**4. Documentation**

Update as you discover patterns:

```markdown
## Documented Patterns

### Pattern 1: Auth Utilities

- Location: `src/lib/auth.utils.ts`
- Safe for: Client & Server
- Example: `isAdmin(role)`

### Pattern 2: Auth Server

- Location: `src/lib/auth.server.ts`
- Safe for: Server Components only
- Example: `getBackendToken()`

### Pattern 3: ...
```

---

## Success Criteria

### Build Quality

- ✅ `npm run build` passes in <60 seconds
- ✅ `npm run typecheck` reports zero errors
- ✅ `npm run lint` reports zero violations in lib/
- ✅ No "imported in a Client Component" build errors

### Code Organization

- ✅ All lib files follow .utils / .server pattern
- ✅ Client Components only import from .utils
- ✅ Server Components can import from both
- ✅ No .server.ts files imported by clients

### Team Capability

- ✅ All developers understand file organization
- ✅ New PRs follow pattern without prompting
- ✅ Code review catches violations automatically
- ✅ Documentation is clear and accessible

### Metrics

| Metric                | Before | After | Target |
| --------------------- | ------ | ----- | ------ |
| Build time            | 60s    | 45s   | <60s   |
| Import errors in PRs  | 2-3    | 0     | 0      |
| ESLint violations     | 5-10   | 0     | 0      |
| Files with pattern    | 0%     | 100%  | 100%   |
| Developer time to fix | 30min  | <5min | <5min  |

---

## Troubleshooting

### Issue: "X is marked with 'server-only' but imported in Client"

**Cause:** Client Component importing from .server.ts

**Fix:**

```typescript
// ❌ Wrong
import { getToken } from '@/lib/auth.server';

// ✅ Correct
import { isAdmin } from '@/lib/auth.utils';
```

### Issue: Pure Function in Wrong File

**Cause:** Pure function placed in .server.ts file

**Problem:** Clients can't use it even though it's pure

**Fix:**

```typescript
// ❌ Wrong - in auth.server.ts
export function isAdmin(role?: string) {
  return role === 'ADMIN';
}

// ✅ Correct - in auth.utils.ts
export function isAdmin(role?: string) {
  return role === 'ADMIN';
}
```

### Issue: Build Succeeds Locally but Fails in CI

**Cause:** Different ESLint configuration in CI

**Fix:**

```bash
# Run same build as CI locally
npm run build --prod
npm run lint -- --max-warnings 0
npm run typecheck
```

### Issue: Developers Keep Importing .server

**Cause:** Unclear documentation

**Fix:**

1. Add `server-only` marker to all .server.ts files
2. Add comment at top of .server.ts explaining it's server-only
3. Share NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md link in onboarding

---

## Timeline Summary

| Phase | Duration | Deliverable                      |
| ----- | -------- | -------------------------------- |
| 1     | 2-3 days | Guidelines, ESLint, review setup |
| 2     | 1 week   | First module refactored          |
| 3     | 2 weeks  | Full lib/ refactored             |
| 4     | ongoing  | CI/CD prevention, maintenance    |

**Total: 3-4 weeks** for full implementation

---

## Team Onboarding

### For New Team Members

1. Read: [NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md) (2 min)
2. Read: [NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md](NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md) (15 min)
3. Watch: Code review example PR (showing common mistakes)
4. Practice: Create .utils/.server files in feature branch

### For Code Reviewers

1. Use provided PR review checklist
2. Run `/workflows:review` for complex changes
3. Verify ESLint and build pass before approving
4. Link to documentation when explaining patterns

### For Architects

1. Maintain file organization guidelines
2. Review new .utils/.server patterns for consistency
3. Enforce ESLint rules in CI/CD
4. Update documentation as patterns evolve

---

## Related Resources

- **[NEXTJS_AUDIT_PREVENTION_STRATEGIES.md](NEXTJS_AUDIT_PREVENTION_STRATEGIES.md)** - Comprehensive guide
- **[NEXTJS_AUDIT_QUICK_REFERENCE.md](NEXTJS_AUDIT_QUICK_REFERENCE.md)** - Quick checklist
- **[NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md](NEXTJS_IMPORT_TAINTING_BEST_PRACTICES.md)** - Detailed best practices
- **[ADR-014: Next.js App Router Migration](../../adrs/ADR-014-nextjs-app-router-migration.md)** - Architecture decisions
- **[Next.js Migration Lessons Learned](../code-review-patterns/nextjs-migration-lessons-learned-MAIS-20251225.md)** - Full context

---

## Sign-Off

Use this template to track implementation:

```markdown
## Next.js Audit Prevention Implementation

**Project:** [Your Project]
**Start Date:** [Date]
**Estimated Completion:** [Date]

### Phase 1: Setup

- [ ] Guidelines documented
- [ ] ESLint rules configured
- [ ] Code review process established

### Phase 2: First Migration

- [ ] Module selected: [Module name]
- [ ] .utils.ts created
- [ ] .server.ts created
- [ ] Imports updated
- [ ] Build passes
- [ ] PR reviewed and merged

### Phase 3: Full Migration

- [ ] All lib modules refactored
- [ ] Parallel review completed
- [ ] P1 findings addressed
- [ ] P2 findings scheduled

### Phase 4: Prevention

- [ ] Pre-commit hook installed
- [ ] CI/CD pipeline updated
- [ ] Team trained
- [ ] Documentation complete

**Completion Date:** [Date]
**Status:** ✅ Complete
```

---

**Next Step:** Start with Phase 1 setup, then proceed through phases sequentially.
